import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Button, Card, SvgFrame } from "@/components/ui";
import { Wordmark } from "@/components/marketing/Wordmark";
import { loadBrandBySlug, recordView } from "@/lib/brand/service";
import { getSession } from "@/lib/auth/session";
import { buildLogoDocument, renderLogo } from "@/lib/render/logo";
import { renderAssetByKind } from "@/lib/render/assets/templates";
import { assetDefinition, withDefaults } from "@/lib/render/assets/definitions";
import { colorResolver } from "@/lib/render/svg";
import { getIndustry } from "@/lib/brand/industries";
import type { AssetData, AssetKind } from "@/types/brand";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const brand = await loadBrandBySlug(slug);
  if (!brand) return { title: "Brand not found" };

  return {
    title: `${brand.name} — brand identity`,
    description:
      brand.strategy?.positioning ?? `The complete brand identity for ${brand.name}, built with Chhaap.`,
    openGraph: {
      title: `${brand.name} — brand identity`,
      description: brand.strategy?.positioning ?? "",
      type: "profile",
    },
  };
}

/** Public share page. Only reachable when the owner has published the brand. */
export default async function PublicBrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await loadBrandBySlug(slug);
  if (!brand || !brand.spec) notFound();

  const session = await getSession();
  await recordView(brand.id, session?.user.id ?? null);

  const spec = brand.spec;
  const resolve = colorResolver(spec, "brand");
  const industry = getIndustry(brand.industry);

  const showcaseKinds: AssetKind[] = ["visiting_card", "instagram_post", "signboard"];
  const assets = showcaseKinds.map((kind) => {
    const def = assetDefinition(kind);
    return {
      kind,
      label: def.name,
      ratio: def.dimension.width / def.dimension.height,
      svg: renderAssetByKind(kind, {
        spec,
        resolve,
        dim: def.dimension,
        data: withDefaults(kind, {}) as AssetData,
        // Public pages always carry the mark — this is the growth surface.
        watermark: true,
      }),
    };
  });

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper/85 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <Wordmark />
          <Link href="/try">
            <Button size="sm" variant="secondary">
              Build your own
            </Button>
          </Link>
        </div>
      </header>

      <main id="main">
        <section
          className="px-5 py-20 border-b border-line"
          style={{ background: spec.palette.surface.hex }}
        >
          <div className="max-w-5xl mx-auto">
            <div className="h-56 flex items-center justify-center">
              <SvgFrame
                svg={renderLogo({ doc: buildLogoDocument(spec, "primary"), spec })}
                className="h-full"
                label={`${brand.name} logo`}
              />
            </div>
            {brand.strategy?.taglines?.[0] && (
              <p
                className="mt-8 text-center text-[19px] leading-relaxed max-w-xl mx-auto"
                style={{ color: spec.palette.ink.hex, fontFamily: `"${spec.typography.body.family}", sans-serif` }}
              >
                {brand.strategy.taglines[0]}
              </p>
            )}
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-5 py-14 space-y-10">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge tone="neutral">{industry.name}</Badge>
            {brand.qualityScore > 0 && (
              <Badge tone={brand.qualityScore >= 72 ? "success" : "warn"}>
                Brand readiness {brand.qualityScore}/100
              </Badge>
            )}
            <span className="text-[12.5px] text-muted ml-auto">
              {brand.viewCount.toLocaleString("en-IN")} views
            </span>
          </div>

          {brand.strategy && (
            <Card className="p-6">
              <h2 className="text-[16px] font-semibold text-ink mb-2">Positioning</h2>
              <p className="text-[14.5px] text-ink-soft leading-relaxed">
                {brand.strategy.positioning}
              </p>
            </Card>
          )}

          <section>
            <h2 className="text-[16px] font-semibold text-ink mb-4">Palette</h2>
            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[spec.palette.primary, spec.palette.accent, spec.palette.ink, spec.palette.surfaceAlt].map(
                (color) => (
                  <li key={color.role}>
                    <div
                      className="h-20 rounded-[10px] border border-ink/8"
                      style={{ background: color.hex }}
                    />
                    <p className="mt-2 text-[12.5px] font-medium text-ink">{color.name}</p>
                    <p className="text-[11.5px] text-muted font-mono">{color.hex.toUpperCase()}</p>
                  </li>
                ),
              )}
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-ink mb-4">In use</h2>
            <ul className="grid sm:grid-cols-3 gap-4">
              {assets.map((asset) => (
                <li key={asset.kind}>
                  <div
                    className="rounded-[10px] border border-line overflow-hidden bg-paper-alt"
                    style={{ aspectRatio: asset.ratio }}
                  >
                    <SvgFrame svg={asset.svg} contain={false} label={asset.label} />
                  </div>
                  <p className="mt-2 text-[12.5px] text-muted">{asset.label}</p>
                </li>
              ))}
            </ul>
          </section>

          <Card className="p-8 text-center">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">
              Build a brand, not just a logo.
            </h2>
            <p className="mt-2.5 text-[14.5px] text-muted max-w-md mx-auto leading-relaxed">
              {brand.name} was generated by Chhaap in minutes — logo, palette, typography and every
              asset, as one system.
            </p>
            <Link href="/try" className="inline-block mt-6">
              <Button size="lg" variant="secondary">
                Create My Brand
              </Button>
            </Link>
          </Card>
        </div>
      </main>
    </div>
  );
}
