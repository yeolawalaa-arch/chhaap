import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http/errors";
import { selectDirectionSchema } from "@/lib/http/schemas";
import { requireUser } from "@/lib/auth/session";
import { selectDirection } from "@/lib/brand/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handleRoute(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { directionId } = selectDirectionSchema.parse(await req.json());

  const brand = await selectDirection(id, user.id, directionId);

  return NextResponse.json({
    brand: { id: brand.id, name: brand.name, qualityScore: brand.qualityScore },
    redirect: `/brand/${brand.id}`,
  });
});
