import { Rng, hashString } from "@/lib/brand/rng";
import { getIndustry, type IndustryProfile } from "@/lib/brand/industries";
import { profileFor, type TraitProfile } from "@/lib/brand/personality";
import { describePalette, generatePalette, resolveMood } from "@/lib/brand/palettes";
import { describeTypography, generateTypography } from "@/lib/brand/typography";
import { generateStrategy } from "@/lib/brand/voice";
import { scriptFor, supportsBilingual } from "@/lib/brand/languages";
import { glyphExists, pickGlyph } from "@/lib/render/glyphs";
import type {
  BrandBrief,
  BrandDirectionCandidate,
  BrandIdentitySpec,
  EnclosureShape,
  LayoutTokens,
  MarkSpec,
  MarkStyle,
  PatternKind,
  PatternSpec,
} from "@/types/brand";

/**
 * The Brand Brain.
 *
 * Turns a brief into several complete, internally-consistent identity systems.
 *
 * The important property is *structured variety*: the directions offered to a
 * user are not random re-rolls of the same generator. Each one is an archetype
 * with its own constraints — a heritage seal genuinely differs from a modern
 * lettermark in mark style, enclosure, type classification and colour depth —
 * so the choice at step 4 is a real decision rather than a coin toss.
 */

// ---------------------------------------------------------------------------
// Direction archetypes
// ---------------------------------------------------------------------------

interface Archetype {
  id: string;
  label: string;
  /** One-line pitch shown on the direction card. */
  summary: string;
  markStyles: MarkStyle[];
  enclosures: EnclosureShape[];
  forceDisplay?: "serif" | "sans";
  /** Multiplier applied to the personality profile before generation. */
  tweak: (p: TraitProfile) => TraitProfile;
  /** How well this archetype suits the brief, 0–1, before personality scoring. */
  fit: (industry: IndustryProfile, profile: TraitProfile) => number;
  narrative: (name: string) => string;
  lockup: "stacked" | "horizontal" | "badge";
}

const ARCHETYPES: Archetype[] = [
  {
    id: "modern-mark",
    label: "Modern Mark",
    summary: "A geometric symbol beside clean sans type. Scales anywhere, ages slowly.",
    markStyles: ["abstract-orbit", "abstract-stack", "lettermark-cut"],
    enclosures: ["none", "squircle", "circle"],
    forceDisplay: "sans",
    tweak: (p) => ({ ...p, saturation: p.saturation - 0.1, contrast: p.contrast + 0.15 }),
    fit: (i, p) => 0.5 + (p.sansBias > 0 ? 0.3 : -0.1) + (i.group === "professional" || i.group === "creator" ? 0.2 : 0),
    narrative: (name) =>
      `An abstract mark built from ${name}'s initial, reduced to its simplest geometry. It carries no literal picture of the product, which is what lets it survive the business growing into new categories.`,
    lockup: "horizontal",
  },
  {
    id: "heritage-seal",
    label: "Heritage Seal",
    summary: "An enclosed emblem with classical type. Reads established from day one.",
    markStyles: ["monogram", "glyph"],
    enclosures: ["circle", "arch", "shield", "banner"],
    forceDisplay: "serif",
    tweak: (p) => ({ ...p, lightness: p.lightness - 0.2, saturation: p.saturation - 0.05 }),
    fit: (i, p) =>
      0.4 +
      (p.traits.some((t) => t.id === "traditional" || t.id === "premium" || t.id === "handcrafted") ? 0.35 : 0) +
      (i.group === "fashion" || i.group === "food" || i.group === "property" ? 0.2 : 0),
    narrative: (name) =>
      `A contained emblem — ${name} locked inside a single enclosing form. Emblems are what a business stamps on things: bags, boxes, receipts, a board above a door. The containment is the point.`,
    lockup: "badge",
  },
  {
    id: "bold-letterform",
    label: "Bold Letterform",
    summary: "The initial, cut heavy and confident. Impossible to miss at any distance.",
    markStyles: ["lettermark-cut", "monogram"],
    enclosures: ["rounded-square", "none", "hexagon", "diamond"],
    forceDisplay: "sans",
    tweak: (p) => ({ ...p, weight: Math.max(700, p.weight), contrast: p.contrast + 0.3 }),
    fit: (i, p) =>
      0.45 +
      (p.traits.some((t) => t.id === "bold" || t.id === "energetic") ? 0.35 : 0) +
      (i.needsSignage ? 0.15 : 0),
    narrative: (name) =>
      `${name}'s initial cut as a solid letterform. Heavy weight gives it presence on a board seen from across a road, and it stays readable when someone shrinks it to a WhatsApp display picture.`,
    lockup: "stacked",
  },
  {
    id: "warm-signature",
    label: "Warm Signature",
    summary: "A friendly pictorial mark with approachable type. Human before it is corporate.",
    markStyles: ["glyph", "abstract-petal"],
    enclosures: ["circle", "squircle", "none"],
    tweak: (p) => ({ ...p, saturation: p.saturation + 0.15, lightness: p.lightness + 0.1 }),
    fit: (i, p) =>
      0.45 +
      (p.traits.some((t) => t.id === "friendly" || t.id === "warm" || t.id === "playful") ? 0.3 : 0) +
      (i.group === "food" || i.group === "retail" || i.group === "beauty" ? 0.2 : 0),
    narrative: (name) =>
      `A drawn mark that shows what ${name} actually does. Pictorial marks are slower to abstract but far faster to understand — the right trade for a business that meets its customers in person.`,
    lockup: "stacked",
  },
  {
    id: "quiet-wordmark",
    label: "Quiet Wordmark",
    summary: "Type only, spaced with care. The most confident thing a brand can do.",
    markStyles: ["wordmark-only", "lettermark-cut"],
    enclosures: ["none"],
    tweak: (p) => ({ ...p, saturation: p.saturation - 0.25, contrast: p.contrast + 0.2 }),
    fit: (_i, p) =>
      0.35 + (p.traits.some((t) => t.id === "minimal" || t.id === "premium") ? 0.4 : 0),
    narrative: (name) =>
      `No symbol at all — ${name} set as the mark itself, with the spacing and weight doing the work. It asks more of the name and gives back a system that never has a symbol/name mismatch.`,
    lockup: "stacked",
  },
  {
    id: "fine-line",
    label: "Fine Line",
    summary: "A hairline mark and widely tracked type. Restraint, held with confidence.",
    markStyles: ["glyph", "abstract-orbit", "monogram"],
    enclosures: ["circle", "diamond", "none"],
    forceDisplay: "serif",
    tweak: (p) => ({
      ...p,
      saturation: p.saturation - 0.4,
      lightness: p.lightness - 0.15,
      weight: Math.min(500, p.weight),
      capsBias: 1,
      tracking: Math.max(p.tracking, 0.16),
    }),
    fit: (i, p) =>
      0.3 +
      (p.traits.some((t) => t.id === "premium" || t.id === "minimal") ? 0.45 : 0) +
      (i.group === "fashion" || i.group === "beauty" || i.group === "property" ? 0.2 : 0),
    narrative: (name) =>
      `${name} drawn at the lightest weight that still survives print. Hairline marks read as expensive because they assume the viewer is paying attention — the opposite bet to a bold logo shouting across a road.`,
    lockup: "stacked",
  },
  {
    id: "structured-grid",
    label: "Structured Grid",
    summary: "An engineered mark on a visible grid. Precise, systematic, technical.",
    markStyles: ["abstract-stack", "lettermark-cut", "monogram"],
    enclosures: ["hexagon", "rounded-square", "none"],
    forceDisplay: "sans",
    tweak: (p) => ({ ...p, saturation: p.saturation - 0.2, contrast: p.contrast + 0.25 }),
    fit: (i, p) =>
      0.35 +
      (p.traits.some((t) => t.id === "technical" || t.id === "modern") ? 0.35 : 0) +
      (i.group === "industry" || i.group === "professional" ? 0.25 : 0),
    narrative: (name) =>
      `${name} built on an exposed modular grid. Every angle is a multiple of the same unit, which is a claim about how the business works, made in geometry rather than words.`,
    lockup: "horizontal",
  },
];

// ---------------------------------------------------------------------------
// Mark generation
// ---------------------------------------------------------------------------

function initialsFor(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    // Drop legal/structural suffixes that would produce a meaningless initial.
    .filter((w) => !/^(and|the|of|pvt|ltd|llp|co|inc|private|limited|&)$/i.test(w));
  if (words.length === 0) return "B";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

function generateMark(
  brief: BrandBrief,
  industry: IndustryProfile,
  profile: TraitProfile,
  archetype: Archetype,
  rng: Rng,
): MarkSpec {
  // Intersect what the archetype allows with what the personality wants.
  const styleCandidates = archetype.markStyles.map((value) => ({
    value,
    weight: (profile.markWeights[value] ?? 0.5) + 1,
  }));
  const style = rng.weighted(styleCandidates);

  const enclosureCandidates = archetype.enclosures.map((value) => ({
    value,
    weight: (profile.enclosureWeights[value] ?? 0.4) + 0.6,
  }));
  const enclosure: EnclosureShape =
    style === "wordmark-only" ? "none" : rng.weighted(enclosureCandidates);

  const glyph =
    style === "glyph" ? pickGlyph(industry.glyphs, rng) : undefined;

  // A glyph style that resolved to nothing would render an empty mark — fall
  // back to a monogram rather than shipping a hole.
  const resolvedStyle: MarkStyle =
    style === "glyph" && (!glyph || !glyphExists(glyph)) ? "monogram" : style;

  const solid = enclosure !== "none" && rng.bool(0.62);
  const fillStyle: MarkSpec["fillStyle"] =
    archetype.id === "fine-line"
      ? "monoline"
      : solid
        ? "solid"
        : enclosure === "none"
          ? "solid"
          : rng.pick(["outline", "duotone"] as const);

  return {
    style: resolvedStyle,
    glyph: resolvedStyle === "glyph" ? glyph : undefined,
    initials: initialsFor(brief.businessName).slice(0, resolvedStyle === "monogram" ? 2 : 1),
    enclosure,
    // Heavier personalities get heavier strokes, clamped to what stays legible
    // when the mark is reproduced 16px wide as a favicon.
    strokeWeight: Math.round(clamp(6 + profile.weight / 90 + profile.contrast * 2, 5, 12)),
    fillStyle,
    symmetry: resolvedStyle === "abstract-petal" ? rng.int(5, 8) : rng.int(3, 6),
    cornerRadius: enclosure === "rounded-square" ? rng.int(14, 26) : rng.int(2, 8),
    inset: clamp(rng.float(0.5, 0.66) - (enclosure === "none" ? 0 : 0.06), 0.4, 0.72),
  };
}

function generatePatterns(
  industry: IndustryProfile,
  profile: TraitProfile,
  mark: MarkSpec,
  rng: Rng,
): PatternSpec[] {
  const pool = new Map<PatternKind, number>();
  for (const kind of industry.patterns) pool.set(kind, (pool.get(kind) ?? 0) + 2);
  for (const [kind, w] of Object.entries(profile.patternWeights)) {
    pool.set(kind as PatternKind, (pool.get(kind as PatternKind) ?? 0) + w);
  }
  if (mark.style !== "wordmark-only") pool.set("mark-tile", (pool.get("mark-tile") ?? 0) + 1.5);

  const entries = [...pool.entries()].map(([value, weight]) => ({ value, weight }));
  const chosen: PatternKind[] = [];
  for (let i = 0; i < 3 && entries.length; i++) {
    const kind = rng.weighted(entries.filter((e) => !chosen.includes(e.value)));
    if (!kind || chosen.includes(kind)) break;
    chosen.push(kind);
  }

  return chosen.map((kind, i) => ({
    kind,
    scale: round2(rng.float(0.7, 1.5)),
    // The first pattern is the workhorse background; later ones are accents.
    opacity: i === 0 ? round2(rng.float(0.06, 0.12)) : round2(rng.float(0.12, 0.3)),
    colors: i === 0 ? ["primary", "surface"] : ["accent", "surface"],
  }));
}

function generateLayout(profile: TraitProfile, rng: Rng): LayoutTokens {
  return {
    clearSpace: round2(clamp(0.5 + (profile.traits.some((t) => t.id === "minimal") ? 0.3 : 0), 0.4, 1)),
    radius: Math.round(clamp(12 - profile.contrast * 8 + rng.float(-2, 4), 0, 22)),
    unit: 8,
    borderWidth: profile.contrast > 0.4 ? 2 : 1,
  };
}

// ---------------------------------------------------------------------------
// Direction generation
// ---------------------------------------------------------------------------

/** Deterministic seed so the same brief always yields the same directions. */
export function briefSeed(brief: BrandBrief): string {
  return [
    brief.businessName.trim().toLowerCase(),
    brief.industry,
    brief.language,
    brief.colorMood,
    [...brief.personality].sort().join("+"),
    (brief.colorSeeds ?? []).join(","),
  ].join("|");
}

export interface GenerateDirectionsOptions {
  brief: BrandBrief;
  count?: number;
  /** Extra entropy for "generate more like this" without changing the brief. */
  salt?: string;
}

export function generateDirections({
  brief,
  count = 4,
  salt = "",
}: GenerateDirectionsOptions): BrandDirectionCandidate[] {
  const industry = getIndustry(brief.industry);
  const baseProfile = profileFor(brief.personality);
  const seed = briefSeed(brief) + salt;

  // Rank archetypes by fit, then take the best `count` — but always keep at
  // least one that scored low, so the user sees a genuine alternative rather
  // than four variations on the same idea.
  const ranked = ARCHETYPES.map((a) => ({
    archetype: a,
    fit: a.fit(industry, baseProfile),
  })).sort((x, y) => y.fit - x.fit);

  const chosen = ranked.slice(0, Math.max(1, count - 1)).map((r) => r.archetype);
  const wildcard = ranked[ranked.length - 1]?.archetype;
  if (wildcard && chosen.length < count && !chosen.includes(wildcard)) chosen.push(wildcard);
  while (chosen.length < count && ranked.length > chosen.length) {
    const next = ranked.find((r) => !chosen.includes(r.archetype));
    if (!next) break;
    chosen.push(next.archetype);
  }

  return chosen.map((archetype, index) => {
    // Per-direction RNG: same brief + same archetype ⇒ same output, always.
    const rng = new Rng(hashString(`${seed}#${archetype.id}#${index}`));
    const profile = archetype.tweak(baseProfile);

    const script = scriptFor(brief.language);
    const palette = generatePalette({
      industry,
      profile,
      mood: brief.colorMood,
      seeds: brief.colorSeeds,
      rng,
    });
    const typography = generateTypography({
      industry,
      profile,
      language: brief.language,
      script,
      rng,
      forceDisplay: archetype.forceDisplay,
    });
    const mark = generateMark(brief, industry, profile, archetype, rng);
    const patterns = generatePatterns(industry, profile, mark, rng);
    const layout = generateLayout(profile, rng);

    const moodDef = resolveMood(brief.colorMood, industry, profile, new Rng(seed));
    const spec: BrandIdentitySpec = {
      directionId: archetype.id,
      name: brief.businessName.trim(),
      descriptor: brief.descriptor?.trim() || pickDescriptor(industry, rng),
      localName: supportsBilingual(brief.language) ? brief.localName?.trim() || undefined : undefined,
      language: brief.language,
      script,
      palette,
      typography,
      mark,
      patterns,
      layout,
      lockup: archetype.lockup,
    };

    const strategy = generateStrategy({
      brief,
      industry,
      profile,
      rng,
      paletteNarrative: describePalette(palette, moodDef.label),
      typographyNarrative: describeTypography(typography),
      markNarrative: archetype.narrative(brief.businessName.trim()),
      directionLabel: archetype.label,
    });

    return {
      id: archetype.id,
      label: archetype.label,
      summary: archetype.summary,
      spec,
      strategy,
      score: Math.round(clamp(ranked[index]?.fit ?? 0.5, 0, 1) * 100),
    };
  });
}

function pickDescriptor(industry: IndustryProfile, rng: Rng): string {
  const seed = rng.pick(industry.descriptorSeeds);
  return seed.replace("{year}", String(new Date().getFullYear() - rng.int(2, 30)));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

export { ARCHETYPES, initialsFor };
