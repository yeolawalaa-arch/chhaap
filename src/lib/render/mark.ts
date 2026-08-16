import { getGlyph } from "@/lib/render/glyphs";
import {
  circle,
  esc,
  group,
  n,
  path,
  rect,
  tag,
  uid,
  type Resolve,
} from "@/lib/render/svg";
import { getFont } from "@/lib/fonts/catalog";
import type { BrandIdentitySpec, EnclosureShape, MarkSpec } from "@/types/brand";

/**
 * Mark rendering.
 *
 * Every mark is drawn inside a 100×100 box, so callers place it with a single
 * transform and never need to know what kind of mark it is. The three colour
 * slots — `fg`, `bg`, `accent` — are the entire interface between a mark and
 * the identity around it, which is what lets one mark render as a full-colour
 * badge, a knocked-out white version and a single-colour print stamp without
 * any of them being authored separately.
 */

export interface MarkColors {
  fg: string;
  bg: string;
  accent: string;
}

export interface RenderMarkOptions {
  mark: MarkSpec;
  spec: BrandIdentitySpec;
  resolve: Resolve;
  colors?: Partial<MarkColors>;
  /** Overrides the identity's display family for monogram/lettermark styles. */
  fontFamily?: string;
}

// ---------------------------------------------------------------------------
// Enclosures
// ---------------------------------------------------------------------------

/** Enclosure outlines in the 100×100 mark box, inset to leave optical margin. */
export function enclosurePath(shape: EnclosureShape, cornerRadius = 20): string | null {
  const r = cornerRadius;
  switch (shape) {
    case "none":
      return null;
    case "circle":
      return "M50 2 A48 48 0 1 1 49.9 2 Z";
    case "rounded-square":
      return roundedRectPath(4, 4, 92, 92, r);
    case "squircle":
      // A true superellipse (n≈4) rather than a rounded rect — the continuous
      // curvature is what makes app-icon shapes look right at small sizes.
      return superellipsePath(50, 50, 46, 46, 4);
    case "hexagon":
      return polygonPath(50, 50, 48, 6, -90);
    case "diamond":
      return polygonPath(50, 50, 48, 4, -90);
    case "shield":
      return "M50 3 L94 18 V50 C94 72 74 89 50 97 C26 89 6 72 6 50 V18 Z";
    case "arch":
      // A flat-bottomed arch — the doorway/mihrab silhouette common to Indian
      // shopfronts and temple architecture, used as geometry not decoration.
      return "M6 97 V44 A44 44 0 0 1 94 44 V97 Z";
    case "banner":
      return "M6 20 H94 V72 L82 62 L70 72 L58 62 L46 72 L34 62 L22 72 L6 62 Z";
  }
}

function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  return (
    `M${n(x + rr)} ${n(y)} H${n(x + w - rr)} A${n(rr)} ${n(rr)} 0 0 1 ${n(x + w)} ${n(y + rr)} ` +
    `V${n(y + h - rr)} A${n(rr)} ${n(rr)} 0 0 1 ${n(x + w - rr)} ${n(y + h)} ` +
    `H${n(x + rr)} A${n(rr)} ${n(rr)} 0 0 1 ${n(x)} ${n(y + h - rr)} ` +
    `V${n(y + rr)} A${n(rr)} ${n(rr)} 0 0 1 ${n(x + rr)} ${n(y)} Z`
  );
}

function superellipsePath(cx: number, cy: number, rx: number, ry: number, power: number): string {
  const steps = 64;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    const x = cx + rx * Math.sign(ct) * Math.abs(ct) ** (2 / power);
    const y = cy + ry * Math.sign(st) * Math.abs(st) ** (2 / power);
    pts.push(`${i === 0 ? "M" : "L"}${n(x)} ${n(y)}`);
  }
  return `${pts.join(" ")} Z`;
}

function polygonPath(cx: number, cy: number, r: number, sides: number, startDeg = -90): string {
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const a = ((startDeg + (360 / sides) * i) * Math.PI) / 180;
    pts.push(`${i === 0 ? "M" : "L"}${n(cx + r * Math.cos(a))} ${n(cy + r * Math.sin(a))}`);
  }
  return `${pts.join(" ")} Z`;
}

// ---------------------------------------------------------------------------
// Abstract mark constructions
// ---------------------------------------------------------------------------

function petalMark(symmetry: number, strokeWeight: number, fg: string, accent: string): string {
  const petals: string[] = [];
  const step = 360 / symmetry;
  for (let i = 0; i < symmetry; i++) {
    // One petal drawn at 12 o'clock, then rotated — rotational symmetry is what
    // gives these marks their stability at any size.
    petals.push(
      path("M50 50 C38 36 38 20 50 8 C62 20 62 36 50 50 Z", {
        fill: i % 2 === 0 ? fg : accent,
        transform: `rotate(${n(step * i)} 50 50)`,
      }),
    );
  }
  return group({}, petals.join(""));
}

/**
 * A ring with an open arc and a body on the path.
 *
 * An earlier version stacked several large offset circles, which overlapped
 * into an unreadable blob at small sizes. Concentric geometry with a single
 * break in the ring holds its silhouette down to favicon scale, which is the
 * only test that matters for an abstract mark.
 */
function orbitMark(symmetry: number, strokeWeight: number, fg: string, accent: string): string {
  const parts: string[] = [];
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const at = (radius: number, deg: number): [number, number] => [
    50 + radius * Math.cos(rad(deg)),
    50 + radius * Math.sin(rad(deg)),
  ];
  const arc = (radius: number, from: number, to: number, stroke: string, width: number) => {
    const [sx, sy] = at(radius, from);
    const [ex, ey] = at(radius, to);
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    return path(`M${n(sx)} ${n(sy)} A${n(radius)} ${n(radius)} 0 ${large} 1 ${n(ex)} ${n(ey)}`, {
      fill: "none",
      stroke,
      "stroke-width": width,
      "stroke-linecap": "round",
    });
  };

  const r = 36;
  // Everything is deliberately asymmetric about the vertical axis. A gap at the
  // top with a mark below it, or any arc across the lower half, resolves into a
  // face the moment the mark gets small — so the break sits off-axis and there
  // is nothing centred beneath it.
  const gapCentre = -42;
  const gapDeg = 44;

  parts.push(arc(r, gapCentre + gapDeg / 2, gapCentre - gapDeg / 2 + 360, fg, strokeWeight));

  // A short inner arc in the upper-left adds depth while keeping the whole
  // figure off-balance, which is what makes it read as motion.
  const innerR = r - strokeWeight * 2;
  parts.push(arc(innerR, 168, 262, accent, strokeWeight * 0.85));

  // The satellite sits in the ring's break, resolving it as intentional.
  const [dx, dy] = at(r, gapCentre);
  parts.push(circle({ cx: dx, cy: dy, r: strokeWeight * 1.1, fill: accent }));

  return group({}, parts.join(""));
}

function stackMark(symmetry: number, strokeWeight: number, fg: string, accent: string): string {
  const bars = Math.max(3, Math.min(5, symmetry));
  const parts: string[] = [];
  const gap = 6;
  const totalH = 84;
  const barH = (totalH - gap * (bars - 1)) / bars;
  for (let i = 0; i < bars; i++) {
    // Each bar is shorter than the last — a stepped stack reads as growth and
    // stays distinct in silhouette, which a set of equal bars does not.
    const width = 84 - i * (56 / bars);
    parts.push(
      rect({
        x: 8,
        y: 8 + i * (barH + gap),
        width,
        height: barH,
        rx: Math.min(barH / 2, 6),
        fill: i === 0 ? accent : fg,
      }),
    );
  }
  return group({}, parts.join(""));
}

function letterCutMark(
  initial: string,
  family: string,
  strokeWeight: number,
  fg: string,
  accent: string,
): string {
  const clip = uid("cut");
  // The initial is set large, then a diagonal band is overlaid in the accent —
  // a "cut" letterform. The clip keeps the band inside the glyph's own box.
  return (
    tag("clipPath", { id: clip }, rect({ x: 6, y: 6, width: 88, height: 88 })) +
    group(
      { "clip-path": `url(#${clip})` },
      tag(
        "text",
        {
          x: 50,
          y: 50,
          "font-family": family,
          "font-size": 84,
          "font-weight": 800,
          fill: fg,
          "text-anchor": "middle",
          "dominant-baseline": "central",
        },
        esc(initial),
      ) +
        path("M-10 66 L110 34 L110 48 L-10 80 Z", { fill: accent, opacity: 0.92 }),
    )
  );
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function renderMark({
  mark,
  spec,
  resolve,
  colors,
  fontFamily,
}: RenderMarkOptions): string {
  if (mark.style === "wordmark-only") return "";

  const fg = colors?.fg ?? resolve("primary");
  const bg = colors?.bg ?? resolve("surface");
  const accent = colors?.accent ?? resolve("accent");
  const family = fontFamily ?? spec.typography.display.family;

  const enclosure = enclosurePath(mark.enclosure, mark.cornerRadius);
  const solid = mark.fillStyle === "solid" && mark.enclosure !== "none";
  const duotone = mark.fillStyle === "duotone" && mark.enclosure !== "none";

  // In a solid enclosure the symbol is knocked out of the shape, so it takes
  // the background colour. Everywhere else it takes the foreground.
  const symbolColor = solid ? bg : fg;
  const symbolAccent = solid ? bg : accent;

  const parts: string[] = [];
  let defs = "";

  if (enclosure) {
    if (mark.fillStyle === "gradient") {
      const gid = uid("grad");
      defs += tag(
        "linearGradient",
        { id: gid, x1: "0", y1: "0", x2: "1", y2: "1" },
        tag("stop", { offset: "0", "stop-color": fg }) +
          tag("stop", { offset: "1", "stop-color": accent }),
      );
      parts.push(path(enclosure, { fill: `url(#${gid})` }));
    } else if (solid) {
      parts.push(path(enclosure, { fill: fg }));
    } else if (duotone) {
      parts.push(path(enclosure, { fill: accent, opacity: 0.16 }));
      parts.push(path(enclosure, { fill: "none", stroke: fg, "stroke-width": mark.strokeWeight * 0.7 }));
    } else {
      parts.push(path(enclosure, { fill: "none", stroke: fg, "stroke-width": mark.strokeWeight }));
    }
  }

  // The symbol is scaled about the centre so it sits inside whatever enclosure
  // was chosen, with room to breathe.
  //
  // Text-based symbols need a second adjustment: their font sizes are tuned for
  // sitting *within* an enclosure, so standing alone they have to grow to fill
  // the box. Drawn glyphs and abstract marks already span it and stay at 1.
  const STANDALONE_BOOST: Partial<Record<MarkSpec["style"], number>> = {
    monogram: 1.5,
    "lettermark-cut": 1.15,
  };
  const scale =
    mark.enclosure === "none"
      ? (STANDALONE_BOOST[mark.style] ?? 1)
      : mark.inset * 1.55;
  const inner = renderSymbol(mark, family, symbolColor, symbolAccent, resolve);
  const symbolTransform =
    scale === 1 ? undefined : `translate(50 50) scale(${n(scale)}) translate(-50 -50)`;

  parts.push(group({ transform: symbolTransform }, inner));

  const body = parts.join("");
  return defs ? tag("defs", {}, defs) + body : body;
}

function renderSymbol(
  mark: MarkSpec,
  family: string,
  fg: string,
  accent: string,
  resolve: Resolve,
): string {
  switch (mark.style) {
    case "monogram":
      return tag(
        "text",
        {
          x: 50,
          y: 50,
          "font-family": family,
          "font-size": mark.initials && mark.initials.length > 1 ? 46 : 62,
          "font-weight": 700,
          fill: fg,
          "text-anchor": "middle",
          "dominant-baseline": "central",
          "letter-spacing": mark.initials && mark.initials.length > 1 ? n(1) : undefined,
        },
        esc(mark.initials ?? "B"),
      );

    case "lettermark-cut":
      return letterCutMark(mark.initials?.[0] ?? "B", family, mark.strokeWeight, fg, accent);

    case "abstract-petal":
      return petalMark(mark.symmetry, mark.strokeWeight, fg, accent);

    case "abstract-orbit":
      return orbitMark(mark.symmetry, mark.strokeWeight, fg, accent);

    case "abstract-stack":
      return stackMark(mark.symmetry, mark.strokeWeight, fg, accent);

    case "glyph": {
      const glyph = mark.glyph ? getGlyph(mark.glyph) : undefined;
      if (!glyph) return "";
      const parts: string[] = [];
      for (const d of glyph.fills ?? []) parts.push(path(d, { fill: fg }));
      for (const d of glyph.strokes ?? []) {
        parts.push(
          path(d, {
            fill: "none",
            stroke: fg,
            "stroke-width": mark.strokeWeight,
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
          }),
        );
      }
      for (const d of glyph.accents ?? []) {
        parts.push(
          path(d, {
            fill: "none",
            stroke: accent,
            "stroke-width": mark.strokeWeight * 0.85,
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
          }),
        );
      }
      for (const [cx, cy, r] of glyph.dots ?? []) parts.push(circle({ cx, cy, r, fill: fg }));
      return parts.join("");
    }

    case "wordmark-only":
      return "";
  }
}

/** Standalone mark as a complete SVG document, used for favicons and previews. */
export function markToSvg(
  spec: BrandIdentitySpec,
  resolve: Resolve,
  size = 256,
  background = "transparent",
): string {
  const inner = renderMark({ mark: spec.mark, spec, resolve });
  const bg =
    background !== "transparent"
      ? rect({ x: 0, y: 0, width: 100, height: 100, fill: background })
      : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(size)}" height="${n(size)}" ` +
    `viewBox="0 0 100 100" fill="none">${bg}${inner}</svg>`
  );
}

/** True when the identity has no symbol — the lockup builder needs to know. */
export function hasSymbol(mark: MarkSpec): boolean {
  return mark.style !== "wordmark-only";
}

/** Serif-ness of the display face, used by width estimation in lockups. */
export function isSerifDisplay(spec: BrandIdentitySpec): boolean {
  return (getFont(spec.typography.display.family)?.sansScore ?? 1) < 0;
}
