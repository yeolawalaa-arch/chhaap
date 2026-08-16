import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: { N?: number; r?: number; p?: number; maxmem?: number },
) => Promise<Buffer>;

/**
 * Password hashing with scrypt from Node's standard library.
 *
 * scrypt is memory-hard and built in, which avoids a native bcrypt/argon2
 * dependency that has to be recompiled for every deploy target. Parameters are
 * stored inside the hash string, so they can be raised later without
 * invalidating existing passwords — `needsRehash` detects the old ones and the
 * login path upgrades them transparently.
 */

const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 64;
const SALT_LEN = 16;
// scrypt needs roughly 128 * N * r bytes; Node's default cap is too low for N=16384.
const MAX_MEM = 64 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const derived = await scrypt(password.normalize("NFKC"), salt, KEY_LEN, {
    ...PARAMS,
    maxmem: MAX_MEM,
  });
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!N || !r || !p) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4]!, "base64");
    expected = Buffer.from(parts[5]!, "base64");
  } catch {
    return false;
  }

  const derived = await scrypt(password.normalize("NFKC"), salt, expected.length, {
    N,
    r,
    p,
    maxmem: MAX_MEM,
  });

  // Length check first: timingSafeEqual throws on mismatched lengths.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** True when a stored hash uses weaker parameters than the current policy. */
export function needsRehash(stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return true;
  return Number(parts[1]) < PARAMS.N;
}

// ---------------------------------------------------------------------------
// Password policy
// ---------------------------------------------------------------------------

/** Passwords that are common enough to be tried first in any credential attack. */
const BANNED = new Set([
  "password", "12345678", "123456789", "qwerty123", "password1", "india@123",
  "welcome1", "abc12345", "iloveyou", "admin123", "letmein1", "chhaap123",
]);

export interface PasswordCheck {
  ok: boolean;
  message?: string;
}

export function checkPasswordStrength(password: string, email?: string): PasswordCheck {
  if (password.length < 8) return { ok: false, message: "Use at least 8 characters." };
  if (password.length > 200) return { ok: false, message: "That password is too long." };
  if (BANNED.has(password.toLowerCase())) {
    return { ok: false, message: "That password is too common. Pick something less predictable." };
  }
  if (email) {
    const local = email.split("@")[0]?.toLowerCase();
    if (local && local.length > 2 && password.toLowerCase().includes(local)) {
      return { ok: false, message: "Your password should not contain your email address." };
    }
  }
  if (/^(.)\1+$/.test(password)) {
    return { ok: false, message: "Your password cannot be a single repeated character." };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// One-time codes
// ---------------------------------------------------------------------------

/** Numeric OTP, generated from a CSPRNG rather than Math.random. */
export function generateOtp(digits = 6): string {
  const max = 10 ** digits;
  // Rejection sampling keeps the distribution uniform across the range.
  let value: number;
  do {
    value = randomBytes(4).readUInt32BE(0);
  } while (value >= Math.floor(0xffffffff / max) * max);
  return String(value % max).padStart(digits, "0");
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
