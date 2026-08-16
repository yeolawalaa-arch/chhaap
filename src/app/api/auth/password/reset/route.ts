import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http/errors";
import { resetPasswordSchema } from "@/lib/http/schemas";
import { resetPassword } from "@/lib/auth/service";
import { RULES, clientIp, enforce } from "@/lib/security/rate-limit";

export const POST = handleRoute(async (req: Request) => {
  const ip = clientIp(req);
  await enforce(RULES.passwordReset, ip);

  const input = resetPasswordSchema.parse(await req.json());
  const { userId } = await resetPassword(input.token, input.password, {
    userAgent: req.headers.get("user-agent"),
    ip,
  });

  return NextResponse.json({ userId, redirect: "/dashboard" });
});
