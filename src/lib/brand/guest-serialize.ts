import { buildLogoDocument, renderLogo, VARIATION_HINTS, VARIATION_LABELS } from "@/lib/render/logo";
import { renderAssetByKind } from "@/lib/render/assets/templates";
import { assetDefinition, withDefaults } from "@/lib/render/assets/definitions";
import { patternSwatch, PATTERN_LABELS, PATTERN_USAGE } from "@/lib/render/patterns";
import { contrastMatrix } from "@/lib/brand/palettes";
import { scoreIdentity } from "@/lib/brand/quality";
import { colorResolver } from "@/lib/render/svg";
import { LOGO_VARIATIONS, type AssetData, type AssetKind, type BrandIdentitySpec } from "@/types/brand";

/**
 * Renders every view of one identity that the guest flow's "brand" screen
 * needs: the primary preview, all eight logo variations, the four showcase
 * assets, the pattern swatches and the contrast table.
 *
 * Shared between /api/try/generate (one call per candidate direction) and
 * /api/try/apply (one call after a mark/colour/type swap), so both produce
 * byte-identical output for the same spec — a swapped mark renders through
 * exactly the same path a freshly generated direction does, not a second
 * lighter-weight preview that could drift from it.
 */

const SHOWCASE_ASSETS: AssetKind[] = ["visiting_card", "instagram_post", "signboard", "shopping_bag"];

export function serializeGuestSpec(spec: BrandIdentitySpec) {
  const resolve = colorResolver(spec, "brand");
  const quality = scoreIdentity(spec, buildLogoDocument(spec, "primary"));

  return {
    spec,
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
}
