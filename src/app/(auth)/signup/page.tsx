import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { getSession } from "@/lib/auth/session";
import { isGoogleConfigured } from "@/lib/auth/google";
import { env } from "@/lib/config/env";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Start building your complete brand identity — free, no card needed.",
};

export default async function SignupPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <AuthForm
      mode="signup"
      googleEnabled={isGoogleConfigured()}
      emailIsConsole={env.EMAIL_PROVIDER === "console"}
      initialError={env.SIGNUP_ENABLED ? undefined : "New signups are currently closed."}
    />
  );
}
