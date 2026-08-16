import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Mirrors the canonical PostgreSQL schema onto SQLite for local development.
 *
 * PostgreSQL is the production target — `prisma/schema.prisma` is the real
 * schema and the one that ships. But requiring a running Postgres just to see
 * the app is a bad first five minutes, so this generates a byte-identical
 * schema with the datasource swapped.
 *
 * This is only viable because the schema was written to be portable in the
 * first place: no native enums, no `@db.*` attributes, no `Json` columns. If
 * someone adds a Postgres-only feature, the guard below fails loudly rather
 * than producing a schema that silently drifts from production.
 */

const root = join(import.meta.dirname, "..");
const source = join(root, "prisma", "schema.prisma");
const target = join(root, "prisma", "schema.sqlite.prisma");

const original = readFileSync(source, "utf8");

const PG_ONLY = [
  { pattern: /@db\.\w+/g, name: "@db.* native type attributes" },
  { pattern: /^\s*enum\s+\w+\s*\{/gm, name: "enum blocks" },
  { pattern: /\bJson\b(?!\w)/g, name: "Json scalar columns" },
  { pattern: /@@index\(\[[^\]]*\],\s*type:/g, name: "index type modifiers (GIN/GiST)" },
];

const violations = PG_ONLY.filter((rule) => rule.pattern.test(original)).map((r) => r.name);

if (violations.length > 0) {
  console.error(
    `\n✗ prisma/schema.prisma uses PostgreSQL-only features that SQLite cannot mirror:\n` +
      violations.map((v) => `    • ${v}`).join("\n") +
      `\n\n  Either avoid them, or run a real PostgreSQL instance for development.\n`,
  );
  process.exit(1);
}

const mirrored = original
  .replace(
    /datasource\s+db\s*\{[^}]*\}/,
    `datasource db {\n  provider = "sqlite"\n  url      = env("DATABASE_URL")\n}`,
  )
  .replace(
    /^\/\/ Chhaap — database schema/m,
    `// GENERATED FILE — do not edit.\n` +
      `// Mirror of prisma/schema.prisma with the datasource swapped to SQLite.\n` +
      `// Regenerate with: npm run db:sqlite\n\n// Chhaap — database schema`,
  );

writeFileSync(target, mirrored, "utf8");

console.log(`✓ Wrote ${target.replace(root + "/", "")} (SQLite mirror of the Postgres schema)`);
