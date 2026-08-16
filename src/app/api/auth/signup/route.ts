import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http/errors";
import { signUpSchema } from "@/lib/http/schemas";
import { signUp } from "@/lib/auth/service";
import { RULES, clientIp, enforce } from "@/lib/security/rate-limit";

export const POST = handleRoute(async (req: Request) => {
  const ip = clientIp(req);
  await enforce(RULES.signup, ip);

  const input = signUpSchema.parse(await req.json());
  const { userId } = await signUp(input, {
    userAgent: req.headers.get("user-agent"),
    ip,
  });

  return NextResponse.json({ userId, redirect: "/dashboard" }, { status: 201 });
});
