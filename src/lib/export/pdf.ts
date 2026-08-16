import { existsSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { FONTS, getFont, resolveWeight } from "@/lib/fonts/catalog";
import type { AssetDimension } from "@/types/brand";

/**
 * PDF export.
 *
 * These are genuine vector PDFs. The SVG's paths become PDF path operators and
 * its text becomes real embedded text — not a rasterised image wrapped in a PDF
 * container, which is what most "PDF export" buttons actually produce.
 *
 * Fonts are embedded from the same TTFs the browser uses, so a print shop that
 * has never heard of Baloo 2 still renders the file exactly as the owner
 * approved it on screen.
 */

const FONT_DIR = join(process.cwd(), "public", "fonts");
const MM_PER_PT = 0.3527777778;

/** Font registration names must match the `font-family` values in the SVG. */
function registerFonts(doc: PDFKit.PDFDocument, families: string[]): Set<string> {
  const registered = new Set<string>();

  for (const family of families) {
    const font = getFont(family);
    if (!font) continue;

    for (const weight of font.weights) {
      const file = font.files[weight];
      if (!file) continue;
      const path = join(FONT_DIR, file);
      if (!existsSync(path)) continue;

      try {
        // svg-to-pdfkit looks up "Family" and "Family-700"; register both forms
        // so weighted text resolves instead of silently falling back.
        doc.registerFont(`${family}-${weight}`, path);
        registered.add(`${family}-${weight}`);
        if (weight === 400 || !registered.has(family)) {
          doc.registerFont(family, path);
          registered.add(family);
        }
      } catch (err) {
        console.warn(`[pdf] could not embed ${family} ${weight}: ${(err as Error).message}`);
      }
    }
  }

  return registered;
}

export interface SvgToPdfOptions {
  svg: string;
  /** Physical page size. Falls back to the SVG's pixel box at 72dpi. */
  dimension?: AssetDimension;
  /** Families to embed; defaults to the whole catalogue. */
  families?: string[];
  title?: string;
  author?: string;
}

/** Converts one SVG into a single-page vector PDF. */
export async function svgToPdf(options: SvgToPdfOptions): Promise<Buffer> {
  const { svg, dimension, families, title, author } = options;

  // Page size in points. Print assets use their true physical size (including
  // bleed) so the file is press-ready; screen assets map 1px to 1pt.
  const size: [number, number] =
    dimension?.print && dimension.widthMm && dimension.heightMm
      ? [
          (dimension.widthMm + (dimension.bleedMm ?? 0) * 2) / MM_PER_PT,
          (dimension.heightMm + (dimension.bleedMm ?? 0) * 2) / MM_PER_PT,
        ]
      : [dimension?.width ?? 800, dimension?.height ?? 600];

  const doc = new PDFDocument({
    size,
    margin: 0,
    info: {
      Title: title ?? "Chhaap export",
      Author: author ?? "Chhaap",
      Creator: "Chhaap",
      Producer: "Chhaap",
    },
  });

  registerFonts(doc, families ?? FONTS.map((f) => f.family));

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  try {
    SVGtoPDF(doc, svg, 0, 0, {
      width: size[0],
      height: size[1],
      preserveAspectRatio: "xMidYMid meet",
      // Without this, text with no exactly-matching registered face is dropped
      // rather than substituted.
      fontCallback: (family: string, bold: boolean) => {
        const clean = String(family).replace(/['"]/g, "").split(",")[0]!.trim();
        const font = getFont(clean);
        if (!font) return bold ? "Helvetica-Bold" : "Helvetica";
        const weight = resolveWeight(clean, bold ? 700 : 400);
        return `${clean}-${weight}`;
      },
    });
  } catch (err) {
    doc.end();
    throw new Error(`Could not convert this design to PDF: ${(err as Error).message}`);
  }

  doc.end();
  return done;
}

// ---------------------------------------------------------------------------
// Multi-page documents
// ---------------------------------------------------------------------------

export interface PdfPage {
  svg: string;
  dimension?: AssetDimension;
}

/** Combines several SVGs into one multi-page PDF (used by the brand kit). */
export async function svgsToPdf(
  pages: PdfPage[],
  meta: { title: string; author?: string; families?: string[] },
): Promise<Buffer> {
  if (pages.length === 0) throw new Error("A PDF needs at least one page.");

  const pageSize = (page: PdfPage): [number, number] =>
    page.dimension?.print && page.dimension.widthMm && page.dimension.heightMm
      ? [
          (page.dimension.widthMm + (page.dimension.bleedMm ?? 0) * 2) / MM_PER_PT,
          (page.dimension.heightMm + (page.dimension.bleedMm ?? 0) * 2) / MM_PER_PT,
        ]
      : [page.dimension?.width ?? 595, page.dimension?.height ?? 842];

  const first = pageSize(pages[0]!);
  const doc = new PDFDocument({
    size: first,
    margin: 0,
    info: {
      Title: meta.title,
      Author: meta.author ?? "Chhaap",
      Creator: "Chhaap",
      Producer: "Chhaap",
    },
  });

  registerFonts(doc, meta.families ?? FONTS.map((f) => f.family));

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  pages.forEach((page, index) => {
    const size = pageSize(page);
    if (index > 0) doc.addPage({ size, margin: 0 });

    try {
      SVGtoPDF(doc, page.svg, 0, 0, {
        width: size[0],
        height: size[1],
        preserveAspectRatio: "xMidYMid meet",
        fontCallback: (family: string, bold: boolean) => {
          const clean = String(family).replace(/['"]/g, "").split(",")[0]!.trim();
          const font = getFont(clean);
          if (!font) return bold ? "Helvetica-Bold" : "Helvetica";
          return `${clean}-${resolveWeight(clean, bold ? 700 : 400)}`;
        },
      });
    } catch (err) {
      // One bad page should not lose the whole document — note it and continue.
      console.error(`[pdf] page ${index + 1} failed: ${(err as Error).message}`);
      doc.fontSize(12).fillColor("#999").text(`This page could not be rendered.`, 40, 40);
    }
  });

  doc.end();
  return done;
}
