import { PrismaClient } from "@prisma/client";
// Deliberately not importing the validated `env` proxy: this module runs at
// import time and must not force full env validation before the app knows
// which storage backend it has.
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
  // Read straight from process.env rather than the validated `env` proxy: this
  // runs at module load, and the proxy would pull in the whole schema before
  // the app has decided whether it even has a database.
  const databaseUrl = process.env.DATABASE_URL;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (databaseUrl) {
    console.log("[db] backend: postgresql");
    return new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
  }

  if (blobToken) {
    console.log("[db] backend: vercel-blob (DATABASE_URL unset)");
    return createBlobClient() as unknown as Db;
  }

  // Neither is configured. Return a client that fails on use rather than at
  // import time, so pages that never touch storage still render.
  console.error("[db] no backend: neither DATABASE_URL nor BLOB_READ_WRITE_TOKEN is set");
  return new PrismaClient({ log: ["error"] });
}

export const db: Db = globalForDb.db ?? build();

if (process.env.NODE_ENV === "development") globalForDb.db = db;

/** True when the deployment can persist accounts and brands. */
export function storageConfigured(): boolean {
  return !!(process.env.DATABASE_URL || process.env.BLOB_READ_WRITE_TOKEN);
}
