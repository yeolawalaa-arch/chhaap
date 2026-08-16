import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { getSession } from "@/lib/auth/session";
import { isGoogleConfigured } from "@/lib/auth/google";
import { env } from "@/lib/config/env";

export const metadata: Metadata = { title: "Sign in" };

const OAUTH_ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in isn't configured on this deployment. Use your email instead.",
  google_cancelled: "Google sign-in was cancelled.",
  google_state_mismatch: "That sign-in attempt expired. Please try again.",
  google_incomplete: "Google didn't send everything we needed. Please try again.",
  google_failed: "Google sign-in failed. Please try again or use your email.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSession()) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <AuthForm
      mode="login"
      googleEnabled={isGoogleConfigured()}
      emailIsConsole={env.EMAIL_PROVIDER === "console"}
      initialError={error ? OAUTH_ERRORS[error] : undefined}
    />
  );
}
