import type {
  ColorMood,
  EnclosureShape,
  MarkStyle,
  PatternKind,
  PersonalityTrait,
} from "@/types/brand";

/**
 * Personality traits are the bridge between what a user *says* about their
 * business and what the renderer *does*. Each trait carries numeric biases that
 * the engine sums across the user's selections, so "premium + minimal" produces
 * a measurably different system from "playful + warm" rather than a reskin.
 */

export interface TraitDef {
  id: PersonalityTrait;
  label: string;
  /** One-line description shown on the selection chip. */
  hint: string;
  /** Nudges the palette generator. */
  color: {
    saturation: number; // −1 restrained … +1 vivid
    lightness: number; // −1 deep … +1 airy
    contrast: number; // −1 soft … +1 stark
    preferredMoods: ColorMood[];
  };
  /** Nudges typography selection. */
  type: {
    /** −1 strongly serif … +1 strongly sans. */
    sansBias: number;
    weight: number; // target display weight
    tracking: number; // em
    /** Preference for all-caps display type. */
    capsBias: number;
  };
  /** Weights over mark styles; summed then sampled. */
  markWeights: Partial<Record<MarkStyle, number>>;
  enclosureWeights: Partial<Record<EnclosureShape, number>>;
  patternWeights: Partial<Record<PatternKind, number>>;
  /** Adjectives injected into the strategy copy. */
  voiceWords: string[];
  /** Words the brand voice should avoid, given this trait. */
  avoidWords: string[];
}

export const TRAITS: Record<PersonalityTrait, TraitDef> = {
  premium: {
    id: "premium",
    label: "Premium",
    hint: "Considered, high-value, quietly confident",
    color: {
      saturation: -0.35,
      lightness: -0.3,
      contrast: 0.5,
      preferredMoods: ["jewel", "monochrome", "cool"],
    },
    type: { sansBias: -0.4, weight: 400, tracking: 0.14, capsBias: 0.7 },
    markWeights: { monogram: 3, "lettermark-cut": 2, "abstract-orbit": 1.5, glyph: 1 },
    enclosureWeights: { circle: 2, none: 2.5, diamond: 1.2, "rounded-square": 0.8 },
    patternWeights: { concentric: 2, lattice: 1.6, "grid-dots": 1 },
    voiceWords: ["crafted", "considered", "refined", "enduring"],
    avoidWords: ["cheap", "discount", "basic"],
  },
  friendly: {
    id: "friendly",
    label: "Friendly",
    hint: "Approachable, human, easy to talk to",
    color: {
      saturation: 0.25,
      lightness: 0.25,
      contrast: -0.1,
      preferredMoods: ["warm", "pastel", "vibrant"],
    },
    type: { sansBias: 0.7, weight: 600, tracking: -0.01, capsBias: -0.4 },
    markWeights: { glyph: 3, "abstract-petal": 2, monogram: 1.5 },
    enclosureWeights: { circle: 2.5, squircle: 2, "rounded-square": 2 },
    patternWeights: { "grid-dots": 2, waves: 1.6, "mark-tile": 1.4 },
    voiceWords: ["welcome", "easy", "together", "yours"],
    avoidWords: ["utilise", "leverage", "synergy"],
  },
  trustworthy: {
    id: "trustworthy",
    label: "Trustworthy",
    hint: "Reliable, established, safe hands",
    color: {
      saturation: -0.1,
      lightness: -0.1,
      contrast: 0.35,
      preferredMoods: ["cool", "monochrome"],
    },
    type: { sansBias: 0.2, weight: 600, tracking: 0.02, capsBias: 0.2 },
    markWeights: { monogram: 2.5, glyph: 2, "abstract-stack": 1.5 },
    enclosureWeights: { shield: 2.5, circle: 2, hexagon: 1.4, banner: 1.2 },
    patternWeights: { "grid-dots": 1.8, chevron: 1.4, lattice: 1.2 },
    voiceWords: ["assured", "verified", "since", "guaranteed"],
    avoidWords: ["maybe", "probably", "try"],
  },
  modern: {
    id: "modern",
    label: "Modern",
    hint: "Current, clean, built for today",
    color: {
      saturation: 0.1,
      lightness: 0,
      contrast: 0.4,
      preferredMoods: ["cool", "vibrant", "monochrome"],
    },
    type: { sansBias: 0.9, weight: 600, tracking: -0.02, capsBias: 0.1 },
    markWeights: { "abstract-orbit": 2.5, "lettermark-cut": 2.2, monogram: 2, "abstract-stack": 2 },
    enclosureWeights: { none: 3, squircle: 1.8, circle: 1.4 },
    patternWeights: { "diagonal-stripes": 2, "grid-dots": 1.8, concentric: 1.4 },
    voiceWords: ["fast", "simple", "clear", "now"],
    avoidWords: ["olde", "vintage", "classical"],
  },
  traditional: {
    id: "traditional",
    label: "Traditional",
    hint: "Rooted, time-honoured, familiar",
    color: {
      saturation: 0.05,
      lightness: -0.25,
      contrast: 0.3,
      preferredMoods: ["earthy", "jewel", "warm"],
    },
    type: { sansBias: -0.85, weight: 500, tracking: 0.06, capsBias: 0.4 },
    markWeights: { glyph: 3, monogram: 2.5, "abstract-petal": 2 },
    enclosureWeights: { arch: 3, circle: 2, banner: 1.8, shield: 1.4 },
    // Arches and lattices reference North Indian jaali and temple architecture
    // as geometry, not as clip-art motifs.
    patternWeights: { arches: 3, lattice: 2.4, concentric: 1.6 },
    voiceWords: ["since", "heritage", "family", "generations"],
    avoidWords: ["disrupt", "hack", "beta"],
  },
  playful: {
    id: "playful",
    label: "Playful",
    hint: "Fun, energetic, doesn't take itself too seriously",
    color: {
      saturation: 0.55,
      lightness: 0.2,
      contrast: 0.1,
      preferredMoods: ["vibrant", "warm", "pastel"],
    },
    type: { sansBias: 0.8, weight: 700, tracking: -0.03, capsBias: -0.5 },
    markWeights: { glyph: 3, "abstract-petal": 2.5, monogram: 1 },
    enclosureWeights: { squircle: 2.5, circle: 2, "rounded-square": 2, banner: 1.2 },
    patternWeights: { waves: 2.4, "mark-tile": 2, "grid-dots": 1.8, chevron: 1.4 },
    voiceWords: ["yay", "grab", "treat", "happy"],
    avoidWords: ["hereby", "pursuant", "compliance"],
  },
  bold: {
    id: "bold",
    label: "Bold",
    hint: "Loud, confident, impossible to ignore",
    color: {
      saturation: 0.5,
      lightness: -0.15,
      contrast: 0.8,
      preferredMoods: ["vibrant", "jewel"],
    },
    type: { sansBias: 0.6, weight: 800, tracking: -0.03, capsBias: 0.8 },
    markWeights: { "lettermark-cut": 3, monogram: 2.5, "abstract-stack": 2 },
    enclosureWeights: { "rounded-square": 2, none: 2, hexagon: 1.8, diamond: 1.5 },
    patternWeights: { "diagonal-stripes": 3, chevron: 2.2 },
    voiceWords: ["own it", "no excuses", "straight up", "big"],
    avoidWords: ["perhaps", "somewhat", "gentle"],
  },
  minimal: {
    id: "minimal",
    label: "Minimal",
    hint: "Stripped back, nothing wasted",
    color: {
      saturation: -0.5,
      lightness: 0.1,
      contrast: 0.6,
      preferredMoods: ["monochrome", "cool", "pastel"],
    },
    type: { sansBias: 0.7, weight: 500, tracking: 0.08, capsBias: 0.5 },
    markWeights: { "lettermark-cut": 2.5, monogram: 2.5, "abstract-orbit": 2, "wordmark-only": 2 },
    enclosureWeights: { none: 4, circle: 1.2 },
    patternWeights: { "grid-dots": 2, "diagonal-stripes": 1.4, concentric: 1.2 },
    voiceWords: ["less", "clear", "essential", "quiet"],
    avoidWords: ["ultimate", "revolutionary", "amazing"],
  },
  warm: {
    id: "warm",
    label: "Warm",
    hint: "Comforting, generous, hospitable",
    color: {
      saturation: 0.3,
      lightness: 0.1,
      contrast: -0.05,
      preferredMoods: ["warm", "earthy", "pastel"],
    },
    type: { sansBias: -0.3, weight: 500, tracking: 0.01, capsBias: -0.3 },
    markWeights: { glyph: 2.8, "abstract-petal": 2.4, monogram: 1.6 },
    enclosureWeights: { circle: 2.4, arch: 2, squircle: 1.8 },
    patternWeights: { arches: 2, waves: 1.8, "mark-tile": 1.5 },
    voiceWords: ["home", "care", "share", "always"],
    avoidWords: ["transactional", "process", "unit"],
  },
  energetic: {
    id: "energetic",
    label: "Energetic",
    hint: "Fast-moving, high-tempo, alive",
    color: {
      saturation: 0.6,
      lightness: 0.05,
      contrast: 0.5,
      preferredMoods: ["vibrant", "warm"],
    },
    type: { sansBias: 0.75, weight: 700, tracking: -0.02, capsBias: 0.5 },
    markWeights: { "abstract-orbit": 2.6, "lettermark-cut": 2.2, "abstract-petal": 2 },
    enclosureWeights: { none: 2.4, diamond: 1.8, circle: 1.6 },
    patternWeights: { "diagonal-stripes": 2.6, chevron: 2.2, waves: 1.6 },
    voiceWords: ["go", "move", "now", "power"],
    avoidWords: ["slowly", "eventually", "someday"],
  },
  handcrafted: {
    id: "handcrafted",
    label: "Handcrafted",
    hint: "Made by hand, small batch, imperfect on purpose",
    color: {
      saturation: -0.05,
      lightness: -0.2,
      contrast: 0.25,
      preferredMoods: ["earthy", "warm"],
    },
    type: { sansBias: -0.75, weight: 400, tracking: 0.05, capsBias: 0.2 },
    markWeights: { glyph: 3, "abstract-petal": 2.2, monogram: 1.8 },
    enclosureWeights: { circle: 2.4, arch: 1.8, banner: 1.6, none: 1.4 },
    patternWeights: { lattice: 2.2, arches: 1.8, concentric: 1.6 },
    voiceWords: ["small batch", "by hand", "slow", "honest"],
    avoidWords: ["mass", "automated", "industrial"],
  },
  technical: {
    id: "technical",
    label: "Technical",
    hint: "Precise, engineered, spec-driven",
    color: {
      saturation: -0.2,
      lightness: -0.1,
      contrast: 0.65,
      preferredMoods: ["cool", "monochrome"],
    },
    type: { sansBias: 0.95, weight: 600, tracking: 0.03, capsBias: 0.6 },
    markWeights: { "abstract-stack": 2.8, "lettermark-cut": 2.4, monogram: 2 },
    enclosureWeights: { hexagon: 2.8, none: 2, "rounded-square": 1.6 },
    patternWeights: { "grid-dots": 2.6, lattice: 2, chevron: 1.4 },
    voiceWords: ["precision", "tested", "spec", "tolerance"],
    avoidWords: ["magic", "vibe", "roughly"],
  },
};

export const TRAIT_LIST: TraitDef[] = Object.values(TRAITS);

/** Aggregated numeric profile for a set of selected traits. */
export interface TraitProfile {
  saturation: number;
  lightness: number;
  contrast: number;
  sansBias: number;
  weight: number;
  tracking: number;
  capsBias: number;
  markWeights: Record<string, number>;
  enclosureWeights: Record<string, number>;
  patternWeights: Record<string, number>;
  preferredMoods: ColorMood[];
  voiceWords: string[];
  avoidWords: string[];
  traits: TraitDef[];
}

/**
 * Averages the numeric biases and sums the categorical weights across the
 * user's chosen traits. Averaging (not summing) the numeric axes keeps a
 * three-trait brand from drifting to the extremes of every scale.
 */
export function profileFor(selected: PersonalityTrait[]): TraitProfile {
  const traits = selected.map((id) => TRAITS[id]).filter(Boolean);
  const list = traits.length ? traits : [TRAITS.modern, TRAITS.friendly];
  const n = list.length;

  const markWeights: Record<string, number> = {};
  const enclosureWeights: Record<string, number> = {};
  const patternWeights: Record<string, number> = {};
  const moods = new Set<ColorMood>();

  for (const t of list) {
    for (const [k, v] of Object.entries(t.markWeights)) markWeights[k] = (markWeights[k] ?? 0) + v;
    for (const [k, v] of Object.entries(t.enclosureWeights))
      enclosureWeights[k] = (enclosureWeights[k] ?? 0) + v;
    for (const [k, v] of Object.entries(t.patternWeights))
      patternWeights[k] = (patternWeights[k] ?? 0) + v;
    for (const m of t.color.preferredMoods) moods.add(m);
  }

  const avg = (fn: (t: TraitDef) => number) => list.reduce((s, t) => s + fn(t), 0) / n;

  return {
    saturation: avg((t) => t.color.saturation),
    lightness: avg((t) => t.color.lightness),
    contrast: avg((t) => t.color.contrast),
    sansBias: avg((t) => t.type.sansBias),
    weight: Math.round(avg((t) => t.type.weight) / 50) * 50,
    tracking: avg((t) => t.type.tracking),
    capsBias: avg((t) => t.type.capsBias),
    markWeights,
    enclosureWeights,
    patternWeights,
    preferredMoods: [...moods],
    voiceWords: list.flatMap((t) => t.voiceWords),
    avoidWords: list.flatMap((t) => t.avoidWords),
    traits: list,
  };
}

/**
 * Traits that pull in opposite directions. Surfaced in the wizard as a gentle
 * warning — not a block, because "traditional but modern" is a real brief.
 */
const TENSIONS: [PersonalityTrait, PersonalityTrait, string][] = [
  ["minimal", "playful", "Minimal and Playful pull apart — expect a restrained palette with one loud accent."],
  ["traditional", "modern", "Traditional and Modern together lands on 'heritage, updated' — classic type, contemporary spacing."],
  ["premium", "friendly", "Premium and Friendly can coexist, but the palette will stay muted to protect the premium read."],
  ["technical", "handcrafted", "Technical and Handcrafted conflict — the engine will favour precise geometry with warm colour."],
  ["bold", "minimal", "Bold and Minimal resolve as high contrast with very few elements."],
];

export function tensionNotes(selected: PersonalityTrait[]): string[] {
  const set = new Set(selected);
  return TENSIONS.filter(([a, b]) => set.has(a) && set.has(b)).map(([, , note]) => note);
}
