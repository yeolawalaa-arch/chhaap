import type { LanguageCode, ScriptCode } from "@/types/brand";

/**
 * Language and script metadata.
 *
 * Two things matter here that generic logo tools get wrong for India:
 *  1. Script ≠ language. Hindi and Marathi share Devanagari; Punjabi needs
 *     Gurmukhi. The font pipeline keys off `script`, not `language`.
 *  2. Indic scripts have taller ascenders/descenders and a shirorekha (head
 *     line) in Devanagari, so lockups need more leading and a different optical
 *     baseline than Latin. `metrics` carries those corrections into the
 *     renderer instead of leaving text clipped.
 */

export interface LanguageDef {
  code: LanguageCode;
  /** English name shown in the picker. */
  name: string;
  /** Endonym, shown alongside so users recognise their own language. */
  nativeName: string;
  script: ScriptCode;
  /** Sample string used for live font previews in the UI. */
  sample: string;
  /** Rough speaker reach, used only to order the picker sensibly. */
  reachMillions: number;
  /** States/regions where this is the dominant business language. */
  regions: string[];
  metrics: ScriptMetrics;
}

export interface ScriptMetrics {
  /** Multiplier on line height relative to Latin. */
  lineHeight: number;
  /** Baseline nudge in em; Indic glyphs sit lower in most fonts. */
  baselineShift: number;
  /** Safe tracking range in em — Indic scripts break if tracked too wide. */
  maxTracking: number;
  /** True when the script has conjuncts that must not be letter-spaced. */
  hasConjuncts: boolean;
}

const LATIN_METRICS: ScriptMetrics = {
  lineHeight: 1,
  baselineShift: 0,
  maxTracking: 0.24,
  hasConjuncts: false,
};

const INDIC_METRICS: ScriptMetrics = {
  lineHeight: 1.32,
  baselineShift: -0.02,
  // Tracking Indic text apart severs conjuncts and matras — keep it near zero.
  maxTracking: 0.02,
  hasConjuncts: true,
};

export const LANGUAGES_META: Record<LanguageCode, LanguageDef> = {
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    script: "latin",
    sample: "Fresh every morning",
    reachMillions: 130,
    regions: ["Pan-India"],
    metrics: LATIN_METRICS,
  },
  hi: {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    script: "devanagari",
    sample: "रोज़ ताज़ा",
    reachMillions: 528,
    regions: ["Delhi", "Uttar Pradesh", "Bihar", "Madhya Pradesh", "Rajasthan", "Haryana"],
    metrics: INDIC_METRICS,
  },
  hinglish: {
    code: "hinglish",
    name: "Hinglish",
    nativeName: "Hinglish",
    // Hinglish is written in Latin script — this is the whole point of offering
    // it separately from Hindi, and why the voice engine treats it differently.
    script: "latin",
    sample: "Roz fresh, roz best",
    reachMillions: 350,
    regions: ["Metro India", "Tier-1 & Tier-2 cities"],
    metrics: LATIN_METRICS,
  },
  mr: {
    code: "mr",
    name: "Marathi",
    nativeName: "मराठी",
    script: "devanagari",
    sample: "रोज ताजे",
    reachMillions: 83,
    regions: ["Maharashtra", "Goa"],
    metrics: INDIC_METRICS,
  },
  gu: {
    code: "gu",
    name: "Gujarati",
    nativeName: "ગુજરાતી",
    script: "gujarati",
    sample: "રોજ તાજું",
    reachMillions: 55,
    regions: ["Gujarat", "Mumbai", "Daman & Diu"],
    metrics: INDIC_METRICS,
  },
  ta: {
    code: "ta",
    name: "Tamil",
    nativeName: "தமிழ்",
    script: "tamil",
    sample: "தினமும் புதியது",
    reachMillions: 78,
    regions: ["Tamil Nadu", "Puducherry"],
    metrics: { ...INDIC_METRICS, lineHeight: 1.38, hasConjuncts: false, maxTracking: 0.04 },
  },
  te: {
    code: "te",
    name: "Telugu",
    nativeName: "తెలుగు",
    script: "telugu",
    sample: "ప్రతిరోజూ తాజా",
    reachMillions: 83,
    regions: ["Andhra Pradesh", "Telangana"],
    metrics: { ...INDIC_METRICS, lineHeight: 1.42 },
  },
  bn: {
    code: "bn",
    name: "Bengali",
    nativeName: "বাংলা",
    script: "bengali",
    sample: "প্রতিদিন তাজা",
    reachMillions: 97,
    regions: ["West Bengal", "Tripura", "Assam"],
    metrics: INDIC_METRICS,
  },
  kn: {
    code: "kn",
    name: "Kannada",
    nativeName: "ಕನ್ನಡ",
    script: "kannada",
    sample: "ಪ್ರತಿದಿನ ತಾಜಾ",
    reachMillions: 44,
    regions: ["Karnataka"],
    metrics: { ...INDIC_METRICS, lineHeight: 1.42 },
  },
  ml: {
    code: "ml",
    name: "Malayalam",
    nativeName: "മലയാളം",
    script: "malayalam",
    sample: "എന്നും പുതിയത്",
    reachMillions: 35,
    regions: ["Kerala", "Lakshadweep"],
    metrics: { ...INDIC_METRICS, lineHeight: 1.44 },
  },
  pa: {
    code: "pa",
    name: "Punjabi",
    nativeName: "ਪੰਜਾਬੀ",
    script: "gurmukhi",
    sample: "ਹਰ ਰੋਜ਼ ਤਾਜ਼ਾ",
    reachMillions: 33,
    regions: ["Punjab", "Chandigarh", "Delhi"],
    metrics: INDIC_METRICS,
  },
};

export const LANGUAGE_LIST: LanguageDef[] = Object.values(LANGUAGES_META).sort(
  (a, b) => b.reachMillions - a.reachMillions,
);

export function languageDef(code: LanguageCode): LanguageDef {
  return LANGUAGES_META[code] ?? LANGUAGES_META.en;
}

export function scriptFor(code: LanguageCode): ScriptCode {
  return languageDef(code).script;
}

export function scriptMetrics(code: LanguageCode): ScriptMetrics {
  return languageDef(code).metrics;
}

/**
 * True when the brand should offer a bilingual lockup (Latin name + local
 * script name). Pointless for English and Hinglish, which are already Latin.
 */
export function supportsBilingual(code: LanguageCode): boolean {
  return languageDef(code).script !== "latin";
}

/** Clamps requested tracking to what the script can survive. */
export function safeTracking(code: LanguageCode, requested: number): number {
  return Math.min(requested, languageDef(code).metrics.maxTracking);
}
