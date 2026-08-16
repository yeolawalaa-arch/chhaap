"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Chip,
  Field,
  Input,
  Progress,
  Textarea,
  cx,
  useToast,
} from "@/components/ui";
import { ApiError, api } from "@/lib/client/api";
import type { IndustryGroup, IndustryProfile } from "@/lib/brand/industries";
import type { LanguageDef } from "@/lib/brand/languages";
import type { TraitDef } from "@/lib/brand/personality";
import type { ColorMood, LanguageCode, PersonalityTrait } from "@/types/brand";

/**
 * The brand brief wizard.
 *
 * Five steps, one decision each. The ordering matters: name and category first
 * (cheap, unambiguous), personality in the middle (the highest-signal input),
 * language last (where the local-script field only appears once we know it is
 * relevant). Nothing is submitted until the final step, so back-navigation is
 * free and no partial brands accumulate.
 */

export interface WizardData {
  industryGroups: { group: IndustryGroup; label: string; items: IndustryProfile[] }[];
  traits: TraitDef[];
  languages: LanguageDef[];
  moods: { mood: ColorMood; label: string; hint: string }[];
  quota: { used: number; limit: number; unlimited: boolean };
}

const STEPS = ["Business", "Audience", "Personality", "Look", "Language"] as const;

export function CreateWizard({ data }: { data: WizardData }) {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  const [businessName, setBusinessName] = useState("");
  const [descriptor, setDescriptor] = useState("");
  const [industry, setIndustry] = useState("");
  const [audience, setAudience] = useState("");
  const [city, setCity] = useState("");
  const [personality, setPersonality] = useState<PersonalityTrait[]>([]);
  const [colorMood, setColorMood] = useState<ColorMood>("auto");
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [localName, setLocalName] = useState("");
  const [notes, setNotes] = useState("");

  const selectedLanguage = data.languages.find((l) => l.code === language);
  const needsLocalName = selectedLanguage && selectedLanguage.script !== "latin";

  const selectedIndustry = useMemo(
    () => data.industryGroups.flatMap((g) => g.items).find((i) => i.key === industry),
    [data.industryGroups, industry],
  );

  const canAdvance = [
    businessName.trim().length > 0 && industry.length > 0,
    audience.trim().length >= 3,
    personality.length >= 1,
    true,
    true,
  ][step];

  function toggleTrait(id: PersonalityTrait) {
    setPersonality((current) =>
      current.includes(id)
        ? current.filter((t) => t !== id)
        : current.length >= 4
          ? current
          : [...current, id],
    );
  }

  async function submit() {
    setBusy(true);
    setFields({});

    try {
      const res = await api.post<{ redirect: string }>("/api/brands", {
        brief: {
          businessName: businessName.trim(),
          descriptor: descriptor.trim() || undefined,
          industry,
          audience: audience.trim(),
          personality,
          colorMood,
          language,
          localName: needsLocalName && localName.trim() ? localName.trim() : undefined,
          city: city.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        count: 6,
      });

      router.push(res.redirect);
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields);
        if (err.needsUpgrade) {
          toast.error(err.message, "Open Pricing to see your options.");
        } else {
          toast.error(err.message);
        }
        // Jump back to whichever step owns the first invalid field.
        const firstBad = Object.keys(err.fields)[0];
        if (firstBad?.includes("businessName") || firstBad?.includes("industry")) setStep(0);
        else if (firstBad?.includes("audience")) setStep(1);
        else if (firstBad?.includes("personality")) setStep(2);
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
      <div className="mb-9">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-medium text-muted">
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </p>
          {!data.quota.unlimited && (
            <Badge tone={data.quota.used >= data.quota.limit ? "danger" : "neutral"}>
              {Math.max(0, data.quota.limit - data.quota.used)} generations left
            </Badge>
          )}
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} />
      </div>

      <div key={step} className="animate-in-up">
        {/* ---------------- Step 1: business ---------------- */}
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-[30px] sm:text-[36px] font-semibold tracking-[-0.025em] leading-[1.1]">
                What&rsquo;s your business called?
              </h1>
              <p className="mt-2.5 text-[15px] text-muted leading-relaxed">
                This becomes the wordmark, so shorter names lock up better.
              </p>
            </div>

            <Field label="Business name" error={fields["brief.businessName"]} required htmlFor="name">
              <Input
                id="name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Sharma Kirana"
                autoFocus
                maxLength={60}
                className="h-12 text-[17px]"
                invalid={!!fields["brief.businessName"]}
              />
            </Field>

            <Field
              label="Descriptor"
              hint="The small line under your name. Leave blank and we'll suggest one."
              htmlFor="descriptor"
            >
              <Input
                id="descriptor"
                value={descriptor}
                onChange={(e) => setDescriptor(e.target.value)}
                placeholder="Provision & Daily Needs"
                maxLength={60}
              />
            </Field>

            <Field label="Category" error={fields["brief.industry"]} required>
              <div className="space-y-4 mt-1">
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
          </div>
        )}

        {/* ---------------- Step 2: audience ---------------- */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-[30px] sm:text-[36px] font-semibold tracking-[-0.025em] leading-[1.1]">
                Who buys from you?
              </h1>
              <p className="mt-2.5 text-[15px] text-muted leading-relaxed">
                Be specific. &ldquo;Working mothers in Indore&rdquo; produces a sharper brand than
                &ldquo;everyone&rdquo;.
              </p>
            </div>

            <Field label="Your customers" error={fields["brief.audience"]} required htmlFor="audience">
              <Textarea
                id="audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Families in the neighbourhood who shop weekly and care about fresh stock and fair prices."
                autoFocus
                maxLength={200}
                rows={3}
                invalid={!!fields["brief.audience"]}
              />
            </Field>

            {selectedIndustry && (
              <Card className="p-4 bg-paper-alt border-line">
                <p className="text-[12.5px] text-muted leading-relaxed">
                  <span className="font-medium text-ink">For a {selectedIndustry.name.toLowerCase()}:</span>{" "}
                  {selectedIndustry.voiceHint}.
                </p>
              </Card>
            )}

            <Field label="City" hint="Used for local taglines and copy. Optional." htmlFor="city">
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Indore"
                maxLength={60}
              />
            </Field>
          </div>
        )}

        {/* ---------------- Step 3: personality ---------------- */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-[30px] sm:text-[36px] font-semibold tracking-[-0.025em] leading-[1.1]">
                How should it feel?
              </h1>
              <p className="mt-2.5 text-[15px] text-muted leading-relaxed">
                Pick one to four. These drive the colour, the type and the mark — this is the
                highest-impact answer in the whole form.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-2.5">
              {data.traits.map((trait) => {
                const selected = personality.includes(trait.id);
                const full = personality.length >= 4 && !selected;
                return (
                  <button
                    key={trait.id}
                    type="button"
                    onClick={() => toggleTrait(trait.id)}
                    disabled={full}
                    aria-pressed={selected}
                    className={cx(
                      "text-left p-4 rounded-[12px] border transition-all duration-150",
                      "disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]",
                      selected
                        ? "bg-ink text-white border-ink"
                        : "bg-white border-line hover:border-ink/25",
                    )}
                  >
                    <p className={cx("text-[15px] font-semibold", selected ? "text-white" : "text-ink")}>
                      {trait.label}
                    </p>
                    <p className={cx("text-[12.5px] mt-0.5 leading-snug", selected ? "text-white/65" : "text-muted")}>
                      {trait.hint}
                    </p>
                  </button>
                );
              })}
            </div>

            {fields["brief.personality"] && (
              <p role="alert" className="text-[12.5px] text-danger">
                {fields["brief.personality"]}
              </p>
            )}
          </div>
        )}

        {/* ---------------- Step 4: colour ---------------- */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-[30px] sm:text-[36px] font-semibold tracking-[-0.025em] leading-[1.1]">
                Any colour direction?
              </h1>
              <p className="mt-2.5 text-[15px] text-muted leading-relaxed">
                Leave it on Auto and the engine picks what suits your category and personality.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-2.5">
              {data.moods.map((mood) => {
                const selected = colorMood === mood.mood;
                return (
                  <button
                    key={mood.mood}
                    type="button"
                    onClick={() => setColorMood(mood.mood)}
                    aria-pressed={selected}
                    className={cx(
                      "text-left p-4 rounded-[12px] border transition-all duration-150 active:scale-[0.99]",
                      selected ? "bg-ink text-white border-ink" : "bg-white border-line hover:border-ink/25",
                    )}
                  >
                    <p className={cx("text-[15px] font-semibold", selected ? "text-white" : "text-ink")}>
                      {mood.label}
                    </p>
                    <p className={cx("text-[12.5px] mt-0.5 leading-snug", selected ? "text-white/65" : "text-muted")}>
                      {mood.hint}
                    </p>
                  </button>
                );
              })}
            </div>

            <Field
              label="Anything else we should know?"
              hint="Optional. Products you sell, what you want to avoid, a competitor you admire."
              htmlFor="notes"
            >
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={600}
                rows={3}
                placeholder="We sell mostly to regular monthly customers. Avoid anything that looks like a supermarket chain."
              />
            </Field>
          </div>
        )}

        {/* ---------------- Step 5: language ---------------- */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-[30px] sm:text-[36px] font-semibold tracking-[-0.025em] leading-[1.1]">
                What language do you trade in?
              </h1>
              <p className="mt-2.5 text-[15px] text-muted leading-relaxed">
                Taglines, captions and your WhatsApp greeting are written natively in this language.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {data.languages.map((item) => {
                const selected = language === item.code;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setLanguage(item.code)}
                    aria-pressed={selected}
                    className={cx(
                      "text-left p-3.5 rounded-[12px] border transition-all duration-150 active:scale-[0.99]",
                      selected ? "bg-ink text-white border-ink" : "bg-white border-line hover:border-ink/25",
                    )}
                  >
                    <p className={cx("text-[17px] leading-tight", selected ? "text-white" : "text-ink")}>
                      {item.nativeName}
                    </p>
                    <p className={cx("text-[11.5px] mt-1", selected ? "text-white/60" : "text-muted")}>
                      {item.name}
                    </p>
                  </button>
                );
              })}
            </div>

            {needsLocalName && (
              <Field
                label={`Your name in ${selectedLanguage!.name}`}
                hint="Optional. Adds a bilingual lockup to your logo and signboard — the thing customers actually read on the street."
                htmlFor="localName"
              >
                <Input
                  id="localName"
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  placeholder={selectedLanguage!.sample}
                  maxLength={60}
                  className="h-12 text-[17px]"
                  lang={selectedLanguage!.code}
                />
              </Field>
            )}
          </div>
        )}
      </div>

      {/* ---------------- Navigation ---------------- */}
      <div className="mt-10 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || busy}
        >
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button size="lg" onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
            Continue
          </Button>
        ) : (
          <Button size="lg" variant="secondary" onClick={submit} loading={busy}>
            {busy ? "Building your brand…" : "Generate my brand"}
          </Button>
        )}
      </div>
    </div>
  );
}
