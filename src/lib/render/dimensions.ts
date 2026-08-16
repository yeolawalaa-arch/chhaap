import type { AssetDimension, AssetKind } from "@/types/brand";

/**
 * Asset dimensions.
 *
 * Print sizes here are the ones Indian presses actually run, which are not
 * always the international defaults: the standard visiting card sold by every
 * local printer is 89 × 51 mm rather than the US 3.5 × 2 in, and stationery is
 * ISO A-series throughout. Getting this wrong is not cosmetic — a file at the
 * wrong trim gets rejected at the counter or comes back with the logo cropped.
 *
 * `bleedMm` is the extra image area beyond the trim line that the guillotine
 * eats. Anything that runs to the edge must extend into it, which the
 * templates handle by drawing full-bleed elements past the trim box.
 */

const MM_PER_INCH = 25.4;

/** Pixel dimensions for a physical size at a given DPI, including bleed. */
export function pxFor(widthMm: number, heightMm: number, dpi: number, bleedMm = 0) {
  const w = ((widthMm + bleedMm * 2) / MM_PER_INCH) * dpi;
  const h = ((heightMm + bleedMm * 2) / MM_PER_INCH) * dpi;
  return { width: Math.round(w), height: Math.round(h) };
}

function print(
  label: string,
  widthMm: number,
  heightMm: number,
  opts: { dpi?: number; bleedMm?: number } = {},
): AssetDimension {
  const dpi = opts.dpi ?? 300;
  const bleedMm = opts.bleedMm ?? 3;
  // Templates are authored at 1/4 of print resolution for responsive preview
  // speed; export re-renders the same vector geometry at full size, so nothing
  // is lost. SVG has no inherent resolution — this is only the coordinate space.
  const { width, height } = pxFor(widthMm, heightMm, dpi / 4, bleedMm);
  return { width, height, widthMm, heightMm, dpi, bleedMm, label, print: true };
}

function screen(label: string, width: number, height: number): AssetDimension {
  return { width, height, label, print: false };
}

export const DIMENSIONS: Record<AssetKind, AssetDimension> = {
  // --- print ---------------------------------------------------------------
  visiting_card: print("Indian standard visiting card · 89 × 51 mm", 89, 51),
  letterhead: print("A4 letterhead · 210 × 297 mm", 210, 297, { bleedMm: 3 }),
  invoice: print("A4 GST invoice · 210 × 297 mm", 210, 297, { bleedMm: 0 }),
  menu: print("A4 menu · 210 × 297 mm", 210, 297),
  brochure: print("A4 trifold brochure · 297 × 210 mm", 297, 210),
  flyer: print("A5 flyer · 148 × 210 mm", 148, 210),
  poster: print("A3 poster · 297 × 420 mm", 297, 420, { dpi: 200 }),
  product_label: print("Product label · 70 × 100 mm", 70, 100),
  packaging: print("Carton face · 180 × 240 mm", 180, 240, { dpi: 200 }),
  shopping_bag: print("Carry bag face · 250 × 320 mm", 250, 320, { dpi: 150 }),
  tshirt: print("T-shirt chest print · 280 × 340 mm", 280, 340, { dpi: 150, bleedMm: 0 }),
  // Large-format vinyl is output at low DPI because it is viewed from metres
  // away; 300dpi on a 4-foot board is a gigabyte of pointless data.
  signboard: print("Shop signboard · 1220 × 610 mm (4 × 2 ft)", 1220, 610, {
    dpi: 72,
    bleedMm: 10,
  }),

  // --- social --------------------------------------------------------------
  whatsapp_profile: screen("WhatsApp Business profile · 640 × 640", 640, 640),
  instagram_profile: screen("Instagram profile picture · 640 × 640", 640, 640),
  instagram_post: screen("Instagram post · 1080 × 1350 (4:5)", 1080, 1350),
  instagram_story: screen("Instagram story · 1080 × 1920 (9:16)", 1080, 1920),
  youtube_banner: screen("YouTube channel art · 2560 × 1440", 2560, 1440),
  linkedin_banner: screen("LinkedIn page banner · 1128 × 191", 1128, 191),

  // --- web -----------------------------------------------------------------
  website_hero: screen("Website hero · 1600 × 900", 1600, 900),
};

export function dimensionFor(kind: AssetKind): AssetDimension {
  return DIMENSIONS[kind];
}

/**
 * The safe area inside a print asset — inside the bleed, and inside the margin
 * a guillotine can drift. Text placed outside this can be trimmed off.
 */
export function safeArea(dim: AssetDimension, marginMm = 4) {
  if (!dim.print || !dim.widthMm || !dim.heightMm) {
    const inset = Math.min(dim.width, dim.height) * 0.06;
    return { x: inset, y: inset, width: dim.width - inset * 2, height: dim.height - inset * 2 };
  }
  const bleed = dim.bleedMm ?? 0;
  const scale = dim.width / (dim.widthMm + bleed * 2);
  const inset = (bleed + marginMm) * scale;
  return {
    x: inset,
    y: inset,
    width: dim.width - inset * 2,
    height: dim.height - inset * 2,
  };
}

/** The trim box — where the blade actually cuts. */
export function trimBox(dim: AssetDimension) {
  if (!dim.print || !dim.widthMm) {
    return { x: 0, y: 0, width: dim.width, height: dim.height };
  }
  const bleed = dim.bleedMm ?? 0;
  const scale = dim.width / (dim.widthMm + bleed * 2);
  const inset = bleed * scale;
  return {
    x: inset,
    y: inset,
    width: dim.width - inset * 2,
    height: dim.height - inset * 2,
  };
}

/** Export pixel size for a raster download at the asset's true resolution. */
export function exportPixels(dim: AssetDimension, multiplier = 1) {
  if (dim.print && dim.widthMm && dim.heightMm && dim.dpi) {
    const { width, height } = pxFor(dim.widthMm, dim.heightMm, dim.dpi, dim.bleedMm ?? 0);
    return { width: Math.round(width * multiplier), height: Math.round(height * multiplier) };
  }
  return {
    width: Math.round(dim.width * multiplier),
    height: Math.round(dim.height * multiplier),
  };
}

/** Human summary shown on the export dialog. */
export function describeExport(dim: AssetDimension): string {
  if (dim.print && dim.widthMm && dim.dpi) {
    const px = exportPixels(dim);
    return `${dim.widthMm} × ${dim.heightMm} mm at ${dim.dpi} dpi (${px.width} × ${px.height} px)` +
      (dim.bleedMm ? `, including ${dim.bleedMm} mm bleed` : "");
  }
  return `${dim.width} × ${dim.height} px`;
}
