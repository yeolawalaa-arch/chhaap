import Link from "next/link";
import type { Metadata } from "next";
import { Badge, Button, Card } from "@/components/ui";
import { db } from "@/lib/db/client";
import { decodeJson } from "@/lib/db/json";
import { PLAN_SEED, type PlanLimits } from "@/lib/billing/plans";
import { integrationStatus } from "@/lib/config/env";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free to start. Pro for print-resolution exports, true vector files and the complete brand kit. Business for teams and multiple brands.",
};

export default async function PricingPage() {
  // Plans are admin-editable rows, but the page must still render if the
  // database is unreachable — a pricing page that 500s costs a signup.
  const [rows, session] = await Promise.all([
    db.plan
      .findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } })
      .catch(() => []),
    getSession().catch(() => null),
  ]);

  // Fall back to the code definitions if the database has not been seeded.
  const plans = rows.length
    ? rows.map((row) => ({
        key: row.key,
        name: row.name,
        description: row.description ?? "",
        priceInr: row.priceInr,
        priceInrYear: row.priceInrYear,
        features: decodeJson<string[]>(row.featuresJson, []),
        limits: decodeJson<PlanLimits>(row.limitsJson, PLAN_SEED[0]!.limits),
        isPopular: row.isPopular,
      }))
    : PLAN_SEED.map((p) => ({ ...p, features: p.features }));

  const payments = integrationStatus().payments;

  return (
    <div className="px-5 py-16 sm:py-24">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl">
          <h1 className="text-[38px] sm:text-[48px] font-semibold tracking-[-0.03em] leading-[1.06]">
            Start free. Pay when you print.
          </h1>
          <p className="mt-4 text-[17px] text-ink-soft leading-relaxed">
            Every plan generates a complete brand system. What you pay for is resolution, vector
            files and the rights to use them commercially.
          </p>
        </div>

        {!payments.live && (
          <div className="mt-8 p-4 rounded-[12px] bg-warn-bg border border-warn/20 max-w-2xl">
            <p className="text-[13px] text-warn leading-relaxed">
              <span className="font-semibold">No payment gateway is configured on this deployment.</span>{" "}
              Upgrades run in manual mode — an administrator can grant a plan, but no money moves.
              Set <code className="font-mono">PAYMENT_GATEWAY</code> to enable checkout.
            </p>
          </div>
        )}

        <div className="mt-12 grid lg:grid-cols-3 gap-5">
          {plans.map((plan) => (
            <Card
              key={plan.key}
              className={`p-6 flex flex-col ${plan.isPopular ? "ring-2 ring-ink border-ink" : ""}`}
            >
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-[18px] font-semibold text-ink">{plan.name}</h2>
                {plan.isPopular && <Badge tone="brand">Most popular</Badge>}
              </div>
              <p className="text-[13.5px] text-muted leading-relaxed min-h-[40px]">
                {plan.description}
              </p>

              <div className="mt-5 mb-6">
                <span className="text-[36px] font-semibold text-ink tracking-[-0.02em]">
                  {plan.priceInr === 0 ? "Free" : `₹${plan.priceInr.toLocaleString("en-IN")}`}
                </span>
                {plan.priceInr > 0 && <span className="text-[14px] text-muted"> / month</span>}
                {plan.priceInrYear > 0 && (
                  <p className="text-[12.5px] text-muted mt-1">
                    or ₹{plan.priceInrYear.toLocaleString("en-IN")} a year
                  </p>
                )}
              </div>

              <Link href={session ? "/dashboard" : "/signup"} className="block">
                <Button
                  full
                  size="lg"
                  variant={plan.isPopular ? "secondary" : "outline"}
                  disabled={plan.priceInr > 0 && !payments.live}
                  title={
                    plan.priceInr > 0 && !payments.live
                      ? "Checkout is unavailable until a payment gateway is configured."
                      : undefined
                  }
                >
                  {plan.priceInr === 0
                    ? "Start free"
                    : payments.live
                      ? `Choose ${plan.name}`
                      : "Checkout unavailable"}
                </Button>
              </Link>

              <ul className="mt-6 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-[13.5px] text-ink-soft leading-relaxed">
                    <span className="text-success shrink-0 mt-0.5" aria-hidden="true">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        {/* Comparison of what actually differs */}
        <div className="mt-16 max-w-3xl">
          <h2 className="text-[24px] font-semibold tracking-[-0.02em]">What actually differs</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-[13.5px] border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left py-3 font-medium text-muted">Capability</th>
                  {plans.map((p) => (
                    <th key={p.key} className="text-left py-3 font-medium text-ink px-3">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Brands", (l: PlanLimits) => String(l.maxBrands)],
                  ["AI generations / month", (l: PlanLimits) => (l.aiGenerationsPerMonth < 0 ? "Unlimited" : String(l.aiGenerationsPerMonth))],
                  ["Max export size", (l: PlanLimits) => `${l.maxExportPx.toLocaleString("en-IN")} px`],
                  ["SVG (true vector)", (l: PlanLimits) => (l.vectorExport ? "✓" : "—")],
                  ["Vector PDF", (l: PlanLimits) => (l.pdfExport ? "✓" : "—")],
                  ["Transparent PNG", (l: PlanLimits) => (l.transparentPng ? "✓" : "—")],
                  ["Brand guidelines PDF", (l: PlanLimits) => (l.brandKitPdf ? "✓" : "—")],
                  ["No watermark", (l: PlanLimits) => (l.removeWatermark ? "✓" : "—")],
                  ["Commercial licence", (l: PlanLimits) => (l.commercialLicense ? "✓" : "—")],
                  ["Team members", (l: PlanLimits) => String(l.maxTeamMembers)],
                ].map(([label, render]) => (
                  <tr key={label as string} className="border-b border-line-soft">
                    <td className="py-2.5 text-ink-soft">{label as string}</td>
                    {plans.map((p) => (
                      <td key={p.key} className="py-2.5 px-3 text-ink tabular-nums">
                        {(render as (l: PlanLimits) => string)(p.limits)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-16 max-w-2xl">
          <h2 className="text-[24px] font-semibold tracking-[-0.02em]">Questions</h2>
          <dl className="mt-6 space-y-6">
            {[
              [
                "Do I own what I generate?",
                "Yes. On a paid plan the commercial licence covers using your brand anywhere — signage, packaging, products, advertising. The typefaces are SIL Open Font Licence, so embedding and redistributing them is permitted too.",
              ],
              [
                "Is the SVG a real vector file?",
                "Yes. The whole engine is vector — every logo is authored as paths and text, not traced from an image. The SVG is the source file, and the PDF is genuine vector with the fonts embedded.",
              ],
              [
                "What happens to my brands if I downgrade?",
                "Nothing is deleted. You keep access to every brand you created; exports return to free-plan resolution and pick the watermark back up until you upgrade again.",
              ],
              [
                "Can I edit the logo after it is generated?",
                "Yes. Every element — colours, typefaces, the mark, spacing — is editable, and the brand system regenerates every asset to match.",
              ],
            ].map(([q, a]) => (
              <div key={q}>
                <dt className="text-[15px] font-semibold text-ink">{q}</dt>
                <dd className="mt-1.5 text-[14px] text-ink-soft leading-relaxed">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
