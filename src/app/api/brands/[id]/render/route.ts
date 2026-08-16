import { NextResponse } from "next/server";
import { handleRoute, badRequest } from "@/lib/http/errors";
import { logoDocumentSchema } from "@/lib/http/schemas";
import { requireUser } from "@/lib/auth/session";
import { loadBrand } from "@/lib/brand/service";
import { renderLogo } from "@/lib/render/logo";
import { RULES, enforce } from "@/lib/security/rate-limit";
import { z } from "zod";
import type { LogoDocument } from "@/types/brand";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({ doc: logoDocumentSchema });

/**
 * Live preview renderer for the Studio.
 *
 * The editor round-trips through the same renderer the exporter uses, so the
 * canvas can never drift from the exported file. It is deliberately a pure
 * render — nothing is persisted, so an unsaved experiment leaves no trace.
 */
export const POST = handleRoute(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await enforce(RULES.mutate, `render:${user.id}`);

  const { doc } = bodySchema.parse(await req.json());
  const brand = await loadBrand(id, user.id);
  if (!brand.spec) throw badRequest("This brand has no identity yet.");

  return NextResponse.json({
    svg: renderLogo({ doc: doc as unknown as LogoDocument, spec: brand.spec }),
  });
});
