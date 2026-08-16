import { env } from "@/lib/config/env";
import { db } from "@/lib/db/client";
import { encodeJson } from "@/lib/db/json";
import { AnthropicProvider } from "@/lib/ai/anthropic";
import { HeuristicProvider } from "@/lib/ai/heuristic";
import type { AiProvider, AiResult } from "@/lib/ai/types";

export * from "@/lib/ai/types";
export { heuristicNames } from "@/lib/ai/heuristic";

/**
 * Provider resolution.
 *
 * Adding a provider means adding a class and one branch here — nothing else in
 * the codebase imports a vendor directly. A configured provider that is missing
 * its key falls back rather than throwing, so a bad deploy degrades to working
 * software instead of a broken signup flow.
 */

let cached: AiProvider | null = null;

export function aiProvider(): AiProvider {
  if (cached) return cached;

  switch (env.AI_PROVIDER) {
    case "anthropic":
      if (env.ANTHROPIC_API_KEY) {
        cached = new AnthropicProvider(env.ANTHROPIC_API_KEY);
        break;
      }
      console.warn("[ai] AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is unset — using the built-in engine.");
      cached = new HeuristicProvider();
      break;

    case "openai":
      // Reserved: the OpenAI implementation drops in here behind the same
      // interface. Until then the deterministic engine runs.
      console.warn("[ai] OpenAI provider is not implemented — using the built-in engine.");
      cached = new HeuristicProvider();
      break;

    default:
      cached = new HeuristicProvider();
  }

  return cached;
}

/** Test seam. */
export function resetProvider(): void {
  cached = null;
}

// ---------------------------------------------------------------------------
// Audit logging
// ---------------------------------------------------------------------------

export interface RecordOptions {
  userId: string;
  brandId?: string | null;
  kind: string;
  input: unknown;
}

/**
 * Runs a provider call and writes an `AiGeneration` row for it.
 *
 * Every path — including the deterministic engine — is logged, so usage limits,
 * admin analytics and cost reporting work identically regardless of which
 * provider served the request.
 */
export async function recordGeneration<T>(
  options: RecordOptions,
  run: () => Promise<AiResult<T>>,
): Promise<T> {
  const started = Date.now();

  try {
    const result = await run();

    await db.aiGeneration.create({
      data: {
        userId: options.userId,
        brandId: options.brandId ?? null,
        kind: options.kind,
        provider: result.meta.provider,
        model: result.meta.model ?? null,
        inputJson: encodeJson(options.input),
        outputJson: encodeJson(result.data),
        status: "success",
        latencyMs: result.meta.latencyMs,
        inputTokens: result.meta.inputTokens ?? null,
        outputTokens: result.meta.outputTokens ?? null,
      },
    }).catch((err) => {
      // Never let an audit-write failure take down a user-facing generation.
      console.error("[ai] failed to record generation:", err);
    });

    return result.data;
  } catch (err) {
    await db.aiGeneration.create({
      data: {
        userId: options.userId,
        brandId: options.brandId ?? null,
        kind: options.kind,
        provider: env.AI_PROVIDER,
        inputJson: encodeJson(options.input),
        status: "error",
        errorMessage: (err as Error).message.slice(0, 500),
        latencyMs: Date.now() - started,
      },
    }).catch(() => {});

    throw err;
  }
}

/** Label shown in the UI so users know what produced their copy. */
export function providerLabel(): { label: string; modelBacked: boolean } {
  const provider = aiProvider();
  return {
    label: provider.isModelBacked
      ? `${provider.name}${provider.model ? ` · ${provider.model}` : ""}`
      : "Chhaap Brand Brain",
    modelBacked: provider.isModelBacked,
  };
}
