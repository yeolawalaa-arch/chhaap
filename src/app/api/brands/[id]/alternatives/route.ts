import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRoute, badRequest } from "@/lib/http/errors";
import { requireUser } from "@/lib/auth/session";
import { loadBrand, updateSpec } from "@/lib/brand/service";
import { allAlternatives } from "@/lib/brand/alternatives";
import { buildLogoDocument, renderLogo } from "@/lib/render/logo";
import { RULES, enforce } from "@/lib/security/rate-limit";
import type { BrandIdentitySpec } from "@/types/brand";

type Ctx = { params: Promise<{ id: string }> };

/** Every swappable option, each rendered so the choice is visual. */
export const GET = handleRoute(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const brand = await loadBrand(id, user.id);
  if (!brand.spec) throw badRequest("Choose a brand direction first.");

  const spec = brand.spec;
  const alts = allAlternatives(spec, brand.brief);

  const preview = (patch: Partial<BrandIdentitySpec>) =>
    renderLogo({
      doc: buildLogoDocument({ ...spec, ...patch }, "primary"),
      spec: { ...spec, ...patch },
    });

  return NextResponse.json({
    marks: alts.marks.map((m) => ({ ...m, preview: preview({ mark: m.mark }) })),
    palettes: alts.palettes.map((p) => ({
      ...p,
      swatches: [p.palette.primary.hex, p.palette.accent.hex, p.palette.ink.hex, p.palette.surfaceAlt.hex],
      preview: preview({ palette: p.palette }),
    })),
    types: alts.types.map((t) => ({ ...t, preview: preview({ typography: t.typography }) })),
  });
});

const applySchema = z.object({
  markId: z.string().max(80).optional(),
  paletteId: z.string().max(40).optional(),
  typeId: z.string().max(120).optional(),
});

/** Applies chosen options. Every asset re-renders from the updated system. */
export const POST = handleRoute(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await enforce(RULES.mutate, `alt:${user.id}`);

  const input = applySchema.parse(await req.json());
  const brand = await loadBrand(id, user.id);
  if (!brand.spec) throw badRequest("Choose a brand direction first.");

  const alts = allAlternatives(brand.spec, brand.brief);
  let next = { ...brand.spec };

  if (input.markId) {
    const found = alts.marks.find((m) => m.id === input.markId);
    if (!found) throw badRequest("That mark option is no longer available.");
    next = { ...next, mark: found.mark };
  }
  if (input.paletteId) {
    const found = alts.palettes.find((p) => p.id === input.paletteId);
    if (!found) throw badRequest("That colour option is no longer available.");
    next = { ...next, palette: found.palette };
  }
  if (input.typeId) {
    const found = alts.types.find((t) => t.id === input.typeId);
    if (!found) throw badRequest("That type option is no longer available.");
    next = { ...next, typography: found.typography };
  }

  // Rebuilding the logo set is the point: a swapped mark must propagate to all
  // eight variations and every downstream asset, not just the primary.
  const updated = await updateSpec(id, user.id, next, { rebuildLogos: true });

  return NextResponse.json({
    ok: true,
    qualityScore: updated.qualityScore,
    preview: renderLogo({ doc: buildLogoDocument(next, "primary"), spec: next }),
  });
});
