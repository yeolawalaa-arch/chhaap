import { Rng, hashString } from "@/lib/brand/rng";
import { getIndustry } from "@/lib/brand/industries";
import { profileFor } from "@/lib/brand/personality";
import { generatePalette, MOODS } from "@/lib/brand/palettes";
import { generateTypography } from "@/lib/brand/typography";
import { fontsForScript, resolveWeight } from "@/lib/fonts/catalog";
import { GLYPHS, glyphExists } from "@/lib/render/glyphs";
import { scriptFor, safeTracking } from "@/lib/brand/languages";
import { hexToHsl } from "@/lib/color";
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
 * The generators below oversample — building a candidate pool many times
 * larger than what is shown — score every candidate against the same
 * readiness checks that gate export, deduplicate anything that would render
 * identically or near-identically, and keep only the best-scoring survivors.
 * That ordering is what keeps a hundred-plus options "classy" rather than a
 * wall of near-duplicates: nothing reaches the screen without already having
 * cleared the bar a paying export has to clear.
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

const ENCLOSURE_LABEL: Record<EnclosureShape, string> = {
  none: "No frame",
  circle: "Circle",
  "rounded-square": "Rounded square",
  squircle: "Squircle",
  hexagon: "Hexagon",
  shield: "Shield",
  arch: "Arch",
  diamond: "Diamond",
  banner: "Banner",
};

const FILL_SUFFIX: Record<MarkSpec["fillStyle"], string> = {
  solid: "",
  outline: " · Outline",
  duotone: " · Duotone",
  gradient: " · Gradient",
  monoline: " · Fine line",
};

/**
 * Fill treatments that actually render differently for a given enclosure.
 *
 * With `enclosure: "none"` there is no enclosure shape to fill, outline,
 * tint or gradient — solid, outline, duotone and gradient all fall through to
 * the identical "draw the symbol at full weight" path. Only `monoline`, which
 * thins the symbol's own stroke, produces a different result. Sweeping all
 * four into the candidate pool for an unframed mark would show three or four
 * pixel-identical thumbnails, which is the opposite of "classy" — it would
 * read as a bug the moment someone looked closely.
 */
function distinctFillStyles(enclosure: EnclosureShape): MarkSpec["fillStyle"][] {
  return enclosure === "none" ? ["solid", "monoline"] : ["solid", "outline", "duotone", "monoline"];
}

interface MarkCandidate {
  mark: MarkSpec;
  label: string;
}

function markCandidatePool(spec: BrandIdentitySpec, industryKey: string, rng: Rng): MarkCandidate[] {
  const industry = getIndustry(industryKey);
  const pool: MarkCandidate[] = [];
  const base = spec.mark;

  const glyphKeys = industry.glyphs.filter(glyphExists);
  for (const glyphKey of glyphKeys) {
    const glyph = GLYPHS.find((g) => g.key === glyphKey);
    const glyphLabel = glyph?.label ?? "Symbol";
    for (const enclosure of ENCLOSURES) {
      for (const fillStyle of distinctFillStyles(enclosure)) {
        pool.push({
          mark: { ...base, style: "glyph", glyph: glyphKey, enclosure, fillStyle },
          label: `${glyphLabel} · ${ENCLOSURE_LABEL[enclosure]}${FILL_SUFFIX[fillStyle]}`,
        });
      }
    }
  }

  for (const style of ABSTRACT) {
    // One symmetry roll per style — real geometric variety without an extra
    // combinatorial axis that would mostly reproduce near-identical siblings.
    const symmetry = rng.int(4, 7);
    for (const enclosure of ENCLOSURES) {
      for (const fillStyle of distinctFillStyles(enclosure)) {
        pool.push({
          mark: { ...base, style, glyph: undefined, symmetry, enclosure, fillStyle },
          label: `${STYLE_LABEL[style]} · ${ENCLOSURE_LABEL[enclosure]}${FILL_SUFFIX[fillStyle]}`,
        });
      }
    }
  }

  for (const style of ["monogram", "lettermark-cut"] as const) {
    for (const enclosure of ENCLOSURES) {
      for (const fillStyle of distinctFillStyles(enclosure)) {
        pool.push({
          mark: { ...base, style, glyph: undefined, enclosure, fillStyle },
          label: `${STYLE_LABEL[style]} · ${ENCLOSURE_LABEL[enclosure]}${FILL_SUFFIX[fillStyle]}`,
        });
      }
    }
  }

  pool.push({ mark: { ...base, style: "wordmark-only", glyph: undefined, enclosure: "none" }, label: "Wordmark only" });

  return pool;
}

/**
 * Mark alternatives.
 *
 * Every glyph the industry offers, in every enclosure, in every fill
 * treatment that actually differs — plus the abstract forms, the monogram and
 * the cut letterform the same way. That pool typically runs 150–250
 * candidates; every one is scored, and only the best-scoring `count` survive,
 * with the option currently in use always kept first.
 */
export function markAlternatives(
  spec: BrandIdentitySpec,
  industryKey: string,
  count = 72,
): MarkOption[] {
  const rng = new Rng(hashString(`${spec.name}|marks|${spec.directionId}`));
  const pool = markCandidatePool(spec, industryKey, rng);

  const seen = new Set<string>();
  const scored: MarkOption[] = [];

  const fingerprint = (m: MarkSpec) => `${m.style}:${m.glyph ?? ""}:${m.enclosure}:${m.fillStyle}`;

  const currentKey = fingerprint(spec.mark);
  seen.add(currentKey);
  scored.push({ id: "current", mark: spec.mark, label: "Current", score: scoreWith(spec, { mark: spec.mark }) });

  for (const candidate of pool) {
    const key = fingerprint(candidate.mark);
    if (seen.has(key)) continue;
    seen.add(key);
    scored.push({
      id: key.replace(/[^a-z0-9]+/gi, "-"),
      mark: candidate.mark,
      label: candidate.label,
      score: scoreWith(spec, { mark: candidate.mark }),
    });
  }

  const [current, ...rest] = scored;
  rest.sort((a, b) => b.score - a.score);
  return [current!, ...rest].slice(0, count);
}

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

/**
 * Palette alternatives.
 *
 * Each mood is rolled several times with different seeds — a mood defines a
 * hue window and a saturation/lightness range, not one fixed colour, so
 * re-rolling it produces genuinely different but still on-mood palettes.
 * Candidates whose primary hue lands within 10° of an already-kept option in
 * the same mood are dropped before scoring settles the rest, so the visible
 * set does not repeat the same orange three times with a one-degree hue shift.
 */
export function paletteAlternatives(
  spec: BrandIdentitySpec,
  brief: BrandBrief,
  count = 28,
  seedsPerMood = 5,
): PaletteOption[] {
  const industry = getIndustry(brief.industry);
  const profile = profileFor(brief.personality);

  const current: PaletteOption = {
    id: "current",
    palette: spec.palette,
    label: "Current",
    mood: brief.colorMood,
    score: scoreWith(spec, { palette: spec.palette }),
  };

  const candidates: (PaletteOption & { hue: number })[] = [];
  for (const mood of Object.values(MOODS)) {
    for (let variant = 0; variant < seedsPerMood; variant++) {
      const rng = new Rng(hashString(`${spec.name}|palette|${mood.mood}|${variant}|${spec.directionId}`));
      const palette = generatePalette({ industry, profile, mood: mood.mood, rng });
      const [hue] = hexToHsl(palette.primary.hex);
      candidates.push({
        id: `${mood.mood}-${variant}`,
        palette,
        label: variant === 0 ? mood.label : `${mood.label} ${variant + 1}`,
        mood: mood.mood,
        score: scoreWith(spec, { palette }),
        hue,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  // Circular hue distance in [0, 180]: 0 means identical hue, 180 means
  // opposite. Dropping anything under 10° is what keeps the visible set from
  // repeating the same orange three times with a one-degree shift — the
  // inverted version of this check (an earlier bug) flagged near-opposite
  // hues as duplicates instead, which meant it never dropped anything.
  const hueDistance = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

  const kept: (PaletteOption & { hue: number })[] = [];
  for (const candidate of candidates) {
    const tooClose = kept.some(
      (k) => k.mood === candidate.mood && hueDistance(k.hue, candidate.hue) < 10,
    );
    if (tooClose) continue;
    kept.push(candidate);
    if (kept.length >= count - 1) break;
  }

  return [current, ...kept.map(({ hue: _hue, ...rest }) => rest)];
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

/**
 * Type pairing alternatives.
 *
 * Two pools, merged. The first sweeps every display typeface the script
 * supports, at every weight that face ships — direct catalogue coverage, not
 * a sample of it, which is what "multiple font options" actually means. The
 * body face and caps treatment stay fixed to the current pairing in this pool,
 * so what changes between options is legible: the typeface itself, not three
 * variables moving at once.
 *
 * The second pool re-runs the pairing engine with a serif or sans face forced,
 * for the cases where the body face or tracking should change too. Both pools
 * are scored and merged, so a face that reads badly at the requested weight —
 * a hairline serif shrunk for a signage-heavy category, say — sorts below one
 * that doesn't, rather than appearing as an equal option.
 */
export function typeAlternatives(
  spec: BrandIdentitySpec,
  brief: BrandBrief,
  // High enough that the full display-face sweep (every Latin display family
  // at every weight it ships — currently ~39 combinations) always fits without
  // a tie-break in the readiness score silently dropping a whole typeface.
  count = 48,
  seedsPerForce = 10,
): TypeOption[] {
  const industry = getIndustry(brief.industry);
  const profile = profileFor(brief.personality);
  const script = scriptFor(brief.language);

  // Weight is part of the fingerprint, not just the family pair: the same two
  // families at 400 and at 700 read as genuinely different options, not
  // duplicates of each other.
  const fingerprint = (t: BrandTypography) =>
    `${t.display.family}/${t.display.weight}/${t.body.family}/${t.body.weight}/${t.display.transform}`;

  const current: TypeOption = {
    id: "current",
    typography: spec.typography,
    label: "Current",
    score: scoreWith(spec, { typography: spec.typography }),
  };

  const seen = new Set<string>([fingerprint(spec.typography)]);
  const candidates: TypeOption[] = [];

  const push = (typography: BrandTypography, label: string) => {
    const key = fingerprint(typography);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ id: key.replace(/[^a-z0-9]+/gi, "-"), typography, label, score: scoreWith(spec, { typography }) });
  };

  // Pool 1 — every display face the script supports, at every weight it ships.
  const displayPool = fontsForScript("latin", "display");
  for (const font of displayPool) {
    for (const weight of font.weights) {
      push(
        {
          ...spec.typography,
          display: {
            family: font.family,
            weight: resolveWeight(font.family, weight),
            letterSpacing: safeTracking(
              brief.language,
              spec.typography.display.transform === "uppercase"
                ? Math.max(0.04, font.idealTracking + 0.06)
                : font.idealTracking,
            ),
            transform: spec.typography.display.transform,
          },
        },
        `${font.family} ${weight}`,
      );
    }
  }

  // Pool 2 — the pairing engine re-run with a classification forced, so body
  // face and tracking can move too, not just the display face.
  for (const force of ["serif", "sans", undefined] as const) {
    for (let seed = 0; seed < seedsPerForce; seed++) {
      const rng = new Rng(hashString(`${spec.name}|type|${force ?? "auto"}|${seed}`));
      const typography = generateTypography({
        industry, profile, language: brief.language, script, rng, forceDisplay: force,
      });
      push(typography, `${typography.display.family} ${typography.display.weight} + ${typography.body.family}`);
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return [current, ...candidates.slice(0, count - 1)];
}

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

/** Total options across all three axes — what the UI advertises. */
export function totalOptionCount(set: AlternativeSet): number {
  return set.marks.length + set.palettes.length + set.types.length;
}
