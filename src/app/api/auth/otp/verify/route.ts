import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http/errors";
import { otpVerifySchema } from "@/lib/http/schemas";
import { verifyOtp } from "@/lib/auth/service";
import { RULES, clientIp, enforce } from "@/lib/security/rate-limit";

export const POST = handleRoute(async (req: Request) => {
  const ip = clientIp(req);
  const input = otpVerifySchema.parse(await req.json());

  await enforce(RULES.authAttempt, ip);
  await enforce(RULES.authAttempt, `otp:${input.email}`);

  const { userId } = await verifyOtp(input.email, input.code, {
    userAgent: req.headers.get("user-agent"),
    ip,
  });

  return NextResponse.json({ userId, redirect: "/dashboard" });
});
