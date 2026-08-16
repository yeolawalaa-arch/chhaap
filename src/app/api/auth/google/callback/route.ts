import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { handleRoute } from "@/lib/http/errors";
import { clientIp } from "@/lib/security/rate-limit";
import {
  RETURN_COOKIE,
  STATE_COOKIE,
  VERIFIER_COOKIE,
  exchangeCode,
} from "@/lib/auth/google";
import { upsertOAuthUser } from "@/lib/auth/service";

/** Google redirects here with the authorization code. */
export const GET = handleRoute(async (req: Request) => {
  const url = new URL(req.url);
  const origin = url.origin;
  const store = await cookies();

  const clear = () => {
    store.delete(STATE_COOKIE);
    store.delete(VERIFIER_COOKIE);
    store.delete(RETURN_COOKIE);
  };

  const fail = (reason: string) => {
    clear();
    return NextResponse.redirect(new URL(`/login?error=${reason}`, origin));
  };

  // The user declined at Google's consent screen.
  if (url.searchParams.get("error")) return fail("google_cancelled");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = store.get(STATE_COOKIE)?.value;
  const verifier = store.get(VERIFIER_COOKIE)?.value;

  if (!code || !state || !expectedState || !verifier) return fail("google_incomplete");

  // CSRF check: the state in the callback must match the one we issued.
  if (state !== expectedState) return fail("google_state_mismatch");

  try {
    const profile = await exchangeCode(code, verifier);

    await upsertOAuthUser(
      {
        provider: "google",
        providerAccountId: profile.sub,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.picture,
        emailVerified: profile.emailVerified,
      },
      { userAgent: req.headers.get("user-agent"), ip: clientIp(req) },
    );

    const returnTo = store.get(RETURN_COOKIE)?.value;
    clear();

    const destination =
      returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard";
    return NextResponse.redirect(new URL(destination, origin));
  } catch (err) {
    console.error("[auth] Google callback failed:", (err as Error).message);
    return fail("google_failed");
  }
});
