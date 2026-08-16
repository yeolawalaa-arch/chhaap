import { generateDirections } from "@/lib/brand/engine";
import { getIndustry, INDUSTRIES } from "@/lib/brand/industries";
import { profileFor } from "@/lib/brand/personality";
import { generateTaglines, voicePackFor } from "@/lib/brand/voice";
import { Rng, hashString } from "@/lib/brand/rng";
import type {
  AiProvider,
  AiResult,
  CaptionInput,
  GenerateNamesInput,
  GenerateTaglinesInput,
  NameSuggestion,
  RefineVoiceInput,
} from "@/lib/ai/types";
import type { BrandBrief, BrandStrategy, LanguageCode, PersonalityTrait } from "@/types/brand";

/**
 * The deterministic provider — the product's default engine.
 *
 * This is not a stub standing in for a "real" implementation. It is the system
 * that produces every visual decision the platform makes, and it runs with no
 * API key, no network call and no per-generation cost. A language model, when
 * configured, layers extra language quality on top of it.
 */

// ---------------------------------------------------------------------------
// Name generation
// ---------------------------------------------------------------------------

/**
 * Morphemes that produce names an Indian business would actually trade under.
 * Sanskrit/Hindi roots carry meaning that customers recognise, which is why
 * each carries a gloss — the meaning is shown to the user, not invented later.
 */
const ROOTS: { word: string; meaning: string; moods: string[] }[] = [
  { word: "Aarambh", meaning: "beginning", moods: ["modern", "energetic"] },
  { word: "Anand", meaning: "joy", moods: ["friendly", "warm"] },
  { word: "Chhaya", meaning: "shade, shelter", moods: ["warm", "trustworthy"] },
  { word: "Dhara", meaning: "a steady stream", moods: ["trustworthy", "minimal"] },
  { word: "Kalpa", meaning: "imagination", moods: ["playful", "premium"] },
  { word: "Nirvi", meaning: "calm, without worry", moods: ["minimal", "premium"] },
  { word: "Ojas", meaning: "vital energy", moods: ["energetic", "bold"] },
  { word: "Prisha", meaning: "beloved gift", moods: ["warm", "premium"] },
  { word: "Rooh", meaning: "soul", moods: ["handcrafted", "premium"] },
  { word: "Saanjh", meaning: "dusk", moods: ["warm", "traditional"] },
  { word: "Sattva", meaning: "purity, essence", moods: ["premium", "minimal"] },
  { word: "Tara", meaning: "star", moods: ["premium", "playful"] },
  { word: "Uday", meaning: "sunrise", moods: ["energetic", "modern"] },
  { word: "Vritti", meaning: "a way of being", moods: ["technical", "minimal"] },
  { word: "Amara", meaning: "everlasting", moods: ["premium", "traditional"] },
  { word: "Nira", meaning: "water, pure", moods: ["minimal", "modern"] },
  { word: "Kesar", meaning: "saffron", moods: ["traditional", "premium"] },
  { word: "Mitti", meaning: "earth", moods: ["handcrafted", "traditional"] },
  { word: "Dhaga", meaning: "thread", moods: ["handcrafted", "traditional"] },
  { word: "Basti", meaning: "settlement, neighbourhood", moods: ["friendly", "warm"] },
  { word: "Nukkad", meaning: "street corner", moods: ["friendly", "playful"] },
  { word: "Chowk", meaning: "town square", moods: ["traditional", "friendly"] },
  { word: "Adda", meaning: "a gathering place", moods: ["playful", "friendly"] },
  { word: "Kadak", meaning: "strong, bold", moods: ["bold", "energetic"] },
  { word: "Halka", meaning: "light", moods: ["minimal", "playful"] },
];

const SUFFIXES = ["& Co", "Works", "House", "Studio", "Collective", "Supply", "Bros", "Company"];

export function heuristicNames(input: GenerateNamesInput, count = 8): NameSuggestion[] {
  const industry = getIndustry(input.industry);
  const rng = new Rng(
    hashString(`${input.industry}|${input.keywords.join(",")}|${input.personality.join(",")}|${input.city ?? ""}`),
  );
  const personality = new Set(input.personality);
  const out: NameSuggestion[] = [];
  const seen = new Set<string>();

  const push = (name: string, meaning: string, rationale: string) => {
    const key = name.toLowerCase();
    if (seen.has(key) || out.length >= count) return;
    seen.add(key);
    out.push({
      name,
      meaning,
      rationale,
      domainStem: name.toLowerCase().replace(/[^a-z0-9]/g, ""),
    });
  };

  // 1. Root + category word — the most common real-world construction.
  const roots = rng.shuffle(
    ROOTS.filter((r) => r.moods.some((m) => personality.has(m as PersonalityTrait))).length >= 4
      ? ROOTS.filter((r) => r.moods.some((m) => personality.has(m as PersonalityTrait)))
      : ROOTS,
  );
  for (const root of roots.slice(0, Math.ceil(count / 2))) {
    const category = rng.pick(industry.nameRoots);
    push(
      `${root.word} ${category}`,
      `"${root.word}" means ${root.meaning}.`,
      `Pairs a familiar root with a category word, so customers grasp what you sell on first read.`,
    );
  }

  // 2. Keyword-led, using what the user actually typed.
  for (const keyword of input.keywords.slice(0, 3)) {
    const clean = keyword.trim().replace(/\s+/g, "");
    if (!clean) continue;
    const root = rng.pick(roots);
    push(
      `${cap(clean)} ${rng.pick(industry.nameRoots)}`,
      `Built directly on "${keyword}".`,
      `Leads with your own keyword — strongest for local search and word of mouth.`,
    );
    push(
      `${root.word}${clean.toLowerCase()}`,
      `"${root.word}" (${root.meaning}) joined to "${keyword}".`,
      `A single coined word — easier to own as a domain and a handle.`,
    );
  }

  // 3. Place-led, which is how most Indian local businesses are actually named.
  if (input.city) {
    push(
      `${input.city} ${rng.pick(industry.nameRoots)}`,
      `Names your city directly.`,
      `Immediate local trust, though it makes expanding to other cities harder later.`,
    );
  }

  // 4. Root + suffix for a more corporate read.
  for (const root of roots.slice(0, 2)) {
    push(
      `${root.word} ${rng.pick(SUFFIXES)}`,
      `"${root.word}" means ${root.meaning}.`,
      `The suffix signals an established company rather than a single shop.`,
    );
  }

  while (out.length < count && roots.length) {
    const root = rng.pick(roots);
    push(root.word, `Means ${root.meaning}.`, `A single word — the most memorable and the hardest to secure.`);
    if (out.length >= count) break;
    if (seen.size > 60) break;
  }

  return out.slice(0, count);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class HeuristicProvider implements AiProvider {
  readonly name = "heuristic";
  readonly model = undefined;
  readonly isModelBacked = false;

  async generateDirections(brief: BrandBrief, count: number, salt = "") {
    const started = Date.now();
    const data = generateDirections({ brief, count, salt });
    return this.wrap(data, started);
  }

  async generateNames(input: GenerateNamesInput) {
    const started = Date.now();
    return this.wrap(heuristicNames(input, input.count ?? 8), started);
  }

  async generateTaglines(input: GenerateTaglinesInput) {
    const started = Date.now();
    const industry = getIndustry(input.industry);
    const profile = profileFor(input.personality as PersonalityTrait[]);
    const rng = new Rng(hashString(`${input.businessName}|taglines`));
    const brief: BrandBrief = {
      businessName: input.businessName,
      industry: input.industry,
      audience: input.audience,
      personality: input.personality as PersonalityTrait[],
      colorMood: "auto",
      language: input.language as LanguageCode,
    };
    return this.wrap(generateTaglines(brief, industry, profile, rng, input.count ?? 6), started);
  }

  async refineVoice(input: RefineVoiceInput) {
    // Already produced by the strategy engine; returned unchanged so callers
    // have one code path regardless of provider.
    const started = Date.now();
    return this.wrap(input.strategy.voice, started);
  }

  async generateCaption(input: CaptionInput) {
    const started = Date.now();
    const pack = voicePackFor(input.language as LanguageCode);
    const rng = new Rng(hashString(`${input.spec.name}|${input.topic}`));
    const caption = rng
      .pick(pack.captions)
      .replace(/\{name\}/g, input.spec.name)
      .replace(/\{city\}/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return this.wrap(caption, started);
  }

  private wrap<T>(data: T, started: number): AiResult<T> {
    return { data, meta: { provider: this.name, latencyMs: Date.now() - started } };
  }
}
