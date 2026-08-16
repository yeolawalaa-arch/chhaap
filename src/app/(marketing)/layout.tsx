import { SiteHeader, SiteFooter } from "@/components/marketing/Chrome";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => null);
  return (
    <>
      <SiteHeader session={session} />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
