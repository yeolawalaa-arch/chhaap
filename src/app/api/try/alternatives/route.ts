import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRoute } from "@/lib/http/errors";
import { briefSchema } from "@/lib/http/schemas";
import { generateDirections } from "@/lib/brand/engine";
import { allAlternatives } from "@/lib/brand/alternatives";
import { buildLogoDocument, renderLogo } from "@/lib/render/logo";
import { RULES, clientIp, enforce } from "@/lib/security/rate-limit";
import type { BrandBrief, BrandIdentitySpec } from "@/types/brand";

const bodySchema = z.object({
  brief: briefSchema,
  directionId: z.string().max(60),
});

/**
 * Guest alternatives.
 *
 * The spec is recomputed from the brief rather than accepted from the client,
 * so an anonymous caller cannot post an arbitrary spec and have the server
 * render from it.
 */
export const POST = handleRoute(async (req: Request) => {
  await enforce(RULES.aiGenerate, `guest-alt:${clientIp(req)}`);

  const { brief, directionId } = bodySchema.parse(await req.json());
  const directions = generateDirections({ brief: brief as BrandBrief, count: 7 });
  const direction = directions.find((d) => d.id === directionId) ?? directions[0]!;
  const spec = direction.spec;

  const alts = allAlternatives(spec, brief as BrandBrief);
  const preview = (patch: Partial<BrandIdentitySpec>) =>
    renderLogo({ doc: buildLogoDocument({ ...spec, ...patch }, "primary"), spec: { ...spec, ...patch } });

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
