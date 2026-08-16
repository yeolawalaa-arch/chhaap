import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Badge, Button, Card, SvgFrame } from "@/components/ui";
import { QualityPanel } from "@/components/brand/QualityPanel";
import { ExportBar } from "@/components/brand/ExportBar";
import { requireUser } from "@/lib/auth/session";
import { loadBrand, loadLogos } from "@/lib/brand/service";
import { buildLogoDocument, renderLogo, VARIATION_HINTS, VARIATION_LABELS } from "@/lib/render/logo";
import { entitlementFor } from "@/lib/billing/plans";
import { LOGO_VARIATIONS } from "@/types/brand";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const user = await requireUser();
  const { id } = await params;
  const brand = await loadBrand(id, user.id).catch(() => null);
  return { title: brand?.name ?? "Brand" };
}

export default async function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const brand = await loadBrand(id, user.id).catch(() => null);
  if (!brand) notFound();
  if (!brand.spec || brand.status === "draft") redirect(`/brand/${id}/directions`);

  const [logos, entitlement] = await Promise.all([
    loadLogos(id, user.id),
    entitlementFor(user.id),
  ]);
  const spec = brand.spec;

  const variations = LOGO_VARIATIONS.map((variation) => {
    const doc = logos.get(variation) ?? buildLogoDocument(spec, variation);
    return {
      variation,
      label: VARIATION_LABELS[variation],
      hint: VARIATION_HINTS[variation],
      svg: renderLogo({ doc, spec }),
      onDark: variation === "white",
    };
  });

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <Link href="/dashboard" className="text-[13px] text-muted hover:text-ink transition-colors">
              My Brands
            </Link>
            <span className="text-faint" aria-hidden="true">/</span>
          </div>
          <h1 className="text-[32px] font-semibold tracking-[-0.025em]">{brand.name}</h1>
          {spec.descriptor && <p className="mt-1 text-[14px] text-muted">{spec.descriptor}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/brand/${id}/studio`}>
            <Button variant="outline">Open Logo Studio</Button>
          </Link>
          <Link href={`/brand/${id}/kit`}>
            <Button variant="secondary">Brand Kit</Button>
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          {/* Logo variations */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-semibold text-ink">Logo variations</h2>
              <Badge tone="neutral">{variations.length}</Badge>
            </div>

            <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {variations.map((item) => (
                <li key={item.variation}>
                  <div
                    className={`h-28 rounded-[10px] border border-line flex items-center justify-center p-4 ${
                      item.onDark ? "bg-ink" : "bg-paper"
                    }`}
                  >
                    <SvgFrame svg={item.svg} className="h-full w-full" label={item.label} />
                  </div>
                  <p className="mt-2 text-[12.5px] font-medium text-ink">{item.label}</p>
                  <p className="text-[11px] text-muted leading-snug mt-0.5">{item.hint}</p>
                </li>
              ))}
            </ul>
          </Card>

          {/* Strategy */}
          {brand.strategy && (
            <Card className="p-5 sm:p-6">
              <h2 className="text-[16px] font-semibold text-ink mb-4">Brand strategy</h2>
              <dl className="space-y-4">
                {[
                  ["Positioning", brand.strategy.positioning],
                  ["Personality", brand.strategy.personalitySummary],
                  ["Visual style", brand.strategy.visualStyle],
                  ["Social media", brand.strategy.socialStyle],
                  ["Packaging", brand.strategy.packagingStyle],
                ].map(([term, description]) => (
                  <div key={term}>
                    <dt className="text-[11.5px] uppercase tracking-[0.11em] text-faint font-semibold">
                      {term}
                    </dt>
                    <dd className="mt-1 text-[13.5px] text-ink-soft leading-relaxed">{description}</dd>
                  </div>
                ))}
              </dl>

              {brand.strategy.taglines.length > 0 && (
                <div className="mt-5 pt-5 border-t border-line-soft">
                  <p className="text-[11.5px] uppercase tracking-[0.11em] text-faint font-semibold mb-2.5">
                    Taglines
                  </p>
                  <ul className="space-y-1.5">
                    {brand.strategy.taglines.map((tagline) => (
                      <li key={tagline} className="text-[14px] text-ink">
                        {tagline}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <ExportBar
            brandId={id}
            limits={entitlement.limits}
            planName={entitlement.planName}
            variations={LOGO_VARIATIONS.map((v) => ({ value: v, label: VARIATION_LABELS[v] }))}
          />

          {brand.quality && <QualityPanel report={brand.quality} />}

          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-ink mb-3">Palette</h3>
            <ul className="space-y-2">
              {Object.values(spec.palette).map((color) => (
                <li key={color.role} className="flex items-center gap-2.5">
                  <span
                    className="w-7 h-7 rounded-[6px] border border-ink/8 shrink-0"
                    style={{ background: color.hex }}
                  />
                  <div className="min-w-0">
                    <p className="text-[12.5px] text-ink truncate">{color.name}</p>
                    <p className="text-[11px] text-muted font-mono">{color.hex.toUpperCase()}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
