"use client";

import { useState } from "react";
import { Card, cx } from "@/components/ui";
import type { QualityReport } from "@/types/brand";

const GRADE_LABELS: Record<QualityReport["grade"], string> = {
  excellent: "Ready to launch",
  good: "Solid — a couple of things to tighten",
  "needs-work": "Usable, but fix these before printing",
  poor: "Not ready — address the failures below",
};

/**
 * Brand readiness.
 *
 * Failures come first and are expanded by default: the point of the score is
 * the fixes, not the number. A collapsed list of passing checks keeps the panel
 * short without hiding the fact that they were run.
 */
export function QualityPanel({ report }: { report: QualityReport }) {
  const [showPassing, setShowPassing] = useState(false);

  const issues = report.checks
    .filter((c) => c.status !== "pass")
    .sort((a, b) => b.weight * (100 - b.score) - a.weight * (100 - a.score));
  const passing = report.checks.filter((c) => c.status === "pass");

  const tone =
    report.score >= 88
      ? { ring: "text-success", bg: "bg-success" }
      : report.score >= 72
        ? { ring: "text-ink", bg: "bg-ink" }
        : { ring: "text-warn", bg: "bg-warn" };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Brand Readiness</h3>
          <p className="text-[12px] text-muted mt-0.5">{GRADE_LABELS[report.grade]}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={cx("text-[30px] font-semibold tabular-nums leading-none", tone.ring)}>
            {report.score}
          </p>
          <p className="text-[11px] text-faint mt-0.5">out of 100</p>
        </div>
      </div>

      <div className="mt-4 h-1.5 bg-line-soft rounded-full overflow-hidden">
        <div
          className={cx("h-full rounded-full transition-[width] duration-700 ease-out", tone.bg)}
          style={{ width: `${report.score}%` }}
        />
      </div>

      {issues.length > 0 && (
        <ul className="mt-5 space-y-3.5">
          {issues.map((check) => (
            <li key={check.id}>
              <div className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className={cx(
                    "text-[13px] font-bold leading-5 shrink-0",
                    check.status === "fail" ? "text-danger" : "text-warn",
                  )}
                >
                  {check.status === "fail" ? "✕" : "!"}
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-ink leading-snug">{check.label}</p>
                  <p className="text-[12px] text-muted mt-1 leading-relaxed">{check.detail}</p>
                  {check.fix && (
                    <p className="text-[12px] text-ink-soft mt-1.5 leading-relaxed border-l-2 border-brand-200 pl-2.5">
                      {check.fix}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {passing.length > 0 && (
        <div className="mt-4 pt-4 border-t border-line-soft">
          <button
            onClick={() => setShowPassing((v) => !v)}
            aria-expanded={showPassing}
            className="text-[12.5px] text-muted hover:text-ink transition-colors flex items-center gap-1.5"
          >
            <span className="text-success font-bold" aria-hidden="true">
              ✓
            </span>
            {passing.length} check{passing.length === 1 ? "" : "s"} passing
            <span aria-hidden="true" className="text-faint">
              {showPassing ? "−" : "+"}
            </span>
          </button>

          {showPassing && (
            <ul className="mt-3 space-y-2.5 animate-fade">
              {passing.map((check) => (
                <li key={check.id}>
                  <p className="text-[12.5px] text-ink-soft">{check.label}</p>
                  <p className="text-[11.5px] text-muted mt-0.5 leading-relaxed">{check.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
