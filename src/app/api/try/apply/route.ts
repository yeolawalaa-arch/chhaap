import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRoute } from "@/lib/http/errors";
import { guestSpecSchema } from "@/lib/http/guest-spec-schema";
import { serializeGuestSpec } from "@/lib/brand/guest-serialize";
import { RULES, clientIp, enforce } from "@/lib/security/rate-limit";
import type { BrandIdentitySpec } from "@/types/brand";

/**
 * Guest "apply an alternative" — swaps one piece (mark, palette, or type)
 * into an already-generated guest spec and re-renders everything downstream,
 * so `chosen` in the try flow can be replaced wholesale.
 *
 * Only the changed slice travels from the options panel; the untouched parts
 * of the spec come back from the client as-is and are patched in here. This
 * reuses the exact same serializer /api/try/generate uses per direction, so
 * a swapped mark renders through the identical path a freshly generated
 * direction would — never a lighter preview that could drift from the real
 * export.
 */
const patchSchema = z
  .object({
    mark: guestSpecSchema.shape.mark.optional(),
    palette: guestSpecSchema.shape.palette.optional(),
    typography: guestSpecSchema.shape.typography.optional(),
  })
  .refine((p) => p.mark || p.palette || p.typography, "Nothing to apply.");

const bodySchema = z.object({
  spec: guestSpecSchema,
  patch: patchSchema,
});

export const POST = handleRoute(async (req: Request) => {
  await enforce(RULES.aiGenerate, `guest-apply:${clientIp(req)}`);

  const { spec, patch } = bodySchema.parse(await req.json());
  const next = { ...(spec as unknown as BrandIdentitySpec), ...patch } as BrandIdentitySpec;

  return NextResponse.json(serializeGuestSpec(next));
});
