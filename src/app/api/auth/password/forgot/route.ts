import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http/errors";
import { forgotPasswordSchema } from "@/lib/http/schemas";
import { requestPasswordReset } from "@/lib/auth/service";
import { env } from "@/lib/config/env";
import { RULES, clientIp, enforce } from "@/lib/security/rate-limit";

export const POST = handleRoute(async (req: Request) => {
  const ip = clientIp(req);
  const { email } = forgotPasswordSchema.parse(await req.json());

  await enforce(RULES.passwordReset, ip);
  await enforce(RULES.passwordReset, `email:${email}`);

  await requestPasswordReset(email);

  return NextResponse.json({
    ok: true,
    message: "If an account exists for that address, a reset link is on its way.",
    deliveryNote: env.EMAIL_PROVIDER === "console"
      ? "This deployment logs emails to the server console instead of sending them."
      : undefined,
  });
});
