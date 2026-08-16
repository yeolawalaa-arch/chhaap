import { db } from "../src/lib/db/client";
import { adminEmails } from "../src/lib/config/env";

/**
 * Promotes accounts to admin.
 *
 * `roleForEmail` only applies the ADMIN_EMAILS allowlist at signup, so an
 * account created before the allowlist existed stays a normal user. This
 * reconciles the two — run it after changing ADMIN_EMAILS.
 *
 *   npx tsx scripts/make-admin.ts                 # everyone in ADMIN_EMAILS
 *   npx tsx scripts/make-admin.ts a@b.com c@d.com # specific addresses
 */

async function main() {
  const requested = process.argv.slice(2).map((e) => e.trim().toLowerCase()).filter(Boolean);
  const targets = requested.length ? requested : adminEmails();

  if (targets.length === 0) {
    console.error(
      "No addresses given and ADMIN_EMAILS is empty.\n" +
        "Pass emails as arguments, or set ADMIN_EMAILS.",
    );
    process.exit(1);
  }

  for (const email of targets) {
    const user = await db.user.findUnique({ where: { email } });

    if (!user) {
      // Not an error: the allowlist can legitimately name someone who has not
      // signed up yet, and roleForEmail will catch them when they do.
      console.log(`  –  ${email} — no account yet (will become admin on signup)`);
      continue;
    }

    if (user.role === "admin") {
      console.log(`  ✓  ${email} — already admin`);
      continue;
    }

    await db.user.update({ where: { id: user.id }, data: { role: "admin" } });
    console.log(`  ✓  ${email} — promoted to admin`);
  }

  console.log("\nAdmins are unmetered: unlimited generations, no watermark, every export format.");
}

main()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect?.());
