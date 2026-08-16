import { renderMark } from "@/lib/render/mark";
import { circle, group, n, path, rect, tag, uid, type Resolve } from "@/lib/render/svg";
import type { BrandIdentitySpec, PatternSpec } from "@/types/brand";

/**
 * Brand patterns.
 *
 * Each pattern is emitted as an SVG `<pattern>` def plus a fill reference, so a
 * template can wash an entire packaging face or Instagram story background in
 * brand texture for the cost of one rect. Patterns derive from the identity —
 * the tile pattern literally repeats the brand's own mark — which is what keeps
 * them from looking like stock textures bolted on afterwards.
 */

export interface PatternRender {
  /** `<pattern>` definition to place inside `<defs>`. */
  def: string;
  /** `url(#id)` reference for a `fill` attribute. */
  fill: string;
  id: string;
}

export interface PatternOptions {
  scale?: number;
  opacity?: number;
  /**
   * Ink colour override. Required whenever the pattern sits on a coloured
   * field: the spec's own foreground is the brand primary, which is invisible
   * when tiled on top of the primary itself.
   */
  foreground?: string;
  /**
   * Opaque tile background. Off by default — a pattern is almost always an
   * overlay, and painting the spec's surface colour behind it would hide
   * whatever it was layered onto. Only standalone swatches want this.
   */
  withBackground?: boolean;
}

export function renderPattern(
  spec: PatternSpec,
  identity: BrandIdentitySpec,
  resolve: Resolve,
  options: PatternOptions = {},
): PatternRender {
  const id = uid("pat");
  const scale = (spec.scale || 1) * (options.scale ?? 1);
  const opacity = options.opacity ?? spec.opacity;
  const fg = options.foreground ?? resolve(spec.colors[0] ?? "primary");
  const bg = options.withBackground && spec.colors[1] ? resolve(spec.colors[1]) : "none";

  const size = 64 * scale;
  let content = "";

  switch (spec.kind) {
    case "grid-dots": {
      const r = 2.6 * scale;
      content =
        circle({ cx: size * 0.25, cy: size * 0.25, r, fill: fg }) +
        circle({ cx: size * 0.75, cy: size * 0.75, r, fill: fg });
      break;
    }

    case "diagonal-stripes": {
      const w = 7 * scale;
      content = path(
        `M${n(-size)} ${n(size)} L${n(size)} ${n(-size)} M0 ${n(size * 2)} L${n(size * 2)} 0`,
        { stroke: fg, "stroke-width": w },
      );
      break;
    }

    case "chevron": {
      const w = 3 * scale;
      content = path(
        `M0 ${n(size * 0.7)} L${n(size * 0.25)} ${n(size * 0.3)} L${n(size * 0.5)} ${n(size * 0.7)} ` +
          `L${n(size * 0.75)} ${n(size * 0.3)} L${n(size)} ${n(size * 0.7)}`,
        { stroke: fg, "stroke-width": w, fill: "none", "stroke-linecap": "square" },
      );
      break;
    }

    case "waves": {
      const w = 2.6 * scale;
      const amp = size * 0.16;
      const mid = size * 0.5;
      content = path(
        `M0 ${n(mid)} Q${n(size * 0.25)} ${n(mid - amp)} ${n(size * 0.5)} ${n(mid)} ` +
          `T${n(size)} ${n(mid)}`,
        { stroke: fg, "stroke-width": w, fill: "none" },
      );
      break;
    }

    case "concentric": {
      const w = 1.8 * scale;
      const rings = [0.16, 0.3, 0.44].map((f) =>
        circle({
          cx: size / 2,
          cy: size / 2,
          r: size * f,
          fill: "none",
          stroke: fg,
          "stroke-width": w,
        }),
      );
      content = rings.join("");
      break;
    }

    case "arches": {
      // The repeating arch is drawn as pure geometry — a jaali/colonnade rhythm
      // rather than a decorative motif pasted onto the brand.
      const w = 2.2 * scale;
      const r = size * 0.28;
      content = path(
        `M${n(size * 0.22)} ${n(size * 0.86)} V${n(size * 0.5)} ` +
          `A${n(r)} ${n(r)} 0 0 1 ${n(size * 0.78)} ${n(size * 0.5)} V${n(size * 0.86)}`,
        { stroke: fg, "stroke-width": w, fill: "none" },
      );
      break;
    }

    case "lattice": {
      const w = 1.6 * scale;
      const h = size / 2;
      content = path(
        `M${n(h)} 0 L${n(size)} ${n(h)} L${n(h)} ${n(size)} L0 ${n(h)} Z`,
        { stroke: fg, "stroke-width": w, fill: "none" },
      );
      break;
    }

    case "mark-tile": {
      const markSvg = renderMark({ mark: identity.mark, spec: identity, resolve, colors: { fg, bg: "none", accent: fg } });
      const s = (size * 0.5) / 100;
      content = group(
        { transform: `translate(${n(size * 0.25)} ${n(size * 0.25)}) scale(${n(s)})` },
        markSvg,
      );
      break;
    }
  }

  const bgRect =
    bg !== "none" ? rect({ x: 0, y: 0, width: size, height: size, fill: bg }) : "";

  const def = tag(
    "pattern",
    {
      id,
      width: size,
      height: size,
      patternUnits: "userSpaceOnUse",
    },
    bgRect + group({ opacity: opacity < 1 ? opacity : undefined }, content),
  );

  return { def, fill: `url(#${id})`, id };
}

/** Renders a pattern as a standalone swatch tile, for the brand kit page. */
export function patternSwatch(
  spec: PatternSpec,
  identity: BrandIdentitySpec,
  resolve: Resolve,
  size = 200,
): string {
  const { def, fill } = renderPattern(spec, identity, resolve, {
    opacity: Math.max(spec.opacity, 0.3),
    withBackground: true,
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(size)}" height="${n(size)}" viewBox="0 0 ${n(size)} ${n(size)}" fill="none">` +
    tag("defs", {}, def) +
    rect({ x: 0, y: 0, width: size, height: size, fill: resolve("surface") }) +
    rect({ x: 0, y: 0, width: size, height: size, fill }) +
    `</svg>`
  );
}

export const PATTERN_LABELS: Record<PatternSpec["kind"], string> = {
  "grid-dots": "Dot grid",
  "diagonal-stripes": "Diagonal",
  arches: "Arches",
  waves: "Waves",
  "mark-tile": "Mark tile",
  chevron: "Chevron",
  concentric: "Concentric",
  lattice: "Lattice",
};

export const PATTERN_USAGE: Record<PatternSpec["kind"], string> = {
  "grid-dots": "Quiet background texture. Safe under text at low opacity.",
  "diagonal-stripes": "Energy and movement. Use on edges and banners, never under body copy.",
  arches: "Structural rhythm for packaging faces, menus and section dividers.",
  waves: "Soft, informal texture for social backgrounds and wrapping.",
  "mark-tile": "Your own mark, repeated. Ideal for carry bags, gift wrap and box interiors.",
  chevron: "Directional texture for edges, tape and shelf strips.",
  concentric: "Focal texture. Works well centred behind a product shot.",
  lattice: "Fine geometric fill for premium surfaces and secondary panels.",
};
