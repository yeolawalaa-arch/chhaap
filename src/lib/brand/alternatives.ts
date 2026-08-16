import { Rng, hashString } from "@/lib/brand/rng";
import { getIndustry } from "@/lib/brand/industries";
import { profileFor } from "@/lib/brand/personality";
import { generatePalette, MOODS } from "@/lib/brand/palettes";
import { generateTypography } from "@/lib/brand/typography";
import { GLYPHS, glyphExists } from "@/lib/render/glyphs";
import { scriptFor } from "@/lib/brand/languages";
import { scoreIdentity } from "@/lib/brand/quality";
import { buildLogoDocument } from "@/lib/render/logo";
import type {
  BrandBrief,
  BrandIdentitySpec,
  BrandPalette,
  BrandTypography,
  ColorMood,
  EnclosureShape,
  MarkSpec,
  MarkStyle,
} from "@/types/brand";

/**
 * Alternatives for each part of a locked-in identity.
 *
 * Choosing a direction settles the *system* — how bold, how warm, how
 * traditional. It should not settle every individual decision inside it. A shop
 * owner who likes the direction but wants a different symbol, or the same mark
 * in green, currently has to regenerate everything and lose what they liked.
 *
 * Each generator below varies exactly one axis and holds the rest fixed, so
 * swapping a mark cannot silently change the palette. Every option is scored,
 * so an alternative that would fail the readiness checks is visibly worse
 * rather than quietly offered as an equal.
 */

export interface MarkOption {
  id: string;
  mark: MarkSpec;
  label: string;
  score: number;
}

export interface PaletteOption {
  id: string;
  palette: BrandPalette;
  label: string;
  mood: ColorMood;
  score: number;
}

export interface TypeOption {
  id: string;
  typography: BrandTypography;
  label: string;
  score: number;
}

/** Rescores a spec with one field swapped, so options can be ranked honestly. */
function scoreWith(spec: BrandIdentitySpec, patch: Partial<BrandIdentitySpec>): number {
  const candidate = { ...spec, ...patch };
  return scoreIdentity(candidate, buildLogoDocument(candidate, "primary")).score;
}

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------

const ENCLOSURES: EnclosureShape[] = [
  "none", "circle", "rounded-square", "squircle", "hexagon", "shield", "arch", "diamond",
];

const ABSTRACT: MarkStyle[] = ["abstract-petal", "abstract-orbit", "abstract-stack", "lettermark-cut"];

const STYLE_LABEL: Record<string, string> = {
  glyph: "Symbol",
  monogram: "Monogram",
  "lettermark-cut": "Cut letter",
  "abstract-petal": "Petal",
  "abstract-orbit": "Orbit",
  "abstract-stack": "Stack",
  "wordmark-only": "Wordmark",
};

/**
 * Mark alternatives, drawn from three pools so the set is varied by
 * construction: the industry's own symbols, abstract forms, and the current
 * mark re-cut in different enclosures.
 */
export function markAlternatives(
  spec: BrandIdentitySpec,
  industryKey: string,
  count = 12,
): MarkOption[] {
  const industry = getIndustry(industryKey);
  const rng = new Rng(hashString(`${spec.name}|marks|${spec.directionId}`));
  const out: MarkOption[] = [];
  const seen = new Set<string>();

  const push = (mark: MarkSpec, label: string) => {
    const key = `${mark.style}:${mark.glyph ?? ""}:${mark.enclosure}:${mark.fillStyle}`;
    if (seen.has(key) || out.length >= count) return;
    seen.add(key);
    out.push({
      id: key.replace(/[^a-z0-9]+/gi, "-"),
      mark,
      label,
      score: scoreWith(spec, { mark }),
    });
  };

  // 1. The current mark stays first — never lose what was already chosen.
  push(spec.mark, "Current");

  // 2. This industry's own symbols, in the current enclosure.
  for (const glyphKey of industry.glyphs.filter(glyphExists)) {
    const glyph = GLYPHS.find((g) => g.key === glyphKey);
    push({ ...spec.mark, style: "glyph", glyph: glyphKey }, glyph?.label ?? "Symbol");
  }

  // 3. Abstract forms, which suit a business that may outgrow a literal symbol.
  for (const style of ABSTRACT) {
    push({ ...spec.mark, style, glyph: undefined, symmetry: rng.int(4, 7) }, STYLE_LABEL[style]!);
  }

  // 4. The monogram, and the current mark in other enclosures.
  push({ ...spec.mark, style: "monogram", glyph: undefined }, "Monogram");
  for (const enclosure of ENCLOSURES) {
    push({ ...spec.mark, enclosure }, enclosure === "none" ? "No frame" : titleCase(enclosure));
  }

  return out.slice(0, count);
}

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

/** One palette per mood, so the choice spans real alternatives, not shades. */
export function paletteAlternatives(
  spec: BrandIdentitySpec,
  brief: BrandBrief,
  count = 8,
): PaletteOption[] {
  const industry = getIndustry(brief.industry);
  const profile = profileFor(brief.personality);
  const out: PaletteOption[] = [];

  out.push({
    id: "current",
    palette: spec.palette,
    label: "Current",
    mood: brief.colorMood,
    score: scoreWith(spec, { palette: spec.palette }),
  });

  for (const mood of Object.values(MOODS)) {
    if (out.length >= count) break;
    const rng = new Rng(hashString(`${spec.name}|palette|${mood.mood}|${spec.directionId}`));
    const palette = generatePalette({ industry, profile, mood: mood.mood, rng });
    out.push({
      id: mood.mood,
      palette,
      label: mood.label,
      mood: mood.mood,
      score: scoreWith(spec, { palette }),
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export function typeAlternatives(
  spec: BrandIdentitySpec,
  brief: BrandBrief,
  count = 6,
): TypeOption[] {
  const industry = getIndustry(brief.industry);
  const profile = profileFor(brief.personality);
  const script = scriptFor(brief.language);
  const out: TypeOption[] = [];
  const seen = new Set<string>();

  const push = (typography: BrandTypography, label: string) => {
    const key = `${typography.display.family}/${typography.body.family}/${typography.display.transform}`;
    if (seen.has(key) || out.length >= count) return;
    seen.add(key);
    out.push({ id: key.replace(/[^a-z0-9]+/gi, "-"), typography, label, score: scoreWith(spec, { typography }) });
  };

  push(spec.typography, "Current");

  // Force each classification so the set always contains a real serif and a
  // real sans option rather than several near-identical grotesques.
  for (const force of ["serif", "sans", undefined] as const) {
    for (let seed = 0; seed < 3; seed++) {
      const rng = new Rng(hashString(`${spec.name}|type|${force ?? "auto"}|${seed}`));
      const typography = generateTypography({
        industry, profile, language: brief.language, script, rng, forceDisplay: force,
      });
      push(typography, `${typography.display.family} + ${typography.body.family}`);
    }
  }

  return out;
}

const titleCase = (s: string) =>
  s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ---------------------------------------------------------------------------
// Combined
// ---------------------------------------------------------------------------

export interface AlternativeSet {
  marks: MarkOption[];
  palettes: PaletteOption[];
  types: TypeOption[];
}

export function allAlternatives(spec: BrandIdentitySpec, brief: BrandBrief): AlternativeSet {
  return {
    marks: markAlternatives(spec, brief.industry),
    palettes: paletteAlternatives(spec, brief),
    types: typeAlternatives(spec, brief),
  };
}
