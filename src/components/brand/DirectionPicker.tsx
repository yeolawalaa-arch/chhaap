"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Card, SvgFrame, cx, useToast } from "@/components/ui";
import { ApiError, api } from "@/lib/client/api";
import type { BrandIdentitySpec, BrandStrategy } from "@/types/brand";

export interface DirectionCard {
  id: string;
  label: string;
  summary: string;
  score: number;
  isSelected: boolean;
  spec: BrandIdentitySpec;
  strategy: BrandStrategy;
  preview: string;
  previewHorizontal: string;
}

/**
 * Step 4 of the flow: pick a direction.
 *
 * Each card shows the real primary logo plus the three things that actually
 * differ between directions — palette, type pairing and the mark's rationale.
 * Choosing is a commitment (it rebuilds the logo set), so the confirm state is
 * explicit rather than a single click that silently discards the others.
 */
export function DirectionPicker({
  brandId,
  brandName,
  directions,
}: {
  brandId: string;
  brandName: string;
  directions: DirectionCard[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(
    directions.find((d) => d.isSelected)?.id ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const chosen = directions.find((d) => d.id === selected);

  async function confirm() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await api.post<{ redirect: string }>(`/api/brands/${brandId}/select`, {
        directionId: selected,
      });
      toast.success("Your brand is locked in.", "All eight logo variations are ready.");
      router.push(res.redirect);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save that direction.");
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    setRegenerating(true);
    try {
      await api.post(`/api/brands/${brandId}/directions`, { count: 4 });
      toast.success("Fresh directions generated.");
      setSelected(null);
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not generate more.";
      toast.error(message, err instanceof ApiError && err.needsUpgrade ? "See Pricing for more generations." : undefined);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-10">
      <div className="max-w-2xl">
        <h1 className="text-[30px] sm:text-[38px] font-semibold tracking-[-0.025em] leading-[1.1]">
          Four directions for {brandName}
        </h1>
        <p className="mt-3 text-[15px] text-muted leading-relaxed">
          Each is a complete system, not a colour swap — different mark, different type
          classification, different colour logic. Pick the one that feels like your business.
        </p>
      </div>

      <div className="mt-9 grid sm:grid-cols-2 gap-5">
        {directions.map((direction) => {
          const isChosen = selected === direction.id;
          const palette = direction.spec.palette;

          return (
            <Card
              key={direction.id}
              as="article"
              className={cx(
                "overflow-hidden transition-all duration-200 cursor-pointer",
                isChosen
                  ? "ring-2 ring-ink border-ink shadow-lift"
                  : "hover:shadow-lift hover:border-ink/15",
              )}
            >
              <button
                type="button"
                onClick={() => setSelected(direction.id)}
                aria-pressed={isChosen}
                className="w-full text-left"
              >
                <div className="h-56 bg-paper border-b border-line-soft flex items-center justify-center p-8">
                  <SvgFrame
                    svg={direction.preview}
                    className="h-full w-full"
                    label={`${direction.label} logo for ${brandName}`}
                  />
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[16px] font-semibold text-ink">{direction.label}</h2>
                      <p className="mt-1 text-[13px] text-muted leading-relaxed">
                        {direction.summary}
                      </p>
                    </div>
                    {isChosen && <Badge tone="brand">Selected</Badge>}
                  </div>

                  <div className="mt-4 pt-4 border-t border-line-soft space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex gap-1.5">
                        {[palette.primary, palette.accent, palette.ink, palette.surfaceAlt].map((c) => (
                          <span
                            key={c.role}
                            className="w-6 h-6 rounded-[6px] border border-ink/8"
                            style={{ background: c.hex }}
                            title={`${c.name} ${c.hex.toUpperCase()}`}
                          />
                        ))}
                      </div>
                      <p className="text-[12px] text-muted text-right">
                        {direction.spec.typography.display.family}
                        {direction.spec.typography.body.family !==
                          direction.spec.typography.display.family &&
                          ` / ${direction.spec.typography.body.family}`}
                      </p>
                    </div>

                    {direction.strategy.taglines?.[0] && (
                      <p className="text-[13px] text-ink-soft italic">
                        &ldquo;{direction.strategy.taglines[0]}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              </button>
            </Card>
          );
        })}
      </div>

      {/* Rationale for the current selection, so the choice is informed. */}
      {chosen && (
        <Card className="mt-6 p-5 sm:p-6 animate-in-up">
          <h3 className="text-[14px] font-semibold text-ink">Why this works</h3>
          <div className="mt-3 grid sm:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <p className="text-[11.5px] uppercase tracking-[0.11em] text-faint font-semibold mb-1.5">
                The mark
              </p>
              <p className="text-[13.5px] text-ink-soft leading-relaxed">
                {chosen.strategy.logoDirection}
              </p>
            </div>
            <div>
              <p className="text-[11.5px] uppercase tracking-[0.11em] text-faint font-semibold mb-1.5">
                The colour
              </p>
              <p className="text-[13.5px] text-ink-soft leading-relaxed">
                {chosen.strategy.colorPsychology}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-4">
        <Button variant="outline" onClick={regenerate} loading={regenerating} className="w-full sm:w-auto">
          Show me different ones
        </Button>
        <Button
          size="lg"
          variant="secondary"
          onClick={confirm}
          loading={busy}
          disabled={!selected}
          className="w-full sm:w-auto shadow-lift"
        >
          {selected ? "Use this direction" : "Pick a direction"}
        </Button>
      </div>
    </div>
  );
}
