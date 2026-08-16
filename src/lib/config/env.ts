import { z } from "zod";

/**
 * Every external dependency of the platform is declared here and nowhere else.
 * Nothing in `src/` reads `process.env` directly — import `env` instead.
 *
 * The schema is deliberately permissive: the product is designed to run with a
 * database and nothing else. Optional integrations (Anthropic, OpenAI, Google
 * OAuth, Razorpay, S3, SMTP, analytics) degrade to a clearly-marked local
 * implementation rather than crashing the app, and `integrationStatus()` below
 * reports exactly which of them are live so the UI never claims a capability
 * the deployment does not actually have.
 */

const bool = (fallback = false) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? fallback : v === "true" || v === "1"));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // --- core -------------------------------------------------------------
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_NAME: z.string().default("Chhaap"),
  /** Signing key for session JWTs, OTP hashes and share tokens. */
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // --- AI providers -----------------------------------------------------
  /** heuristic = the built-in deterministic Brand Brain (no network needed). */
  AI_PROVIDER: z.enum(["heuristic", "anthropic", "openai"]).default("heuristic"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),

  // --- OAuth ------------------------------------------------------------
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // --- email ------------------------------------------------------------
  EMAIL_PROVIDER: z.enum(["console", "resend", "smtp"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Chhaap <no-reply@chhaap.local>"),
  SMTP_URL: z.string().optional(),

  // --- payments ---------------------------------------------------------
  PAYMENT_GATEWAY: z.enum(["none", "razorpay", "stripe"]).default("none"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // --- storage ----------------------------------------------------------
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default(".storage"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),

  // --- domain / handle availability -------------------------------------
  /**
   * Availability is only ever displayed when a real checker is configured.
   * Without these the UI shows "not checked" — it never guesses.
   */
  DOMAIN_CHECK_PROVIDER: z.enum(["none", "rdap"]).default("rdap"),
  SOCIAL_CHECK_PROVIDER: z.enum(["none"]).default("none"),

  // --- analytics --------------------------------------------------------
  ANALYTICS_PROVIDER: z.enum(["none", "plausible", "ga4"]).default("none"),
  PLAUSIBLE_DOMAIN: z.string().optional(),
  GA4_MEASUREMENT_ID: z.string().optional(),

  // --- ops --------------------------------------------------------------
  RATE_LIMIT_ENABLED: bool(true),
  SIGNUP_ENABLED: bool(true),
  ADMIN_EMAILS: z.string().default(""),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\n` +
        `Copy .env.example to .env and fill in the required values.`,
    );
  }
  return parsed.data;
}

let cached: Env | null = null;

/** Validated, typed environment. Throws once at first access if misconfigured. */
export const env: Env = new Proxy({} as Env, {
  get(_t, prop: string) {
    cached ??= load();
    return cached[prop as keyof Env];
  },
});

export const isProd = () => env.NODE_ENV === "production";
export const isDev = () => env.NODE_ENV === "development";

export function adminEmails(): string[] {
  return env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export type IntegrationKey =
  | "ai"
  | "googleOAuth"
  | "email"
  | "payments"
  | "storage"
  | "domainCheck"
  | "socialCheck"
  | "analytics";

export interface IntegrationState {
  key: IntegrationKey;
  label: string;
  live: boolean;
  detail: string;
}

/**
 * Single source of truth for "is this integration actually wired up?".
 * The UI reads this so it can be honest about what is real in this deployment
 * instead of showing dead controls.
 */
export function integrationStatus(): Record<IntegrationKey, IntegrationState> {
  const aiLive =
    (env.AI_PROVIDER === "anthropic" && !!env.ANTHROPIC_API_KEY) ||
    (env.AI_PROVIDER === "openai" && !!env.OPENAI_API_KEY);

  return {
    ai: {
      key: "ai",
      label: "AI copy provider",
      live: aiLive,
      detail: aiLive
        ? `${env.AI_PROVIDER} (${env.AI_PROVIDER === "anthropic" ? env.ANTHROPIC_MODEL : env.OPENAI_MODEL})`
        : "Built-in Brand Brain engine (deterministic, no external API)",
    },
    googleOAuth: {
      key: "googleOAuth",
      label: "Google login",
      live: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      detail: env.GOOGLE_CLIENT_ID ? "configured" : "set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET",
    },
    email: {
      key: "email",
      label: "Transactional email",
      live: env.EMAIL_PROVIDER !== "console",
      detail:
        env.EMAIL_PROVIDER === "console"
          ? "console driver — messages are logged, not sent"
          : env.EMAIL_PROVIDER,
    },
    payments: {
      key: "payments",
      label: "Payments",
      live: env.PAYMENT_GATEWAY !== "none",
      detail:
        env.PAYMENT_GATEWAY === "none"
          ? "no gateway configured — upgrades run in manual/comp mode"
          : env.PAYMENT_GATEWAY,
    },
    storage: {
      key: "storage",
      label: "Object storage",
      live: env.STORAGE_DRIVER === "s3",
      detail: env.STORAGE_DRIVER === "s3" ? `s3://${env.S3_BUCKET}` : "local filesystem driver",
    },
    domainCheck: {
      key: "domainCheck",
      label: "Domain availability",
      live: env.DOMAIN_CHECK_PROVIDER !== "none",
      detail:
        env.DOMAIN_CHECK_PROVIDER === "rdap"
          ? "live RDAP lookups (iana.org bootstrap)"
          : "disabled — availability will not be shown",
    },
    socialCheck: {
      key: "socialCheck",
      label: "Social handle availability",
      live: false,
      detail: "no compliant provider configured — handles are shown as unchecked",
    },
    analytics: {
      key: "analytics",
      label: "Analytics",
      live: env.ANALYTICS_PROVIDER !== "none",
      detail: env.ANALYTICS_PROVIDER,
    },
  };
}
