import { PrismaClient } from "@prisma/client";
import { isDev } from "@/lib/config/env";
import { createBlobClient } from "@/lib/store/adapter";

/**
 * Database client selection.
 *
 * PostgreSQL is the real target and takes priority whenever `DATABASE_URL` is
 * set. When it is not, the app falls back to a Blob-backed document store that
 * exposes the same Prisma-shaped API, so accounts and saved brands work on a
 * deployment with no provisioned database.
 *
 * The fallback is a genuine trade-off, documented in blob-store.ts: atomic
 * single-key creates (which is what keeps unique emails safe) but no
 * multi-key transactions and O(n) list queries. Setting `DATABASE_URL` moves
 * everything back onto Postgres with no other change.
 */

type Db = PrismaClient;

const globalForDb = globalThis as unknown as { db?: Db };

function build(): Db {
  if (process.env.DATABASE_URL) {
    return new PrismaClient({ log: isDev() ? ["warn", "error"] : ["error"] });
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn(
      "[db] DATABASE_URL is not set — using the Blob-backed store. " +
        "Set DATABASE_URL to move onto PostgreSQL.",
    );
    return createBlobClient() as unknown as Db;
  }

  // Neither is configured. Return a client that fails on use rather than at
  // import time, so pages that never touch the database still render.
  console.error("[db] No DATABASE_URL and no BLOB_READ_WRITE_TOKEN — storage is unavailable.");
  return new PrismaClient({ log: ["error"] });
}

export const db: Db = globalForDb.db ?? build();

if (isDev()) globalForDb.db = db;

/** True when the deployment can persist accounts and brands. */
export function storageConfigured(): boolean {
  return !!(process.env.DATABASE_URL || process.env.BLOB_READ_WRITE_TOKEN);
}
