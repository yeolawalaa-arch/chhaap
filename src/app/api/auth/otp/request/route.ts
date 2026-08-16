import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http/errors";
import { otpRequestSchema } from "@/lib/http/schemas";
import { requestOtp } from "@/lib/auth/service";
import { env } from "@/lib/config/env";
import { RULES, clientIp, enforce } from "@/lib/security/rate-limit";

export const POST = handleRoute(async (req: Request) => {
  const ip = clientIp(req);
  const { email } = otpRequestSchema.parse(await req.json());

  await enforce(RULES.otpRequest, ip);
  await enforce(RULES.otpRequest, `email:${email}`);

  await requestOtp(email);

  // Always the same response, whether or not the account exists.
  return NextResponse.json({
    ok: true,
    message: "If an account exists for that address, a code is on its way.",
    // Told plainly rather than leaving the user waiting for an email that a
    // console-driver deployment will never send.
    deliveryNote: env.EMAIL_PROVIDER === "console"
      ? "This deployment logs emails to the server console instead of sending them."
      : undefined,
  });
});
