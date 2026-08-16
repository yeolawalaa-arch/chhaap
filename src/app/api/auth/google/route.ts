import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { handleRoute } from "@/lib/http/errors";
import { isProd } from "@/lib/config/env";
import {
  RETURN_COOKIE,
  STATE_COOKIE,
  VERIFIER_COOKIE,
  buildAuthorizationUrl,
  isGoogleConfigured,
} from "@/lib/auth/google";

/** Starts the Google OAuth flow. */
export const GET = handleRoute(async (req: Request) => {
  if (!isGoogleConfigured()) {
    // Fail visibly rather than bouncing to a Google error page.
    return NextResponse.redirect(
      new URL("/login?error=google_not_configured", new URL(req.url).origin),
    );
  }

  const { url, state, verifier } = buildAuthorizationUrl();
  const returnTo = new URL(req.url).searchParams.get("next");

  const store = await cookies();
  const options = {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax" as const,
    path: "/",
    // Long enough for a slow sign-in, short enough to limit replay.
    maxAge: 600,
  };

  store.set(STATE_COOKIE, state, options);
  store.set(VERIFIER_COOKIE, verifier, options);

  // Only same-origin relative paths are honoured, so this cannot be used as an
  // open redirect.
  if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    store.set(RETURN_COOKIE, returnTo, options);
  }

  return NextResponse.redirect(url);
});
