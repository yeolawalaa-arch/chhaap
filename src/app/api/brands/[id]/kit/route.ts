import { NextResponse } from "next/server";
import { handleRoute, badRequest } from "@/lib/http/errors";
import { requireUser } from "@/lib/auth/session";
import { loadBrand } from "@/lib/brand/service";
import { entitlementFor } from "@/lib/billing/plans";
import { guidelinePages } from "@/lib/export/guidelines";
import { contrastMatrix } from "@/lib/brand/palettes";
import { patternSwatch, PATTERN_LABELS, PATTERN_USAGE } from "@/lib/render/patterns";
import { buildLogoDocument, renderLogo, VARIATION_HINTS, VARIATION_LABELS } from "@/lib/render/logo";
import { colorResolver } from "@/lib/render/svg";
import { LOGO_VARIATIONS } from "@/types/brand";

type Ctx = { params: Promise<{ id: string }> };

/** Everything the on-screen Brand Kit page needs, in one request. */
export const GET = handleRoute(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const brand = await loadBrand(id, user.id);
  if (!brand.spec || !brand.strategy) throw badRequest("Choose a brand direction first.");

  const { limits } = await entitlementFor(user.id);
  const resolve = colorResolver(brand.spec, "brand");

  return NextResponse.json({
    brand: { id: brand.id, name: brand.name, slug: brand.slug, isPublic: brand.isPublic },
    spec: brand.spec,
    strategy: brand.strategy,
    quality: brand.quality,
    limits,
    logos: LOGO_VARIATIONS.map((variation) => {
      const doc = buildLogoDocument(brand.spec!, variation);
      return {
        variation,
        label: VARIATION_LABELS[variation],
        hint: VARIATION_HINTS[variation],
        svg: renderLogo({ doc, spec: brand.spec! }),
        width: doc.width,
        height: doc.height,
        onDark: variation === "white",
      };
    }),
    contrast: contrastMatrix(brand.spec.palette),
    patterns: brand.spec.patterns.map((p) => ({
      kind: p.kind,
      label: PATTERN_LABELS[p.kind],
      usage: PATTERN_USAGE[p.kind],
      svg: patternSwatch(p, brand.spec!, resolve, 200),
    })),
    guidelinePreview: guidelinePages({
      spec: brand.spec,
      strategy: brand.strategy,
      quality: brand.quality,
    }),
  });
});
