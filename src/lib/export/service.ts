import JSZip from "jszip";
import { buildLogoDocument, renderLogo, VARIATION_LABELS } from "@/lib/render/logo";
import { renderAssetByKind } from "@/lib/render/assets/templates";
import { assetDefinition, withDefaults } from "@/lib/render/assets/definitions";
import { GUIDELINES_PAGE_SIZE, guidelinePages } from "@/lib/export/guidelines";
import { svgToPdf, svgsToPdf } from "@/lib/export/pdf";
import { familiesUsed } from "@/lib/brand/typography";
import { colorResolver } from "@/lib/render/svg";
import { exportPixels } from "@/lib/render/dimensions";
import { badRequest } from "@/lib/http/errors";
import { checkShaping, shapingReadmeNote } from "@/lib/export/shaping";
import { checkExport, type ExportFormat, type PlanLimits } from "@/lib/billing/plans";
import type {
  AssetData,
  AssetKind,
  BrandIdentitySpec,
  BrandStrategy,
  LogoDocument,
  LogoVariation,
  QualityReport,
} from "@/types/brand";
import { LOGO_VARIATIONS } from "@/types/brand";

/**
 * Export orchestration.
 *
 * Formats are handled honestly:
 *  - **SVG** is the native output — the whole engine is vector, so this is the
 *    real source file, not a trace.
 *  - **PDF** is true vector with embedded fonts, via pdfkit.
 *  - **PNG/JPG** are rasterised *in the browser* from the same SVG. That keeps
 *    the server free of a native image dependency and uses the browser's own
 *    text shaping, which matters for Indic scripts. The server returns the SVG
 *    plus the exact pixel dimensions to draw at; `rasterize.ts` does the rest.
 */

export interface ExportContext {
  spec: BrandIdentitySpec;
  strategy: BrandStrategy | null;
  quality: QualityReport | null;
  limits: PlanLimits;
  brandName: string;
}

export interface ExportResult {
  filename: string;
  contentType: string;
  /**
   * Set when the export may render complex-script text incorrectly. Callers
   * must show this to the user rather than swallowing it.
   */
  warning?: { message: string; recommendation: string };
  /** Present for server-produced binaries (PDF, ZIP). */
  body?: Buffer;
  /** Present when the client must rasterise (PNG/JPG). */
  raster?: { svg: string; width: number; height: number; background: string | null };
}

const safeName = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand";

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------

export async function exportLogo(
  ctx: ExportContext,
  variation: LogoVariation,
  format: ExportFormat,
  opts: { scale?: number; transparent?: boolean; doc?: LogoDocument } = {},
): Promise<ExportResult> {
  const doc = opts.doc ?? buildLogoDocument(ctx.spec, variation);
  const base = `${safeName(ctx.brandName)}-logo-${variation}`;

  const targetPx = Math.round(doc.width * (opts.scale ?? 2));
  const permission = checkExport(ctx.limits, format, targetPx);
  if (!permission.allowed) throw badRequest(permission.reason ?? "That format is not available on your plan.");

  const transparent = opts.transparent && ctx.limits.transparentPng;
  const resolve = colorResolver(ctx.spec, doc.colorMode);
  const background = transparent
    ? undefined
    : doc.background === "transparent"
      ? resolve("surface")
      : resolve(doc.background);

  const svg = renderLogo({ doc, spec: ctx.spec, background });

  if (format === "svg") {
    return { filename: `${base}.svg`, contentType: "image/svg+xml", body: Buffer.from(svg, "utf8") };
  }

  if (format === "pdf") {
    const body = await svgToPdf({
      svg,
      families: familiesUsed(ctx.spec.typography),
      title: `${ctx.brandName} logo — ${VARIATION_LABELS[variation]}`,
      author: ctx.brandName,
    });
    const shaping = checkShaping(ctx.spec);
    return {
      filename: `${base}.pdf`,
      contentType: "application/pdf",
      body,
      warning: shaping ? { message: shaping.message, recommendation: shaping.recommendation } : undefined,
    };
  }

  const width = Math.min(permission.maxPx, targetPx);
  const height = Math.round((width / doc.width) * doc.height);

  return {
    filename: `${base}.${format}`,
    contentType: format === "png" ? "image/png" : "image/jpeg",
    raster: {
      svg,
      width,
      height,
      // JPEG has no alpha; falling through to transparent would render black.
      background: format === "jpg" ? (background ?? "#ffffff") : transparent ? null : (background ?? null),
    },
  };
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export async function exportAsset(
  ctx: ExportContext,
  kind: AssetKind,
  format: ExportFormat,
  data: AssetData,
  opts: { scale?: number } = {},
): Promise<ExportResult> {
  const def = assetDefinition(kind);
  const dim = def.dimension;
  const base = `${safeName(ctx.brandName)}-${kind.replace(/_/g, "-")}`;

  const full = exportPixels(dim);
  const permission = checkExport(ctx.limits, format, full.width);
  if (!permission.allowed) throw badRequest(permission.reason ?? "That format is not available on your plan.");

  const resolve = colorResolver(ctx.spec, "brand");
  const svg = renderAssetByKind(kind, {
    spec: ctx.spec,
    resolve,
    dim,
    data: { ...withDefaults(kind, {}), ...data } as AssetData,
    watermark: permission.watermark,
  });

  if (format === "svg") {
    return { filename: `${base}.svg`, contentType: "image/svg+xml", body: Buffer.from(svg, "utf8") };
  }

  if (format === "pdf") {
    const body = await svgToPdf({
      svg,
      dimension: dim,
      families: familiesUsed(ctx.spec.typography),
      title: `${ctx.brandName} — ${def.name}`,
      author: ctx.brandName,
    });
    const shaping = checkShaping(ctx.spec, Object.values(data).filter((v): v is string => typeof v === "string"));
    return {
      filename: `${base}.pdf`,
      contentType: "application/pdf",
      body,
      warning: shaping ? { message: shaping.message, recommendation: shaping.recommendation } : undefined,
    };
  }

  const width = Math.min(permission.maxPx, Math.round(full.width * (opts.scale ?? 1)));
  const height = Math.round((width / dim.width) * dim.height);

  return {
    filename: `${base}.${format}`,
    contentType: format === "png" ? "image/png" : "image/jpeg",
    raster: { svg, width, height, background: format === "jpg" ? resolve("surface") : null },
  };
}

// ---------------------------------------------------------------------------
// Brand guidelines PDF
// ---------------------------------------------------------------------------

export async function exportGuidelines(ctx: ExportContext): Promise<ExportResult> {
  if (!ctx.limits.brandKitPdf) {
    throw badRequest("The brand guidelines PDF is a Pro feature.");
  }
  if (!ctx.strategy) throw badRequest("This brand has no strategy yet.");

  const pages = guidelinePages({ spec: ctx.spec, strategy: ctx.strategy, quality: ctx.quality });
  const body = await svgsToPdf(
    pages.map((svg) => ({ svg, dimension: GUIDELINES_PAGE_SIZE })),
    {
      title: `${ctx.brandName} — Brand Guidelines`,
      author: ctx.brandName,
      families: familiesUsed(ctx.spec.typography),
    },
  );

  const shaping = checkShaping(ctx.spec);
  return {
    filename: `${safeName(ctx.brandName)}-brand-guidelines.pdf`,
    contentType: "application/pdf",
    body,
    warning: shaping ? { message: shaping.message, recommendation: shaping.recommendation } : undefined,
  };
}

// ---------------------------------------------------------------------------
// Full brand kit (ZIP)
// ---------------------------------------------------------------------------

export interface KitOptions {
  /** Assets to include, with their saved field data. */
  assets?: { kind: AssetKind; data: AssetData }[];
  includeGuidelines?: boolean;
}

export async function exportBrandKit(
  ctx: ExportContext,
  options: KitOptions = {},
): Promise<ExportResult> {
  const zip = new JSZip();
  const name = safeName(ctx.brandName);
  const families = familiesUsed(ctx.spec.typography);
  const vector = ctx.limits.vectorExport;

  // --- logos -------------------------------------------------------------
  const logos = zip.folder("01-logo")!;
  for (const variation of LOGO_VARIATIONS) {
    const doc = buildLogoDocument(ctx.spec, variation);
    const svg = renderLogo({ doc, spec: ctx.spec });
    if (vector) logos.file(`${name}-${variation}.svg`, svg);
    if (ctx.limits.pdfExport) {
      logos.file(
        `${name}-${variation}.pdf`,
        await svgToPdf({ svg, families, title: `${ctx.brandName} ${variation}` }),
      );
    }
  }

  // --- guidelines --------------------------------------------------------
  if (options.includeGuidelines !== false && ctx.limits.brandKitPdf && ctx.strategy) {
    const guidelines = await exportGuidelines(ctx);
    zip.file(`02-guidelines/${guidelines.filename}`, guidelines.body!);
  }

  // --- assets ------------------------------------------------------------
  if (options.assets?.length) {
    const folder = zip.folder("03-assets")!;
    const resolve = colorResolver(ctx.spec, "brand");
    for (const entry of options.assets) {
      const def = assetDefinition(entry.kind);
      const svg = renderAssetByKind(entry.kind, {
        spec: ctx.spec,
        resolve,
        dim: def.dimension,
        data: { ...withDefaults(entry.kind, {}), ...entry.data } as AssetData,
        watermark: !ctx.limits.removeWatermark,
      });
      const file = `${name}-${entry.kind.replace(/_/g, "-")}`;
      if (vector) folder.file(`${file}.svg`, svg);
      if (ctx.limits.pdfExport) {
        folder.file(
          `${file}.pdf`,
          await svgToPdf({ svg, dimension: def.dimension, families, title: def.name }),
        );
      }
    }
  }

  // --- machine-readable tokens ------------------------------------------
  // Included so a developer can wire the brand into a real product without
  // eyedropping the PDF.
  zip.file("04-tokens/brand-tokens.json", JSON.stringify(buildTokens(ctx.spec), null, 2));
  zip.file("04-tokens/brand-tokens.css", buildCssTokens(ctx.spec));
  zip.file("README.txt", buildReadme(ctx));

  const body = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  const shaping = checkShaping(ctx.spec);
  return {
    filename: `${name}-brand-kit.zip`,
    contentType: "application/zip",
    body,
    warning: shaping ? { message: shaping.message, recommendation: shaping.recommendation } : undefined,
  };
}

function buildTokens(spec: BrandIdentitySpec) {
  return {
    name: spec.name,
    color: Object.fromEntries(
      Object.entries(spec.palette).map(([role, c]) => [
        role,
        { hex: c.hex, rgb: c.rgb, cmyk: c.cmyk, name: c.name },
      ]),
    ),
    typography: {
      display: spec.typography.display,
      body: spec.typography.body,
      local: spec.typography.local ?? null,
      scaleRatio: spec.typography.scaleRatio,
    },
    layout: spec.layout,
    mark: spec.mark,
    patterns: spec.patterns,
  };
}

function buildCssTokens(spec: BrandIdentitySpec): string {
  const lines = Object.entries(spec.palette).map(
    ([role, c]) => `  --brand-${role.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${c.hex};`,
  );
  return [
    `/* ${spec.name} — brand tokens */`,
    `:root {`,
    ...lines,
    `  --brand-font-display: "${spec.typography.display.family}";`,
    `  --brand-font-body: "${spec.typography.body.family}";`,
    ...(spec.typography.local ? [`  --brand-font-local: "${spec.typography.local.family}";`] : []),
    `  --brand-radius: ${spec.layout.radius}px;`,
    `  --brand-unit: ${spec.layout.unit}px;`,
    `}`,
    ``,
  ].join("\n");
}

function buildReadme(ctx: ExportContext): string {
  const fonts = familiesUsed(ctx.spec.typography);
  const shaping = checkShaping(ctx.spec);
  return [
    `${ctx.brandName} — Brand Kit`,
    `${"=".repeat(ctx.brandName.length + 13)}`,
    ``,
    `01-logo/       All eight logo variations.`,
    `02-guidelines/ The full brand guidelines document.`,
    `03-assets/     Your generated business assets.`,
    `04-tokens/     Machine-readable colour and type tokens for developers.`,
    ``,
    `FILE FORMATS`,
    `SVG is the master format. It is true vector — scale it to a billboard`,
    `without loss. Every print shop and design tool can open it.`,
    ``,
    `PDF files are also true vector, with fonts embedded, so a printer who does`,
    `not have your typefaces still gets exactly what you approved.`,
    ``,
    `FONTS`,
    `This brand uses: ${fonts.join(", ")}.`,
    `All are licensed under the SIL Open Font License, which permits commercial`,
    `use, embedding and redistribution. Download them from fonts.google.com.`,
    ``,
    `COLOUR IN PRINT`,
    `The CMYK values in the guidelines are an unmanaged conversion, provided for`,
    `reference. For accurate printing, give your press the hex values and ask`,
    `them to convert using their own ICC profile.`,
    ``,
    `Generated by Chhaap.`,
    ``,
  ].join("\n") + (shaping ? shapingReadmeNote(shaping) : "");
}
