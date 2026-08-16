import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { entitlementFor, generationQuota } from "@/lib/billing/plans";
import { AppShell } from "@/components/app/AppShell";

export const dynamic = "force-dynamic";

/** Auth boundary for the whole signed-in application. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [entitlement, quota] = await Promise.all([
    entitlementFor(session.user.id),
    generationQuota(session.user.id),
  ]);

  return (
    <AppShell
      user={session.user}
      plan={{ key: entitlement.planKey, name: entitlement.planName }}
      quota={{ used: quota.used, limit: quota.limit, unlimited: quota.unlimited }}
    >
      {children}
    </AppShell>
  );
}
