import { db } from "@/lib/db/client";
import { decodeJson } from "@/lib/db/json";
import { quotaExceeded } from "@/lib/http/errors";

/**
 * Plans and entitlements.
 *
 * Limits live in the database, not in code, so the admin can retune the free
 * tier without a deploy. `PLAN_SEED` below is the bootstrap definition used by
 * the seeder and as the fallback when a plan row is missing — the app must
 * never fail open on quota because a row was deleted.
 */

export interface PlanLimits {
  /** AI/brand generations per calendar month. -1 = unlimited. */
  aiGenerationsPerMonth: number;
  /** Total brands the user may own. */
  maxBrands: number;
  /** Team seats. */
  maxTeamMembers: number;
  /** Longest side of a raster export, in px. */
  maxExportPx: number;
  vectorExport: boolean;
  transparentPng: boolean;
  pdfExport: boolean;
  brandKitPdf: boolean;
  removeWatermark: boolean;
  premiumTemplates: boolean;
  commercialLicense: boolean;
  priorityGeneration: boolean;
}

export type PlanKey = "free" | "pro" | "business";

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  description: string;
  priceInr: number;
  priceInrYear: number;
  limits: PlanLimits;
  features: string[];
  isPopular: boolean;
  sortOrder: number;
}

export const PLAN_SEED: PlanDefinition[] = [
  {
    key: "free",
    name: "Free",
    description: "Everything you need to see your brand before you commit to it.",
    priceInr: 0,
    priceInrYear: 0,
    limits: {
      aiGenerationsPerMonth: 10,
      maxBrands: 1,
      maxTeamMembers: 1,
      maxExportPx: 1200,
      vectorExport: false,
      transparentPng: false,
      pdfExport: false,
      brandKitPdf: false,
      removeWatermark: false,
      premiumTemplates: false,
      commercialLicense: false,
      priorityGeneration: false,
    },
    features: [
      "1 brand workspace",
      "10 AI generations a month",
      "All 8 logo variations",
      "Web-resolution PNG exports (up to 1200 px)",
      "Basic templates",
      "Public brand page",
      "Downloads carry a small “Made with Chhaap” mark",
    ],
    isPopular: false,
    sortOrder: 0,
  },
  {
    key: "pro",
    name: "Pro",
    description: "For a business actually opening its doors.",
    priceInr: 749,
    priceInrYear: 6_490,
    limits: {
      aiGenerationsPerMonth: 300,
      maxBrands: 5,
      maxTeamMembers: 1,
      maxExportPx: 8000,
      vectorExport: true,
      transparentPng: true,
      pdfExport: true,
      brandKitPdf: true,
      removeWatermark: true,
      premiumTemplates: true,
      commercialLicense: true,
      priorityGeneration: false,
    },
    features: [
      "5 brand workspaces",
      "300 AI generations a month",
      "Print-resolution exports up to 8000 px",
      "True SVG and vector PDF",
      "Transparent PNG",
      "Complete Brand Kit with guidelines PDF",
      "Every premium template",
      "Commercial-use licence",
      "No watermark",
    ],
    isPopular: true,
    sortOrder: 1,
  },
  {
    key: "business",
    name: "Business",
    description: "Multiple brands, a team, and the paperwork to match.",
    priceInr: 2_499,
    priceInrYear: 21_990,
    limits: {
      aiGenerationsPerMonth: -1,
      maxBrands: 50,
      maxTeamMembers: 10,
      maxExportPx: 12000,
      vectorExport: true,
      transparentPng: true,
      pdfExport: true,
      brandKitPdf: true,
      removeWatermark: true,
      premiumTemplates: true,
      commercialLicense: true,
      priorityGeneration: true,
    },
    features: [
      "50 brand workspaces",
      "Unlimited AI generations",
      "Up to 10 team members",
      "Advanced brand guidelines",
      "Priority generation queue",
      "Everything in Pro",
    ],
    isPopular: false,
    sortOrder: 2,
  },
];

export const FREE_LIMITS = PLAN_SEED[0]!.limits;

// ---------------------------------------------------------------------------
// Entitlement resolution
// ---------------------------------------------------------------------------

export interface Entitlement {
  planKey: PlanKey;
  planName: string;
  limits: PlanLimits;
  status: string;
  currentPeriodEnd: Date | null;
}

export async function entitlementFor(userId: string): Promise<Entitlement> {
  const subscription = await db.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  const active =
    subscription &&
    (subscription.status === "active" || subscription.status === "trialing") &&
    (!subscription.currentPeriodEnd || subscription.currentPeriodEnd > new Date());

  if (!active || !subscription) {
    const freePlan = await db.plan.findUnique({ where: { key: "free" } });
    return {
      planKey: "free",
      planName: freePlan?.name ?? "Free",
      limits: freePlan ? decodeJson<PlanLimits>(freePlan.limitsJson, FREE_LIMITS) : FREE_LIMITS,
      status: "active",
      currentPeriodEnd: null,
    };
  }

  return {
    planKey: subscription.plan.key as PlanKey,
    planName: subscription.plan.name,
    limits: decodeJson<PlanLimits>(subscription.plan.limitsJson, FREE_LIMITS),
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
  };
}

// ---------------------------------------------------------------------------
// Usage metering
// ---------------------------------------------------------------------------

export type UsageMetric = "ai_generation" | "brand" | "export_hires" | "export_vector";

const period = () => new Date().toISOString().slice(0, 7); // YYYY-MM

export async function currentUsage(userId: string, metric: UsageMetric): Promise<number> {
  const row = await db.usageRecord.findUnique({
    where: { userId_metric_period: { userId, metric, period: period() } },
  });
  return row?.count ?? 0;
}

export async function incrementUsage(userId: string, metric: UsageMetric, by = 1): Promise<number> {
  const row = await db.usageRecord.upsert({
    where: { userId_metric_period: { userId, metric, period: period() } },
    create: { userId, metric, period: period(), count: by },
    update: { count: { increment: by } },
  });
  return row.count;
}

export interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
  unlimited: boolean;
}

export async function generationQuota(userId: string): Promise<QuotaState> {
  const { limits } = await entitlementFor(userId);
  const used = await currentUsage(userId, "ai_generation");
  const limit = limits.aiGenerationsPerMonth;
  return {
    used,
    limit,
    remaining: limit < 0 ? Infinity : Math.max(0, limit - used),
    unlimited: limit < 0,
  };
}

/** Throws a 402 when the monthly generation allowance is spent. */
export async function assertGenerationQuota(userId: string): Promise<void> {
  const quota = await generationQuota(userId);
  if (!quota.unlimited && quota.remaining <= 0) {
    throw quotaExceeded(
      `You've used all ${quota.limit} generations on your plan this month. Upgrade for more, or come back next month.`,
      { used: quota.used, limit: quota.limit, upgrade: true },
    );
  }
}

/** Throws a 402 when the user is at their brand limit. */
export async function assertBrandQuota(userId: string): Promise<void> {
  const { limits, planName } = await entitlementFor(userId);
  const count = await db.brand.count({ where: { userId, archivedAt: null } });
  if (count >= limits.maxBrands) {
    throw quotaExceeded(
      `The ${planName} plan includes ${limits.maxBrands} brand${limits.maxBrands === 1 ? "" : "s"}. Upgrade to create more, or archive one you're not using.`,
      { used: count, limit: limits.maxBrands, upgrade: true },
    );
  }
}

// ---------------------------------------------------------------------------
// Export gating
// ---------------------------------------------------------------------------

export type ExportFormat = "svg" | "png" | "jpg" | "pdf";

export interface ExportPermission {
  allowed: boolean;
  /** Applied cap on the longest side for raster formats. */
  maxPx: number;
  watermark: boolean;
  reason?: string;
}

export function checkExport(
  limits: PlanLimits,
  format: ExportFormat,
  requestedPx: number,
): ExportPermission {
  if (format === "svg" && !limits.vectorExport) {
    return {
      allowed: false,
      maxPx: limits.maxExportPx,
      watermark: !limits.removeWatermark,
      reason: "SVG export is a Pro feature. Your logo is already vector — upgrade to download the source file.",
    };
  }
  if (format === "pdf" && !limits.pdfExport) {
    return {
      allowed: false,
      maxPx: limits.maxExportPx,
      watermark: !limits.removeWatermark,
      reason: "PDF export is a Pro feature.",
    };
  }
  return {
    allowed: true,
    maxPx: Math.min(requestedPx, limits.maxExportPx),
    watermark: !limits.removeWatermark,
  };
}
