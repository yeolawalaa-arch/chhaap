import { buildLogoDocument } from "@/lib/render/logo";
import { renderMark } from "@/lib/render/mark";
import { renderPattern } from "@/lib/render/patterns";
import { safeArea, trimBox } from "@/lib/render/dimensions";
import {
  estimateTextWidth,
  group,
  n,
  rect,
  tag,
  text,
  type Resolve,
} from "@/lib/render/svg";
import type {
  AssetData,
  AssetDimension,
  BrandIdentitySpec,
  LogoVariation,
} from "@/types/brand";

/**
 * Shared building blocks for asset templates.
 *
 * Templates compose from these rather than emitting raw SVG, which is what
 * keeps a visiting card and a signboard on the same system: both call
 * `placeLogo`, so both get identical lockup proportions and clear space, and a
 * change to the identity moves both at once.
 */

export interface AssetCtx {
  spec: BrandIdentitySpec;
  resolve: Resolve;
  dim: AssetDimension;
  data: AssetData;
  watermark: boolean;
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

export const str = (data: AssetData, key: string, fallback = ""): string => {
  const v = data[key];
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
};

export const bool = (data: AssetData, key: string, fallback = false): boolean => {
  const v = data[key];
  return typeof v === "boolean" ? v : fallback;
};

export const list = (data: AssetData, key: string): string[] => {
  const v = data[key];
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
};

// ---------------------------------------------------------------------------
// Logo placement
// ---------------------------------------------------------------------------

/**
 * Draws the brand logo inside a box, scaled to fit and centred.
 *
 * Everything routes through `buildLogoDocument`, so an asset never invents its
 * own arrangement of mark and name — it places the same lockup the Logo Studio
 * produces.
 */
export interface PlaceLogoOptions {
  /**
   * The logo is sitting on a solid coloured field of this colour.
   *
   * This exists instead of a bare foreground override because a knocked-out
   * mark needs *two* colours to be right: the ink becomes the surface colour,
   * and the mark's own background — the colour a solid enclosure knocks its
   * symbol out to — must become the field it is sitting on. Setting only the
   * foreground produces a solid white blob with an invisible symbol inside it.
   */
  onField?: string;
  /** Explicit overrides, for cases `onField` doesn't cover. */
  colorOverride?: { fg?: string; bg?: string; text?: string };
  align?: "start" | "middle" | "end";
}

export function placeLogo(
  ctx: AssetCtx,
  variation: LogoVariation,
  box: { x: number; y: number; width: number; height: number },
  opts: PlaceLogoOptions = {},
): string {
  const doc = buildLogoDocument(ctx.spec, variation);
  const scale = Math.min(box.width / doc.width, box.height / doc.height);
  const w = doc.width * scale;
  const h = doc.height * scale;

  const align = opts.align ?? "middle";
  const x = align === "start" ? box.x : align === "end" ? box.x + box.width - w : box.x + (box.width - w) / 2;
  const y = box.y + (box.height - h) / 2;

  // On a coloured field the whole lockup reverses: ink goes to the surface
  // colour and the mark's knockout colour becomes the field itself.
  const ink = opts.onField ? ctx.resolve("surface") : undefined;
  const fgOverride = opts.colorOverride?.fg ?? ink;
  const bgOverride = opts.colorOverride?.bg ?? opts.onField;
  const textOverride = opts.colorOverride?.text ?? ink;

  const layers = doc.layers
    .filter((l) => l.visible)
    .map((layer) => {
      if (layer.kind === "mark") {
        const inner = renderMark({
          mark: layer.mark,
          spec: ctx.spec,
          resolve: ctx.resolve,
          colors: {
            fg: fgOverride ?? ctx.resolve(layer.colors.fg),
            bg: bgOverride ?? ctx.resolve(layer.colors.bg),
            accent: fgOverride ?? ctx.resolve(layer.colors.accent),
          },
        });
        const s = (layer.size / 100) * layer.scale;
        return group(
          { transform: `translate(${n(layer.x)} ${n(layer.y)}) scale(${n(s)}) translate(-50 -50)` },
          inner,
        );
      }
      if (layer.kind === "text") {
        return group(
          { transform: `translate(${n(layer.x)} ${n(layer.y)})` },
          text({
            x: 0,
            y: 0,
            text: layer.text,
            family: layer.font.family,
            size: layer.size,
            weight: layer.font.weight,
            fill: textOverride ?? ctx.resolve(layer.color),
            letterSpacing: layer.font.letterSpacing,
            anchor: layer.align,
            transform: layer.font.transform,
          }),
        );
      }
      if (layer.kind === "divider") {
        const half = layer.width / 2;
        return tag("line", {
          x1: layer.x - half,
          y1: layer.y,
          x2: layer.x + half,
          y2: layer.y,
          stroke: fgOverride ?? ctx.resolve(layer.color),
          "stroke-width": layer.thickness,
          opacity: layer.opacity,
        });
      }
      return "";
    })
    .join("");

  return group({ transform: `translate(${n(x)} ${n(y)}) scale(${n(scale)})` }, layers);
}

// ---------------------------------------------------------------------------
// Backgrounds
// ---------------------------------------------------------------------------

export interface Background {
  defs: string;
  body: string;
}

export function patternBackground(
  ctx: AssetCtx,
  opts: { index?: number; opacity?: number; scale?: number; base?: string } = {},
): Background {
  const spec = ctx.spec.patterns[opts.index ?? 0];
  const base = opts.base ?? ctx.resolve("surface");
  if (!spec) {
    return {
      defs: "",
      body: rect({ x: 0, y: 0, width: ctx.dim.width, height: ctx.dim.height, fill: base }),
    };
  }
  const { def, fill } = renderPattern(spec, ctx.spec, ctx.resolve, {
    opacity: opts.opacity,
    scale: opts.scale,
  });
  return {
    defs: def,
    body:
      rect({ x: 0, y: 0, width: ctx.dim.width, height: ctx.dim.height, fill: base }) +
      rect({ x: 0, y: 0, width: ctx.dim.width, height: ctx.dim.height, fill }),
  };
}

export const solidBackground = (ctx: AssetCtx, color: string): string =>
  rect({ x: 0, y: 0, width: ctx.dim.width, height: ctx.dim.height, fill: color });

// ---------------------------------------------------------------------------
// Text blocks
// ---------------------------------------------------------------------------

/**
 * Greedy word wrap using the width estimator.
 *
 * Exact metrics would need the font file, which is not available in the browser
 * preview. The estimator is accurate to within a few percent, and templates
 * leave enough margin to absorb that — the alternative, rendering text that
 * overflows its box, is far worse than a slightly early break.
 */
export function wrapText(
  content: string,
  maxWidth: number,
  size: number,
  opts: { weight?: number; letterSpacing?: number; serif?: boolean; script?: string; maxLines?: number } = {},
): string[] {
  const words = content.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateTextWidth(candidate, size, opts) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  const maxLines = opts.maxLines ?? 6;
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]!.replace(/[.,;:]$/, "")}…`;
    return kept;
  }
  return lines;
}

export interface TextBlockOptions {
  x: number;
  y: number;
  maxWidth: number;
  size: number;
  lineHeight?: number;
  family: string;
  weight: number;
  fill: string;
  letterSpacing?: number;
  anchor?: "start" | "middle" | "end";
  transform?: "none" | "uppercase" | "lowercase";
  serif?: boolean;
  maxLines?: number;
  script?: string;
}

/** Multi-line text block. Returns markup plus the height it consumed. */
export function textBlock(
  content: string,
  o: TextBlockOptions,
): { svg: string; height: number; lines: number } {
  const lines = wrapText(content, o.maxWidth, o.size, {
    weight: o.weight,
    letterSpacing: o.letterSpacing,
    serif: o.serif,
    script: o.script,
    maxLines: o.maxLines,
  });
  const lh = (o.lineHeight ?? 1.28) * o.size;
  const svg = lines
    .map((lineContent, i) =>
      text({
        x: o.x,
        y: o.y + i * lh,
        text: lineContent,
        family: o.family,
        size: o.size,
        weight: o.weight,
        fill: o.fill,
        letterSpacing: o.letterSpacing,
        anchor: o.anchor,
        transform: o.transform,
      }),
    )
    .join("");
  return { svg, height: lines.length * lh, lines: lines.length };
}

// ---------------------------------------------------------------------------
// Print furniture
// ---------------------------------------------------------------------------

/** Crop marks outside the trim box — omitted from screen assets. */
export function cropMarks(ctx: AssetCtx, color = "#000"): string {
  if (!ctx.dim.print || !ctx.dim.bleedMm) return "";
  const trim = trimBox(ctx.dim);
  const len = Math.min(trim.width, trim.height) * 0.03;
  const t = 0.5;
  const marks: string[] = [];
  const corners = [
    [trim.x, trim.y, -1, -1],
    [trim.x + trim.width, trim.y, 1, -1],
    [trim.x, trim.y + trim.height, -1, 1],
    [trim.x + trim.width, trim.y + trim.height, 1, 1],
  ];
  for (const [x, y, dx, dy] of corners) {
    marks.push(
      tag("line", { x1: x, y1: y! + dy! * 2, x2: x, y2: y! + dy! * (2 + len), stroke: color, "stroke-width": t }),
      tag("line", { x1: x! + dx! * 2, y1: y, x2: x! + dx! * (2 + len), y2: y, stroke: color, "stroke-width": t }),
    );
  }
  return group({ opacity: 0.55 }, marks.join(""));
}

// ---------------------------------------------------------------------------
// Watermark
// ---------------------------------------------------------------------------

/**
 * "Made with Chhaap" for free-tier exports.
 *
 * Placed in the bleed area on print assets so it never intrudes on the design a
 * user paid attention to — it disappears at the guillotine — and in a corner on
 * screen assets where it is visible but small.
 */
export function watermark(ctx: AssetCtx): string {
  if (!ctx.watermark) return "";

  const size = Math.max(9, Math.min(ctx.dim.width, ctx.dim.height) * 0.022);
  const label = "Made with Chhaap";
  const pad = size * 0.9;

  if (ctx.dim.print) {
    return text({
      x: ctx.dim.width / 2,
      y: ctx.dim.height - size * 0.4,
      text: label,
      family: "Inter",
      size: size * 0.8,
      weight: 400,
      fill: "#9a9aa2",
      anchor: "middle",
      opacity: 0.8,
    });
  }

  const w = estimateTextWidth(label, size, { weight: 500 }) + pad * 2;
  const h = size * 2.1;
  return group(
    { transform: `translate(${n(ctx.dim.width - w - pad)} ${n(ctx.dim.height - h - pad)})` },
    rect({ x: 0, y: 0, width: w, height: h, rx: h / 2, fill: "#00000059" }) +
      text({
        x: w / 2,
        y: h / 2,
        text: label,
        family: "Inter",
        size,
        weight: 500,
        fill: "#ffffff",
        anchor: "middle",
        dominantBaseline: "central",
      }),
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export const safe = (ctx: AssetCtx, marginMm?: number) => safeArea(ctx.dim, marginMm);

/** Rupee-formatted amount. */
export const inr = (amount: number): string =>
  `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function contactLine(data: AssetData): string {
  return [str(data, "phone"), str(data, "email"), str(data, "website")]
    .filter(Boolean)
    .join("  ·  ");
}
