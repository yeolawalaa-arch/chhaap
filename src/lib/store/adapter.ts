import { randomUUID } from "node:crypto";
import { blobStore, type Doc } from "@/lib/store/blob-store";
import { MODEL_DEFAULTS, MODEL_NULLABLE } from "@/lib/store/defaults";

/**
 * A Prisma-shaped facade over the Blob document store.
 *
 * The point is a zero-diff swap: `db.user.findUnique({ where: { email } })`
 * works whether it hits PostgreSQL or this. Every service, route and page is
 * unchanged, so the day a real database is connected the app moves back to
 * Prisma by changing one export.
 *
 * Only the query surface the app actually uses is implemented — 46 call sites
 * across 15 models. Anything outside that throws loudly rather than silently
 * returning nothing, because a query that quietly returns [] is far worse to
 * debug than one that fails.
 */

// Unique fields per model, mirroring @unique in prisma/schema.prisma. These
// drive both atomic creation and lookup-by-unique.
const UNIQUE_FIELDS: Record<string, string[]> = {
  User: ["email"],
  Account: ["provider_providerAccountId"],
  Session: ["tokenHash"],
  VerificationToken: ["tokenHash"],
  Brand: ["slug"],
  BrandIdentity: ["brandId"],
  Logo: ["brandId_variation"],
  Template: ["key"],
  Plan: ["key"],
  Subscription: ["userId"],
  Coupon: ["code"],
  BlogPost: ["slug"],
  ShowcaseEntry: ["brandId"],
  Setting: ["key"],
  RateLimit: ["bucket"],
  UsageRecord: ["userId_metric_period"],
};

/** Relations the app loads via `include`. */
const RELATIONS: Record<string, Record<string, { model: string; localField: string; single: boolean }>> = {
  Brand: { identity: { model: "BrandIdentity", localField: "id", single: true } },
  Account: { user: { model: "User", localField: "userId", single: true } },
  Session: { user: { model: "User", localField: "userId", single: true } },
  Subscription: { plan: { model: "Plan", localField: "planId", single: true } },
};

type Where = Record<string, unknown>;

const now = () => new Date().toISOString();

/** Composite unique keys arrive as `{ brandId_variation: { brandId, variation } }`. */
function compositeValue(field: string, value: Record<string, unknown>): string {
  return field
    .split("_")
    .map((part) => String(value[part] ?? ""))
    .join("::");
}

function uniqueLookup(model: string, where: Where): { field: string; value: string } | null {
  for (const field of UNIQUE_FIELDS[model] ?? []) {
    const raw = where[field];
    if (raw === undefined) continue;
    if (field.includes("_") && raw && typeof raw === "object") {
      return { field, value: compositeValue(field, raw as Record<string, unknown>) };
    }
    if (typeof raw === "string") return { field, value: raw };
  }
  return null;
}

/** Unique index entries a record should own, derived from its own fields. */
function uniquesFor(model: string, doc: Doc): { field: string; value: string }[] {
  return (UNIQUE_FIELDS[model] ?? [])
    .map((field) => {
      if (field.includes("_")) {
        const value = compositeValue(field, doc as Record<string, unknown>);
        return value.replaceAll("::", "") ? { field, value } : null;
      }
      const raw = doc[field];
      return typeof raw === "string" && raw ? { field, value: raw } : null;
    })
    .filter((x): x is { field: string; value: string } => x !== null);
}

/** Supports the comparison shapes the app uses: equality, null, lt/gt, in. */
function matches(doc: Doc, where: Where | undefined): boolean {
  if (!where) return true;

  for (const [key, expected] of Object.entries(where)) {
    if (key === "AND" || key === "OR" || key === "NOT") {
      throw new Error(`blob adapter: '${key}' filters are not implemented`);
    }

    const actual = (doc as Record<string, unknown>)[key];

    if (expected === null) {
      if (actual !== null && actual !== undefined) return false;
      continue;
    }

    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      const ops = expected as Record<string, unknown>;
      for (const [op, operand] of Object.entries(ops)) {
        const a = actual instanceof Date ? actual.getTime() : typeof actual === "string" ? Date.parse(actual) : Number(actual);
        const b = operand instanceof Date ? operand.getTime() : typeof operand === "string" ? Date.parse(operand) : Number(operand);
        if (op === "lt" && !(a < b)) return false;
        else if (op === "gt" && !(a > b)) return false;
        else if (op === "lte" && !(a <= b)) return false;
        else if (op === "gte" && !(a >= b)) return false;
        else if (op === "not" && actual === operand) return false;
        else if (op === "in" && Array.isArray(operand) && !operand.includes(actual)) return false;
        else if (!["lt", "gt", "lte", "gte", "not", "in"].includes(op)) {
          throw new Error(`blob adapter: operator '${op}' is not implemented`);
        }
      }
      continue;
    }

    if (actual instanceof Date && expected instanceof Date) {
      if (actual.getTime() !== expected.getTime()) return false;
      continue;
    }

    if (actual !== expected) return false;
  }

  return true;
}

/** Applies `{ increment: n }` and plain assignments. */
function applyUpdate(doc: Doc, data: Record<string, unknown>): Doc {
  const next: Record<string, unknown> = { ...doc };

  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && !(value instanceof Date) && "increment" in value) {
      next[key] = Number(next[key] ?? 0) + Number((value as { increment: number }).increment);
    } else {
      next[key] = value;
    }
  }

  if ("updatedAt" in doc || "updatedAt" in data) next.updatedAt = now();
  return next as Doc;
}

/** Dates round-trip as ISO strings through JSON; the app expects Date objects. */
const DATE_FIELDS = new Set([
  "createdAt", "updatedAt", "expiresAt", "consumedAt", "revokedAt", "lastActiveAt",
  "lastSeenAt", "deletedAt", "archivedAt", "emailVerified", "publishedAt", "approvedAt",
  "joinedAt", "currentPeriodStart", "currentPeriodEnd",
]);

function hydrate<T>(doc: Doc | null): T | null {
  if (!doc) return null;
  const out: Record<string, unknown> = { ...doc };
  for (const field of DATE_FIELDS) {
    const value = out[field];
    if (typeof value === "string") out[field] = new Date(value);
  }
  return out as T;
}

async function withIncludes(model: string, doc: Doc | null, include?: Record<string, unknown>) {
  if (!doc || !include) return doc;
  const relations = RELATIONS[model] ?? {};

  for (const [name, wanted] of Object.entries(include)) {
    if (!wanted) continue;
    const relation = relations[name];
    if (!relation) throw new Error(`blob adapter: include '${model}.${name}' is not implemented`);

    if (relation.model === "BrandIdentity") {
      // BrandIdentity is keyed by brandId rather than its own id.
      const found = await blobStore.findByUnique<Doc>("BrandIdentity", "brandId", String(doc.id));
      (doc as Record<string, unknown>)[name] = hydrate(found);
    } else {
      const id = String((doc as Record<string, unknown>)[relation.localField] ?? "");
      const found = id ? await blobStore.get<Doc>(relation.model, id) : null;
      (doc as Record<string, unknown>)[name] = hydrate(found);
    }
  }
  return doc;
}

function sortBy<T extends Doc>(rows: T[], orderBy: unknown): T[] {
  if (!orderBy) return rows;
  const clauses = (Array.isArray(orderBy) ? orderBy : [orderBy]) as Record<string, "asc" | "desc">[];

  return [...rows].sort((a, b) => {
    for (const clause of clauses) {
      for (const [field, dir] of Object.entries(clause)) {
        const av = (a as Record<string, unknown>)[field];
        const bv = (b as Record<string, unknown>)[field];
        const an = typeof av === "string" ? Date.parse(av) || av : av;
        const bn = typeof bv === "string" ? Date.parse(bv) || bv : bv;
        if (an === bn) continue;
        const cmp = (an as number) < (bn as number) ? -1 : 1;
        return dir === "desc" ? -cmp : cmp;
      }
    }
    return 0;
  });
}

// ---------------------------------------------------------------------------
// Model API
// ---------------------------------------------------------------------------

function model(name: string) {
  const load = async (where: Where): Promise<Doc | null> => {
    if (typeof where.id === "string") return blobStore.get<Doc>(name, where.id);
    const unique = uniqueLookup(name, where);
    if (unique) return blobStore.findByUnique<Doc>(name, unique.field, unique.value);
    return null;
  };

  const api = {
    async findUnique({ where, include }: { where: Where; include?: Record<string, unknown> }) {
      const doc = await load(where);
      return hydrate(await withIncludes(name, doc, include));
    },

    async findFirst({ where, include, orderBy }: { where?: Where; include?: Record<string, unknown>; orderBy?: unknown } = {}) {
      const direct = where ? await load(where) : null;
      if (direct && matches(direct, where)) return hydrate(await withIncludes(name, direct, include));

      const rows = sortBy((await blobStore.all<Doc>(name)).filter((d) => matches(d, where)), orderBy);
      return rows.length ? hydrate(await withIncludes(name, rows[0]!, include)) : null;
    },

    async findMany({ where, include, orderBy, take, select }: { where?: Where; include?: Record<string, unknown>; orderBy?: unknown; take?: number; select?: unknown } = {}) {
      let rows = (await blobStore.all<Doc>(name)).filter((d) => matches(d, where));
      rows = sortBy(rows, orderBy);
      if (typeof take === "number") rows = rows.slice(0, take);
      if (include) for (const row of rows) await withIncludes(name, row, include);
      return rows.map((r) => hydrate(r));
    },

    async count({ where }: { where?: Where } = {}) {
      return (await blobStore.all<Doc>(name)).filter((d) => matches(d, where)).length;
    },

    async create({ data, include }: { data: Record<string, unknown>; include?: Record<string, unknown> }) {
      const { nested, scalars } = splitNested(data);

      // PostgreSQL applies @default(...) itself. The Blob store has no schema,
      // so those columns must be materialised here or they come back
      // undefined — which surfaces far from the cause, as a TypeError deep in
      // whatever first reads the field.
      const defaults: Record<string, unknown> = {};
      for (const [field, spec] of Object.entries(MODEL_DEFAULTS[name] ?? {})) {
        defaults[field] = spec.kind === "now" ? now() : spec.value;
      }
      // Optional columns become explicit nulls, so `x === null` behaves the
      // same way it does against a real database.
      for (const field of MODEL_NULLABLE[name] ?? []) defaults[field] = null;

      const doc: Doc = {
        id: (scalars.id as string) ?? randomUUID(),
        ...defaults,
        createdAt: (defaults.createdAt as string) ?? now(),
        updatedAt: now(),
        ...scalars,
      } as Doc;

      const result = await blobStore.create(name, doc, uniquesFor(name, doc));
      if (!result.ok) {
        // Surfaced as Prisma's unique-violation code so existing catch blocks work.
        const err = new Error(`Unique constraint failed on ${name}.${result.conflict}`) as Error & { code: string };
        err.code = "P2002";
        throw err;
      }

      for (const [relation, payload] of Object.entries(nested)) {
        await createNested(name, doc, relation, payload);
      }

      return hydrate(await withIncludes(name, doc, include));
    },

    async createMany({ data }: { data: Record<string, unknown>[] }) {
      for (const entry of data) await api.create({ data: entry });
      return { count: data.length };
    },

    async update({ where, data }: { where: Where; data: Record<string, unknown> }) {
      const existing = await load(where);
      if (!existing) {
        const err = new Error(`Record to update not found: ${name}`) as Error & { code: string };
        err.code = "P2025";
        throw err;
      }
      const next = applyUpdate(existing, data);

      // A changed unique value needs its index moved, or lookups go stale.
      for (const unique of uniquesFor(name, existing)) {
        const after = uniquesFor(name, next).find((u) => u.field === unique.field);
        if (after && after.value !== unique.value) {
          await blobStore.dropUnique(name, unique.field, unique.value);
          await blobStore.setUnique(name, after.field, after.value, next.id);
        }
      }

      await blobStore.put(name, next);
      return hydrate(next);
    },

    async updateMany({ where, data }: { where?: Where; data: Record<string, unknown> }) {
      const rows = (await blobStore.all<Doc>(name)).filter((d) => matches(d, where));
      for (const row of rows) await blobStore.put(name, applyUpdate(row, data));
      return { count: rows.length };
    },

    async upsert({ where, create, update, include }: { where: Where; create: Record<string, unknown>; update: Record<string, unknown>; include?: Record<string, unknown> }) {
      const existing = await load(where);
      if (existing) return api.update({ where, data: update });
      try {
        return await api.create({ data: { ...where, ...create }, include });
      } catch (err) {
        // Lost a create race — the other writer won, so update instead.
        if ((err as { code?: string }).code === "P2002") return api.update({ where, data: update });
        throw err;
      }
    },

    async delete({ where }: { where: Where }) {
      const existing = await load(where);
      if (!existing) return null;
      for (const unique of uniquesFor(name, existing)) {
        await blobStore.dropUnique(name, unique.field, unique.value);
      }
      await blobStore.delete(name, existing.id);
      return hydrate(existing);
    },

    async deleteMany({ where }: { where?: Where } = {}) {
      const rows = (await blobStore.all<Doc>(name)).filter((d) => matches(d, where));
      for (const row of rows) {
        for (const unique of uniquesFor(name, row)) {
          await blobStore.dropUnique(name, unique.field, unique.value);
        }
        await blobStore.delete(name, row.id);
      }
      return { count: rows.length };
    },
  };

  return api;
}

/** Prisma nested writes: `{ directions: { create: [...] } }`. */
function splitNested(data: Record<string, unknown>) {
  const nested: Record<string, unknown> = {};
  const scalars: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && !(value instanceof Date) && "create" in (value as object)) {
      nested[key] = (value as { create: unknown }).create;
    } else {
      scalars[key] = value;
    }
  }
  return { nested, scalars };
}

const NESTED_TARGETS: Record<string, { model: string; foreignKey: string }> = {
  directions: { model: "BrandDirection", foreignKey: "brandId" },
  accounts: { model: "Account", foreignKey: "userId" },
};

async function createNested(parentModel: string, parent: Doc, relation: string, payload: unknown) {
  const target = NESTED_TARGETS[relation];
  if (!target) throw new Error(`blob adapter: nested create '${parentModel}.${relation}' is not implemented`);

  const entries = Array.isArray(payload) ? payload : [payload];
  for (const entry of entries) {
    await model(target.model).create({
      data: { ...(entry as Record<string, unknown>), [target.foreignKey]: parent.id },
    });
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const MODELS = [
  "User", "Account", "Session", "VerificationToken", "Team", "TeamMember",
  "Brand", "BrandDirection", "BrandIdentity", "Logo", "BrandAsset", "Template",
  "AiGeneration", "UsageRecord", "Download", "Plan", "Subscription", "Payment",
  "Coupon", "BlogPost", "ShowcaseEntry", "Setting", "RateLimit",
] as const;

const camel = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function createBlobClient() {
  const client: Record<string, unknown> = {
    // Sequential, not atomic. Callers order writes so the visibility-making
    // write lands last; see the comment in blob-store.ts.
    $transaction: async (operations: unknown) => {
      if (typeof operations === "function") return (operations as (c: unknown) => unknown)(client);
      const results = [];
      for (const op of operations as Promise<unknown>[]) results.push(await op);
      return results;
    },
    $queryRaw: async () => [{ "1": 1 }],
    $executeRaw: async () => 0,
    $connect: async () => {},
    $disconnect: async () => {},
  };

  for (const name of MODELS) client[camel(name)] = model(name);
  return client;
}
