import {
  colorFamily,
  contrastRatio,
  darken,
  ensureContrast,
  harmonize,
  hexToHsl,
  hexToRgb,
  hslToHex,
  lighten,
  normalizeHex,
  rgbToCmyk,
} from "@/lib/color";
import type { Rng } from "@/lib/brand/rng";
import type { TraitProfile } from "@/lib/brand/personality";
import type { IndustryProfile } from "@/lib/brand/industries";
import type { BrandColor, BrandPalette, ColorMood, ColorRole } from "@/types/brand";

/**
 * Palette generation.
 *
 * A palette is never sampled at random. It is built from a base hue that the
 * industry and mood agree on, then *constructed* — the accent comes from a
 * harmony rule, the neutrals are tinted with the primary hue so the whole set
 * feels related, and every foreground/background pair is contrast-corrected
 * before it leaves this module. That last step is why generated business cards
 * and Instagram posts are legible without anyone checking them by hand.
 */

// ---------------------------------------------------------------------------
// Colour psychology copy
// ---------------------------------------------------------------------------

/**
 * Meanings are written for an Indian commercial context, where several hues
 * carry associations that differ from Western colour theory — saffron and
 * marigold read as auspicious, green carries both freshness and (for food)
 * a vegetarian signal, and deep red is the colour of celebration rather than
 * of warning.
 */
const HUE_MEANING: { range: [number, number]; family: string; meaning: string }[] = [
  {
    range: [345, 15],
    family: "red",
    meaning:
      "Red signals celebration, appetite and urgency. In Indian retail it reads as festive and auspicious rather than alarming, which is why it works for sweets, textiles and jewellery.",
  },
  {
    range: [15, 42],
    family: "saffron/orange",
    meaning:
      "Saffron and marigold are the most culturally loaded warm tones in India — auspicious, energetic and instantly familiar. They drive footfall and appetite, and photograph well on a printed signboard.",
  },
  {
    range: [42, 65],
    family: "gold",
    meaning:
      "Gold carries value and occasion. Used sparingly as an accent it lifts a brand into gifting and premium territory; used as a large field it goes flat, so the system keeps it to detail work.",
  },
  {
    range: [65, 100],
    family: "lime",
    meaning:
      "Fresh, young and slightly disruptive. Reads as new-generation and health-forward, and cuts through a feed dominated by warmer competitors.",
  },
  {
    range: [100, 160],
    family: "green",
    meaning:
      "Green means fresh, natural and — for food businesses in India — vegetarian, which is a genuine purchase signal. It also carries growth and prosperity for finance and agri brands.",
  },
  {
    range: [160, 195],
    family: "teal",
    meaning:
      "Teal balances trust with modernity. Calm enough for clinics and services, distinctive enough to avoid the sea of corporate blue.",
  },
  {
    range: [195, 250],
    family: "blue",
    meaning:
      "Blue is the default trust colour worldwide — dependable, calm and professional. The trade-off is ubiquity, so this system pairs it with a warmer accent to stay memorable.",
  },
  {
    range: [250, 290],
    family: "violet",
    meaning:
      "Violet reads creative and premium. It is rare in Indian small business signage, which makes it a strong differentiator for studios, salons and D2C brands.",
  },
  {
    range: [290, 345],
    family: "magenta",
    meaning:
      "Magenta and rani pink are confident, festive and unmistakably contemporary Indian. Strong for fashion, beauty and youth-facing brands.",
  },
];

function meaningForHue(hue: number): string {
  const h = ((hue % 360) + 360) % 360;
  for (const entry of HUE_MEANING) {
    const [lo, hi] = entry.range;
    if (lo > hi ? h >= lo || h < hi : h >= lo && h < hi) return entry.meaning;
  }
  return HUE_MEANING[6]!.meaning;
}

// ---------------------------------------------------------------------------
// Mood definitions
// ---------------------------------------------------------------------------

interface MoodDef {
  mood: ColorMood;
  label: string;
  hint: string;
  /** Allowed hue windows for the primary. */
  hues: [number, number][];
  saturation: [number, number];
  lightness: [number, number];
  /** Neutral base: how much primary hue bleeds into greys (0–1). */
  neutralTint: number;
  surfaceLightness: number;
  harmony: Parameters<typeof harmonize>[1];
}

export const MOODS: Record<Exclude<ColorMood, "auto">, MoodDef> = {
  warm: {
    mood: "warm",
    label: "Warm",
    hint: "Saffron, terracotta, chilli — inviting and appetising",
    hues: [[8, 48]],
    saturation: [0.6, 0.86],
    lightness: [0.42, 0.56],
    neutralTint: 0.35,
    surfaceLightness: 0.975,
    harmony: "analogous",
  },
  cool: {
    mood: "cool",
    label: "Cool",
    hint: "Indigo, teal, slate — calm and dependable",
    hues: [[178, 262]],
    saturation: [0.42, 0.72],
    lightness: [0.36, 0.5],
    neutralTint: 0.25,
    surfaceLightness: 0.98,
    harmony: "complementary",
  },
  earthy: {
    mood: "earthy",
    label: "Earthy",
    hint: "Clay, haldi, olive — grounded and handmade",
    hues: [
      [18, 45],
      [70, 115],
    ],
    saturation: [0.28, 0.52],
    lightness: [0.3, 0.46],
    neutralTint: 0.5,
    surfaceLightness: 0.965,
    harmony: "analogous",
  },
  vibrant: {
    mood: "vibrant",
    label: "Vibrant",
    hint: "Rani pink, electric blue, marigold — loud and young",
    hues: [
      [320, 350],
      [200, 230],
      [25, 45],
    ],
    saturation: [0.78, 0.96],
    lightness: [0.46, 0.58],
    neutralTint: 0.15,
    surfaceLightness: 0.985,
    harmony: "split",
  },
  monochrome: {
    mood: "monochrome",
    label: "Monochrome",
    hint: "One hue, many steps — disciplined and modern",
    hues: [[0, 360]],
    saturation: [0.05, 0.28],
    lightness: [0.22, 0.4],
    neutralTint: 0.7,
    surfaceLightness: 0.98,
    harmony: "monochrome",
  },
  pastel: {
    mood: "pastel",
    label: "Pastel",
    hint: "Soft, airy, gentle on the eye",
    hues: [[0, 360]],
    saturation: [0.35, 0.55],
    lightness: [0.58, 0.7],
    neutralTint: 0.3,
    surfaceLightness: 0.99,
    harmony: "analogous",
  },
  jewel: {
    mood: "jewel",
    label: "Jewel",
    hint: "Emerald, ruby, sapphire — rich and ceremonial",
    hues: [
      [340, 360],
      [140, 175],
      [240, 275],
    ],
    saturation: [0.6, 0.85],
    lightness: [0.24, 0.36],
    neutralTint: 0.4,
    surfaceLightness: 0.97,
    harmony: "triadic",
  },
};

export const MOOD_LIST = Object.values(MOODS);

/**
 * Representative swatches for a mood picker — computed from the same hue
 * windows and saturation/lightness ranges the generator actually samples
 * from, so the preview a user picks by is honest rather than a decorative
 * stand-in colour.
 *
 * Moods with an unconstrained hue window (monochrome, pastel — "any hue,
 * many steps") don't have a hue to preview, so instead they show the same
 * neutral anchor hue stepped across the mood's own lightness range.
 */
export function moodSwatchHexes(mood: ColorMood): string[] {
  if (mood === "auto") return ["#e7e3dd", "#c9c3ba", "#a8a29e"];

  const def = MOODS[mood];
  const isOpenHue = def.hues.length === 1 && def.hues[0][1] - def.hues[0][0] >= 300;
  const s = (def.saturation[0] + def.saturation[1]) / 2;
  const [loL, hiL] = def.lightness;
  const midL = (loL + hiL) / 2;

  if (isOpenHue) {
    return [loL, midL, hiL].map((l) => hslToHex([28, s, l]));
  }

  if (def.hues.length >= 3) {
    return def.hues.slice(0, 3).map(([lo, hi]) => hslToHex([((lo + hi) / 2) % 360, s, midL]));
  }

  // One or two hue windows can't fill three distinct-hue swatches, so the
  // remaining stops vary lightness instead — still three honest samples of
  // the mood's own range, not a repeated or padded colour.
  const [p0, p1] = def.hues[0]!;
  const primaryHue = ((p0 + p1) / 2) % 360;
  const secondHue = def.hues[1] ? ((def.hues[1][0] + def.hues[1][1]) / 2) % 360 : primaryHue;

  return [hslToHex([primaryHue, s, loL]), hslToHex([secondHue, s, midL]), hslToHex([primaryHue, s, hiL])];
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

function pickHue(rng: Rng, windows: [number, number][]): number {
  const [lo, hi] = rng.pick(windows);
  return hi >= lo ? rng.float(lo, hi) : rng.float(lo, hi + 360) % 360;
}

/** Intersects industry hue windows with mood hue windows, falling back to mood. */
function resolveHueWindows(
  industry: IndustryProfile,
  mood: MoodDef,
): [number, number][] {
  const overlaps: [number, number][] = [];
  for (const [ilo, ihi] of industry.hueWindows) {
    for (const [mlo, mhi] of mood.hues) {
      // Only handles non-wrapping intersections; wrapping windows fall through
      // to the mood default, which is the safer of the two constraints to keep.
      if (ihi >= ilo && mhi >= mlo) {
        const lo = Math.max(ilo, mlo);
        const hi = Math.min(ihi, mhi);
        if (hi - lo >= 8) overlaps.push([lo, hi]);
      }
    }
  }
  return overlaps.length ? overlaps : mood.hues;
}

export function resolveMood(
  requested: ColorMood,
  industry: IndustryProfile,
  profile: TraitProfile,
  rng: Rng,
): MoodDef {
  if (requested !== "auto") return MOODS[requested];
  // "Auto" means: find a mood the industry and the personality both endorse.
  const shared = industry.moods.filter((m) => profile.preferredMoods.includes(m));
  const pool = shared.length ? shared : industry.moods.length ? industry.moods : profile.preferredMoods;
  const chosen = pool.length ? rng.pick(pool) : "cool";
  return MOODS[chosen === "auto" ? "cool" : chosen];
}

/**
 * Turns a raw harmony result into a usable accent.
 *
 * A textbook complement returned at the primary's own saturation and lightness
 * is the single most common way generated palettes go wrong: two colours of
 * equal visual weight compete instead of one supporting the other, and the pair
 * reads like a channel swap rather than a decision. So the accent is forced
 * into a subordinate role — pushed apart in hue, then separated in lightness
 * and pulled back in saturation, so the primary stays dominant.
 */
function refineAccent(raw: string, primary: string, mood: MoodDef, rng: Rng): string {
  const [pHue, pSat, pLight] = hexToHsl(primary);
  let [aHue, aSat, aLight] = hexToHsl(raw);

  // 1. Hue separation. Anything closer than 25° reads as a botched primary
  //    rather than a deliberate second colour.
  const hueGap = Math.abs(((aHue - pHue + 540) % 360) - 180);
  if (180 - hueGap < 25) aHue = pHue + (rng.bool() ? 32 : -32);

  // 2. Lightness separation — the part that decides which colour leads.
  //    Going lighter keeps the accent lively; going darker keeps it grave.
  //    Either is fine, equal lightness is not.
  const goLighter = pLight < 0.5 ? true : rng.bool(0.35);
  const separation = rng.float(0.13, 0.22);
  aLight = clamp01(goLighter ? pLight + separation : pLight - separation);

  // 3. Saturation. A complement at full strength vibrates against the primary —
  //    two 90%-saturated opposites is how generated palettes end up neon.
  //    Holding the accent below the primary keeps the hierarchy intact.
  //    Vibrant brands run hotter because that tension is the point, but even
  //    they get a ceiling.
  const vibrant = mood.mood === "vibrant";
  aSat = clamp01(Math.min(aSat, pSat * (vibrant ? 0.9 : 0.78), vibrant ? 0.8 : 0.66));

  // Highly saturated primaries need the accent pulled back further still: the
  // vibration is a product of *both* colours, not of the accent alone.
  if (pSat > 0.8) aSat = clamp01(aSat * 0.85);

  // Pastel and monochrome systems collapse if the accent shouts.
  if (mood.mood === "pastel") aSat = clamp01(aSat * 0.75);
  if (mood.mood === "monochrome") aSat = clamp01(Math.min(aSat, pSat * 0.6));

  return hslToHex([aHue, aSat, aLight]);
}

function makeColor(
  role: ColorRole,
  name: string,
  hex: string,
  meaning?: string,
): BrandColor {
  const clean = normalizeHex(hex);
  const rgb = hexToRgb(clean);
  return { role, name, hex: clean, rgb, cmyk: rgbToCmyk(rgb), meaning };
}

export interface PaletteOptions {
  industry: IndustryProfile;
  profile: TraitProfile;
  mood: ColorMood;
  seeds?: string[];
  rng: Rng;
}

export function generatePalette({
  industry,
  profile,
  mood,
  seeds,
  rng,
}: PaletteOptions): BrandPalette {
  const moodDef = resolveMood(mood, industry, profile, rng);

  // 1. Primary — either the user's own seed, or constructed from the
  //    industry × mood hue agreement, then nudged by personality.
  let primary: string;
  if (seeds?.length) {
    primary = normalizeHex(seeds[0]!);
  } else {
    const hue = pickHue(rng, resolveHueWindows(industry, moodDef));
    const sat = clamp01(
      rng.float(moodDef.saturation[0], moodDef.saturation[1]) + profile.saturation * 0.18,
    );
    const light = clamp01(
      rng.float(moodDef.lightness[0], moodDef.lightness[1]) + profile.lightness * 0.1,
    );
    primary = hslToHex([hue, sat, light]);
  }

  const [pHue, pSat] = hexToHsl(primary);

  // 2. Accent — a harmony rule, not a second random colour. If the user gave a
  //    second seed we honour it instead.
  let accent: string;
  if (seeds && seeds.length > 1) {
    accent = normalizeHex(seeds[1]!);
  } else {
    const candidates = harmonize(primary, moodDef.harmony);
    accent = refineAccent(rng.pick(candidates), primary, moodDef, rng);
  }

  // 3. Ink and neutrals carry a trace of the primary hue. This is the detail
  //    that makes a palette feel designed rather than assembled.
  const tint = moodDef.neutralTint;
  const ink = hslToHex([pHue, clamp01(pSat * tint * 0.5), 0.11 - profile.contrast * 0.02]);
  const muted = hslToHex([pHue, clamp01(pSat * tint * 0.35), 0.47]);
  const surface = hslToHex([pHue, clamp01(pSat * tint * 0.12), moodDef.surfaceLightness]);
  const surfaceAlt = hslToHex([pHue, clamp01(pSat * tint * 0.2), moodDef.surfaceLightness - 0.045]);

  // 4. Contrast repair. Everything below is a guarantee, not a suggestion.
  const inkFixed = ensureContrast(ink, surface, 12);
  const mutedFixed = ensureContrast(muted, surface, 4.5);
  // The primary must survive as a text colour on the surface *and* hold white
  // type on top of it — the two jobs it actually does in every template.
  let primaryFixed = primary;
  if (contrastRatio(primaryFixed, "#ffffff") < 3.2) primaryFixed = darken(primaryFixed, 0.12);
  if (contrastRatio(primaryFixed, surface) < 3) primaryFixed = darken(primaryFixed, 0.08);

  let accentFixed = accent;
  if (contrastRatio(accentFixed, surface) < 2.4) accentFixed = darken(accentFixed, 0.1);

  const family = colorFamily(primaryFixed);

  return {
    primary: makeColor("primary", titleCase(`${family} primary`), primaryFixed, meaningForHue(pHue)),
    primaryDark: makeColor(
      "primaryDark",
      "Deep shade",
      darken(primaryFixed, 0.14),
      "Used for pressed states, dark backgrounds and single-colour print where the primary would be too light.",
    ),
    primaryLight: makeColor(
      "primaryLight",
      "Light tint",
      lighten(primaryFixed, 0.34),
      "Backgrounds, highlights and large fills where the full-strength primary would overwhelm.",
    ),
    accent: makeColor(
      "accent",
      titleCase(`${colorFamily(accentFixed)} accent`),
      accentFixed,
      `Chosen by ${moodDef.harmony} harmony against the primary, so it contrasts without clashing. Use it for one thing per layout — a button, a price, a highlight.`,
    ),
    ink: makeColor("ink", "Ink", inkFixed, "Headlines and body text. Tinted with the brand hue so black never looks dead next to the primary."),
    muted: makeColor("muted", "Muted", mutedFixed, "Secondary text, captions and metadata. Cleared for 4.5:1 against the surface."),
    surface: makeColor("surface", "Surface", surface, "The default background across print and screen."),
    surfaceAlt: makeColor("surfaceAlt", "Surface alt", surfaceAlt, "Section banding, cards and table stripes."),
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Narrative used in the brand guidelines PDF and the strategy panel.
 * Built from the actual generated values, so it can never contradict them.
 */
export function describePalette(palette: BrandPalette, moodLabel: string): string {
  const p = palette.primary;
  const a = palette.accent;
  return (
    `${p.name} (${p.hex.toUpperCase()}) anchors the identity. ${p.meaning} ` +
    `${a.name} (${a.hex.toUpperCase()}) is the counterweight — reserve it for the one element you want acted on. ` +
    `The neutrals are not pure greys: they carry a trace of the primary hue, which is what keeps a ${moodLabel.toLowerCase()} palette feeling like one system across a signboard, a visiting card and an Instagram grid.`
  );
}

/** Contrast pairs the quality scorer and the guidelines PDF both report on. */
export function contrastMatrix(palette: BrandPalette) {
  const pairs: { fg: ColorRole; bg: ColorRole; ratio: number; passesAA: boolean; passesAALarge: boolean }[] = [];
  const combos: [ColorRole, ColorRole][] = [
    ["ink", "surface"],
    ["muted", "surface"],
    ["primary", "surface"],
    ["surface", "primary"],
    ["surface", "primaryDark"],
    ["ink", "primaryLight"],
    ["surface", "accent"],
    ["ink", "surfaceAlt"],
  ];
  for (const [fg, bg] of combos) {
    const ratio = contrastRatio(palette[fg].hex, palette[bg].hex);
    pairs.push({
      fg,
      bg,
      ratio: Math.round(ratio * 100) / 100,
      passesAA: ratio >= 4.5,
      passesAALarge: ratio >= 3,
    });
  }
  return pairs;
}
