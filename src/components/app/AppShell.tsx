"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, cx, useToast } from "@/components/ui";
import { Wordmark } from "@/components/marketing/Wordmark";
import { api } from "@/lib/client/api";
import type { SessionUser } from "@/lib/auth/session";

/** Application chrome: top bar, account menu, quota indicator. */
export function AppShell({
  user,
  plan,
  quota,
  children,
}: {
  user: SessionUser;
  plan: { key: string; name: string };
  quota: { used: number; limit: number; unlimited: boolean };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function signOut() {
    try {
      await api.post("/api/auth/logout");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Could not sign out. Please try again.");
    }
  }

  const nav = [{ href: "/dashboard", label: "My Brands" }];

  const remaining = quota.unlimited ? Infinity : Math.max(0, quota.limit - quota.used);
  const low = !quota.unlimited && remaining <= 2;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-md border-b border-line">
        <div className="max-w-[1400px] mx-auto px-5 h-14 flex items-center gap-6">
          <Wordmark size={24} href="/dashboard" />

          <nav className="hidden sm:flex items-center gap-1" aria-label="Application">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "px-3 h-8 inline-flex items-center rounded-lg text-[13.5px] transition-colors",
                    active ? "bg-paper-alt text-ink font-medium" : "text-muted hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            {!quota.unlimited && (
              <Badge tone={low ? "warn" : "neutral"} className="hidden sm:inline-flex">
                {remaining} left
              </Badge>
            )}

            <Link href="/create" className="hidden sm:block">
              <Button size="sm" variant="secondary">
                New brand
              </Button>
            </Link>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="w-8 h-8 rounded-full bg-ink text-white text-[12px] font-semibold flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                {(user.name ?? user.email).slice(0, 1).toUpperCase()}
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-10 w-60 bg-white border border-line rounded-[12px] shadow-pop py-1.5 animate-pop z-50"
                >
                  <div className="px-3.5 py-2 border-b border-line-soft">
                    <p className="text-[13px] font-medium text-ink truncate">
                      {user.name ?? "Your account"}
                    </p>
                    <p className="text-[12px] text-muted truncate">{user.email}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Badge tone={plan.key === "free" ? "neutral" : "brand"}>{plan.name}</Badge>
                      {user.role === "admin" && <Badge tone="warn">Admin</Badge>}
                    </div>
                  </div>

                  {[{ href: "/pricing", label: "Plans & billing" }].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="block px-3.5 py-2 text-[13.5px] text-ink-soft hover:bg-paper-alt hover:text-ink transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}

                  <div className="h-px bg-line-soft my-1" />
                  <button
                    role="menuitem"
                    onClick={signOut}
                    className="w-full text-left px-3.5 py-2 text-[13.5px] text-ink-soft hover:bg-paper-alt hover:text-ink transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main id="main" className="grow">
        {children}
      </main>
    </div>
  );
}
