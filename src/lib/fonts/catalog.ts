import type { ScriptCode } from "@/types/brand";

/**
 * Font catalogue.
 *
 * Every family here is SIL Open Font Licence, which matters because users
 * export these logos for commercial use — a proprietary font would make the
 * output legally unusable for exactly the small businesses this is built for.
 *
 * `file` is the filename produced by `npm run fonts:fetch`, which downloads the
 * TTFs into `assets/fonts/`. Those same TTFs are embedded into PDF exports, so
 * a printed visiting card matches the on-screen preview even when the print
 * shop has never heard of the typeface.
 */

export type FontCategory = "display" | "body" | "local";
export type FontFeel =
  | "geometric"
  | "grotesque"
  | "humanist"
  | "serif-modern"
  | "serif-classic"
  | "slab"
  | "rounded"
  | "condensed";

export interface FontDef {
  /** CSS family name, also the key used in FontSpec.family. */
  family: string;
  /** Google Fonts API family string. */
  googleFamily: string;
  scripts: ScriptCode[];
  categories: FontCategory[];
  feel: FontFeel;
  /** −1 fully serif … +1 fully sans. Matched against TraitProfile.sansBias. */
  sansScore: number;
  /** Weights we actually fetch and can embed. */
  weights: number[];
  /** Tracking that flatters this face at display size, in em. */
  idealTracking: number;
  /** True for faces that hold up at signboard scale and 16px alike. */
  workhorse: boolean;
  /** Short note used in the "why this font" copy. */
  note: string;
  /** TTF filenames keyed by weight, relative to assets/fonts. */
  files: Record<number, string>;
}

function files(slug: string, weights: number[]): Record<number, string> {
  return Object.fromEntries(weights.map((w) => [w, `${slug}-${w}.ttf`]));
}

// ---------------------------------------------------------------------------
// Latin
// ---------------------------------------------------------------------------

const LATIN: FontDef[] = [
  {
    family: "Poppins",
    googleFamily: "Poppins",
    scripts: ["latin", "devanagari"],
    categories: ["display", "body"],
    feel: "geometric",
    sansScore: 0.9,
    weights: [400, 500, 600, 700],
    idealTracking: -0.01,
    workhorse: true,
    note: "Geometric and friendly, with genuine Devanagari coverage — the safest bilingual workhorse in the catalogue.",
    files: files("poppins", [400, 500, 600, 700]),
  },
  {
    family: "Sora",
    googleFamily: "Sora",
    scripts: ["latin"],
    categories: ["display"],
    feel: "geometric",
    sansScore: 0.95,
    weights: [400, 600, 700],
    idealTracking: -0.02,
    workhorse: false,
    note: "Slightly technical geometry with distinctive cut terminals — reads modern without looking generic.",
    files: files("sora", [400, 600, 700]),
  },
  {
    family: "Space Grotesk",
    googleFamily: "Space Grotesk",
    scripts: ["latin"],
    categories: ["display"],
    feel: "grotesque",
    sansScore: 0.85,
    weights: [400, 500, 700],
    idealTracking: -0.015,
    workhorse: false,
    note: "Quirky grotesque with mechanical detailing — good for brands that want to look engineered.",
    files: files("space-grotesk", [400, 500, 700]),
  },
  {
    family: "Outfit",
    googleFamily: "Outfit",
    scripts: ["latin"],
    categories: ["display", "body"],
    feel: "geometric",
    sansScore: 0.92,
    weights: [400, 500, 600, 700],
    idealTracking: -0.005,
    workhorse: true,
    note: "Clean geometric sans that stays even at very large sizes — strong signboard behaviour.",
    files: files("outfit", [400, 500, 600, 700]),
  },
  {
    family: "Manrope",
    googleFamily: "Manrope",
    scripts: ["latin"],
    categories: ["body", "display"],
    feel: "grotesque",
    sansScore: 0.88,
    weights: [400, 500, 600, 700],
    idealTracking: 0,
    workhorse: true,
    note: "Semi-geometric with open apertures; holds legibility down to caption size.",
    files: files("manrope", [400, 500, 600, 700]),
  },
  {
    family: "Inter",
    googleFamily: "Inter",
    scripts: ["latin"],
    categories: ["body"],
    feel: "grotesque",
    sansScore: 0.9,
    weights: [400, 500, 600, 700],
    idealTracking: 0,
    workhorse: true,
    note: "Designed for screens at small sizes — the default body face when nothing else is called for.",
    files: files("inter", [400, 500, 600, 700]),
  },
  {
    family: "DM Sans",
    googleFamily: "DM Sans",
    scripts: ["latin"],
    categories: ["body", "display"],
    feel: "geometric",
    sansScore: 0.86,
    weights: [400, 500, 700],
    idealTracking: 0,
    workhorse: true,
    note: "Low-contrast geometric sans with a warm lowercase — friendly without being childish.",
    files: files("dm-sans", [400, 500, 700]),
  },
  {
    family: "Playfair Display",
    googleFamily: "Playfair Display",
    scripts: ["latin"],
    categories: ["display"],
    feel: "serif-modern",
    sansScore: -0.9,
    weights: [400, 500, 700],
    idealTracking: 0.005,
    workhorse: false,
    note: "High-contrast transitional serif — the fastest route to a premium, editorial read.",
    files: files("playfair-display", [400, 500, 700]),
  },
  {
    family: "Cormorant Garamond",
    googleFamily: "Cormorant Garamond",
    scripts: ["latin"],
    categories: ["display"],
    feel: "serif-classic",
    sansScore: -0.95,
    weights: [400, 500, 600],
    idealTracking: 0.06,
    workhorse: false,
    // Very light stems: fine on a card, fails on a backlit signboard.
    note: "Delicate old-style serif for luxury and jewellery. Needs generous size — it thins out badly when small.",
    files: files("cormorant-garamond", [400, 500, 600]),
  },
  {
    family: "Fraunces",
    googleFamily: "Fraunces",
    scripts: ["latin"],
    categories: ["display"],
    feel: "serif-classic",
    sansScore: -0.75,
    weights: [400, 600, 700],
    idealTracking: 0,
    workhorse: false,
    note: "Soft, slightly wonky serif with warmth — reads handmade rather than corporate.",
    files: files("fraunces", [400, 600, 700]),
  },
  {
    family: "Bitter",
    googleFamily: "Bitter",
    scripts: ["latin"],
    categories: ["display", "body"],
    feel: "slab",
    sansScore: -0.5,
    weights: [400, 600, 700],
    idealTracking: 0,
    workhorse: true,
    note: "Sturdy contemporary slab — dependable and grounded, prints cleanly at any size.",
    files: files("bitter", [400, 600, 700]),
  },
  {
    family: "Archivo",
    googleFamily: "Archivo",
    scripts: ["latin"],
    categories: ["display", "body"],
    feel: "grotesque",
    sansScore: 0.8,
    weights: [400, 600, 700],
    idealTracking: -0.01,
    workhorse: true,
    note: "Sturdy American grotesque built for high-impact headlines and dense signage.",
    files: files("archivo", [400, 600, 700]),
  },
  {
    family: "Baloo 2",
    googleFamily: "Baloo 2",
    scripts: ["latin", "devanagari"],
    categories: ["display"],
    feel: "rounded",
    sansScore: 0.7,
    weights: [400, 600, 700],
    idealTracking: 0,
    workhorse: true,
    note: "Heavy rounded display with matching Devanagari — the workhorse look of Indian street signage, done properly.",
    files: files("baloo-2", [400, 600, 700]),
  },
];

// ---------------------------------------------------------------------------
// Indic — Noto Sans covers every script we support, with matching metrics.
// ---------------------------------------------------------------------------

interface IndicSeed {
  family: string;
  google: string;
  script: ScriptCode;
  slug: string;
  note: string;
}

const INDIC_SEEDS: IndicSeed[] = [
  {
    family: "Noto Sans Devanagari",
    google: "Noto Sans Devanagari",
    script: "devanagari",
    slug: "noto-sans-devanagari",
    note: "Full Devanagari coverage with a clean, even shirorekha — safe for Hindi and Marathi at any size.",
  },
  {
    family: "Noto Sans Gujarati",
    google: "Noto Sans Gujarati",
    script: "gujarati",
    slug: "noto-sans-gujarati",
    note: "Even-weight Gujarati with reliable conjunct rendering.",
  },
  {
    family: "Noto Sans Tamil",
    google: "Noto Sans Tamil",
    script: "tamil",
    slug: "noto-sans-tamil",
    note: "Open, generously spaced Tamil that stays legible on signage.",
  },
  {
    family: "Noto Sans Telugu",
    google: "Noto Sans Telugu",
    script: "telugu",
    slug: "noto-sans-telugu",
    note: "Telugu with well-resolved vowel signs at small sizes.",
  },
  {
    family: "Noto Sans Bengali",
    google: "Noto Sans Bengali",
    script: "bengali",
    slug: "noto-sans-bengali",
    note: "Bengali with a steady matra line and correct conjunct forms.",
  },
  {
    family: "Noto Sans Kannada",
    google: "Noto Sans Kannada",
    script: "kannada",
    slug: "noto-sans-kannada",
    note: "Kannada tuned for screen and print at equal quality.",
  },
  {
    family: "Noto Sans Malayalam",
    google: "Noto Sans Malayalam",
    script: "malayalam",
    slug: "noto-sans-malayalam",
    note: "Malayalam with both traditional and reformed conjuncts.",
  },
  {
    family: "Noto Sans Gurmukhi",
    google: "Noto Sans Gurmukhi",
    script: "gurmukhi",
    slug: "noto-sans-gurmukhi",
    note: "Gurmukhi with an even top line, matched to the Latin weights.",
  },
];

const INDIC: FontDef[] = INDIC_SEEDS.map((seed) => ({
  family: seed.family,
  googleFamily: seed.google,
  scripts: [seed.script],
  categories: ["local", "body", "display"],
  feel: "humanist",
  sansScore: 0.7,
  weights: [400, 500, 600, 700],
  idealTracking: 0,
  workhorse: true,
  note: seed.note,
  files: files(seed.slug, [400, 500, 600, 700]),
}));

/** A serif Devanagari option, so Hindi brands aren't forced into a sans. */
const TIRO_DEVANAGARI: FontDef = {
  family: "Tiro Devanagari Hindi",
  googleFamily: "Tiro Devanagari Hindi",
  scripts: ["devanagari"],
  categories: ["local", "display"],
  feel: "serif-classic",
  sansScore: -0.8,
  weights: [400],
  idealTracking: 0,
  workhorse: false,
  note: "Calligraphic Devanagari with real stroke modulation — the right choice when a Hindi brand needs gravitas rather than friendliness.",
  files: files("tiro-devanagari-hindi", [400]),
};

export const FONTS: FontDef[] = [...LATIN, ...INDIC, TIRO_DEVANAGARI];

export const FONT_MAP: Record<string, FontDef> = Object.fromEntries(
  FONTS.map((f) => [f.family, f]),
);

export function getFont(family: string): FontDef | undefined {
  return FONT_MAP[family];
}

export function fontsForScript(script: ScriptCode, category?: FontCategory): FontDef[] {
  return FONTS.filter(
    (f) => f.scripts.includes(script) && (!category || f.categories.includes(category)),
  );
}

/** Nearest available weight for a family — never request one we can't embed. */
export function resolveWeight(family: string, requested: number): number {
  const font = getFont(family);
  if (!font) return 400;
  return font.weights.reduce((best, w) =>
    Math.abs(w - requested) < Math.abs(best - requested) ? w : best,
  );
}

/** Every (family, weight) pair the fetch script needs to download. */
export function allFontFiles(): { family: string; googleFamily: string; weight: number; file: string }[] {
  return FONTS.flatMap((f) =>
    f.weights.map((w) => ({
      family: f.family,
      googleFamily: f.googleFamily,
      weight: w,
      file: f.files[w]!,
    })),
  );
}

/** Families needed on the web for a given script, for the @font-face layer. */
export function webFontFamilies(script: ScriptCode): FontDef[] {
  const set = new Set<FontDef>();
  for (const f of FONTS) if (f.scripts.includes("latin") || f.scripts.includes(script)) set.add(f);
  return [...set];
}
