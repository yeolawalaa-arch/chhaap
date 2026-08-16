import Link from "next/link";
import type { Metadata } from "next";
import { Badge, Button, Card, EmptyState, SvgFrame } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { listBrands } from "@/lib/brand/service";
import { buildLogoDocument, renderLogo } from "@/lib/render/logo";
import { entitlementFor } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My Brands" };

export default async function DashboardPage() {
  const user = await requireUser();
  const [brands, entitlement] = await Promise.all([
    listBrands(user.id),
    entitlementFor(user.id),
  ]);

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.025em]">My Brands</h1>
          <p className="mt-1.5 text-[14px] text-muted">
            {brands.length === 0
              ? "Nothing here yet."
              : `${brands.length} of ${entitlement.limits.maxBrands} brand${entitlement.limits.maxBrands === 1 ? "" : "s"} on ${entitlement.planName}.`}
          </p>
        </div>
        {brands.length > 0 && (
          <Link href="/create">
            <Button variant="secondary">New brand</Button>
          </Link>
        )}
      </div>

      {brands.length === 0 ? (
        <Card>
          <EmptyState
            title="Create your first brand"
            description="Answer a few questions about your business and get a complete identity — logo, colours, typography and every asset you need to open."
            action={
              <Link href="/create">
                <Button size="lg" variant="secondary">
                  Create My Brand
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {brands.map((brand) => {
            const preview = brand.spec
              ? renderLogo({ doc: buildLogoDocument(brand.spec, "primary"), spec: brand.spec })
              : null;
            const needsDirection = brand.status === "draft";

            return (
              <Card as="li" key={brand.id} interactive className="overflow-hidden">
                <Link href={needsDirection ? `/brand/${brand.id}/directions` : `/brand/${brand.id}`}>
                  <div className="h-44 bg-paper border-b border-line-soft flex items-center justify-center p-7">
                    {preview ? (
                      <SvgFrame svg={preview} className="h-full w-full" label={brand.name} />
                    ) : (
                      <p className="text-[13px] text-faint">Direction not chosen yet</p>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-[15px] font-semibold text-ink truncate">{brand.name}</h2>
                        <p className="text-[12.5px] text-muted mt-0.5">
                          {new Date(brand.updatedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                      {needsDirection ? (
                        <Badge tone="warn">Draft</Badge>
                      ) : (
                        <Badge tone={brand.qualityScore >= 72 ? "success" : "warn"}>
                          {brand.qualityScore}
                        </Badge>
                      )}
                    </div>

                    {brand.spec && (
                      <div className="mt-3 flex gap-1.5">
                        {[
                          brand.spec.palette.primary.hex,
                          brand.spec.palette.accent.hex,
                          brand.spec.palette.ink.hex,
                        ].map((hex) => (
                          <span
                            key={hex}
                            className="w-5 h-5 rounded-[5px] border border-ink/8"
                            style={{ background: hex }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
