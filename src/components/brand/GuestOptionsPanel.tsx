"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, Skeleton, SvgFrame, Tabs, cx, useToast } from "@/components/ui";
import { ApiError, api } from "@/lib/client/api";
import type { BrandBrief, BrandIdentitySpec, BrandPalette, BrandTypography, MarkSpec } from "@/types/brand";

/**
 * The signed-in brand page's "More options" panel, ported to guest mode.
 *
 * Same idea — swap the symbol, colour system or type pairing without losing
 * the rest of the brand — but nothing is loaded from a row. The current spec
 * travels to /api/try/alternatives in the request body, and applying a choice
 * posts the patch to /api/try/apply and hands the fully re-rendered result
 * back up so the try flow can replace its in-memory `chosen` state.
 */

interface Option {
  id: string;
  label: string;
  score: number;
  preview: string;
  swatches?: string[];
  mark?: MarkSpec;
  palette?: BrandPalette;
  typography?: BrandTypography;
}

interface Alternatives {
  marks: Option[];
  palettes: Option[];
  types: Option[];
}

type Tab = "marks" | "palettes" | "types";

type Patch = Partial<Pick<BrandIdentitySpec, "mark" | "palette" | "typography">>;

export function GuestOptionsPanel({
  spec,
  brief,
  currentScore,
  onApply,
}: {
  spec: BrandIdentitySpec;
  brief: BrandBrief;
  currentScore: number;
  onApply: (patch: Patch) => Promise<void>;
}) {
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("marks");
  const [data, setData] = useState<Alternatives | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    if (!open || data || loading) return;
    setLoading(true);
    api
      .post<Alternatives>("/api/try/alternatives", { spec, brief })
      .then(setData)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Could not load options."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data, loading]);

  async function apply(option: Option) {
    const patch: Patch =
      tab === "marks"
        ? { mark: option.mark }
        : tab === "palettes"
          ? { palette: option.palette }
          : { typography: option.typography };

    setApplying(option.id);
    try {
      await onApply(patch);
      toast.success("Applied.", `Every asset updated · readiness ${option.score}/100`);
      // The old options were scored against the spec that's now gone.
      setData(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not apply that option.");
    } finally {
      setApplying(null);
    }
  }

  const total = data ? data.marks.length + data.palettes.length + data.types.length : null;

  if (!open) {
    return (
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-ink">More options</h3>
          <Badge tone="brand">{total ?? "100+"}</Badge>
        </div>
        <p className="mt-1.5 text-[12.5px] text-muted leading-relaxed">
          Every symbol in your category, in every frame and weight — plus every colour system and
          typeface pairing. Swap any one without regenerating the rest.
        </p>
        <Button size="sm" full variant="outline" className="mt-3" onClick={() => setOpen(true)}>
          Browse {total ?? "100+"} options
        </Button>
      </Card>
    );
  }

  const options = data ? data[tab] : [];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-semibold text-ink">More options</h3>
          {total !== null && <Badge tone="brand">{total}</Badge>}
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-[12px] text-muted hover:text-ink transition-colors"
        >
          Hide
        </button>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "marks", label: "Symbol", count: data?.marks.length },
          { value: "palettes", label: "Colour", count: data?.palettes.length },
          { value: "types", label: "Type", count: data?.types.length },
        ]}
        className="mb-4"
      />

      {loading || !data ? (
        <div className="grid grid-cols-2 gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto -mx-1 px-1">
          {options.map((option) => {
            const isCurrent = option.label === "Current";
            const busy = applying === option.id;
            const worse = option.score < currentScore - 4;

            return (
              <li key={option.id}>
                <button
                  onClick={() => !isCurrent && apply(option)}
                  disabled={isCurrent || applying !== null}
                  className={cx(
                    "w-full text-left rounded-[10px] border p-2 transition-all",
                    "disabled:cursor-default",
                    isCurrent
                      ? "border-ink ring-1 ring-ink bg-paper-alt"
                      : "border-line hover:border-ink/30 hover:shadow-card active:scale-[0.98]",
                    busy && "opacity-60",
                  )}
                >
                  <div className="h-16 flex items-center justify-center bg-white rounded-[6px] overflow-hidden">
                    <SvgFrame svg={option.preview} className="h-full w-full" label={option.label} />
                  </div>

                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    <span className="text-[11px] text-ink truncate">{option.label}</span>
                    {isCurrent ? (
                      <Badge tone="neutral">now</Badge>
                    ) : (
                      <span
                        className={cx(
                          "text-[10.5px] tabular-nums shrink-0",
                          worse ? "text-warn" : "text-faint",
                        )}
                        title={
                          worse
                            ? `Readiness would drop to ${option.score}/100`
                            : `Readiness ${option.score}/100`
                        }
                      >
                        {option.score}
                      </span>
                    )}
                  </div>

                  {option.swatches && (
                    <div className="mt-1 flex gap-1">
                      {option.swatches.map((hex) => (
                        <span
                          key={hex}
                          className="w-3.5 h-3.5 rounded-[3px] border border-ink/10"
                          style={{ background: hex }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-[11.5px] text-muted leading-relaxed">
        The number is what your Brand Readiness would become. Applying an option re-renders every
        logo variation and asset.
      </p>
    </Card>
  );
}
