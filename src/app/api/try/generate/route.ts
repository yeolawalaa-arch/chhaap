import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http/errors";
import { briefSchema } from "@/lib/http/schemas";
import { generateDirections } from "@/lib/brand/engine";
import { buildLogoDocument, renderLogo, VARIATION_HINTS, VARIATION_LABELS } from "@/lib/render/logo";
import { renderAssetByKind } from "@/lib/render/assets/templates";
import { assetDefinition, withDefaults } from "@/lib/render/assets/definitions";
import { patternSwatch, PATTERN_LABELS, PATTERN_USAGE } from "@/lib/render/patterns";
import { contrastMatrix } from "@/lib/brand/palettes";
import { scoreIdentity } from "@/lib/brand/quality";
import { colorResolver } from "@/lib/render/svg";
import { RULES, clientIp, enforce } from "@/lib/security/rate-limit";
import { LOGO_VARIATIONS, type AssetData, type AssetKind, type BrandBrief } from "@/types/brand";

/**
 * Guest brand generation — no account, no persistence.
 *
 * The Brand Brain is a pure function of the brief: no database read, no write,
 * no external call. That makes an anonymous version of the core product
 * genuinely possible rather than a crippled teaser — everything a signed-in
 * user sees at the direction stage is computed here identically.
 *
 * Nothing is stored. The client holds the result, which is also why this cannot
 * leak between visitors.
 */

const SHOWCASE_ASSETS: AssetKind[] = [
  "visiting_card",
  "instagram_post",
  "signboard",
  "shopping_bag",
];

export const POST = handleRoute(async (req: Request) => {
  // The only abuse surface is CPU, so the limit is per IP and deliberately
  // generous enough for real evaluation. Falls back to an in-process counter
  // when the database is unavailable.
  await enforce(RULES.aiGenerate, `guest:${clientIp(req)}`);

  const brief = briefSchema.parse(await req.json()) as BrandBrief;
  const directions = generateDirections({ brief, count: 4 });

  return NextResponse.json({
    directions: directions.map((direction) => {
      const spec = direction.spec;
      const resolve = colorResolver(spec, "brand");
      const quality = scoreIdentity(spec, buildLogoDocument(spec, "primary"));

      return {
        id: direction.id,
        label: direction.label,
        summary: direction.summary,
        score: direction.score,
        spec,
        strategy: direction.strategy,
        quality,

        preview: renderLogo({ doc: buildLogoDocument(spec, "primary"), spec }),

        variations: LOGO_VARIATIONS.map((variation) => {
          const doc = buildLogoDocument(spec, variation);
          return {
            variation,
            label: VARIATION_LABELS[variation],
            hint: VARIATION_HINTS[variation],
            svg: renderLogo({ doc, spec }),
            onDark: variation === "white",
          };
        }),

        assets: SHOWCASE_ASSETS.map((kind) => {
          const def = assetDefinition(kind);
          return {
            kind,
            label: def.name,
            ratio: def.dimension.width / def.dimension.height,
            svg: renderAssetByKind(kind, {
              spec,
              resolve,
              dim: def.dimension,
              data: withDefaults(kind, {}) as AssetData,
              // Guests always get the mark — this is the growth surface.
              watermark: true,
            }),
          };
        }),

        patterns: spec.patterns.map((pattern) => ({
          kind: pattern.kind,
          label: PATTERN_LABELS[pattern.kind],
          usage: PATTERN_USAGE[pattern.kind],
          svg: patternSwatch(pattern, spec, resolve, 200),
        })),

        contrast: contrastMatrix(spec.palette),
      };
    }),
  });
});
