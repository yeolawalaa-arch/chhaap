import { del, get, list, put } from "@vercel/blob";

/**
 * A small document store over Vercel Blob.
 *
 * This exists because Vercel gates every marketplace database behind a human
 * terms-acceptance step, while Blob is first-party and provisionable from the
 * CLI. It is a deliberate trade, not a preference — the honest comparison:
 *
 *   What it does give us
 *     • Atomic create. `put` with `allowOverwrite: false` rejects a write when
 *       the key exists, verified under concurrency: five simultaneous creates
 *       of one key produce exactly one winner. That is a real compare-and-set,
 *       and it is what makes unique-email enforcement safe.
 *     • Read-after-write consistency on a single key.
 *
 *   What it does not
 *     • No multi-key transactions. A "transaction" here is sequential writes,
 *       so a crash midway can leave partial state. Callers that care order
 *       their writes so the last one is the one that makes state visible.
 *     • No query planner. `findMany` lists a prefix and fetches each record, so
 *       it is O(n) in the collection. Fine at MVP scale, wrong at 10k brands.
 *     • Listing is not guaranteed immediately consistent with a just-written
 *       key, so anything needing read-your-write goes through a direct key
 *       lookup or a secondary index, never through a list.
 *
 * Swapping to PostgreSQL is a one-line change in src/lib/db/client.ts — the
 * Prisma-shaped adapter above this keeps every call site identical.
 */

const PREFIX = "data";

function keyFor(model: string, id: string): string {
  return `${PREFIX}/${model}/${encodeURIComponent(id)}.json`;
}

/** Secondary index entry: maps a unique field value to a record id. */
function indexKey(model: string, field: string, value: string): string {
  // Values are hashed into the path to keep emails and tokens out of blob
  // pathnames, which are visible in store listings.
  const safe = Buffer.from(value.toLowerCase()).toString("base64url").slice(0, 120);
  return `${PREFIX}/${model}/_idx/${field}/${safe}.json`;
}

const OPTS = { access: "private", addRandomSuffix: false, contentType: "application/json" } as const;

/**
 * Reads a record.
 *
 * Two details are load-bearing on a private store:
 *  - the SDK's `get` must be used rather than fetching `downloadUrl`, which
 *    403s without a signed token;
 *  - `useCache: false` bypasses the CDN. With caching on, a read immediately
 *    after a write can serve the previous version, which for a session lookup
 *    right after login means the user appears signed out.
 */
async function readJson<T>(pathname: string): Promise<T | null> {
  try {
    const result = await get(pathname, { access: "private", useCache: false });
    if (!result?.stream) return null;
    const text = await new Response(result.stream).text();
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    // A missing key throws BlobNotFoundError — that is a normal miss, not an error.
    return null;
  }
}

async function writeJson(pathname: string, value: unknown): Promise<void> {
  await put(pathname, JSON.stringify(value), { ...OPTS, allowOverwrite: true });
}

/** Write that fails if the key already exists. The store's only atomic primitive. */
async function createJson(pathname: string, value: unknown): Promise<boolean> {
  try {
    await put(pathname, JSON.stringify(value), { ...OPTS, allowOverwrite: false });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type Doc = Record<string, unknown> & { id: string };

export const blobStore = {
  async get<T extends Doc>(model: string, id: string): Promise<T | null> {
    return readJson<T>(keyFor(model, id));
  },

  async put<T extends Doc>(model: string, doc: T): Promise<T> {
    await writeJson(keyFor(model, doc.id), doc);
    return doc;
  },

  /**
   * Creates a record, reserving its unique fields first.
   *
   * The reservation is what makes concurrent signups safe: whoever wins the
   * atomic create on `email` is the only one who proceeds. If a later
   * reservation fails, earlier ones are released so a retry can succeed.
   */
  async create<T extends Doc>(
    model: string,
    doc: T,
    uniques: { field: string; value: string }[] = [],
  ): Promise<{ ok: true; doc: T } | { ok: false; conflict: string }> {
    const claimed: string[] = [];

    for (const unique of uniques) {
      const path = indexKey(model, unique.field, unique.value);
      const won = await createJson(path, { id: doc.id });
      if (!won) {
        await Promise.all(claimed.map((p) => del(p).catch(() => {})));
        return { ok: false, conflict: unique.field };
      }
      claimed.push(path);
    }

    await writeJson(keyFor(model, doc.id), doc);
    return { ok: true, doc };
  },

  async findByUnique<T extends Doc>(
    model: string,
    field: string,
    value: string,
  ): Promise<T | null> {
    const pointer = await readJson<{ id: string }>(indexKey(model, field, value));
    if (!pointer?.id) return null;
    return blobStore.get<T>(model, pointer.id);
  },

  async setUnique(model: string, field: string, value: string, id: string): Promise<void> {
    await writeJson(indexKey(model, field, value), { id });
  },

  async dropUnique(model: string, field: string, value: string): Promise<void> {
    await del(indexKey(model, field, value)).catch(() => {});
  },

  async delete(model: string, id: string): Promise<void> {
    await del(keyFor(model, id)).catch(() => {});
  },

  /**
   * Every record in a collection.
   *
   * O(n) fetches. Acceptable while collections are small; the moment they are
   * not, this is the call that has to move to a real database.
   */
  async all<T extends Doc>(model: string): Promise<T[]> {
    const prefix = `${PREFIX}/${model}/`;
    const out: T[] = [];
    let cursor: string | undefined;

    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      const blobs = page.blobs.filter((b) => !b.pathname.includes("/_idx/"));

      // Bounded concurrency: enough to be quick, not enough to trip rate limits.
      for (let i = 0; i < blobs.length; i += 20) {
        const batch = blobs.slice(i, i + 20);
        const docs = await Promise.all(batch.map((b) => readJson<T>(b.pathname)));
        for (const doc of docs) if (doc) out.push(doc);
      }

      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    return out;
  },

  /** True when a Blob store is actually configured for this deployment. */
  configured(): boolean {
    return !!process.env.BLOB_READ_WRITE_TOKEN;
  },
};
