import Link from "next/link";
import type { Metadata } from "next";
import { Badge, Button, Card, EmptyState, SvgFrame } from "@/components/ui";
import { db } from "@/lib/db/client";
import { decodeJsonOrNull } from "@/lib/db/json";
import { buildLogoDocument, renderLogo } from "@/lib/render/logo";
import { marketingSamples } from "@/lib/marketing/samples";
import { getIndustry } from "@/lib/brand/industries";
import type { BrandIdentitySpec } from "@/types/brand";

export const metadata: Metadata = {
  title: "Brand showcase",
  description: "Real brands built with Chhaap — logos, palettes and identities for Indian businesses.",
};

export default async function ShowcasePage() {
  // Falls back to engine samples when the DB is unreachable or empty, so the
  // gallery is never a blank page.
  const rows = await db.brand
    .findMany({
      where: { isPublic: true, archivedAt: null },
      include: { identity: true },
      orderBy: [{ viewCount: "desc" }, { updatedAt: "desc" }],
      take: 24,
    })
    .catch(() => []);

  const published = rows
    .map((row) => {
      const spec = row.identity ? decodeJsonOrNull<BrandIdentitySpec>(row.identity.specJson) : null;
      if (!spec) return null;
      return {
        slug: row.slug,
        name: row.name,
        industry: getIndustry(row.industry).name,
        score: row.identity?.qualityScore ?? 0,
        svg: renderLogo({ doc: buildLogoDocument(spec, "primary"), spec }),
        primary: spec.palette.primary.hex,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Until users publish, show what the engine produces so the page is never bare.
  const samples = published.length === 0 ? marketingSamples() : [];

  return (
    <div className="px-5 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl">
          <h1 className="text-[38px] sm:text-[46px] font-semibold tracking-[-0.03em] leading-[1.08]">
            Brand showcase
          </h1>
          <p className="mt-4 text-[16px] text-ink-soft leading-relaxed">
            {published.length > 0
              ? "Brands their owners chose to make public."
              : "No one has published a brand yet. Here is what the engine produces from a brief."}
          </p>
        </div>

        {published.length > 0 ? (
          <ul className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {published.map((brand) => (
              <Card as="li" key={brand.slug} interactive className="overflow-hidden">
                <Link href={`/b/${brand.slug}`}>
                  <div className="h-44 bg-paper border-b border-line-soft flex items-center justify-center p-7">
                    <SvgFrame svg={brand.svg} className="h-full w-full" label={brand.name} />
                  </div>
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-[15px] font-semibold text-ink truncate">{brand.name}</h2>
                      <p className="text-[12.5px] text-muted truncate">{brand.industry}</p>
                    </div>
                    <span
                      className="w-6 h-6 rounded-[6px] border border-ink/8 shrink-0"
                      style={{ background: brand.primary }}
                    />
                  </div>
                </Link>
              </Card>
            ))}
          </ul>
        ) : (
          <ul className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {samples.map((sample) => (
              <Card as="li" key={sample.name} className="overflow-hidden">
                <div className="h-44 bg-paper border-b border-line-soft flex items-center justify-center p-7">
                  <SvgFrame svg={sample.logo} className="h-full w-full" label={sample.name} />
                </div>
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold text-ink truncate">{sample.name}</h2>
                    <p className="text-[12.5px] text-muted truncate">{sample.city}</p>
                  </div>
                  <Badge tone="neutral">Sample</Badge>
                </div>
              </Card>
            ))}
          </ul>
        )}

        <Card className="mt-14 p-8 text-center">
          <h2 className="text-[24px] font-semibold tracking-[-0.02em]">Put yours here</h2>
          <p className="mt-2 text-[14.5px] text-muted max-w-md mx-auto leading-relaxed">
            Generate your brand, then publish it to a public page you can share with customers.
          </p>
          <Link href="/try" className="inline-block mt-6">
            <Button size="lg" variant="secondary">Create My Brand</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
