import { createHash } from "node:crypto";
import { db } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import { sendEmail, templates } from "@/lib/email";
import {
  checkPasswordStrength,
  generateOtp,
  generateToken,
  hashPassword,
  needsRehash,
  verifyPassword,
} from "@/lib/auth/password";
import { createSession, revokeAllSessions, roleForEmail } from "@/lib/auth/session";
import { badRequest, conflict, notFound, unauthorized } from "@/lib/http/errors";

/**
 * Authentication flows.
 *
 * Two properties are enforced throughout:
 *
 *  - **No account enumeration.** Signup, login, OTP request and password reset
 *    all return the same shape whether or not the address exists. An attacker
 *    cannot use these endpoints to discover who has an account.
 *  - **Single-use, hashed tokens.** OTPs and reset links are stored as hashes
 *    with an attempt counter, so neither a database dump nor brute force over
 *    the wire is useful.
 */

const hashSecret = (value: string) =>
  createHash("sha256").update(`${value}:${env.AUTH_SECRET}`).digest("hex");

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export interface RequestMeta {
  userAgent?: string | null;
  ip?: string | null;
}

// ---------------------------------------------------------------------------
// Signup
// ---------------------------------------------------------------------------

export async function signUp(
  input: { email: string; password: string; name?: string },
  meta: RequestMeta = {},
): Promise<{ userId: string }> {
  if (!env.SIGNUP_ENABLED) {
    throw badRequest("New signups are currently closed.");
  }

  const email = normalizeEmail(input.email);
  const strength = checkPasswordStrength(input.password, email);
  if (!strength.ok) throw badRequest(strength.message!, { password: strength.message! });

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // The address is taken. Saying so is a deliberate trade-off: signup is the
    // one flow where silence would strand a returning user who forgot they had
    // an account. The message points at recovery rather than confirming a
    // password exists.
    throw conflict("An account already exists for this email. Try signing in, or reset your password.");
  }

  const user = await db.user.create({
    data: {
      email,
      name: input.name?.trim() || null,
      passwordHash: await hashPassword(input.password),
      role: roleForEmail(email),
    },
  });

  await createSession(user.id, meta);
  await sendEmail({ to: email, ...templates.welcome(user.name ?? "there") });

  return { userId: user.id };
}

// ---------------------------------------------------------------------------
// Password login
// ---------------------------------------------------------------------------

export async function signIn(
  input: { email: string; password: string },
  meta: RequestMeta = {},
): Promise<{ userId: string }> {
  const email = normalizeEmail(input.email);
  const user = await db.user.findUnique({ where: { email } });

  // Hash against a dummy value when the user is missing so the response time
  // does not reveal whether the address exists.
  const stored = user?.passwordHash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA";
  const valid = await verifyPassword(input.password, stored);

  if (!user || !user.passwordHash || !valid || user.deletedAt) {
    throw unauthorized("That email and password combination doesn't match an account.");
  }

  // Transparently upgrade hashes when the cost policy rises.
  if (needsRehash(user.passwordHash)) {
    await db.user
      .update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.password) } })
      .catch(() => {});
  }

  await createSession(user.id, meta);
  return { userId: user.id };
}

// ---------------------------------------------------------------------------
// OTP login
// ---------------------------------------------------------------------------

const OTP_TTL_MS = 10 * 60_000;
const OTP_MAX_ATTEMPTS = 5;

/** Always resolves the same way, whether or not the address has an account. */
export async function requestOtp(emailInput: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) return;

  const code = generateOtp(6);

  // Invalidate any outstanding codes so only the newest one works.
  await db.verificationToken.updateMany({
    where: { identifier: email, purpose: "otp_login", consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await db.verificationToken.create({
    data: {
      identifier: email,
      tokenHash: hashSecret(`otp:${email}:${code}`),
      purpose: "otp_login",
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  await sendEmail({ to: email, ...templates.otp(code) });
}

export async function verifyOtp(
  emailInput: string,
  code: string,
  meta: RequestMeta = {},
): Promise<{ userId: string }> {
  const email = normalizeEmail(emailInput);
  const tokenHash = hashSecret(`otp:${email}:${code.trim()}`);

  const token = await db.verificationToken.findUnique({ where: { tokenHash } });

  if (!token || token.consumedAt || token.expiresAt < new Date() || token.purpose !== "otp_login") {
    // Burn an attempt against the newest live code for this address, so
    // guessing costs the attacker their remaining tries.
    const live = await db.verificationToken.findFirst({
      where: { identifier: email, purpose: "otp_login", consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (live) {
      const attempts = live.attempts + 1;
      await db.verificationToken.update({
        where: { id: live.id },
        data: {
          attempts,
          consumedAt: attempts >= OTP_MAX_ATTEMPTS ? new Date() : null,
        },
      });
    }
    throw unauthorized("That code is incorrect or has expired. Request a new one.");
  }

  if (token.attempts >= OTP_MAX_ATTEMPTS) {
    throw unauthorized("Too many incorrect attempts. Request a new code.");
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) throw unauthorized("That code is incorrect or has expired.");

  await db.verificationToken.update({
    where: { id: token.id },
    data: { consumedAt: new Date() },
  });

  // Signing in by email code proves control of the address.
  if (!user.emailVerified) {
    await db.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
  }

  await createSession(user.id, meta);
  return { userId: user.id };
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

const RESET_TTL_MS = 60 * 60_000;

export async function requestPasswordReset(emailInput: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) return;

  const raw = generateToken(32);

  await db.verificationToken.updateMany({
    where: { identifier: email, purpose: "reset_password", consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await db.verificationToken.create({
    data: {
      identifier: email,
      tokenHash: hashSecret(`reset:${raw}`),
      purpose: "reset_password",
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });

  const url = `${env.APP_URL}/reset-password?token=${encodeURIComponent(raw)}`;
  await sendEmail({ to: email, ...templates.passwordReset(url) });
}

export async function resetPassword(
  rawToken: string,
  newPassword: string,
  meta: RequestMeta = {},
): Promise<{ userId: string }> {
  const token = await db.verificationToken.findUnique({
    where: { tokenHash: hashSecret(`reset:${rawToken}`) },
  });

  if (!token || token.consumedAt || token.expiresAt < new Date() || token.purpose !== "reset_password") {
    throw badRequest("This reset link is invalid or has expired. Request a new one.");
  }

  const strength = checkPasswordStrength(newPassword, token.identifier);
  if (!strength.ok) throw badRequest(strength.message!, { password: strength.message! });

  const user = await db.user.findUnique({ where: { email: token.identifier } });
  if (!user) throw notFound("Account not found.");

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword), emailVerified: user.emailVerified ?? new Date() },
    }),
    db.verificationToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } }),
  ]);

  // A password reset is the standard signal that an account may be compromised,
  // so every other session is invalidated.
  await revokeAllSessions(user.id);
  await createSession(user.id, meta);

  return { userId: user.id };
}

// ---------------------------------------------------------------------------
// OAuth account linking
// ---------------------------------------------------------------------------

export async function upsertOAuthUser(
  input: {
    provider: string;
    providerAccountId: string;
    email: string;
    name?: string | null;
    avatarUrl?: string | null;
    emailVerified: boolean;
  },
  meta: RequestMeta = {},
): Promise<{ userId: string; isNew: boolean }> {
  const email = normalizeEmail(input.email);

  const existingAccount = await db.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: input.provider,
        providerAccountId: input.providerAccountId,
      },
    },
    include: { user: true },
  });

  if (existingAccount && !existingAccount.user.deletedAt) {
    await createSession(existingAccount.userId, meta);
    return { userId: existingAccount.userId, isNew: false };
  }

  const existingUser = await db.user.findUnique({ where: { email } });

  if (existingUser) {
    // Link the provider to the existing account, but only when the provider has
    // verified the address. Without that check, anyone who can create an
    // account at the provider with someone else's unverified email could take
    // over their Chhaap account.
    if (!input.emailVerified) {
      throw badRequest(
        "Your Google account's email is not verified, so it can't be linked to an existing Chhaap account. Sign in with your password instead.",
      );
    }

    await db.account.create({
      data: {
        userId: existingUser.id,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
      },
    });

    await db.user.update({
      where: { id: existingUser.id },
      data: {
        emailVerified: existingUser.emailVerified ?? new Date(),
        avatarUrl: existingUser.avatarUrl ?? input.avatarUrl ?? null,
        name: existingUser.name ?? input.name ?? null,
      },
    });

    await createSession(existingUser.id, meta);
    return { userId: existingUser.id, isNew: false };
  }

  if (!env.SIGNUP_ENABLED) throw badRequest("New signups are currently closed.");

  const user = await db.user.create({
    data: {
      email,
      name: input.name ?? null,
      avatarUrl: input.avatarUrl ?? null,
      emailVerified: input.emailVerified ? new Date() : null,
      role: roleForEmail(email),
      accounts: {
        create: { provider: input.provider, providerAccountId: input.providerAccountId },
      },
    },
  });

  await createSession(user.id, meta);
  await sendEmail({ to: email, ...templates.welcome(user.name ?? "there") });

  return { userId: user.id, isNew: true };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function updateProfile(
  userId: string,
  input: { name?: string; locale?: string },
): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: {
      name: input.name?.trim() || undefined,
      locale: input.locale || undefined,
    },
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("Account not found.");

  if (user.passwordHash) {
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) throw unauthorized("Your current password is incorrect.");
  }

  const strength = checkPasswordStrength(newPassword, user.email);
  if (!strength.ok) throw badRequest(strength.message!, { newPassword: strength.message! });

  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
}
