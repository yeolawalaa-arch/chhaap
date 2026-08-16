import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Operational health.
 *
 * Reports *presence* of configuration, never values. This exists because
 * "storage is misconfigured" is otherwise only visible as a 503 on signup, and
 * distinguishing "no database" from "database unreachable" from "env var not
 * reaching the runtime" by guesswork wastes far more time than an endpoint.
 */
export async function GET() {
  const has = (key: string) => Boolean(process.env[key]);

  // Reported by the module that actually chose, not re-derived here — the two
  // disagreeing is exactly the confusion this endpoint exists to prevent.
  const { db, activeBackend } = await import("@/lib/db/client");

  // Prove the chosen backend actually answers, rather than only that a
  // variable exists.
  let storageOk = false;
  let storageError: string | null = null;
  try {
    await db.user.count();
    storageOk = true;
  } catch (err) {
    storageError = (err as Error).message.slice(0, 200);
  }

  return NextResponse.json(
    {
      ok: storageOk,
      backend: activeBackend,
      storage: { reachable: storageOk, error: storageError },
      config: {
        DATABASE_URL: has("DATABASE_URL"),
        BLOB_READ_WRITE_TOKEN: has("BLOB_READ_WRITE_TOKEN"),
        AUTH_SECRET: has("AUTH_SECRET"),
        APP_URL: process.env.APP_URL ?? null,
        VERCEL_ENV: process.env.VERCEL_ENV ?? null,
      },
      // Names only — helps spot a token that landed under an unexpected key.
      blobRelatedKeys: Object.keys(process.env).filter((k) => /BLOB|STORE/i.test(k)),
    },
    { status: storageOk ? 200 : 503 },
  );
}
