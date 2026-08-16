import Link from "next/link";
import { Button } from "@/components/ui";
import { Wordmark } from "@/components/marketing/Wordmark";
import type { ActiveSession } from "@/lib/auth/session";

/** Shared marketing header and footer. */

// Only routes that exist. A nav entry pointing at an unbuilt page is a bug,
// not a roadmap.
const PRODUCT_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/showcase", label: "Showcase" },
];

export function SiteHeader({ session }: { session: ActiveSession | null }) {
  return (
    <header className="sticky top-0 z-50 bg-paper/85 backdrop-blur-md border-b border-line">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-6">
        <Wordmark />

        <nav className="hidden md:flex items-center gap-1" aria-label="Main">
          {PRODUCT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 h-9 inline-flex items-center rounded-lg text-[14px] text-ink-soft hover:text-ink hover:bg-paper-alt transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {session ? (
            <Link href="/dashboard">
              <Button size="sm">Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden sm:block">
                <Button size="sm" variant="ghost">
                  Sign in
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" variant="secondary">
                  Create My Brand
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

const FOOTER_GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/create", label: "Create a brand" },
      { href: "/pricing", label: "Pricing" },
      { href: "/showcase", label: "Showcase" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="max-w-6xl mx-auto px-5 py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-3">
            <Wordmark />
            <p className="mt-4 text-[13.5px] text-muted leading-relaxed max-w-[280px]">
              Build a brand, not just a logo. Made for Indian businesses.
            </p>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-[12px] uppercase tracking-[0.12em] text-faint font-semibold">
                {group.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[13.5px] text-ink-soft hover:text-ink transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-line-soft flex flex-col sm:flex-row gap-3 justify-between text-[12.5px] text-muted">
          <p>© {new Date().getFullYear()} Chhaap</p>
          <p>
            Typefaces are SIL Open Font Licence — your exports are cleared for commercial use.
          </p>
        </div>
      </div>
    </footer>
  );
}
