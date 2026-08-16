"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Divider, Field, Input, useToast } from "@/components/ui";
import { ApiError, api } from "@/lib/client/api";

/**
 * Sign-in and sign-up.
 *
 * One component for both because they differ by three fields and a heading;
 * two near-identical files would drift. Password and OTP are both first-class
 * paths — OTP matters here because a lot of Indian users on shared devices
 * would rather not maintain another password.
 */

type Mode = "login" | "signup";
type Step = "credentials" | "otp-sent";

export function AuthForm({
  mode,
  googleEnabled,
  emailIsConsole,
  initialError,
}: {
  mode: Mode;
  googleEnabled: boolean;
  emailIsConsole: boolean;
  initialError?: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState<Step>("credentials");
  const [useOtp, setUseOtp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState(initialError ?? "");

  const isSignup = mode === "signup";

  function handleError(err: unknown) {
    if (err instanceof ApiError) {
      setFields(err.fields);
      setFormError(Object.keys(err.fields).length ? "" : err.message);
      if (!Object.keys(err.fields).length) toast.error(err.message);
    } else {
      setFormError("Something went wrong. Please try again.");
    }
  }

  async function submitCredentials(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFields({});
    setFormError("");

    try {
      if (useOtp) {
        const res = await api.post<{ deliveryNote?: string }>("/api/auth/otp/request", { email });
        setStep("otp-sent");
        toast.info(
          "If an account exists for that address, a code is on its way.",
          res.deliveryNote,
        );
      } else {
        const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/login";
        const res = await api.post<{ redirect: string }>(endpoint, {
          email,
          password,
          ...(isSignup && name ? { name } : {}),
        });
        toast.success(isSignup ? "Welcome to Chhaap." : "Signed in.");
        router.push(res.redirect);
        router.refresh();
      }
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError("");

    try {
      const res = await api.post<{ redirect: string }>("/api/auth/otp/verify", { email, code });
      toast.success("Signed in.");
      router.push(res.redirect);
      router.refresh();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  if (step === "otp-sent") {
    return (
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Enter your code</h1>
        <p className="mt-2 text-[14px] text-muted leading-relaxed">
          We sent a 6-digit code to <span className="text-ink font-medium">{email}</span>.
        </p>
        {emailIsConsole && (
          <p className="mt-3 text-[12.5px] text-warn bg-warn-bg border border-warn/20 rounded-[10px] px-3 py-2.5 leading-relaxed">
            This deployment has no email provider configured, so the code was printed to the server
            console instead of being sent.
          </p>
        )}

        <form onSubmit={submitOtp} className="mt-6 space-y-4">
          <Field label="6-digit code" error={formError} htmlFor="code">
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              autoFocus
              className="text-center text-[22px] tracking-[0.35em] font-medium h-12"
              invalid={!!formError}
            />
          </Field>

          <Button type="submit" full size="lg" loading={busy} disabled={code.length !== 6}>
            Verify and continue
          </Button>

          <button
            type="button"
            onClick={() => {
              setStep("credentials");
              setCode("");
              setFormError("");
            }}
            className="w-full text-[13px] text-muted hover:text-ink transition-colors"
          >
            Use a different email
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">
        {isSignup ? "Create your brand" : "Welcome back"}
      </h1>
      <p className="mt-2 text-[14px] text-muted leading-relaxed">
        {isSignup
          ? "Start free. Your first brand takes about five minutes."
          : "Sign in to your brands and assets."}
      </p>

      {formError && (
        <p
          role="alert"
          className="mt-5 text-[13px] text-danger bg-danger-bg border border-danger/20 rounded-[10px] px-3 py-2.5"
        >
          {formError}
        </p>
      )}

      {googleEnabled && (
        <>
          <a href="/api/auth/google" className="block mt-6">
            <Button
              variant="outline"
              full
              size="lg"
              type="button"
              icon={
                <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                  <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
                </svg>
              }
            >
              Continue with Google
            </Button>
          </a>
          <Divider label="or" className="my-6" />
        </>
      )}

      <form onSubmit={submitCredentials} className={googleEnabled ? "space-y-4" : "mt-6 space-y-4"}>
        {isSignup && (
          <Field label="Your name" hint="Optional" htmlFor="name">
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Rohit Sharma"
            />
          </Field>
        )}

        <Field label="Email" error={fields.email} required htmlFor="email">
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            placeholder="you@business.in"
            invalid={!!fields.email}
          />
        </Field>

        {!useOtp && (
          <Field
            label="Password"
            error={fields.password}
            hint={isSignup ? "At least 8 characters." : undefined}
            required
            htmlFor="password"
          >
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              invalid={!!fields.password}
            />
          </Field>
        )}

        <Button type="submit" full size="lg" loading={busy}>
          {useOtp ? "Email me a code" : isSignup ? "Create account" : "Sign in"}
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-between text-[13px]">
        <button
          type="button"
          onClick={() => {
            setUseOtp((v) => !v);
            setFields({});
            setFormError("");
          }}
          className="text-ink-soft hover:text-ink transition-colors"
        >
          {useOtp ? "Use a password" : "Email me a code instead"}
        </button>

        {!isSignup && !useOtp && (
          <Link href="/forgot-password" className="text-muted hover:text-ink transition-colors">
            Forgot password?
          </Link>
        )}
      </div>

      <p className="mt-8 text-[13.5px] text-muted text-center">
        {isSignup ? "Already have an account? " : "New to Chhaap? "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="text-ink font-medium hover:text-brand-600 transition-colors"
        >
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
