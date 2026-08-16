import type {
  BrandBrief,
  BrandDirectionCandidate,
  BrandIdentitySpec,
  BrandStrategy,
} from "@/types/brand";

/**
 * The AI abstraction layer.
 *
 * Two things are deliberate here.
 *
 * First, the *visual* system never comes from a language model. Directions,
 * palettes, type pairings and marks are computed by the Brand Brain, because a
 * model asked to "pick a hex colour" produces something plausible but
 * unaccountable — it can't guarantee a 4.5:1 contrast ratio or that the mark
 * survives greyscale. The model's job is language: names, taglines, voice,
 * captions. That split is what makes the product's output defensible.
 *
 * Second, every method has a deterministic implementation that needs no API key
 * (`HeuristicProvider`). A deployment with no credentials is fully functional,
 * not degraded — which is why `AI_PROVIDER=heuristic` is the default rather
 * than an error state.
 */

export interface NameSuggestion {
  name: string;
  meaning: string;
  rationale: string;
  /** Suggested domain stem, e.g. "chaipoint" → chaipoint.in */
  domainStem: string;
}

export interface GenerateNamesInput {
  industry: string;
  keywords: string[];
  language: string;
  personality: string[];
  city?: string;
  count?: number;
}

export interface GenerateTaglinesInput {
  businessName: string;
  industry: string;
  language: string;
  personality: string[];
  audience: string;
  count?: number;
}

export interface RefineVoiceInput {
  spec: BrandIdentitySpec;
  strategy: BrandStrategy;
  brief: BrandBrief;
}

export interface CaptionInput {
  spec: BrandIdentitySpec;
  strategy: BrandStrategy;
  topic: string;
  language: string;
}

export interface ProviderMeta {
  provider: string;
  model?: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AiResult<T> {
  data: T;
  meta: ProviderMeta;
}

export interface AiProvider {
  readonly name: string;
  readonly model?: string;
  /** False for the heuristic engine — used by the UI to label output honestly. */
  readonly isModelBacked: boolean;

  /**
   * `salt` re-rolls the generation. Without it the engine is deterministic —
   * correct for stability, but it made "show me different ones" return the
   * identical set every time.
   */
  generateDirections(
    brief: BrandBrief,
    count: number,
    salt?: string,
  ): Promise<AiResult<BrandDirectionCandidate[]>>;
  generateNames(input: GenerateNamesInput): Promise<AiResult<NameSuggestion[]>>;
  generateTaglines(input: GenerateTaglinesInput): Promise<AiResult<string[]>>;
  refineVoice(input: RefineVoiceInput): Promise<AiResult<BrandStrategy["voice"]>>;
  generateCaption(input: CaptionInput): Promise<AiResult<string>>;
}
