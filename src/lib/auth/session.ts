import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db/client";
import { env, adminEmails, isProd } from "@/lib/config/env";
import { generateToken } from "@/lib/auth/password";
import { unauthorized, forbidden } from "@/lib/http/errors";

/**
 * Sessions.
 *
 * The cookie holds a signed JWT, but the JWT is only a pointer: its `sid` claim
 * references a `Session` row, and every request checks that row. That costs one
 * indexed lookup and buys real revocation — "log out everywhere" and admin
 * suspension take effect immediately, which a self-contained JWT cannot do.
 *
 * The raw token never touches the database; only its SHA-256 is stored, so a
 * leaked database dump cannot be replayed as a live session.
 */

const COOKIE_NAME = "chhaap_session";
const ALG = "HS256";

function secret(): Uint8Array {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  locale: string;
}

export interface ActiveSession {
  user: SessionUser;
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<string> {
  const raw = generateToken(32);
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 86_400_000);

  const session = await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      ip: meta.ip ?? null,
      expiresAt,
    },
  });

  const jwt = await new SignJWT({ sid: session.id })
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, `${jwt}.${raw}`, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  await db.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } }).catch(() => {});

  return session.id;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Current session, or null. Never throws — safe in layouts and pages. */
export async function getSession(): Promise<ActiveSession | null> {
  const store = await cookies();
  const cookie = store.get(COOKIE_NAME)?.value;
  if (!cookie) return null;

  // The cookie is `<jwt>.<raw-token>`. The JWT is three dot-separated segments,
  // so the raw token is everything after the fourth dot.
  const parts = cookie.split(".");
  if (parts.length < 4) return null;
  const jwt = parts.slice(0, 3).join(".");
  const raw = parts.slice(3).join(".");
  if (!raw) return null;

  let sid: string;
  try {
    const { payload } = await jwtVerify(jwt, secret(), { algorithms: [ALG] });
    sid = String(payload.sid ?? "");
    if (!sid) return null;
  } catch {
    return null;
  }

  const session = await db.session.findUnique({
    where: { id: sid },
    include: { user: true },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt < new Date() ||
    session.tokenHash !== hashToken(raw) ||
    session.user.deletedAt
  ) {
    return null;
  }

  // Throttled activity tracking — one write per hour per session, not per request.
  if (Date.now() - session.lastActiveAt.getTime() > 3_600_000) {
    db.session
      .update({ where: { id: sid }, data: { lastActiveAt: new Date() } })
      .catch(() => {});
  }

  return {
    sessionId: session.id,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      avatarUrl: session.user.avatarUrl,
      role: session.user.role,
      locale: session.user.locale,
    },
  };
}

/** Session or 401. Use in API routes and protected server components. */
export async function requireSession(): Promise<ActiveSession> {
  const session = await getSession();
  if (!session) throw unauthorized();
  return session;
}

export async function requireUser(): Promise<SessionUser> {
  return (await requireSession()).user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw forbidden("This area is restricted to administrators.");
  return user;
}

// ---------------------------------------------------------------------------
// Destruction
// ---------------------------------------------------------------------------

export async function destroySession(): Promise<void> {
  const session = await getSession();
  if (session) {
    await db.session
      .update({ where: { id: session.sessionId }, data: { revokedAt: new Date() } })
      .catch(() => {});
  }
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Revokes every session for a user — "log out everywhere". */
export async function revokeAllSessions(userId: string): Promise<number> {
  const { count } = await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count;
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/** Admin status is granted from the ADMIN_EMAILS allowlist at signup. */
export function roleForEmail(email: string): string {
  return adminEmails().includes(email.trim().toLowerCase()) ? "admin" : "user";
}

export const SESSION_COOKIE = COOKIE_NAME;
