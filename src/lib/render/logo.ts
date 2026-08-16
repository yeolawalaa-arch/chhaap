import { nanoid } from "nanoid";
import { hasSymbol, isSerifDisplay, renderMark } from "@/lib/render/mark";
import { scriptMetrics } from "@/lib/brand/languages";
import {
  colorResolver,
  estimateTextWidth,
  group,
  n,
  rect,
  svgDoc,
  tag,
  text,
  transform,
  type ColorMode,
  type Resolve,
} from "@/lib/render/svg";
import type {
  BrandIdentitySpec,
  LogoDocument,
  LogoLayer,
  LogoVariation,
  MarkLayer,
  TextLayer,
} from "@/types/brand";

/**
 * Logo documents.
 *
 * A `LogoDocument` is a flat list of positioned layers — the representation the
 * Studio edits directly. Building it from the identity spec (rather than
 * rendering the spec straight to SVG) is what makes the editor possible: the
 * generator produces a starting document, the user moves things, and the
 * renderer never needs to know which of the two happened.
 *
 * All eight variations are derived from the same spec, so a colour change in
 * the identity propagates everywhere, while a manual nudge in the Studio stays
 * local to the variation the user was editing.
 */

const CANVAS = {
  stacked: { width: 480, height: 420 },
  horizontal: { width: 720, height: 240 },
  badge: { width: 480, height: 480 },
  icon: { width: 240, height: 240 },
} as const;

type Lockup = keyof typeof CANVAS;

// ---------------------------------------------------------------------------
// Document construction
// ---------------------------------------------------------------------------

function lockupFor(spec: BrandIdentitySpec, variation: LogoVariation): Lockup {
  switch (variation) {
    case "icon":
      return "icon";
    case "horizontal":
      return "horizontal";
    case "vertical":
      return "stacked";
    case "secondary":
      // The secondary is deliberately the *other* shape to the primary, so a
      // brand always has one wide and one tall option for real layouts.
      return spec.lockup === "horizontal" ? "stacked" : "horizontal";
    default:
      return spec.lockup === "badge" ? "badge" : spec.lockup === "horizontal" ? "horizontal" : "stacked";
  }
}

function colorModeFor(variation: LogoVariation): ColorMode {
  switch (variation) {
    case "black":
      return "black";
    case "white":
      return "white";
    case "monochrome":
      return "monochrome";
    default:
      return "brand";
  }
}

export function buildLogoDocument(
  spec: BrandIdentitySpec,
  variation: LogoVariation,
): LogoDocument {
  const lockup = lockupFor(spec, variation);
  const canvas = CANVAS[lockup];
  const colorMode = colorModeFor(variation);
  const layers: LogoLayer[] = [];

  const showMark = hasSymbol(spec.mark);
  const showText = variation !== "icon";
  const serif = isSerifDisplay(spec);
  const metrics = scriptMetrics(spec.language);

  const display = spec.typography.display;
  const body = spec.typography.body;
  const local = spec.typography.local;

  // White-variation logos sit on dark ground; everything else on light.
  const background: LogoDocument["background"] =
    variation === "white" ? "ink" : "transparent";

  if (lockup === "icon") {
    layers.push(markLayer(spec, canvas.width / 2, canvas.height / 2, 168));
    return { variation, width: canvas.width, height: canvas.height, background, layers, colorMode };
  }

  if (lockup === "horizontal") {
    const markSize = showMark ? 132 : 0;
    const gap = showMark ? 32 : 0;
    const nameSize = 68;
    const nameWidth = estimateTextWidth(spec.name, nameSize, {
      weight: display.weight,
      letterSpacing: display.letterSpacing,
      serif,
    });
    const descSize = 21;
    const hasDesc = !!spec.descriptor;
    const hasLocal = !!spec.localName && !!local;

    const textWidth = Math.max(
      nameWidth,
      hasDesc
        ? estimateTextWidth(spec.descriptor!, descSize, { weight: body.weight, letterSpacing: 0.14 })
        : 0,
    );
    const totalWidth = markSize + gap + textWidth;
    const startX = (canvas.width - totalWidth) / 2;
    const cy = canvas.height / 2;

    if (showMark) layers.push(markLayer(spec, startX + markSize / 2, cy, markSize));

    const textX = startX + markSize + gap;
    // Vertical rhythm: the name sits on the optical centre, with the descriptor
    // and local name hung below it.
    const stackHeight = nameSize + (hasDesc ? descSize + 14 : 0) + (hasLocal ? nameSize * 0.62 : 0);
    let y = cy - stackHeight / 2 + nameSize * 0.72;

    layers.push(nameLayer(spec, textX, y, nameSize, "start"));
    y += hasLocal ? nameSize * 0.62 : 0;
    if (hasLocal) {
      layers.push(localLayer(spec, textX, y, nameSize * 0.5, "start", metrics.baselineShift));
    }
    if (hasDesc) {
      y += descSize + 14;
      layers.push(descriptorLayer(spec, textX, y, descSize, "start"));
    }

    return { variation, width: canvas.width, height: canvas.height, background, layers, colorMode };
  }

  // --- stacked and badge ---------------------------------------------------
  const isBadge = lockup === "badge";
  const markSize = showMark ? (isBadge ? 200 : 176) : 0;
  const nameSize = isBadge ? 52 : 60;
  const descSize = isBadge ? 18 : 20;
  const cx = canvas.width / 2;
  const hasDesc = !!spec.descriptor;
  const hasLocal = !!spec.localName && !!local;

  const blockHeight =
    markSize +
    (showMark && showText ? 40 : 0) +
    (showText ? nameSize : 0) +
    (hasLocal ? nameSize * 0.62 : 0) +
    (hasDesc ? descSize + 18 : 0);

  let y = (canvas.height - blockHeight) / 2;

  if (showMark) {
    layers.push(markLayer(spec, cx, y + markSize / 2, markSize));
    y += markSize + (showText ? 40 : 0);
  }

  if (showText) {
    y += nameSize * 0.76;
    layers.push(nameLayer(spec, cx, y, nameSize, "middle"));

    if (hasLocal) {
      y += nameSize * 0.62;
      layers.push(localLayer(spec, cx, y, nameSize * 0.5, "middle", metrics.baselineShift));
    }

    if (hasDesc) {
      y += descSize + 18;
      // A hairline rule above the descriptor is a classic emblem device; it
      // also visually ties a long descriptor to the name above it.
      if (isBadge) {
        layers.push({
          id: nanoid(8),
          kind: "divider",
          name: "Rule",
          x: cx,
          y: y - descSize - 2,
          rotation: 0,
          scale: 1,
          opacity: 0.45,
          visible: true,
          locked: false,
          width: Math.min(200, estimateTextWidth(spec.descriptor!, descSize, { letterSpacing: 0.16 }) + 40),
          thickness: 1.5,
          color: "primary",
          orientation: "horizontal",
        });
      }
      layers.push(descriptorLayer(spec, cx, y, descSize, "middle"));
    }
  }

  return { variation, width: canvas.width, height: canvas.height, background, layers, colorMode };
}

// ---------------------------------------------------------------------------
// Layer factories
// ---------------------------------------------------------------------------

function markLayer(spec: BrandIdentitySpec, x: number, y: number, size: number): MarkLayer {
  return {
    id: nanoid(8),
    kind: "mark",
    name: "Mark",
    x,
    y,
    rotation: 0,
    scale: 1,
    opacity: 1,
    visible: true,
    locked: false,
    mark: spec.mark,
    size,
    colors: { fg: "primary", bg: "surface", accent: "accent" },
  };
}

function nameLayer(
  spec: BrandIdentitySpec,
  x: number,
  y: number,
  size: number,
  align: TextLayer["align"],
): TextLayer {
  return {
    id: nanoid(8),
    kind: "text",
    name: "Business name",
    x,
    y,
    rotation: 0,
    scale: 1,
    opacity: 1,
    visible: true,
    locked: false,
    text: spec.name,
    font: spec.typography.display,
    size,
    color: "ink",
    align,
  };
}

function localLayer(
  spec: BrandIdentitySpec,
  x: number,
  y: number,
  size: number,
  align: TextLayer["align"],
  baselineShift: number,
): TextLayer {
  return {
    id: nanoid(8),
    kind: "text",
    name: "Local script name",
    x,
    // Indic glyphs sit lower in the em box; without this correction the local
    // name reads as if it is floating above its own baseline.
    y: y + size * baselineShift,
    rotation: 0,
    scale: 1,
    opacity: 1,
    visible: true,
    locked: false,
    text: spec.localName ?? "",
    font: spec.typography.local ?? spec.typography.body,
    size,
    color: "primary",
    align,
    isLocalScript: true,
  };
}

function descriptorLayer(
  spec: BrandIdentitySpec,
  x: number,
  y: number,
  size: number,
  align: TextLayer["align"],
): TextLayer {
  return {
    id: nanoid(8),
    kind: "text",
    name: "Descriptor",
    x,
    y,
    rotation: 0,
    scale: 1,
    opacity: 1,
    visible: true,
    locked: false,
    text: spec.descriptor ?? "",
    font: { ...spec.typography.body, letterSpacing: 0.16, transform: "uppercase" },
    size,
    color: "muted",
    align,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface RenderLogoOptions {
  doc: LogoDocument;
  spec: BrandIdentitySpec;
  /** Overrides the document background; used for preview checkerboards. */
  background?: string;
  /** Scales the output document; the viewBox is unchanged. */
  size?: { width: number; height: number };
  title?: string;
}

export function renderLogo({ doc, spec, background, size, title }: RenderLogoOptions): string {
  const resolve = colorResolver(spec, doc.colorMode);

  // The backdrop is resolved in brand mode even for the one-colour variations.
  // It is a presentation surface, not part of the mark's ink — running it
  // through the inverting resolver would flip the white variation's dark
  // ground to white and render a white logo invisible on it.
  const backdrop = colorResolver(spec, "brand");
  const bg = background ?? (doc.background === "transparent" ? undefined : backdrop(doc.background));

  const body = doc.layers
    .filter((layer) => layer.visible)
    .map((layer) => renderLayer(layer, spec, resolve))
    .join("");

  return svgDoc(
    {
      width: size?.width ?? doc.width,
      height: size?.height ?? doc.height,
      viewBox: `0 0 ${n(doc.width)} ${n(doc.height)}`,
      background: bg,
      title: title ?? `${spec.name} — ${doc.variation} logo`,
    },
    body,
  );
}

function renderLayer(layer: LogoLayer, spec: BrandIdentitySpec, resolve: Resolve): string {
  const common = {
    opacity: layer.opacity < 1 ? layer.opacity : undefined,
  };

  switch (layer.kind) {
    case "mark": {
      const inner = renderMark({
        mark: layer.mark,
        spec,
        resolve,
        colors: {
          fg: resolve(layer.colors.fg),
          bg: resolve(layer.colors.bg),
          accent: resolve(layer.colors.accent),
        },
      });
      const scale = (layer.size / 100) * layer.scale;
      return group(
        {
          ...common,
          transform: [
            `translate(${n(layer.x)} ${n(layer.y)})`,
            layer.rotation ? `rotate(${n(layer.rotation)})` : "",
            `scale(${n(scale)})`,
            `translate(-50 -50)`,
          ]
            .filter(Boolean)
            .join(" "),
        },
        inner,
      );
    }

    case "text": {
      const content = text({
        x: 0,
        y: 0,
        text: layer.text,
        family: layer.font.family,
        size: layer.size,
        weight: layer.font.weight,
        fill: resolve(layer.color),
        letterSpacing: layer.font.letterSpacing,
        anchor: layer.align,
        transform: layer.font.transform,
      });
      return group(
        {
          ...common,
          transform: [
            `translate(${n(layer.x)} ${n(layer.y)})`,
            layer.rotation ? `rotate(${n(layer.rotation)})` : "",
            layer.scale !== 1 ? `scale(${n(layer.scale)})` : "",
          ]
            .filter(Boolean)
            .join(" "),
        },
        content,
      );
    }

    case "divider": {
      const half = layer.width / 2;
      const isH = layer.orientation === "horizontal";
      return tag("line", {
        ...common,
        x1: isH ? layer.x - half : layer.x,
        y1: isH ? layer.y : layer.y - half,
        x2: isH ? layer.x + half : layer.x,
        y2: isH ? layer.y : layer.y + half,
        stroke: resolve(layer.color),
        "stroke-width": layer.thickness,
        "stroke-linecap": "round",
      });
    }

    case "shape": {
      const fill = resolve(layer.fill);
      const stroke = resolve(layer.stroke);
      const t = transform({
        translate: [layer.x, layer.y],
        rotate: layer.rotation || undefined,
        scale: layer.scale !== 1 ? layer.scale : undefined,
      });
      const w = layer.width;
      const h = layer.height;
      let shape: string;
      switch (layer.shape) {
        case "circle":
          shape = tag("ellipse", { cx: 0, cy: 0, rx: w / 2, ry: h / 2, fill, stroke, "stroke-width": layer.strokeWidth });
          break;
        case "line":
          shape = tag("line", { x1: -w / 2, y1: 0, x2: w / 2, y2: 0, stroke, "stroke-width": layer.strokeWidth, "stroke-linecap": "round" });
          break;
        case "triangle":
          shape = tag("path", { d: `M0 ${n(-h / 2)} L${n(w / 2)} ${n(h / 2)} L${n(-w / 2)} ${n(h / 2)} Z`, fill, stroke, "stroke-width": layer.strokeWidth });
          break;
        case "hexagon": {
          const pts: string[] = [];
          for (let i = 0; i < 6; i++) {
            const a = ((-90 + 60 * i) * Math.PI) / 180;
            pts.push(`${i === 0 ? "M" : "L"}${n((w / 2) * Math.cos(a))} ${n((h / 2) * Math.sin(a))}`);
          }
          shape = tag("path", { d: `${pts.join(" ")} Z`, fill, stroke, "stroke-width": layer.strokeWidth });
          break;
        }
        case "arch":
          shape = tag("path", {
            d: `M${n(-w / 2)} ${n(h / 2)} V${n(-h / 6)} A${n(w / 2)} ${n(h / 2.2)} 0 0 1 ${n(w / 2)} ${n(-h / 6)} V${n(h / 2)} Z`,
            fill,
            stroke,
            "stroke-width": layer.strokeWidth,
          });
          break;
        default:
          shape = rect({
            x: -w / 2,
            y: -h / 2,
            width: w,
            height: h,
            rx: layer.radius,
            fill,
            stroke,
            "stroke-width": layer.strokeWidth,
          });
      }
      return group({ ...common, transform: t }, shape);
    }
  }
}

// ---------------------------------------------------------------------------
// Variation set
// ---------------------------------------------------------------------------

/** Builds all eight variations for a freshly generated identity. */
export function buildAllVariations(
  spec: BrandIdentitySpec,
): Record<LogoVariation, LogoDocument> {
  const variations: LogoVariation[] = [
    "primary",
    "secondary",
    "horizontal",
    "vertical",
    "icon",
    "black",
    "white",
    "monochrome",
  ];
  return Object.fromEntries(
    variations.map((v) => [v, buildLogoDocument(spec, v)]),
  ) as Record<LogoVariation, LogoDocument>;
}

export const VARIATION_LABELS: Record<LogoVariation, string> = {
  primary: "Primary",
  secondary: "Secondary",
  horizontal: "Horizontal",
  vertical: "Vertical",
  icon: "Icon only",
  black: "One-colour black",
  white: "One-colour white",
  monochrome: "Greyscale",
};

export const VARIATION_HINTS: Record<LogoVariation, string> = {
  primary: "Your default. Use this everywhere unless the space forces otherwise.",
  secondary: "The alternate proportion, for layouts the primary doesn't fit.",
  horizontal: "Wide spaces: website headers, letterheads, email signatures.",
  vertical: "Tall or square spaces: signage, packaging faces, posters.",
  icon: "App icons, favicons, profile pictures, WhatsApp display picture.",
  black: "Single-colour printing, rubber stamps, fax forms, newspaper ads.",
  white: "Reversed out of photographs and dark backgrounds.",
  monochrome: "Greyscale reproduction — invoices, forms, laser printing.",
};
