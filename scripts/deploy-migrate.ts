import { execSync } from "node:child_process";

/**
 * Runs pending migrations during a deploy.
 *
 * The distinction that matters: a *missing* DATABASE_URL means the database has
 * not been provisioned yet, and the build should still produce a working
 * marketing site. A *present but failing* DATABASE_URL means something is
 * genuinely broken, and shipping on top of an un-migrated schema would put the
 * app live in a state where every signup 500s. So the first case warns and the
 * second fails the build.
 */

const url = process.env.DATABASE_URL;

if (!url) {
  console.warn(
    [
      "",
      "⚠  DATABASE_URL is not set — skipping migrations.",
      "",
      "   The build will continue and the marketing pages will render, but",
      "   anything requiring an account (signup, dashboard, brand creation)",
      "   will fail until a database is connected.",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

// A placeholder left over from a template would otherwise produce a confusing
// connection error deep in Prisma's output.
if (url.includes("user:password@localhost")) {
  console.error("✗ DATABASE_URL is still the .env.example placeholder. Set a real connection string.");
  process.exit(1);
}

console.log("→ Applying migrations…");

try {
  execSync("prisma migrate deploy", { stdio: "inherit" });
  console.log("✓ Migrations applied.");
} catch {
  console.error(
    [
      "",
      "✗ Migrations failed against the configured DATABASE_URL.",
      "",
      "  Failing the build deliberately: deploying application code against an",
      "  un-migrated schema would put the site live in a broken state.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
