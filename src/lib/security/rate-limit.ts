import { createHash } from "node:crypto";
import { db } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import { rateLimited } from "@/lib/http/errors";

/**
 * Fixed-window rate limiting backed by the primary database.
 *
 * The DB is the right default here: it needs no extra infrastructure, and the
 * limits that matter (signup, OTP, AI generation, export) are low-frequency.
 * Swapping in Redis later means reimplementing `consume` only — every call site
 * goes through `enforce`.
 */

export interface RateLimitRule {
  /** Stable name; becomes part of the bucket key. */
  name: string;
  limit: number;
  windowSec: number;
}

export const RULES = {
  authAttempt: { name: "auth", limit: 10, windowSec: 15 * 60 },
  signup: { name: "signup", limit: 5, windowSec: 60 * 60 },
  otpRequest: { name: "otp", limit: 5, windowSec: 15 * 60 },
  passwordReset: { name: "reset", limit: 5, windowSec: 60 * 60 },
  aiGenerate: { name: "ai", limit: 40, windowSec: 60 * 60 },
  nameGenerate: { name: "names", limit: 60, windowSec: 60 * 60 },
  exportAsset: { name: "export", limit: 120, windowSec: 60 * 60 },
  domainCheck: { name: "domain", limit: 60, windowSec: 10 * 60 },
  publicRead: { name: "public", limit: 300, windowSec: 60 * 60 },
  mutate: { name: "mutate", limit: 600, windowSec: 60 * 60 },
} as const satisfies Record<string, RateLimitRule>;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSec: number;
}

function bucketKey(rule: RateLimitRule, identity: string, windowStart: number) {
  const raw = `${rule.name}:${identity}:${windowStart}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 40);
}

/**
 * Process-local fallback counters.
 *
 * Used only when the database is unreachable. It is per-instance, so a
 * horizontally scaled deployment enforces the limit per instance rather than
 * globally — weaker than the DB path, but the alternative when the DB is down
 * is either failing every request or applying no limit at all, and an
 * approximate limit beats an open door on a public generation endpoint.
 */
const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

function consumeInMemory(key: string, limit: number, resetAt: Date, now: number): RateLimitResult {
  // Opportunistic sweep; this map only grows with distinct clients per window.
  if (memoryBuckets.size > 10_000) {
    for (const [k, v] of memoryBuckets) if (v.resetAt < now) memoryBuckets.delete(k);
  }

  const existing = memoryBuckets.get(key);
  const bucket =
    existing && existing.resetAt > now ? existing : { count: 0, resetAt: resetAt.getTime() };
  bucket.count += 1;
  memoryBuckets.set(key, bucket);

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt,
    retryAfterSec: Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000)),
  };
}

export async function consume(rule: RateLimitRule, identity: string): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = rule.windowSec * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = new Date(windowStart + windowMs);
  const key = bucketKey(rule, identity, windowStart);

  if (!env.RATE_LIMIT_ENABLED) {
    return { allowed: true, remaining: rule.limit, resetAt, retryAfterSec: 0 };
  }

  try {
    // Upsert-then-read keeps this a single round trip in the common case.
    const row = await db.rateLimit.upsert({
      where: { bucket: key },
      create: { bucket: key, count: 1, expiresAt: resetAt },
      update: { count: { increment: 1 } },
    });

    return {
      allowed: row.count <= rule.limit,
      remaining: Math.max(0, rule.limit - row.count),
      resetAt,
      retryAfterSec: Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000)),
    };
  } catch {
    // The database is unavailable. Guest generation must still be limited, so
    // fall back rather than letting the request through unchecked.
    return consumeInMemory(key, rule.limit, resetAt, now);
  }
}

/** Consume a token, throwing a 429 `AppError` when the window is exhausted. */
export async function enforce(rule: RateLimitRule, identity: string): Promise<void> {
  const result = await consume(rule, identity);
  if (!result.allowed) {
    const mins = Math.ceil(result.retryAfterSec / 60);
    throw rateLimited(
      `Too many requests. Please try again in ${mins} minute${mins === 1 ? "" : "s"}.`,
      result.retryAfterSec,
    );
  }
}

/** Best-effort cleanup, called opportunistically from the admin dashboard. */
export async function purgeExpired(): Promise<number> {
  const { count } = await db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return count;
}

/**
 * Client identity for anonymous rate limiting. Trusts the first hop of
 * `x-forwarded-for` only, which is correct behind a single reverse proxy.
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}
