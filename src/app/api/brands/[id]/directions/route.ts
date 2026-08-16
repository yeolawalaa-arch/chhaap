import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http/errors";
import { regenerateSchema } from "@/lib/http/schemas";
import { requireUser } from "@/lib/auth/session";
import { listDirections, loadBrand } from "@/lib/brand/service";
import { buildLogoDocument, renderLogo } from "@/lib/render/logo";
import { aiProvider, recordGeneration } from "@/lib/ai";
import { assertGenerationQuota, incrementUsage } from "@/lib/billing/plans";
import { RULES, enforce } from "@/lib/security/rate-limit";
import { db } from "@/lib/db/client";
import { encodeJson } from "@/lib/db/json";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handleRoute(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const directions = await listDirections(id, user.id);

  return NextResponse.json({
    directions: directions.map((d) => ({
      ...d,
      // Each card shows the real logo, not a generic placeholder.
      preview: renderLogo({ doc: buildLogoDocument(d.spec, "primary"), spec: d.spec }),
      previewHorizontal: renderLogo({ doc: buildLogoDocument(d.spec, "horizontal"), spec: d.spec }),
    })),
  });
});

/** "Show me more" — a fresh set, seeded differently from the same brief. */
export const POST = handleRoute(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const brand = await loadBrand(id, user.id);

  await enforce(RULES.aiGenerate, `user:${user.id}`);
  await assertGenerationQuota(user.id);

  const { count } = regenerateSchema.parse(await req.json().catch(() => ({})));

  const directions = await recordGeneration(
    { userId: user.id, brandId: id, kind: "directions", input: brand.brief },
    () => aiProvider().generateDirections(brand.brief, count),
  );

  await db.$transaction([
    db.brandDirection.deleteMany({ where: { brandId: id, isSelected: false } }),
    db.brandDirection.createMany({
      data: directions.map((d) => ({
        brandId: id,
        label: d.label,
        summary: d.summary,
        specJson: encodeJson({ spec: d.spec, strategy: d.strategy }),
        score: d.score,
      })),
    }),
  ]);

  await incrementUsage(user.id, "ai_generation");
  return NextResponse.json({ ok: true, count: directions.length });
});
