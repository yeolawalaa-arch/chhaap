import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/PasswordForms";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Link incomplete</h1>
        <p className="mt-2 text-[14px] text-muted leading-relaxed">
          This reset link is missing its token. Request a new one and open the most recent email.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block mt-6 text-[14px] text-ink font-medium hover:text-brand-600"
        >
          Request a new link →
        </Link>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
