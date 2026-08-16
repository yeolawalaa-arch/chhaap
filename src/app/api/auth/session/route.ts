import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/http/errors";
import { getSession } from "@/lib/auth/session";
import { entitlementFor, generationQuota } from "@/lib/billing/plans";

export const GET = handleRoute(async () => {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });

  const [entitlement, quota] = await Promise.all([
    entitlementFor(session.user.id),
    generationQuota(session.user.id),
  ]);

  return NextResponse.json({
    user: session.user,
    plan: { key: entitlement.planKey, name: entitlement.planName, limits: entitlement.limits },
    quota: { used: quota.used, limit: quota.limit, unlimited: quota.unlimited },
  });
});
