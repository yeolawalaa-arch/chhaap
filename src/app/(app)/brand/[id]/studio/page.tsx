import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LogoStudio } from "@/components/studio/LogoStudio";
import { requireUser } from "@/lib/auth/session";
import { loadBrand, loadLogo } from "@/lib/brand/service";
import { renderLogo, VARIATION_LABELS } from "@/lib/render/logo";
import { GLYPHS } from "@/lib/render/glyphs";
import { fontsForScript } from "@/lib/fonts/catalog";
import { LOGO_VARIATIONS, type LogoVariation } from "@/types/brand";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const user = await requireUser();
  const { id } = await params;
  const brand = await loadBrand(id, user.id).catch(() => null);
  return { title: brand ? `${brand.name} — Logo Studio` : "Logo Studio" };
}

export default async function StudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { v } = await searchParams;

  const brand = await loadBrand(id, user.id).catch(() => null);
  if (!brand) notFound();
  if (!brand.spec) redirect(`/brand/${id}/directions`);

  const variation: LogoVariation = (LOGO_VARIATIONS as string[]).includes(v ?? "")
    ? (v as LogoVariation)
    : "primary";

  const doc = await loadLogo(id, user.id, variation);

  // Latin plus the brand's own script, so a Hindi brand can pick a Devanagari
  // face without being offered families that cannot render its text.
  const fonts = [
    ...fontsForScript("latin"),
    ...(brand.spec.script !== "latin" ? fontsForScript(brand.spec.script) : []),
  ];
  const seen = new Set<string>();

  return (
    <LogoStudio
      brandId={id}
      brandName={brand.name}
      spec={brand.spec}
      variations={LOGO_VARIATIONS.map((value) => ({
        variation: value,
        label: VARIATION_LABELS[value],
      }))}
      initialVariation={variation}
      initialDoc={doc}
      initialSvg={renderLogo({ doc, spec: brand.spec })}
      glyphOptions={GLYPHS.map((g) => ({ key: g.key, label: g.label }))}
      fontOptions={fonts
        .filter((f) => (seen.has(f.family) ? false : seen.add(f.family)))
        .map((f) => ({ family: f.family, label: f.family }))}
    />
  );
}
