import { existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { allFontFiles } from "../src/lib/fonts/catalog";

/**
 * Downloads the catalogue's TTFs from Google Fonts into `assets/fonts/`.
 *
 * TTF specifically, not WOFF2: the same files are embedded into PDF exports by
 * pdfkit, which cannot read WOFF. Fetching once at setup means the running app
 * never depends on Google Fonts being reachable — important for a product whose
 * users are on Indian networks, and required for the PDF pipeline to be
 * reproducible.
 *
 * Every family here is OFL-licensed, so embedding them in user exports is
 * permitted for commercial use.
 */

// Fonts live under `public/` so one copy serves both jobs: the browser loads
// them via @font-face, and the PDF pipeline reads the same files off disk to
// embed them. Keeping a second copy would let the two drift apart.
const OUT_DIR = join(import.meta.dirname, "..", "public", "fonts");

/**
 * Google serves whichever font format the requesting user agent supports, and
 * the choice is surprisingly sharp: a modern UA gets WOFF2, an ancient IE UA
 * gets EOT, and only a narrow middle band gets raw TrueType. A bare
 * `Mozilla/5.0` reliably lands in that band, which is what we need — pdfkit can
 * embed TTF and OTF but neither WOFF nor EOT.
 */
const TTF_UA = "Mozilla/5.0";

interface Target {
  family: string;
  googleFamily: string;
  weight: number;
  file: string;
}

async function cssFor(googleFamily: string, weight: number): Promise<string> {
  // The css2 endpoint is required: most of the catalogue (Outfit, Sora, and
  // every Noto Indic family) ships as a variable font that the v1 endpoint
  // will not serve at a specific weight.
  const family = `${googleFamily.replace(/ /g, "+")}:wght@${weight}`;
  const url = `https://fonts.googleapis.com/css2?family=${family}`;
  const res = await fetch(url, { headers: { "User-Agent": TTF_UA } });
  if (!res.ok) throw new Error(`CSS request failed (${res.status})`);
  return res.text();
}

function extractFontUrl(css: string): string | null {
  // Modern gstatic URLs have no file extension (`/l/font?kit=…`), so match the
  // host rather than a suffix.
  const match = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
  return match?.[1] ?? null;
}

/** Rejects WOFF/WOFF2/EOT, which pdfkit cannot embed. */
function sniffFormat(buf: Buffer): "ttf" | "otf" | "woff" | "woff2" | "eot" | "unknown" {
  if (buf.length < 4) return "unknown";
  const magic = buf.readUInt32BE(0);
  const ascii = buf.toString("ascii", 0, 4);
  if (magic === 0x00010000 || ascii === "true" || ascii === "ttcf") return "ttf";
  if (ascii === "OTTO") return "otf";
  if (ascii === "wOFF") return "woff";
  if (ascii === "wOF2") return "woff2";
  // EOT has no leading magic; it is identified by its embedded signature.
  if (buf.length > 34 && buf.readUInt32LE(8) === 0x504c) return "eot";
  if (buf.includes(Buffer.from("LP", "ascii"), 32)) return "eot";
  return "unknown";
}

async function download(target: Target): Promise<"ok" | "skip" | "fail"> {
  const dest = join(OUT_DIR, target.file);
  if (existsSync(dest) && statSync(dest).size > 1000) return "skip";

  try {
    const css = await cssFor(target.googleFamily, target.weight);
    const fontUrl = extractFontUrl(css);
    if (!fontUrl) {
      console.warn(`  ! ${target.googleFamily} ${target.weight}: no font source in CSS`);
      return "fail";
    }
    const res = await fetch(fontUrl, { headers: { "User-Agent": TTF_UA } });
    if (!res.ok) throw new Error(`download failed (${res.status})`);

    const buf = Buffer.from(await res.arrayBuffer());
    const format = sniffFormat(buf);
    if (format !== "ttf" && format !== "otf") {
      throw new Error(`got ${format}, need ttf/otf — PDF embedding would fail`);
    }

    writeFileSync(dest, buf);
    return "ok";
  } catch (err) {
    console.warn(`  ! ${target.googleFamily} ${target.weight}: ${(err as Error).message}`);
    return "fail";
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const targets = allFontFiles();
  console.log(`Fetching ${targets.length} font files into assets/fonts/ …\n`);

  let ok = 0;
  let skipped = 0;
  const failed: Target[] = [];

  // Small concurrency — enough to be quick, polite enough not to get throttled.
  const CONCURRENCY = 6;
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(download));
    results.forEach((result, j) => {
      const target = batch[j]!;
      if (result === "ok") {
        ok++;
        process.stdout.write(`  ✓ ${target.file}\n`);
      } else if (result === "skip") {
        skipped++;
      } else {
        failed.push(target);
      }
    });
  }

  console.log(
    `\n${ok} downloaded, ${skipped} already present, ${failed.length} failed.`,
  );

  if (failed.length) {
    console.log(
      `\nMissing fonts fall back to the next family in the same script at render time,\n` +
        `and PDF export substitutes a built-in face for those specific weights.\n` +
        `Re-run \`npm run fonts:fetch\` to retry.`,
    );
  }

  writeStylesheet();
}

/**
 * Emits `public/fonts/fonts.css` with an @font-face per file.
 *
 * Declaring all of them costs nothing: a browser only fetches a face when
 * something on the page actually uses it, so the studio can switch a brand
 * between any two families with no extra loading logic.
 */
function writeStylesheet() {
  const rules = allFontFiles()
    .filter((t) => existsSync(join(OUT_DIR, t.file)))
    .map(
      (t) =>
        `@font-face{font-family:"${t.family}";font-style:normal;font-weight:${t.weight};` +
        `font-display:swap;src:url("/fonts/${t.file}") format("truetype")}`,
    );

  const css =
    `/* Generated by scripts/fetch-fonts.ts — do not edit. */\n` +
    `/* All families are SIL Open Font Licence, so exports are safe for commercial use. */\n` +
    rules.join("\n") +
    "\n";

  writeFileSync(join(OUT_DIR, "fonts.css"), css, "utf8");
  console.log(`✓ Wrote public/fonts/fonts.css (${rules.length} faces)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
