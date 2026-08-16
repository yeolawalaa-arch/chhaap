/**
 * JSON columns are stored as `String` so the schema runs unchanged on both
 * PostgreSQL and SQLite. These helpers are the only place that serialisation
 * happens, and they never throw on malformed data — a corrupt row degrades to
 * the supplied fallback instead of 500-ing a whole page.
 */

export function encodeJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function decodeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (raw === null || raw === undefined || raw === "") return fallback;
  try {
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

/** Decode-or-null, for genuinely optional payloads. */
export function decodeJsonOrNull<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
