"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, Input, useToast } from "@/components/ui";
import { ApiError, api } from "@/lib/client/api";

export function ForgotPasswordForm({ emailIsConsole }: { emailIsConsole: boolean }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [note, setNote] = useState<string | undefined>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post<{ deliveryNote?: string }>("/api/auth/password/forgot", { email });
      setNote(res.deliveryNote);
      setSent(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Check your email</h1>
        <p className="mt-2 text-[14px] text-muted leading-relaxed">
          If an account exists for <span className="text-ink font-medium">{email}</span>, a reset
          link is on its way. It expires in an hour.
        </p>
        {(note || emailIsConsole) && (
          <p className="mt-4 text-[12.5px] text-warn bg-warn-bg border border-warn/20 rounded-[10px] px-3 py-2.5 leading-relaxed">
            {note ?? "This deployment logs emails to the server console instead of sending them."}
          </p>
        )}
        <Link
          href="/login"
          className="inline-block mt-6 text-[14px] text-ink font-medium hover:text-brand-600"
        >
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Reset your password</h1>
      <p className="mt-2 text-[14px] text-muted leading-relaxed">
        Enter your email and we&rsquo;ll send you a link to choose a new one.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Email" required htmlFor="email">
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            autoFocus
            placeholder="you@business.in"
          />
        </Field>
        <Button type="submit" full size="lg" loading={busy}>
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-[13.5px] text-muted text-center">
        <Link href="/login" className="text-ink font-medium hover:text-brand-600">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  const mismatch = confirm.length > 0 && password !== confirm;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mismatch) return;

    setBusy(true);
    setFields({});
    setFormError("");

    try {
      const res = await api.post<{ redirect: string }>("/api/auth/password/reset", {
        token,
        password,
      });
      toast.success("Password updated.", "You've been signed out everywhere else.");
      router.push(res.redirect);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields);
        if (!Object.keys(err.fields).length) setFormError(err.message);
      } else {
        setFormError("Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Choose a new password</h1>
      <p className="mt-2 text-[14px] text-muted leading-relaxed">
        Setting a new password signs you out on every other device.
      </p>

      {formError && (
        <p
          role="alert"
          className="mt-5 text-[13px] text-danger bg-danger-bg border border-danger/20 rounded-[10px] px-3 py-2.5"
        >
          {formError}{" "}
          <Link href="/forgot-password" className="underline">
            Request a new link
          </Link>
        </p>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="New password" error={fields.password} hint="At least 8 characters." required htmlFor="password">
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            autoFocus
            invalid={!!fields.password}
          />
        </Field>

        <Field
          label="Confirm password"
          error={mismatch ? "These don't match." : undefined}
          required
          htmlFor="confirm"
        >
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            invalid={mismatch}
          />
        </Field>

        <Button type="submit" full size="lg" loading={busy} disabled={mismatch || !password}>
          Update password
        </Button>
      </form>
    </div>
  );
}
