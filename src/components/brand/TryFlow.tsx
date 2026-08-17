"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Chip,
  Field,
  Input,
  Progress,
  Select,
  SvgFrame,
  Textarea,
  cx,
  useToast,
} from "@/components/ui";
import { QualityPanel } from "@/components/brand/QualityPanel";
import { GuestOptionsPanel } from "@/components/brand/GuestOptionsPanel";
import { CategoryPicker } from "@/components/brand/CategoryPicker";
import { MoodPicker } from "@/components/brand/MoodPicker";
import { SparkleIcon } from "@/components/marketing/icons";
import { ApiError, api } from "@/lib/client/api";
import { saveBlob, svgToBlob } from "@/lib/client/rasterize";
import type { IndustryGroup, IndustryProfile } from "@/lib/brand/industries";
import type { LanguageDef } from "@/lib/brand/languages";
import type { TraitDef } from "@/lib/brand/personality";
import type { Sample, AssetShowcase } from "@/lib/marketing/samples";
import type {
  BrandBrief,
  BrandIdentitySpec,
  BrandStrategy,
  ColorMood,
  LanguageCode,
  PersonalityTrait,
  QualityReport,
} from "@/types/brand";

/**
 * Guest flow: brief → directions → full brand → export, with no account.
 *
 * State lives entirely in this component. Nothing is written anywhere, which is
 * the point — a visitor can evaluate the actual product before deciding whether
 * it is worth an account, and the deployment needs no database to demonstrate
 * what it does.
 */

interface GuestDirection {
  id: string;
  label: string;
  summary: string;
  score: number;
  spec: BrandIdentitySpec;
  strategy: BrandStrategy;
  quality: QualityReport;
  preview: string;
  variations: { variation: string; label: string; hint: string; svg: string; onDark: boolean }[];
  assets: { kind: string; label: string; ratio: number; svg: string }[];
  patterns: { kind: string; label: string; usage: string; svg: string }[];
  contrast: { fg: string; bg: string; ratio: number; passesAA: boolean; passesAALarge: boolean }[];
}

export interface TryData {
  industryGroups: { group: IndustryGroup; label: string; items: IndustryProfile[] }[];
  traits: TraitDef[];
  languages: LanguageDef[];
  moods: { mood: ColorMood; label: string; hint: string }[];
  accountsAvailable: boolean;
  samples: Sample[];
  showcase: AssetShowcase;
}

type Stage = "brief" | "directions" | "brand";

const WIZARD_STEPS = [
  {
    key: "business",
    title: "Your business",
    why: "Your name and city set the tone before a single colour gets picked.",
  },
  {
    key: "category",
    title: "Category",
    why: "Every category reads with different colours, marks and assets — this is what points the engine.",
  },
  {
    key: "audience",
    title: "Who buys from you",
    why: "The audience shapes the voice more than the product does.",
  },
  {
    key: "personality",
    title: "Personality",
    why: "The single biggest lever on how the final brand looks. Pick up to four.",
  },
  {
    key: "style",
    title: "Colour & language",
    why: "Optional steer — leave Colour on Auto and the engine reasons it out from your category.",
  },
  {
    key: "review",
    title: "Review",
    why: "Last look before Chhaap builds six complete brand systems.",
  },
] as const;

const FIELD_STEP: Record<string, number> = {
  businessName: 0,
  city: 0,
  descriptor: 0,
  industry: 1,
  audience: 2,
  personality: 3,
  colorMood: 4,
  language: 4,
  localName: 4,
};

const SYSTEM_CONTENTS = [
  { title: "Logo direction", body: "A distinct mark and lockup — not a font with a swoosh bolted on." },
  { title: "Colour palette", body: "Primary, accent and neutrals, contrast-checked for print and screen." },
  { title: "Typography", body: "A display and body pairing chosen for your category, not a safe default." },
  { title: "Brand personality", body: "The traits you picked, translated into visual weight and tone." },
  { title: "Visual language", body: "Patterns and textures that extend the mark onto packaging and posts." },
  { title: "Brand applications", body: "Visiting card, signboard, Instagram post and more — rendered, not mocked." },
];

const ARCHETYPE_NAMES = [
  "Modern Mark",
  "Heritage Seal",
  "Bold Letterform",
  "Warm Signature",
  "Quiet Wordmark",
  "Fine Line",
  "Structured Grid",
];

export function TryFlow({ data }: { data: TryData }) {
  const toast = useToast();

  const [stage, setStage] = useState<Stage>("brief");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [directions, setDirections] = useState<GuestDirection[]>([]);
  const [chosen, setChosen] = useState<GuestDirection | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [descriptor, setDescriptor] = useState("");
  const [industry, setIndustry] = useState("");
  const [audience, setAudience] = useState("");
  const [city, setCity] = useState("");
  const [personality, setPersonality] = useState<PersonalityTrait[]>([]);
  const [colorMood, setColorMood] = useState<ColorMood>("auto");
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [localName, setLocalName] = useState("");
  const [reroll, setReroll] = useState(0);
  const [wizardStep, setWizardStep] = useState(0);
  const wizardRef = useRef<HTMLDivElement>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [quotaMessage, setQuotaMessage] = useState<string | null>(null);

  const selectedLanguage = data.languages.find((l) => l.code === language);
  const needsLocalName = selectedLanguage && selectedLanguage.script !== "latin";
  const ready = businessName.trim() && industry && audience.trim().length >= 3 && personality.length;
  const selectedIndustry = data.industryGroups.flatMap((g) => g.items).find((i) => i.key === industry);

  const stepValid = [
    businessName.trim().length > 0,
    industry !== "",
    audience.trim().length >= 3,
    personality.length > 0,
    true,
    true,
  ];

  function toggleTrait(id: PersonalityTrait) {
    setPersonality((c) =>
      c.includes(id) ? c.filter((t) => t !== id) : c.length >= 4 ? c : [...c, id],
    );
  }

  function goStep(next: number) {
    setWizardStep(Math.max(0, Math.min(WIZARD_STEPS.length - 1, next)));
    requestAnimationFrame(() => wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function generate(salt?: string) {
    setBusy(true);
    setFields({});
    try {
      const res = await api.post<{ directions: GuestDirection[]; remaining: number }>(
        "/api/try/generate",
        {
          salt,
          businessName: businessName.trim(),
          descriptor: descriptor.trim() || undefined,
          industry,
          audience: audience.trim(),
          personality,
          colorMood,
          language,
          localName: needsLocalName && localName.trim() ? localName.trim() : undefined,
          city: city.trim() || undefined,
        },
      );
      setDirections(res.directions);
      setRemaining(res.remaining);
      setQuotaMessage(null);
      setStage("directions");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.needsUpgrade) {
          setQuotaMessage(err.message);
          setRemaining(0);
          toast.error(err.message);
        } else {
          setFields(err.fields);
          toast.error(err.message);
          const erroredSteps = Object.keys(err.fields).map((f) => FIELD_STEP[f] ?? 0);
          if (erroredSteps.length) goStep(Math.min(...erroredSteps));
        }
      } else {
        toast.error("Could not generate. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function download(
    target: "logo" | "asset" | "guidelines",
    format: "svg" | "png" | "pdf",
    extra: { variation?: string; kind?: string } = {},
  ) {
    if (!chosen) return;
    const key = `${target}-${format}-${extra.variation ?? extra.kind ?? ""}`;
    setDownloading(key);

    try {
      const res = await fetch("/api/try/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          spec: chosen.spec,
          strategy: target === "guidelines" ? chosen.strategy : undefined,
          target,
          format,
          ...extra,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? `Export failed (${res.status}).`);
      }

      const contentType = res.headers.get("content-type") ?? "";

      if (!contentType.includes("application/json")) {
        const blob = await res.blob();
        const disposition = res.headers.get("content-disposition") ?? "";
        const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `chhaap.${format}`;
        saveBlob(blob, filename);
        const raw = res.headers.get("x-chhaap-warning");
        if (raw) setWarning(decodeURIComponent(raw));
        toast.success(`Downloaded ${filename}`);
      } else {
        const instruction = await res.json();
        const blob = await svgToBlob(instruction.svg, instruction.width, instruction.height, {
          background: instruction.background,
        });
        saveBlob(blob, instruction.filename);
        if (instruction.warning?.message) setWarning(instruction.warning.message);
        toast.success(`Downloaded ${instruction.filename}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setDownloading(null);
    }
  }

  /** The same brief the current directions were generated from, for /api/try/alternatives. */
  function currentBrief(): BrandBrief {
    return {
      businessName: businessName.trim(),
      descriptor: descriptor.trim() || undefined,
      industry,
      audience: audience.trim(),
      personality,
      colorMood,
      language,
      localName: needsLocalName && localName.trim() ? localName.trim() : undefined,
      city: city.trim() || undefined,
    } as BrandBrief;
  }

  async function applyPatch(patch: Partial<Pick<BrandIdentitySpec, "mark" | "palette" | "typography">>) {
    if (!chosen) return;
    const res = await api.post<
      Pick<GuestDirection, "spec" | "quality" | "preview" | "variations" | "assets" | "patterns" | "contrast">
    >("/api/try/apply", { spec: chosen.spec, patch });
    setChosen((prev) => (prev ? { ...prev, ...res } : prev));
  }

  // =========================================================================
  // Stage 3 — the full brand
  // =========================================================================
  if (stage === "brand" && chosen) {
    const spec = chosen.spec;
    return (
      <div className="max-w-[1200px] mx-auto px-5 py-10">
        <button
          onClick={() => setStage("directions")}
          className="text-[13px] text-muted hover:text-ink transition-colors"
        >
          ← Back to directions
        </button>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[32px] font-semibold tracking-[-0.025em]">{spec.name}</h1>
            {spec.descriptor && <p className="mt-1 text-[14px] text-muted">{spec.descriptor}</p>}
          </div>
          <Badge tone="brand">{chosen.label}</Badge>
        </div>

        {warning && (
          <div className="mt-5 p-4 rounded-[12px] bg-warn-bg border border-warn/20">
            <p className="text-[13px] text-warn leading-relaxed">
              <span className="font-semibold">Check before printing: </span>
              {warning}
            </p>
          </div>
        )}

        <div className="mt-8 grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-6">
            <Card className="p-5 sm:p-6">
              <h2 className="text-[16px] font-semibold text-ink mb-4">Logo — 8 variations</h2>
              <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {chosen.variations.map((item) => (
                  <li key={item.variation}>
                    <div
                      className={cx(
                        "h-28 rounded-[10px] border border-line flex items-center justify-center p-4",
                        item.onDark ? "bg-ink" : "bg-paper",
                      )}
                    >
                      <SvgFrame svg={item.svg} className="h-full w-full" label={item.label} />
                    </div>
                    <p className="mt-2 text-[12.5px] font-medium text-ink">{item.label}</p>
                    <p className="text-[11px] text-muted leading-snug mt-0.5">{item.hint}</p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="text-[16px] font-semibold text-ink mb-1.5">Colour</h2>
              <p className="text-[13.5px] text-muted leading-relaxed mb-5">
                {chosen.strategy.colorPsychology?.replace(/\*\*/g, "")}
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
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="text-[16px] font-semibold text-ink mb-4">In use</h2>
              <ul className="grid sm:grid-cols-2 gap-4">
                {chosen.assets.map((asset) => (
                  <li key={asset.kind}>
                    <div
                      className="rounded-[10px] border border-line overflow-hidden bg-paper-alt"
                      style={{ aspectRatio: asset.ratio }}
                    >
                      <SvgFrame svg={asset.svg} contain={false} label={asset.label} />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[12.5px] text-ink">{asset.label}</p>
                      <button
                        onClick={() => download("asset", "png", { kind: asset.kind })}
                        disabled={downloading !== null}
                        className="text-[11.5px] text-muted hover:text-ink transition-colors disabled:opacity-50"
                      >
                        {downloading === `asset-png-${asset.kind}` ? "…" : "PNG"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="text-[16px] font-semibold text-ink mb-1.5">Brand voice</h2>
              <p className="text-[13.5px] text-muted mb-4">
                Tone: {chosen.strategy.voice?.tone?.join(" · ")}
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-[10px] bg-paper-alt">
                  <p className="text-[10.5px] uppercase tracking-[0.12em] text-faint font-semibold mb-2">
                    Instagram caption
                  </p>
                  <p className="text-[14px] text-ink leading-relaxed" lang={spec.language}>
                    {chosen.strategy.voice?.sampleCaption}
                  </p>
                </div>
                <div className="p-4 rounded-[10px] bg-paper-alt">
                  <p className="text-[10.5px] uppercase tracking-[0.12em] text-faint font-semibold mb-2">
                    WhatsApp greeting
                  </p>
                  <p className="text-[14px] text-ink leading-relaxed" lang={spec.language}>
                    {chosen.strategy.voice?.sampleWhatsApp}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-5">
            <Card className="p-5">
              <h3 className="text-[14px] font-semibold text-ink mb-3">Download</h3>
              <div className="grid grid-cols-3 gap-2">
                {(["png", "svg", "pdf"] as const).map((format) => (
                  <Button
                    key={format}
                    size="sm"
                    variant="outline"
                    onClick={() => download("logo", format, { variation: "primary" })}
                    loading={downloading === `logo-${format}-primary`}
                    disabled={downloading !== null}
                  >
                    {format.toUpperCase()}
                  </Button>
                ))}
              </div>
              <Button
                size="sm"
                full
                className="mt-2"
                onClick={() => download("guidelines", "pdf")}
                loading={downloading === "guidelines-pdf-"}
                disabled={downloading !== null}
              >
                Brand guidelines PDF
              </Button>
              <p className="mt-3 text-[11.5px] text-muted leading-relaxed">
                Guest downloads are watermarked and capped at {1400} px.
                {data.accountsAvailable
                  ? " Create a free account for full resolution."
                  : " Accounts are not available on this deployment yet."}
              </p>
            </Card>

            <GuestOptionsPanel
              spec={chosen.spec}
              brief={currentBrief()}
              currentScore={chosen.quality.score}
              onApply={applyPatch}
            />

            <QualityPanel report={chosen.quality} />

            <Card className="p-5">
              <h3 className="text-[14px] font-semibold text-ink mb-2">Nothing was saved</h3>
              <p className="text-[12.5px] text-muted leading-relaxed">
                This brand exists only in this browser tab. Download what you want before you
                close it — there is no account holding it.
              </p>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Stage 2 — directions
  // =========================================================================
  if (stage === "directions") {
    return (
      <div className="max-w-[1200px] mx-auto px-5 py-10">
        <button
          onClick={() => setStage("brief")}
          className="text-[13px] text-muted hover:text-ink transition-colors"
        >
          ← Change the brief
        </button>

        <h1 className="mt-3 text-[30px] sm:text-[38px] font-semibold tracking-[-0.025em] leading-[1.1]">
          Brand directions for {businessName}
        </h1>
        <p className="mt-3 text-[15px] text-muted leading-relaxed max-w-2xl">
          Each is a complete system — different mark, different type classification, different
          colour logic. Pick one to see the whole brand.
        </p>

        <div className="mt-5 flex items-center gap-3">
          <Button
            variant="outline"
            loading={busy}
            disabled={remaining === 0}
            onClick={() => {
              // The salt is passed directly rather than read from state, which
              // would still hold the previous value on this render.
              const next = reroll + 1;
              setReroll(next);
              void generate(`r${next}`);
            }}
          >
            Show me different ones
          </Button>
          {remaining !== null && (
            <span className="text-[12.5px] text-muted">
              {remaining === 0
                ? "No free generations left"
                : `${remaining} free generation${remaining === 1 ? "" : "s"} left`}
            </span>
          )}
        </div>

        <div className="mt-8 grid sm:grid-cols-2 gap-5">
          {directions.map((direction) => (
            <Card key={direction.id} interactive className="overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setChosen(direction);
                  setStage("brand");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="w-full text-left"
              >
                <div className="h-56 bg-paper border-b border-line-soft flex items-center justify-center p-8">
                  <SvgFrame svg={direction.preview} className="h-full w-full" label={direction.label} />
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[16px] font-semibold text-ink">{direction.label}</h2>
                      <p className="mt-1 text-[13px] text-muted leading-relaxed">
                        {direction.summary}
                      </p>
                    </div>
                    <Badge tone={direction.quality.score >= 72 ? "success" : "warn"}>
                      {direction.quality.score}
                    </Badge>
                  </div>
                  <div className="mt-4 pt-4 border-t border-line-soft flex items-center justify-between gap-3">
                    <div className="flex gap-1.5">
                      {Object.values(direction.spec.palette)
                        .slice(0, 4)
                        .map((c) => (
                          <span
                            key={c.role}
                            className="w-6 h-6 rounded-[6px] border border-ink/8"
                            style={{ background: c.hex }}
                          />
                        ))}
                    </div>
                    <p className="text-[12px] text-muted text-right">
                      {direction.spec.typography.display.family}
                    </p>
                  </div>
                </div>
              </button>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // =========================================================================
  // Stage 1 — the brief
  // =========================================================================
  return (
    <div>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="px-5 pt-14 pb-16 sm:pt-20 sm:pb-20">
        <div className="max-w-2xl mx-auto text-center animate-in-up">
          <div className="flex items-center justify-center gap-2 flex-wrap mb-5">
            <Badge tone="brand">No account needed</Badge>
            <Badge tone="neutral">Nothing is saved</Badge>
          </div>

          <h1 className="text-[38px] sm:text-[54px] leading-[1.04] font-semibold tracking-[-0.03em]">
            Build a brand,
            <br />
            <span className="text-brand-500">not just a logo.</span>
          </h1>

          <p className="mt-5 text-[16px] sm:text-[18px] text-ink-soft leading-relaxed max-w-xl mx-auto">
            Chhaap builds a complete identity for your Indian business — logo, colours,
            typography, voice and the assets you&rsquo;ll actually print. Free, and nothing is
            saved until you download it.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" variant="secondary" onClick={() => goStep(0)}>
              Start building — free
            </Button>
            <a href="#see-output">
              <Button size="lg" variant="outline" full>
                See a sample brand
              </Button>
            </a>
          </div>

          <p className="mt-5 text-[13px] text-muted">
            {data.industryGroups.reduce((n, g) => n + g.items.length, 0)} categories · 11 Indian
            languages · about 2 minutes
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Show the output before asking for input                          */}
      {/* ---------------------------------------------------------------- */}
      <section id="see-output" className="px-5 py-14 sm:py-16 border-y border-line bg-white scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-[13px] text-muted mb-8">
            Every brand below was generated by the same engine, on this page load — not drawn by
            hand.
          </p>

          <div className="flex gap-3.5 overflow-x-auto pb-2 -mx-5 px-5 snap-x snap-mandatory sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:overflow-visible">
            {data.samples.map((sample) => (
              <div key={sample.name} className="shrink-0 w-[220px] sm:w-auto snap-start">
                <Card className="p-4 h-full flex flex-col">
                  <div className="h-24 flex items-center justify-center">
                    <SvgFrame svg={sample.icon} className="h-full w-full" label={`${sample.name} logo`} />
                  </div>
                  <div className="mt-3 pt-3 border-t border-line-soft">
                    <div className="flex gap-1">
                      {[sample.palette.primary, sample.palette.accent, sample.palette.ink].map((hex) => (
                        <span
                          key={hex}
                          className="w-5 h-5 rounded-[5px] border border-ink/8"
                          style={{ background: hex }}
                        />
                      ))}
                    </div>
                    <p className="mt-2.5 text-[12px] font-medium text-ink truncate">
                      {sample.fonts.display}
                    </p>
                    {sample.tagline && (
                      <p className="mt-1 text-[11.5px] text-muted leading-snug line-clamp-2">
                        &ldquo;{sample.tagline}&rdquo;
                      </p>
                    )}
                  </div>
                </Card>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <p className="text-center text-[13px] text-muted mb-6">
              …and every asset it needs, rendered from that one system
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {data.showcase.items.map((item) => (
                <Card key={item.kind} interactive className="overflow-hidden">
                  <div
                    className="bg-paper-alt border-b border-line-soft overflow-hidden"
                    style={{ aspectRatio: item.ratio }}
                  >
                    <SvgFrame svg={item.svg} contain={false} label={item.label} />
                  </div>
                  <p className="px-3 py-2.5 text-[12.5px] font-medium text-ink">{item.label}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Six complete systems                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="px-5 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-[26px] sm:text-[34px] font-semibold tracking-[-0.025em] leading-[1.15]">
            Six complete brand systems, not six logos
          </h2>
          <p className="mt-3 text-[15px] sm:text-[16px] text-ink-soft leading-relaxed max-w-xl mx-auto">
            Every direction carries its own logic end to end. Pick the one that feels right, and
            everything downstream already matches it.
          </p>
        </div>

        <div className="mt-10 max-w-4xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SYSTEM_CONTENTS.map((item) => (
            <div key={item.title} className="p-5 rounded-[14px] border border-line bg-white">
              <p className="text-[13.5px] font-semibold text-ink">{item.title}</p>
              <p className="mt-1.5 text-[12.5px] text-muted leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
          {ARCHETYPE_NAMES.map((name) => (
            <span
              key={name}
              className="px-3 h-7 inline-flex items-center rounded-full bg-paper-alt border border-line text-[12px] text-ink-soft"
            >
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* The wizard                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section ref={wizardRef} className="px-5 py-16 sm:py-20 bg-white border-t border-line scroll-mt-16">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[12px] font-semibold text-ink tabular-nums">
              {String(wizardStep + 1).padStart(2, "0")} / {String(WIZARD_STEPS.length).padStart(2, "0")}
            </p>
            <p className="text-[12px] text-faint">{WIZARD_STEPS[wizardStep]!.title}</p>
          </div>
          <Progress value={((wizardStep + 1) / WIZARD_STEPS.length) * 100} className="mb-9" />

          <div key={wizardStep} className="animate-fade">
            <h2 className="text-[22px] sm:text-[27px] font-semibold tracking-[-0.02em]">
              {WIZARD_STEPS[wizardStep]!.title}
            </h2>
            <p className="mt-2 text-[13.5px] text-muted leading-relaxed flex items-start gap-1.5">
              <SparkleIcon className="shrink-0 mt-0.5 text-brand-500" size={13} />
              {WIZARD_STEPS[wizardStep]!.why}
            </p>

            <div className="mt-7 space-y-6">
              {wizardStep === 0 && (
                <>
                  <Field label="Business name" error={fields.businessName} required htmlFor="name">
                    <Input
                      id="name"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Sharma Kirana"
                      maxLength={60}
                      invalid={!!fields.businessName}
                      className="h-12 text-[15px]"
                    />
                  </Field>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="City" hint="Optional" htmlFor="city">
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Indore"
                        maxLength={60}
                      />
                    </Field>
                    <Field label="Descriptor" hint="The line under your name. Optional." htmlFor="descriptor">
                      <Input
                        id="descriptor"
                        value={descriptor}
                        onChange={(e) => setDescriptor(e.target.value)}
                        placeholder="Provision & Daily Needs"
                        maxLength={60}
                      />
                    </Field>
                  </div>
                </>
              )}

              {wizardStep === 1 && (
                <Field error={fields.industry}>
                  <CategoryPicker groups={data.industryGroups} value={industry} onChange={setIndustry} />
                </Field>
              )}

              {wizardStep === 2 && (
                <Field error={fields.audience} htmlFor="audience">
                  <Textarea
                    id="audience"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="Families in the neighbourhood who shop weekly and care about fresh stock and fair prices."
                    maxLength={200}
                    rows={4}
                    invalid={!!fields.audience}
                    className="text-[15px]"
                  />
                  <p className="mt-1.5 text-[12px] text-faint text-right">{audience.length}/200</p>
                </Field>
              )}

              {wizardStep === 3 && (
                <Field error={fields.personality}>
                  <div className="flex flex-wrap gap-2">
                    {data.traits.map((trait) => (
                      <Chip
                        key={trait.id}
                        selected={personality.includes(trait.id)}
                        onClick={() => toggleTrait(trait.id)}
                        disabled={personality.length >= 4 && !personality.includes(trait.id)}
                        title={trait.hint}
                      >
                        {trait.label}
                      </Chip>
                    ))}
                  </div>
                  <p className="mt-3 text-[12px] text-faint">{personality.length}/4 selected</p>
                </Field>
              )}

              {wizardStep === 4 && (
                <>
                  <Field label="Colour direction" htmlFor="mood">
                    <MoodPicker moods={data.moods} value={colorMood} onChange={setColorMood} />
                  </Field>
                  <Field label="Language" htmlFor="lang">
                    <Select
                      id="lang"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                    >
                      {data.languages.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.nativeName} — {l.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {needsLocalName && (
                    <Field
                      label={`Your name in ${selectedLanguage!.name}`}
                      hint="Optional. Adds a bilingual lockup to your logo and signboard."
                      htmlFor="localName"
                    >
                      <Input
                        id="localName"
                        value={localName}
                        onChange={(e) => setLocalName(e.target.value)}
                        placeholder={selectedLanguage!.sample}
                        maxLength={60}
                        lang={selectedLanguage!.code}
                      />
                    </Field>
                  )}
                </>
              )}

              {wizardStep === 5 && (
                <div className="rounded-[14px] border border-line divide-y divide-line-soft overflow-hidden">
                  {[
                    { label: "Business", value: businessName || "—", step: 0 },
                    { label: "Category", value: selectedIndustry?.name ?? "—", step: 1 },
                    { label: "Audience", value: audience || "—", step: 2 },
                    {
                      label: "Personality",
                      value: personality.length
                        ? personality.map((p) => data.traits.find((t) => t.id === p)?.label ?? p).join(", ")
                        : "—",
                      step: 3,
                    },
                    {
                      label: "Colour & language",
                      value: `${data.moods.find((m) => m.mood === colorMood)?.label ?? "Auto"} · ${selectedLanguage?.name ?? "English"}`,
                      step: 4,
                    },
                  ].map((row) => (
                    <button
                      key={row.label}
                      type="button"
                      onClick={() => goStep(row.step)}
                      className="w-full flex items-start justify-between gap-4 p-4 text-left hover:bg-paper-alt transition-colors"
                    >
                      <span>
                        <span className="block text-[11px] uppercase tracking-[0.1em] text-faint font-semibold">
                          {row.label}
                        </span>
                        <span className="block mt-1 text-[13.5px] text-ink leading-snug line-clamp-2">
                          {row.value}
                        </span>
                      </span>
                      <span className="text-[12px] text-muted shrink-0 mt-0.5">Edit</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-9 flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => goStep(wizardStep - 1)} disabled={wizardStep === 0}>
              Back
            </Button>

            {wizardStep < WIZARD_STEPS.length - 1 ? (
              <Button
                size="lg"
                variant="secondary"
                onClick={() => goStep(wizardStep + 1)}
                disabled={!stepValid[wizardStep]}
              >
                Next
              </Button>
            ) : quotaMessage ? (
              <Link href={data.accountsAvailable ? "/signup" : "/pricing"}>
                <Button size="lg" variant="secondary">
                  {data.accountsAvailable ? "Create a free account" : "See pricing"}
                </Button>
              </Link>
            ) : (
              <Button size="lg" variant="secondary" onClick={() => generate()} loading={busy} disabled={!ready}>
                {busy ? "Building six brand systems…" : "Build My Brand"}
              </Button>
            )}
          </div>

          {wizardStep === WIZARD_STEPS.length - 1 &&
            (quotaMessage ? (
              <p className="mt-5 text-center text-[13px] text-warn leading-relaxed">{quotaMessage}</p>
            ) : (
              <>
                <p className="mt-3 text-center text-[12px] text-muted">
                  {remaining === null
                    ? "Up to 10 free generations — no account needed"
                    : `${remaining} free generation${remaining === 1 ? "" : "s"} left`}
                </p>
                {data.accountsAvailable && (
                  <p className="mt-2 text-center text-[13px] text-muted">
                    Want to save and edit it?{" "}
                    <Link href="/signup" className="text-ink font-medium hover:text-brand-600">
                      Create a free account
                    </Link>
                  </p>
                )}
              </>
            ))}
        </div>
      </section>
    </div>
  );
}
