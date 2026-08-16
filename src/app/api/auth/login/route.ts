import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http/errors";
import { signInSchema } from "@/lib/http/schemas";
import { signIn } from "@/lib/auth/service";
import { RULES, clientIp, enforce } from "@/lib/security/rate-limit";

export const POST = handleRoute(async (req: Request) => {
  const ip = clientIp(req);
  const input = signInSchema.parse(await req.json());

  // Limited per IP *and* per account, so one attacker can't lock everyone out
  // and a distributed attack can't grind a single account.
  await enforce(RULES.authAttempt, ip);
  await enforce(RULES.authAttempt, `email:${input.email}`);

  const { userId } = await signIn(input, {
    userAgent: req.headers.get("user-agent"),
    ip,
  });

  return NextResponse.json({ userId, redirect: "/dashboard" });
});
