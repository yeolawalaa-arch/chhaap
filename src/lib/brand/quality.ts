import { contrastRatio, toGrayscale } from "@/lib/color";
import { getFont } from "@/lib/fonts/catalog";
import { estimateTextWidth } from "@/lib/render/svg";
import { isSerifDisplay } from "@/lib/render/mark";
import { scriptMetrics } from "@/lib/brand/languages";
import type {
  BrandIdentitySpec,
  CheckStatus,
  LogoDocument,
  QualityCheck,
  QualityReport,
} from "@/types/brand";

/**
 * Brand readiness scoring.
 *
 * Every check below measures something real about the artwork — contrast
 * ratios, stroke weight against reproduction size, greyscale separation,
 * estimated text width — rather than scoring the user's inputs. A score that
 * came from "did you fill in the form" would be theatre; this one can actually
 * fail a logo that would print badly, and each failure carries the specific fix.
 */

interface CheckResult {
  status: CheckStatus;
  score: number;
  detail: string;
  fix?: string;
}

const WEIGHTS = {
  contrastOnLight: 14,
  contrastOnDark: 10,
  monochrome: 16,
  smallSize: 16,
  printWeight: 12,
  typeConsistency: 10,
  spacing: 10,
  nameLength: 12,
} as const;

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkContrastOnLight(spec: BrandIdentitySpec): CheckResult {
  const ratio = contrastRatio(spec.palette.primary.hex, spec.palette.surface.hex);
  if (ratio >= 4.5) {
    return { status: "pass", score: 1, detail: `Primary on surface is ${ratio.toFixed(1)}:1 — clears WCAG AA for text.` };
  }
  if (ratio >= 3) {
    return {
      status: "warn",
      score: 0.6,
      detail: `Primary on surface is ${ratio.toFixed(1)}:1 — fine for large type and the mark, below AA for body copy.`,
      fix: "Darken the primary a step, or keep body text in Ink and use the primary only for headings and the mark.",
    };
  }
  return {
    status: "fail",
    score: 0.15,
    detail: `Primary on surface is only ${ratio.toFixed(1)}:1. The logo will wash out on white.`,
    fix: "Darken the primary until it reaches at least 3:1 against the surface colour.",
  };
}

function checkContrastOnDark(spec: BrandIdentitySpec): CheckResult {
  const ratio = contrastRatio(spec.palette.surface.hex, spec.palette.primaryDark.hex);
  if (ratio >= 4.5) {
    return { status: "pass", score: 1, detail: `Surface knocked out of the deep shade is ${ratio.toFixed(1)}:1 — reversed use is safe.` };
  }
  return {
    status: ratio >= 3 ? "warn" : "fail",
    score: ratio >= 3 ? 0.6 : 0.2,
    detail: `Reversed contrast is ${ratio.toFixed(1)}:1 — the white logo on your dark shade is weak.`,
    fix: "Deepen the dark shade so white type and the knocked-out mark stay crisp on it.",
  };
}

function checkMonochrome(spec: BrandIdentitySpec): CheckResult {
  // The real test of a logo: does it survive losing all colour information?
  const primaryGrey = toGrayscale(spec.palette.primary.hex);
  const accentGrey = toGrayscale(spec.palette.accent.hex);
  const surfaceGrey = toGrayscale(spec.palette.surface.hex);

  const markVsSurface = contrastRatio(primaryGrey, surfaceGrey);
  const primaryVsAccent = contrastRatio(primaryGrey, accentGrey);

  if (markVsSurface >= 4 && primaryVsAccent >= 1.6) {
    return {
      status: "pass",
      score: 1,
      detail: `In greyscale the mark holds ${markVsSurface.toFixed(1)}:1 against the background, and primary and accent stay ${primaryVsAccent.toFixed(1)}:1 apart.`,
    };
  }
  if (markVsSurface < 3) {
    return {
      status: "fail",
      score: 0.2,
      detail: `Converted to greyscale the mark drops to ${markVsSurface.toFixed(1)}:1 — it will disappear on a photocopy or a single-colour stamp.`,
      fix: "Increase the lightness gap between your primary and surface. Two colours of similar brightness become the same grey.",
    };
  }
  return {
    status: "warn",
    score: 0.55,
    detail: `Primary and accent converge in greyscale (${primaryVsAccent.toFixed(1)}:1) — duotone details will merge in single-colour print.`,
    fix: "Make the accent noticeably lighter or darker than the primary, not just a different hue.",
  };
}

function checkSmallSize(spec: BrandIdentitySpec): CheckResult {
  const mark = spec.mark;

  if (mark.style === "wordmark-only") {
    const len = spec.name.length;
    return len <= 12
      ? { status: "pass", score: 1, detail: "A short wordmark stays readable as a profile picture." }
      : {
          status: "warn",
          score: 0.5,
          detail: `A ${len}-character wordmark is unreadable at favicon size, and you have no icon-only fallback.`,
          fix: "Add a monogram or symbol variation for small placements — profile pictures, app icons, WhatsApp.",
        };
  }

  // A 100-unit mark reproduced at 32px: strokes below ~5 units close up or
  // vanish once the renderer rounds them to whole pixels.
  const strokeAt32 = (mark.strokeWeight / 100) * 32;
  const enclosed = mark.enclosure !== "none";
  const effectiveInset = enclosed ? mark.inset : 1;
  const detailAt32 = strokeAt32 * effectiveInset;

  if (detailAt32 >= 1.4) {
    return {
      status: "pass",
      score: 1,
      detail: `At 32 px the mark's thinnest stroke is about ${detailAt32.toFixed(1)} px — it survives favicon and app-icon sizes.`,
    };
  }
  if (detailAt32 >= 1) {
    return {
      status: "warn",
      score: 0.6,
      detail: `At 32 px strokes land near ${detailAt32.toFixed(1)} px. Fine detail will start to close up.`,
      fix: "Increase the mark's stroke weight, or use the solid fill style for small placements.",
    };
  }
  return {
    status: "fail",
    score: 0.25,
    detail: `Strokes reduce to roughly ${detailAt32.toFixed(1)} px at favicon size — detail will be lost entirely.`,
    fix: "Thicken the mark's strokes, or scale the symbol up inside its enclosure.",
  };
}

function checkPrintWeight(spec: BrandIdentitySpec): CheckResult {
  const display = getFont(spec.typography.display.family);
  const weight = spec.typography.display.weight;
  const serif = isSerifDisplay(spec);

  // High-contrast serifs at light weights have hairlines that break up in vinyl
  // cutting, embroidery and newsprint — the three places small Indian
  // businesses most often reproduce a logo.
  const risky = serif && weight <= 400 && display?.feel === "serif-modern";
  const veryRisky = display?.family === "Cormorant Garamond" && weight <= 400;

  if (veryRisky) {
    return {
      status: "warn",
      score: 0.5,
      detail: `${display?.family} at ${weight} has hairline strokes that break up in vinyl cutting, embroidery and newsprint.`,
      fix: "Move the display weight up to 500 or 600 for anything that will be cut, stitched or printed small.",
    };
  }
  if (risky) {
    return {
      status: "warn",
      score: 0.7,
      detail: `A high-contrast serif at weight ${weight} is delicate for signage and embroidery.`,
      fix: "Keep this face for print and screen; use the one-colour variation with a heavier weight on signboards.",
    };
  }
  return {
    status: "pass",
    score: 1,
    detail: `${display?.family ?? "The display face"} at weight ${weight} reproduces cleanly in vinyl, embroidery and single-colour print.`,
  };
}

function checkTypeConsistency(spec: BrandIdentitySpec): CheckResult {
  const families = new Set([
    spec.typography.display.family,
    spec.typography.body.family,
    ...(spec.typography.local ? [spec.typography.local.family] : []),
  ]);

  const latinFamilies = new Set([spec.typography.display.family, spec.typography.body.family]);

  if (latinFamilies.size > 2) {
    return {
      status: "fail",
      score: 0.3,
      detail: `${latinFamilies.size} Latin typefaces in one system is one too many.`,
      fix: "Reduce to two: one for display, one for body. Use weight to create hierarchy instead of a third face.",
    };
  }

  const tracking = spec.typography.display.letterSpacing;
  const metrics = scriptMetrics(spec.language);
  if (metrics.hasConjuncts && spec.typography.local && spec.typography.local.letterSpacing > metrics.maxTracking) {
    return {
      status: "fail",
      score: 0.3,
      detail: `The local-script name is tracked wider than ${spec.script} can take — conjuncts and matras will separate from their base characters.`,
      fix: "Set local-script tracking to zero. Indic scripts must not be letter-spaced.",
    };
  }

  if (spec.typography.display.transform === "uppercase" && tracking < 0.02) {
    return {
      status: "warn",
      score: 0.65,
      detail: `Caps set at ${(tracking * 1000).toFixed(0)}/1000 em are too tight — capitals need extra air to stay open.`,
      fix: "Increase display tracking to at least 40/1000 em for all-caps settings.",
    };
  }

  return {
    status: "pass",
    score: 1,
    detail:
      families.size === 1
        ? "A single-family system — disciplined, and consistent by construction."
        : `${families.size} faces with clearly separated roles, and tracking within safe limits for ${spec.script}.`,
  };
}

function checkSpacing(spec: BrandIdentitySpec, doc: LogoDocument | null): CheckResult {
  if (!doc) {
    return { status: "pass", score: 0.85, detail: "Generated lockups use the system's clear-space rule." };
  }

  const visible = doc.layers.filter((l) => l.visible);
  if (visible.length === 0) {
    return {
      status: "fail",
      score: 0,
      detail: "Every layer is hidden — the logo is empty.",
      fix: "Turn at least one layer back on in the Studio.",
    };
  }

  // Anything outside the canvas will be cropped by the viewBox on export.
  const outside = visible.filter(
    (l) => l.x < 0 || l.y < 0 || l.x > doc.width || l.y > doc.height,
  );
  if (outside.length) {
    return {
      status: "fail",
      score: 0.2,
      detail: `${outside.length} layer${outside.length === 1 ? " sits" : "s sit"} outside the canvas and will be cropped on export.`,
      fix: "Move the layers back inside the frame, or use Fit to canvas in the Studio.",
    };
  }

  // Optical centring: the visible mass should sit near the canvas centre.
  const xs = visible.map((l) => l.x);
  const centre = (Math.min(...xs) + Math.max(...xs)) / 2;
  const drift = Math.abs(centre - doc.width / 2) / doc.width;

  if (drift > 0.16) {
    return {
      status: "warn",
      score: 0.55,
      detail: `The lockup sits ${(drift * 100).toFixed(0)}% off-centre horizontally.`,
      fix: "Select all layers and use Align → Centre, unless the imbalance is deliberate.",
    };
  }

  return {
    status: "pass",
    score: 1,
    detail: `Balanced lockup with ${spec.layout.clearSpace}× cap-height clear space defined around it.`,
  };
}

function checkNameLength(spec: BrandIdentitySpec): CheckResult {
  const serif = isSerifDisplay(spec);
  const width = estimateTextWidth(spec.name, 100, {
    weight: spec.typography.display.weight,
    letterSpacing: spec.typography.display.letterSpacing,
    serif,
  });

  // Width expressed in multiples of cap height. Past about 9× a wordmark stops
  // fitting the places a logo has to fit — a card, a board, an app icon.
  const ratio = width / 100;

  if (ratio <= 7) {
    return { status: "pass", score: 1, detail: `"${spec.name}" is compact enough to lock up cleanly at any size.` };
  }
  if (ratio <= 10) {
    return {
      status: "warn",
      score: 0.65,
      detail: `"${spec.name}" is a wide wordmark (${ratio.toFixed(1)}× cap height), so it will set small in square placements.`,
      fix: "Use the stacked or icon-only variation for square spaces like profile pictures and app icons.",
    };
  }
  return {
    status: "fail",
    score: 0.3,
    detail: `"${spec.name}" is very wide (${ratio.toFixed(1)}× cap height) and will be illegible in square or small placements.`,
    fix: "Consider a shorter trading name, or lead with the monogram and set the full name smaller beneath it.",
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export function scoreIdentity(
  spec: BrandIdentitySpec,
  doc: LogoDocument | null = null,
): QualityReport {
  const entries: [string, string, keyof typeof WEIGHTS, CheckResult][] = [
    ["contrast-light", "Readable on light backgrounds", "contrastOnLight", checkContrastOnLight(spec)],
    ["contrast-dark", "Readable reversed on dark", "contrastOnDark", checkContrastOnDark(spec)],
    ["monochrome", "Works in black and white", "monochrome", checkMonochrome(spec)],
    ["small-size", "Holds up at small sizes", "smallSize", checkSmallSize(spec)],
    ["print", "Suitable for printing and signage", "printWeight", checkPrintWeight(spec)],
    ["type", "Typography is consistent", "typeConsistency", checkTypeConsistency(spec)],
    ["spacing", "Spacing is balanced", "spacing", checkSpacing(spec, doc)],
    ["name-length", "Name locks up well", "nameLength", checkNameLength(spec)],
  ];

  const checks: QualityCheck[] = entries.map(([id, label, weightKey, result]) => ({
    id,
    label,
    status: result.status,
    score: Math.round(result.score * 100),
    weight: WEIGHTS[weightKey],
    detail: result.detail,
    fix: result.fix,
  }));

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earned = checks.reduce((sum, c) => sum + (c.score / 100) * c.weight, 0);
  const score = Math.round((earned / totalWeight) * 100);

  return {
    score,
    grade: score >= 88 ? "excellent" : score >= 72 ? "good" : score >= 55 ? "needs-work" : "poor",
    checks,
    generatedAt: new Date().toISOString(),
  };
}

export const GRADE_LABELS: Record<QualityReport["grade"], string> = {
  excellent: "Ready to launch",
  good: "Solid — a couple of things to tighten",
  "needs-work": "Usable, but fix these before printing",
  poor: "Not ready — address the failures below",
};

/** Gate for high-resolution and vector export. */
export const EXPORT_THRESHOLD = 55;

export function canExport(report: QualityReport): boolean {
  return report.score >= EXPORT_THRESHOLD && !report.checks.some((c) => c.status === "fail" && c.weight >= 14);
}

/** The highest-leverage fixes, for the "how to improve" panel. */
export function topFixes(report: QualityReport, limit = 3): QualityCheck[] {
  return report.checks
    .filter((c) => c.fix && c.status !== "pass")
    .sort((a, b) => (b.weight * (100 - b.score)) - (a.weight * (100 - a.score)))
    .slice(0, limit);
}
