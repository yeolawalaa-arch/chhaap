import { createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/config/env";
import { badRequest } from "@/lib/http/errors";

/**
 * Google OAuth 2.0, authorization-code flow with PKCE.
 *
 * Implemented directly rather than through a framework adapter: it is about a
 * hundred lines, it keeps the session model above as the single source of truth
 * for auth, and it avoids a dependency whose major versions churn.
 *
 * State and PKCE verifier both live in short-lived httpOnly cookies. State
 * defends the callback against CSRF; PKCE defends the code against
 * interception, and is required for public clients regardless.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export const STATE_COOKIE = "chhaap_oauth_state";
export const VERIFIER_COOKIE = "chhaap_oauth_verifier";
export const RETURN_COOKIE = "chhaap_oauth_return";

export function isGoogleConfigured(): boolean {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(): string {
  return `${env.APP_URL}/api/auth/google/callback`;
}

const base64url = (buf: Buffer) => buf.toString("base64url");

export interface AuthorizationRequest {
  url: string;
  state: string;
  verifier: string;
}

export function buildAuthorizationUrl(): AuthorizationRequest {
  if (!isGoogleConfigured()) {
    throw badRequest("Google sign-in is not configured on this deployment.");
  }

  const state = base64url(randomBytes(24));
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash("sha256").update(verifier).digest());

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    // Without this Google silently reuses the last account on shared machines.
    prompt: "select_account",
  });

  return { url: `${AUTH_ENDPOINT}?${params}`, state, verifier };
}

interface TokenResponse {
  access_token: string;
  id_token?: string;
  expires_in?: number;
  refresh_token?: string;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

export async function exchangeCode(code: string, verifier: string): Promise<GoogleProfile> {
  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
    }),
  });

  if (!tokenRes.ok) {
    const detail = await tokenRes.text().catch(() => "");
    throw badRequest(`Google rejected the sign-in attempt. ${detail.slice(0, 160)}`);
  }

  const tokens = (await tokenRes.json()) as TokenResponse;

  const userRes = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userRes.ok) throw badRequest("Could not read your Google profile.");

  const profile = (await userRes.json()) as {
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!profile.email) {
    throw badRequest("Your Google account did not share an email address, which Chhaap needs to create an account.");
  }

  return {
    sub: profile.sub,
    email: profile.email,
    emailVerified: profile.email_verified === true,
    name: profile.name ?? null,
    picture: profile.picture ?? null,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : null,
  };
}
