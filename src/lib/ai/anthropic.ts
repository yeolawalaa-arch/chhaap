import { env } from "@/lib/config/env";
import { generateDirections } from "@/lib/brand/engine";
import { HeuristicProvider } from "@/lib/ai/heuristic";
import { voicePackFor } from "@/lib/brand/voice";
import type {
  AiProvider,
  AiResult,
  CaptionInput,
  GenerateNamesInput,
  GenerateTaglinesInput,
  NameSuggestion,
  RefineVoiceInput,
} from "@/lib/ai/types";
import type { BrandBrief, BrandStrategy, LanguageCode } from "@/types/brand";

/**
 * Anthropic-backed language layer.
 *
 * Scope is deliberately narrow: names, taglines, voice and captions. Visual
 * decisions stay with the Brand Brain, so a model outage degrades copy quality
 * but never breaks brand generation — `generateDirections` here still runs the
 * deterministic engine and only asks the model to sharpen the written strategy.
 *
 * Called over plain fetch rather than the SDK so the abstraction stays free of
 * vendor types and a second provider is a file, not a refactor.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

interface MessageResponse {
  content: { type: string; text?: string }[];
  usage?: { input_tokens: number; output_tokens: number };
}

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  readonly model: string;
  readonly isModelBacked = true;

  private fallback = new HeuristicProvider();

  constructor(private apiKey: string, model?: string) {
    this.model = model ?? env.ANTHROPIC_MODEL;
  }

  // -------------------------------------------------------------------------
  // Transport
  // -------------------------------------------------------------------------

  private async complete(
    system: string,
    user: string,
    maxTokens = 1200,
  ): Promise<{ text: string; inputTokens?: number; outputTokens?: number }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": API_VERSION,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: user }],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Anthropic responded ${res.status}: ${detail.slice(0, 200)}`);
      }

      const json = (await res.json()) as MessageResponse;
      const text = json.content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("");

      return {
        text,
        inputTokens: json.usage?.input_tokens,
        outputTokens: json.usage?.output_tokens,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Extracts the first JSON array/object, tolerating prose or fences around it. */
  private parseJson<T>(text: string): T | null {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = (fenced?.[1] ?? text).trim();
    const start = candidate.search(/[[{]/);
    if (start === -1) return null;
    const end = Math.max(candidate.lastIndexOf("]"), candidate.lastIndexOf("}"));
    if (end <= start) return null;
    try {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }

  private meta(started: number, usage?: { inputTokens?: number; outputTokens?: number }) {
    return {
      provider: this.name,
      model: this.model,
      latencyMs: Date.now() - started,
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
    };
  }

  // -------------------------------------------------------------------------
  // Shared prompt context
  // -------------------------------------------------------------------------

  private systemPrompt(language: string): string {
    const pack = voicePackFor(language as LanguageCode);
    return [
      `You write brand copy for Indian small businesses — kirana stores, restaurants, salons, D2C labels, freelancers.`,
      `Your copy must sound like the owner talking to a regular customer, not like an agency deck.`,
      ``,
      `Rules:`,
      `- Write in ${language}. If the language is "hinglish", mix Hindi and English the way people actually speak in Indian cities — do not translate, code-switch naturally.`,
      `- For Indic languages, write in the native script, not transliteration.`,
      `- Be concrete. Name the product, the price, the time. Never write "excellence", "quality service", "your trusted partner".`,
      `- Keep every line short enough to fit one line on a phone screen.`,
      `- Never use em dashes in the output copy.`,
      ``,
      `Reference tone for this language: ${pack.tone.join(", ")}.`,
      `Example of the register expected: ${pack.captions[0] ?? ""}`,
      ``,
      `Reply with JSON only. No preamble, no explanation, no code fences.`,
    ].join("\n");
  }

  // -------------------------------------------------------------------------
  // Methods
  // -------------------------------------------------------------------------

  /**
   * The visual system comes from the deterministic engine; the model rewrites
   * only the strategy prose so the two can never disagree about, say, which
   * colour is primary.
   */
  async generateDirections(brief: BrandBrief, count: number) {
    const started = Date.now();
    const directions = generateDirections({ brief, count });

    try {
      const { text, inputTokens, outputTokens } = await this.complete(
        this.systemPrompt(brief.language),
        [
          `Business: ${brief.businessName}`,
          `Category: ${brief.industry}`,
          `Audience: ${brief.audience}`,
          `Personality: ${brief.personality.join(", ")}`,
          brief.city ? `City: ${brief.city}` : "",
          brief.notes ? `Owner's notes: ${brief.notes}` : "",
          ``,
          `For each of these ${directions.length} visual directions, write a positioning line and 4 taglines.`,
          directions.map((d, i) => `${i + 1}. ${d.label}: ${d.summary}`).join("\n"),
          ``,
          `Reply as JSON: [{"index":1,"positioning":"...","taglines":["...","...","...","..."]}]`,
        ]
          .filter(Boolean)
          .join("\n"),
        1600,
      );

      const parsed = this.parseJson<{ index: number; positioning?: string; taglines?: string[] }[]>(text);
      if (parsed) {
        for (const entry of parsed) {
          const target = directions[entry.index - 1];
          if (!target) continue;
          if (entry.positioning) target.strategy.positioning = entry.positioning;
          if (entry.taglines?.length) {
            target.strategy.taglines = entry.taglines.filter((t) => typeof t === "string" && t.length <= 70);
          }
        }
      }

      return { data: directions, meta: this.meta(started, { inputTokens, outputTokens }) };
    } catch (err) {
      // Copy enhancement failed; the brand system itself is unaffected.
      console.warn("[ai] direction copy enhancement failed, using engine output:", (err as Error).message);
      return { data: directions, meta: this.meta(started) };
    }
  }

  async generateNames(input: GenerateNamesInput): Promise<AiResult<NameSuggestion[]>> {
    const started = Date.now();
    const count = input.count ?? 8;

    try {
      const { text, inputTokens, outputTokens } = await this.complete(
        this.systemPrompt(input.language),
        [
          `Suggest ${count} brand names for a new ${input.industry} business in India.`,
          `Personality: ${input.personality.join(", ")}`,
          input.city ? `City: ${input.city}` : "",
          input.keywords.length ? `Owner's keywords: ${input.keywords.join(", ")}` : "",
          ``,
          `Mix these constructions: a meaningful Hindi/Sanskrit root, a coined single word, a place-led name, and a plain descriptive name.`,
          `Names must be pronounceable by both Hindi and English speakers, and short enough to fit a shop board.`,
          ``,
          `Reply as JSON: [{"name":"...","meaning":"what the word means, one line","rationale":"why it suits this business, one line","domainStem":"lowercase-no-spaces"}]`,
        ]
          .filter(Boolean)
          .join("\n"),
        1400,
      );

      const parsed = this.parseJson<NameSuggestion[]>(text);
      if (parsed?.length) {
        const clean = parsed
          .filter((s) => s?.name)
          .map((s) => ({
            name: String(s.name).slice(0, 40),
            meaning: String(s.meaning ?? "").slice(0, 160),
            rationale: String(s.rationale ?? "").slice(0, 200),
            domainStem: String(s.domainStem ?? s.name)
              .toLowerCase()
              .replace(/[^a-z0-9]/g, ""),
          }))
          .slice(0, count);
        if (clean.length) return { data: clean, meta: this.meta(started, { inputTokens, outputTokens }) };
      }
    } catch (err) {
      console.warn("[ai] name generation failed, falling back:", (err as Error).message);
    }

    return this.fallback.generateNames(input);
  }

  async generateTaglines(input: GenerateTaglinesInput): Promise<AiResult<string[]>> {
    const started = Date.now();
    const count = input.count ?? 6;

    try {
      const { text, inputTokens, outputTokens } = await this.complete(
        this.systemPrompt(input.language),
        [
          `Write ${count} taglines for "${input.businessName}", a ${input.industry} business.`,
          `Audience: ${input.audience}`,
          `Personality: ${input.personality.join(", ")}`,
          ``,
          `Each must be under 55 characters so it fits on a signboard.`,
          `Reply as JSON: ["tagline one","tagline two"]`,
        ].join("\n"),
        700,
      );

      const parsed = this.parseJson<string[]>(text);
      const clean = parsed?.filter((t) => typeof t === "string" && t.length > 0 && t.length <= 60);
      if (clean?.length) return { data: clean.slice(0, count), meta: this.meta(started, { inputTokens, outputTokens }) };
    } catch (err) {
      console.warn("[ai] tagline generation failed, falling back:", (err as Error).message);
    }

    return this.fallback.generateTaglines(input);
  }

  async refineVoice(input: RefineVoiceInput): Promise<AiResult<BrandStrategy["voice"]>> {
    const started = Date.now();

    try {
      const { text, inputTokens, outputTokens } = await this.complete(
        this.systemPrompt(input.brief.language),
        [
          `Business: ${input.spec.name} — ${input.brief.industry}`,
          `Audience: ${input.brief.audience}`,
          `Personality: ${input.brief.personality.join(", ")}`,
          ``,
          `Write this brand's voice guide.`,
          `Reply as JSON: {"tone":["word","word","word"],"dos":["...","...","..."],"donts":["...","...","..."],"sampleCaption":"an Instagram caption they could post today","sampleWhatsApp":"their WhatsApp Business greeting"}`,
        ].join("\n"),
        900,
      );

      const parsed = this.parseJson<BrandStrategy["voice"]>(text);
      if (parsed?.sampleCaption && Array.isArray(parsed.tone)) {
        return {
          data: {
            tone: parsed.tone.slice(0, 5).map(String),
            dos: (parsed.dos ?? input.strategy.voice.dos).slice(0, 5).map(String),
            donts: (parsed.donts ?? input.strategy.voice.donts).slice(0, 5).map(String),
            sampleCaption: String(parsed.sampleCaption).slice(0, 300),
            sampleWhatsApp: String(parsed.sampleWhatsApp ?? input.strategy.voice.sampleWhatsApp).slice(0, 300),
          },
          meta: this.meta(started, { inputTokens, outputTokens }),
        };
      }
    } catch (err) {
      console.warn("[ai] voice refinement failed, falling back:", (err as Error).message);
    }

    return this.fallback.refineVoice(input);
  }

  async generateCaption(input: CaptionInput): Promise<AiResult<string>> {
    const started = Date.now();

    try {
      const { text, inputTokens, outputTokens } = await this.complete(
        this.systemPrompt(input.language),
        [
          `Business: ${input.spec.name}`,
          `Voice: ${input.strategy.voice.tone.join(", ")}`,
          `Write one Instagram caption about: ${input.topic}`,
          `Reply as JSON: {"caption":"..."}`,
        ].join("\n"),
        400,
      );

      const parsed = this.parseJson<{ caption: string }>(text);
      if (parsed?.caption) {
        return { data: String(parsed.caption).slice(0, 400), meta: this.meta(started, { inputTokens, outputTokens }) };
      }
    } catch (err) {
      console.warn("[ai] caption generation failed, falling back:", (err as Error).message);
    }

    return this.fallback.generateCaption(input);
  }
}
