import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DirectionPicker, type DirectionCard } from "@/components/brand/DirectionPicker";
import { requireUser } from "@/lib/auth/session";
import { listDirections, loadBrand } from "@/lib/brand/service";
import { buildLogoDocument, renderLogo } from "@/lib/render/logo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Choose a direction" };

export default async function DirectionsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const brand = await loadBrand(id, user.id).catch(() => null);
  if (!brand) notFound();

  const directions = await listDirections(id, user.id);
  if (directions.length === 0) redirect(`/brand/${id}`);

  const cards: DirectionCard[] = directions.map((d) => ({
    id: d.id,
    label: d.label,
    summary: d.summary,
    score: d.score,
    isSelected: d.isSelected,
    spec: d.spec,
    strategy: d.strategy,
    preview: renderLogo({ doc: buildLogoDocument(d.spec, "primary"), spec: d.spec }),
    previewHorizontal: renderLogo({ doc: buildLogoDocument(d.spec, "horizontal"), spec: d.spec }),
  }));

  return <DirectionPicker brandId={id} brandName={brand.name} directions={cards} />;
}
