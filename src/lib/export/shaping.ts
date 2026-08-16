import type { BrandIdentitySpec, ScriptCode } from "@/types/brand";

/**
 * Complex-script shaping limits in the PDF pipeline.
 *
 * SVG and browser-rasterised PNG/JPG are shaped by the browser's own text
 * engine and render Indic conjuncts correctly. The PDF path goes through
 * pdfkit, which lays out glyphs without applying the full OpenType shaping
 * Indic scripts need — a virama sequence like श + ् + र can lose its conjunct
 * form and silently drop a letter from the business's own name.
 *
 * Silently exporting that would be the worst outcome: the owner takes the file
 * to a printer and gets their name wrong on five hundred cards. So we detect
 * the risk and say so, and point at the formats that are correct.
 */

/** Scripts whose correct rendering depends on conjunct formation. */
const CONJUNCT_SCRIPTS: ScriptCode[] = [
  "devanagari",
  "bengali",
  "gujarati",
  "kannada",
  "malayalam",
  "telugu",
  "gurmukhi",
];

/**
 * Virama / halant code points. Their presence is what turns adjacent
 * consonants into a conjunct, and therefore what the PDF path can get wrong.
 */
const VIRAMA = /[्্્୍்్್്੍]/;

/** Any character from a conjunct-forming Indic block. */
const INDIC_RANGE =
  /[ऀ-ॿঀ-৿਀-੿઀-૿஀-௿ఀ-౿ಀ-೿ഀ-ൿ]/;

export interface ShapingWarning {
  atRisk: boolean;
  script: ScriptCode;
  /** The specific strings that would be affected. */
  samples: string[];
  message: string;
  recommendation: string;
}

export function checkShaping(
  spec: BrandIdentitySpec,
  extraText: string[] = [],
): ShapingWarning | null {
  if (!CONJUNCT_SCRIPTS.includes(spec.script)) return null;

  const candidates = [spec.localName, ...extraText].filter(
    (s): s is string => !!s && INDIC_RANGE.test(s),
  );
  if (candidates.length === 0) return null;

  // Text without a virama has no conjuncts to lose, so it round-trips fine.
  const risky = candidates.filter((s) => VIRAMA.test(s));
  if (risky.length === 0) return null;

  return {
    atRisk: true,
    script: spec.script,
    samples: risky,
    message:
      `This brand's ${spec.script} text contains conjunct characters. The PDF export can render these ` +
      `incorrectly — a letter may be dropped from the joined form.`,
    recommendation:
      `Use SVG for anything going to a printer, or PNG at full resolution for screen. Both render the ` +
      `script correctly. If you need PDF specifically, ask your printer to place the SVG.`,
  };
}

/** Note appended to the brand kit README when the risk applies. */
export function shapingReadmeNote(warning: ShapingWarning): string {
  return [
    ``,
    `IMPORTANT — ${warning.script.toUpperCase()} TEXT IN PDF FILES`,
    `Your brand name includes joined (conjunct) characters: ${warning.samples.join(", ")}`,
    ``,
    `The SVG files in this kit render these correctly. The PDF files may not —`,
    `the PDF generator does not apply full Indic shaping, so a conjunct can lose`,
    `a letter.`,
    ``,
    `Before printing anything with your ${warning.script} name on it, open the PDF and`,
    `check the name character by character. If it is wrong, give your printer the`,
    `SVG file instead — every print shop can place an SVG.`,
    ``,
  ].join("\n");
}
