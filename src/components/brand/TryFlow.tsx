"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Chip,
  Field,
  Input,
  Select,
  SvgFrame,
  Textarea,
  cx,
  useToast,
} from "@/components/ui";
import { QualityPanel } from "@/components/brand/QualityPanel";
import { ApiError, api } from "@/lib/client/api";
import { saveBlob, svgToBlob } from "@/lib/client/rasterize";
import type { IndustryGroup, IndustryProfile } from "@/lib/brand/industries";
import type { LanguageDef } from "@/lib/brand/languages";
import type { TraitDef } from "@/lib/brand/personality";
import type {
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
}

type Stage = "brief" | "directions" | "brand";

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

  const selectedLanguage = data.languages.find((l) => l.code === language);
  const needsLocalName = selectedLanguage && selectedLanguage.script !== "latin";
  const ready = businessName.trim() && industry && audience.trim().length >= 3 && personality.length;

  function toggleTrait(id: PersonalityTrait) {
    setPersonality((c) =>
      c.includes(id) ? c.filter((t) => t !== id) : c.length >= 4 ? c : [...c, id],
    );
  }

  async function generate() {
    setBusy(true);
    setFields({});
    try {
      const res = await api.post<{ directions: GuestDirection[] }>("/api/try/generate", {
        businessName: businessName.trim(),
        descriptor: descriptor.trim() || undefined,
        industry,
        audience: audience.trim(),
        personality,
        colorMood,
        language,
        localName: needsLocalName && localName.trim() ? localName.trim() : undefined,
        city: city.trim() || undefined,
      });
      setDirections(res.directions);
      setStage("directions");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields);
        toast.error(err.message);
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
          Four directions for {businessName}
        </h1>
        <p className="mt-3 text-[15px] text-muted leading-relaxed max-w-2xl">
          Each is a complete system — different mark, different type classification, different
          colour logic. Pick one to see the whole brand.
        </p>

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
    <div className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
      <Badge tone="brand" className="mb-4">
        No account needed
      </Badge>
      <h1 className="text-[32px] sm:text-[40px] font-semibold tracking-[-0.025em] leading-[1.08]">
        Try it on your own business
      </h1>
      <p className="mt-3 text-[16px] text-ink-soft leading-relaxed">
        Answer these and get four complete brand systems — logo, colours, type, assets and voice.
        Nothing is saved anywhere.
      </p>

      <div className="mt-8 space-y-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Business name" error={fields.businessName} required htmlFor="name">
            <Input
              id="name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Sharma Kirana"
              maxLength={60}
              autoFocus
              invalid={!!fields.businessName}
            />
          </Field>
          <Field label="City" hint="Optional" htmlFor="city">
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Indore" maxLength={60} />
          </Field>
        </div>

        <Field label="Descriptor" hint="The small line under your name. Optional." htmlFor="descriptor">
          <Input
            id="descriptor"
            value={descriptor}
            onChange={(e) => setDescriptor(e.target.value)}
            placeholder="Provision & Daily Needs"
            maxLength={60}
          />
        </Field>

        <Field label="Category" error={fields.industry} required>
          <div className="space-y-3 mt-1">
            {data.industryGroups.map((group) => (
              <div key={group.group}>
                <p className="text-[11.5px] uppercase tracking-[0.11em] text-faint font-semibold mb-2">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <Chip
                      key={item.key}
                      selected={industry === item.key}
                      onClick={() => setIndustry(item.key)}
                      title={item.hint}
                    >
                      {item.name}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Field>

        <Field label="Who buys from you?" error={fields.audience} required htmlFor="audience">
          <Textarea
            id="audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="Families in the neighbourhood who shop weekly and care about fresh stock and fair prices."
            maxLength={200}
            rows={2}
            invalid={!!fields.audience}
          />
        </Field>

        <Field label="How should it feel?" error={fields.personality} required>
          <div className="flex flex-wrap gap-2 mt-1">
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
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Colour direction" htmlFor="mood">
            <Select id="mood" value={colorMood} onChange={(e) => setColorMood(e.target.value as ColorMood)}>
              {data.moods.map((m) => (
                <option key={m.mood} value={m.mood}>
                  {m.label}
                </option>
              ))}
            </Select>
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
        </div>

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

        <Button size="lg" full variant="secondary" onClick={generate} loading={busy} disabled={!ready}>
          {busy ? "Building four brand systems…" : "Generate my brand"}
        </Button>

        {data.accountsAvailable && (
          <p className="text-center text-[13.5px] text-muted">
            Want to save and edit it?{" "}
            <Link href="/signup" className="text-ink font-medium hover:text-brand-600">
              Create a free account
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
