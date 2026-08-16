import { NextResponse } from "next/server";
import { handleRoute, badRequest } from "@/lib/http/errors";
import { logoDocumentSchema } from "@/lib/http/schemas";
import { requireUser } from "@/lib/auth/session";
import { loadLogo, resetLogo, saveLogo } from "@/lib/brand/service";
import { LOGO_VARIATIONS, type LogoDocument, type LogoVariation } from "@/types/brand";

type Ctx = { params: Promise<{ id: string; variation: string }> };

function parseVariation(value: string): LogoVariation {
  if (!(LOGO_VARIATIONS as string[]).includes(value)) {
    throw badRequest(`"${value}" is not a logo variation.`);
  }
  return value as LogoVariation;
}

export const GET = handleRoute(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id, variation } = await ctx.params;
  const doc = await loadLogo(id, user.id, parseVariation(variation));
  return NextResponse.json({ doc });
});

export const PUT = handleRoute(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id, variation } = await ctx.params;
  const doc = logoDocumentSchema.parse(await req.json()) as unknown as LogoDocument;

  const quality = await saveLogo(id, user.id, parseVariation(variation), doc);
  return NextResponse.json({ ok: true, quality });
});

/** Discards Studio edits and rebuilds from the identity. */
export const DELETE = handleRoute(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id, variation } = await ctx.params;
  const doc = await resetLogo(id, user.id, parseVariation(variation));
  return NextResponse.json({ doc });
});
