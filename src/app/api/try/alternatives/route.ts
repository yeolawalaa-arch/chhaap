import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRoute } from "@/lib/http/errors";
import { briefSchema } from "@/lib/http/schemas";
import { guestSpecSchema } from "@/lib/http/guest-spec-schema";
import { allAlternatives } from "@/lib/brand/alternatives";
import { buildLogoDocument, renderLogo } from "@/lib/render/logo";
import { RULES, clientIp, enforce } from "@/lib/security/rate-limit";
import type { BrandBrief, BrandIdentitySpec } from "@/types/brand";

/**
 * Guest alternatives.
 *
 * The spec travels in the request body rather than being re-derived from
 * `(brief, directionId)` on the server. An earlier version tried to
 * regenerate it that way, but `generateDirections` is only reproducible when
 * called with the exact same `count` and `salt` the client used — and this
 * route had no way to know whether the guest had clicked "show me different
 * ones" first. A mismatched salt silently produced a different direction than
 * the one on screen, with the `directions[0]` fallback masking the failure
 * rather than surfacing it. Accepting the already-computed spec directly,
 * the same way /api/try/export already does, removes the mismatch entirely:
 * there is nothing left to regenerate.
 */
const bodySchema = z.object({
  spec: guestSpecSchema,
  brief: briefSchema,
});

export const POST = handleRoute(async (req: Request) => {
  await enforce(RULES.aiGenerate, `guest-alt:${clientIp(req)}`);

  const { spec, brief } = bodySchema.parse(await req.json());
  const typedSpec = spec as unknown as BrandIdentitySpec;

  const alts = allAlternatives(typedSpec, brief as BrandBrief);
  const preview = (patch: Partial<BrandIdentitySpec>) =>
    renderLogo({
      doc: buildLogoDocument({ ...typedSpec, ...patch }, "primary"),
      spec: { ...typedSpec, ...patch },
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
