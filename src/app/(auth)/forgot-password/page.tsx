import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/PasswordForms";
import { env } from "@/lib/config/env";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm emailIsConsole={env.EMAIL_PROVIDER === "console"} />;
}
