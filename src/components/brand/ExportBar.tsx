"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Card, Field, Select, useToast } from "@/components/ui";
import { runExport } from "@/lib/client/rasterize";
import type { PlanLimits } from "@/lib/billing/plans";

/**
 * Export controls.
 *
 * Formats the plan doesn't include are shown, disabled, with the reason — a
 * hidden feature teaches the user nothing and an unexplained failure is worse.
 * Any shaping warning returned by the server is surfaced as a persistent
 * notice rather than a toast that disappears before it can be acted on.
 */
export function ExportBar({
  brandId,
  limits,
  planName,
  variations,
}: {
  brandId: string;
  limits: PlanLimits;
  planName: string;
  variations: { value: string; label: string }[];
}) {
  const toast = useToast();
  const [variation, setVariation] = useState(variations[0]?.value ?? "primary");
  const [busy, setBusy] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function download(format: "svg" | "png" | "pdf", target: "logo" | "kit" = "logo") {
    setBusy(`${target}-${format}`);
    try {
      const outcome = await runExport({
        brandId,
        target,
        format,
        variation: target === "logo" ? variation : undefined,
        scale: format === "png" ? 3 : 1,
        transparent: format === "png" && limits.transparentPng,
      });
      toast.success(`Downloaded ${outcome.filename}`);
      if (outcome.warning?.message) setWarning(outcome.warning.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  const locked = (allowed: boolean, feature: string) =>
    allowed ? undefined : `${feature} is a Pro feature — you're on ${planName}.`;

  return (
    <Card className="p-5">
      <h3 className="text-[14px] font-semibold text-ink mb-3">Export</h3>

      <Field label="Variation" htmlFor="variation">
        <Select id="variation" value={variation} onChange={(e) => setVariation(e.target.value)}>
          {variations.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => download("png")}
          loading={busy === "logo-png"}
          title={limits.transparentPng ? "Transparent PNG" : `PNG up to ${limits.maxExportPx}px`}
        >
          PNG
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => download("svg")}
          loading={busy === "logo-svg"}
          disabled={!limits.vectorExport}
          title={locked(limits.vectorExport, "SVG export")}
        >
          SVG
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => download("pdf")}
          loading={busy === "logo-pdf"}
          disabled={!limits.pdfExport}
          title={locked(limits.pdfExport, "PDF export")}
        >
          PDF
        </Button>
      </div>

      <div className="mt-4 pt-4 border-t border-line-soft space-y-2">
        <Button
          size="sm"
          full
          onClick={() => download("pdf", "kit")}
          loading={busy === "kit-pdf"}
          disabled={!limits.brandKitPdf}
          title={locked(limits.brandKitPdf, "The brand guidelines PDF")}
        >
          Brand guidelines PDF
        </Button>
        <Button
          size="sm"
          variant="outline"
          full
          onClick={() => download("svg", "kit")}
          loading={busy === "kit-svg"}
          disabled={!limits.vectorExport}
          title={locked(limits.vectorExport, "The full brand kit")}
        >
          Full brand kit (.zip)
        </Button>
      </div>

      {!limits.removeWatermark && (
        <p className="mt-3 text-[11.5px] text-muted leading-relaxed">
          Free downloads carry a small &ldquo;Made with Chhaap&rdquo; mark.{" "}
          <Link href="/pricing" className="text-ink underline hover:text-brand-600">
            Remove it
          </Link>
        </p>
      )}

      {warning && (
        <div className="mt-3 p-3 rounded-[10px] bg-warn-bg border border-warn/20">
          <p className="text-[11.5px] text-warn leading-relaxed">
            <span className="font-semibold">Check before printing: </span>
            {warning}
          </p>
          <button
            onClick={() => setWarning(null)}
            className="mt-1.5 text-[11px] text-muted hover:text-ink transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </Card>
  );
}
