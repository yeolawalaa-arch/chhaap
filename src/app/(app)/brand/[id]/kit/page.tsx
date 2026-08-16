import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Badge, Button, Card, SvgFrame } from "@/components/ui";
import { ExportBar } from "@/components/brand/ExportBar";
import { QualityPanel } from "@/components/brand/QualityPanel";
import { PublishToggle } from "@/components/brand/PublishToggle";
import { requireUser } from "@/lib/auth/session";
import { loadBrand, loadLogos } from "@/lib/brand/service";
import { buildLogoDocument, renderLogo, VARIATION_HINTS, VARIATION_LABELS } from "@/lib/render/logo";
import { patternSwatch, PATTERN_LABELS, PATTERN_USAGE } from "@/lib/render/patterns";
import { contrastMatrix } from "@/lib/brand/palettes";
import { describeTypography } from "@/lib/brand/typography";
import { colorResolver } from "@/lib/render/svg";
import { entitlementFor } from "@/lib/billing/plans";
import { LOGO_VARIATIONS } from "@/types/brand";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const user = await requireUser();
  const { id } = await params;
  const brand = await loadBrand(id, user.id).catch(() => null);
  return { title: brand ? `${brand.name} — Brand Kit` : "Brand Kit" };
}

/** Strips the light markdown emphasis the narrative generators emit. */
const plain = (s: string) => s.replace(/\*\*/g, "");

export default async function BrandKitPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const brand = await loadBrand(id, user.id).catch(() => null);
  if (!brand) notFound();
  if (!brand.spec || !brand.strategy) redirect(`/brand/${id}/directions`);

  const [logos, entitlement] = await Promise.all([
    loadLogos(id, user.id),
    entitlementFor(user.id),
  ]);

  const spec = brand.spec;
  const strategy = brand.strategy;
  const resolve = colorResolver(spec, "brand");

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

  const contrast = contrastMatrix(spec.palette);

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <Link
            href={`/brand/${id}`}
            className="text-[13px] text-muted hover:text-ink transition-colors"
          >
            ← {brand.name}
          </Link>
          <h1 className="mt-1.5 text-[32px] font-semibold tracking-[-0.025em]">Brand Kit</h1>
          <p className="mt-1 text-[14px] text-muted">
            Everything that defines {brand.name}, in one place.
          </p>
        </div>
        <PublishToggle brandId={id} slug={brand.slug} isPublic={brand.isPublic} />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          {/* Logo */}
          <Card className="p-5 sm:p-6">
            <h2 className="text-[16px] font-semibold text-ink mb-4">Logo</h2>
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

          {/* Colour */}
          <Card className="p-5 sm:p-6">
            <h2 className="text-[16px] font-semibold text-ink mb-1.5">Colour</h2>
            <p className="text-[13.5px] text-muted leading-relaxed mb-5">
              {plain(strategy.colorPsychology)}
            </p>

            <ul className="grid sm:grid-cols-2 gap-3">
              {Object.values(spec.palette).map((color) => (
                <li key={color.role} className="flex gap-3">
                  <span
                    className="w-16 h-16 rounded-[10px] border border-ink/8 shrink-0"
                    style={{ background: color.hex }}
                  />
                  <div className="min-w-0 py-0.5">
                    <p className="text-[13.5px] font-medium text-ink">{color.name}</p>
                    <p className="text-[11.5px] text-muted font-mono mt-0.5">
                      {color.hex.toUpperCase()}
                    </p>
                    <p className="text-[11px] text-faint mt-0.5 leading-snug">
                      RGB {color.rgb.join(" ")} · CMYK {color.cmyk.join(" ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6 pt-5 border-t border-line-soft">
              <h3 className="text-[13px] font-semibold text-ink mb-1">Contrast</h3>
              <p className="text-[12px] text-muted mb-3 leading-relaxed">
                Measured to WCAG 2.1. AA is safe for body text; AA Large covers 18pt and above.
              </p>
              <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                {contrast.map((pair) => (
                  <li
                    key={`${pair.fg}-${pair.bg}`}
                    className="flex items-center justify-between text-[12.5px] py-0.5"
                  >
                    <span className="text-ink-soft">
                      {pair.fg} on {pair.bg}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums text-ink font-medium">{pair.ratio}:1</span>
                      <Badge tone={pair.passesAA ? "success" : pair.passesAALarge ? "warn" : "danger"}>
                        {pair.passesAA ? "AA" : pair.passesAALarge ? "AA Large" : "Fails"}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[11.5px] text-muted leading-relaxed">
                CMYK values are an unmanaged conversion for reference. For production printing, give
                your press the hex values and ask them to convert with their own ICC profile.
              </p>
            </div>
          </Card>

          {/* Typography */}
          <Card className="p-5 sm:p-6">
            <h2 className="text-[16px] font-semibold text-ink mb-1.5">Typography</h2>
            <p className="text-[13.5px] text-muted leading-relaxed mb-5">
              {plain(describeTypography(spec.typography))}
            </p>

            <div className="space-y-5">
              {[
                { role: "Display", font: spec.typography.display, size: 34, sample: spec.name },
                { role: "Body", font: spec.typography.body, size: 19, sample: spec.name },
                ...(spec.typography.local
                  ? [
                      {
                        role: "Local script",
                        font: spec.typography.local,
                        size: 27,
                        sample: spec.localName ?? spec.name,
                      },
                    ]
                  : []),
              ].map((item) => (
                <div key={item.role} className="pb-4 border-b border-line-soft last:border-0">
                  <p className="text-[11px] uppercase tracking-[0.11em] text-faint font-semibold">
                    {item.role} · {item.font.family} {item.font.weight}
                  </p>
                  <p
                    className="mt-2 text-ink leading-tight"
                    style={{
                      fontFamily: `"${item.font.family}", sans-serif`,
                      fontSize: item.size,
                      fontWeight: item.font.weight,
                      letterSpacing: `${item.font.letterSpacing}em`,
                      textTransform: item.font.transform === "uppercase" ? "uppercase" : "none",
                    }}
                  >
                    {item.sample}
                  </p>
                  <p
                    className="mt-1.5 text-muted"
                    style={{ fontFamily: `"${item.font.family}", sans-serif`, fontSize: 13 }}
                  >
                    {item.role === "Local script"
                      ? "क ख ग घ ०१२३४५६७८९"
                      : "ABCDEFGHIJKLM abcdefghijklm 0123456789 ₹"}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* Patterns */}
          {spec.patterns.length > 0 && (
            <Card className="p-5 sm:p-6">
              <h2 className="text-[16px] font-semibold text-ink mb-4">Patterns</h2>
              <ul className="grid sm:grid-cols-3 gap-4">
                {spec.patterns.map((pattern) => (
                  <li key={pattern.kind}>
                    <div className="aspect-square rounded-[10px] border border-line overflow-hidden">
                      <SvgFrame
                        svg={patternSwatch(pattern, spec, resolve, 200)}
                        contain={false}
                        label={PATTERN_LABELS[pattern.kind]}
                      />
                    </div>
                    <p className="mt-2 text-[12.5px] font-medium text-ink">
                      {PATTERN_LABELS[pattern.kind]}
                    </p>
                    <p className="text-[11px] text-muted leading-snug mt-0.5">
                      {PATTERN_USAGE[pattern.kind]}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Voice */}
          <Card className="p-5 sm:p-6">
            <h2 className="text-[16px] font-semibold text-ink mb-1.5">Brand voice</h2>
            <p className="text-[13.5px] text-muted mb-5">
              Tone: {strategy.voice.tone.join(" · ")}
            </p>

            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.11em] text-faint font-semibold mb-2.5">
                  Do
                </h3>
                <ul className="space-y-2">
                  {strategy.voice.dos.map((item) => (
                    <li key={item} className="text-[13px] text-ink-soft leading-relaxed flex gap-2">
                      <span className="text-success shrink-0" aria-hidden="true">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.11em] text-faint font-semibold mb-2.5">
                  Don&rsquo;t
                </h3>
                <ul className="space-y-2">
                  {strategy.voice.donts.map((item) => (
                    <li key={item} className="text-[13px] text-ink-soft leading-relaxed flex gap-2">
                      <span className="text-danger shrink-0" aria-hidden="true">✕</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-6 grid sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-[10px] bg-paper-alt">
                <p className="text-[10.5px] uppercase tracking-[0.12em] text-faint font-semibold mb-2">
                  Instagram caption
                </p>
                <p className="text-[14px] text-ink leading-relaxed" lang={spec.language}>
                  {strategy.voice.sampleCaption}
                </p>
              </div>
              <div className="p-4 rounded-[10px] bg-paper-alt">
                <p className="text-[10.5px] uppercase tracking-[0.12em] text-faint font-semibold mb-2">
                  WhatsApp greeting
                </p>
                <p className="text-[14px] text-ink leading-relaxed" lang={spec.language}>
                  {strategy.voice.sampleWhatsApp}
                </p>
              </div>
            </div>
          </Card>

          {/* Usage rules */}
          <Card className="p-5 sm:p-6">
            <h2 className="text-[16px] font-semibold text-ink mb-4">Logo usage</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.11em] text-faint font-semibold mb-2.5">
                  Do
                </h3>
                <ul className="space-y-2 text-[13px] text-ink-soft leading-relaxed">
                  <li>
                    Keep clear space of at least {spec.layout.clearSpace}× the mark&rsquo;s height on
                    every side.
                  </li>
                  <li>Use the one-colour variation on kraft, cloth, corrugate and vinyl.</li>
                  <li>Reverse to the white variation on photographs and dark backgrounds.</li>
                  <li>Reproduce no smaller than 12 mm wide in print, 32 px on screen.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.11em] text-faint font-semibold mb-2.5">
                  Don&rsquo;t
                </h3>
                <ul className="space-y-2 text-[13px] text-ink-soft leading-relaxed">
                  <li>Don&rsquo;t stretch, squash or rotate the logo.</li>
                  <li>Don&rsquo;t recolour it outside this palette.</li>
                  <li>Don&rsquo;t add shadows, outlines, bevels or gradients to the mark.</li>
                  <li>Don&rsquo;t set the name in a different typeface, however close it looks.</li>
                </ul>
              </div>
            </div>
          </Card>
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
        </div>
      </div>
    </div>
  );
}
