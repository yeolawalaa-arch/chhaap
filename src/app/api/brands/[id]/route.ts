import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http/errors";
import { updateBrandSchema } from "@/lib/http/schemas";
import { requireUser } from "@/lib/auth/session";
import { archiveBrand, loadBrand, renameBrand, setPublic } from "@/lib/brand/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handleRoute(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const brand = await loadBrand(id, user.id);
  return NextResponse.json({ brand });
});

export const PATCH = handleRoute(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const input = updateBrandSchema.parse(await req.json());

  if (input.name !== undefined) await renameBrand(id, user.id, input.name);
  if (input.isPublic !== undefined) await setPublic(id, user.id, input.isPublic);

  return NextResponse.json({ brand: await loadBrand(id, user.id) });
});

export const DELETE = handleRoute(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await archiveBrand(id, user.id);
  return NextResponse.json({ ok: true, redirect: "/dashboard" });
});
