import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http/errors";
import { createBrandSchema } from "@/lib/http/schemas";
import { requireUser } from "@/lib/auth/session";
import { createBrand, listBrands } from "@/lib/brand/service";
import { aiProvider, recordGeneration } from "@/lib/ai";
import { assertGenerationQuota, incrementUsage } from "@/lib/billing/plans";
import { RULES, clientIp, enforce } from "@/lib/security/rate-limit";
import { buildLogoDocument, renderLogo } from "@/lib/render/logo";
import type { BrandBrief } from "@/types/brand";

/** The user's brands, newest first. */
export const GET = handleRoute(async () => {
  const user = await requireUser();
  const brands = await listBrands(user.id);

  return NextResponse.json({
    brands: brands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      industry: b.industry,
      status: b.status,
      isPublic: b.isPublic,
      qualityScore: b.qualityScore,
      updatedAt: b.updatedAt,
      // A thumbnail so the dashboard needs no second round trip per card.
      preview: b.spec ? renderLogo({ doc: buildLogoDocument(b.spec, "primary"), spec: b.spec }) : null,
      palette: b.spec
        ? { primary: b.spec.palette.primary.hex, accent: b.spec.palette.accent.hex }
        : null,
    })),
  });
});

/** Creates a brand and generates its candidate directions. */
export const POST = handleRoute(async (req: Request) => {
  const user = await requireUser();
  await enforce(RULES.aiGenerate, `user:${user.id}`);
  await enforce(RULES.mutate, clientIp(req));
  await assertGenerationQuota(user.id);

  const { brief, count } = createBrandSchema.parse(await req.json());

  const directions = await recordGeneration(
    { userId: user.id, kind: "directions", input: brief },
    () => aiProvider().generateDirections(brief as BrandBrief, count),
  );

  const brand = await createBrand(user.id, brief as BrandBrief, directions);
  await incrementUsage(user.id, "ai_generation");
  await incrementUsage(user.id, "brand");

  return NextResponse.json(
    {
      brand: { id: brand.id, name: brand.name, slug: brand.slug },
      directions: directions.map((d) => ({
        id: d.id,
        label: d.label,
        summary: d.summary,
        score: d.score,
      })),
      redirect: `/brand/${brand.id}/directions`,
    },
    { status: 201 },
  );
});
