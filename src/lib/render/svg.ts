import { toGrayscale } from "@/lib/color";
import type { BrandIdentitySpec, ColorRole, LogoDocument } from "@/types/brand";

/**
 * SVG primitives.
 *
 * Everything the platform draws is a string built here. Two rules make that
 * safe: all text is escaped, and all colours pass through `colorResolver`, so a
 * black-and-white variation cannot leak a brand colour and a business name
 * containing an ampersand cannot produce invalid markup.
 */

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** Escapes text content and attribute values. */
export function esc(value: string): string {
  return String(value).replace(/[&<>"']/g, (c) => XML_ESCAPES[c]!);
}

/** Numbers in path data — trimmed so output stays compact and diffable. */
export function n(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return String(Math.round(value * 1000) / 1000);
}

// ---------------------------------------------------------------------------
// Attribute building
// ---------------------------------------------------------------------------

export type Attrs = Record<string, string | number | undefined | null | false>;

export function attrs(input: Attrs): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === false) continue;
    parts.push(`${key}="${esc(typeof value === "number" ? n(value) : String(value))}"`);
  }
  return parts.length ? ` ${parts.join(" ")}` : "";
}

export function tag(name: string, a: Attrs, children?: string): string {
  return children === undefined
    ? `<${name}${attrs(a)}/>`
    : `<${name}${attrs(a)}>${children}</${name}>`;
}

export const group = (a: Attrs, children: string) => tag("g", a, children);
export const path = (d: string, a: Attrs = {}) => tag("path", { d, ...a });
export const rect = (a: Attrs) => tag("rect", a);
export const circle = (a: Attrs) => tag("circle", a);
export const line = (a: Attrs) => tag("line", a);

// ---------------------------------------------------------------------------
// Colour resolution
// ---------------------------------------------------------------------------

export type ColorMode = LogoDocument["colorMode"];

/**
 * Maps a colour token (a role name like `primary`, or a literal hex) to the hex
 * that should actually be drawn, honouring the document's colour mode.
 *
 * This is the mechanism behind the black / white / monochrome logo variations:
 * the same document renders differently because the resolver is swapped, so the
 * variations can never drift out of sync with the primary logo.
 */
export function colorResolver(spec: BrandIdentitySpec, mode: ColorMode = "brand") {
  const palette = spec.palette;

  return (token: ColorRole | string | "none" | undefined): string => {
    if (!token || token === "none") return "none";

    const literal = token.startsWith("#") ? token : palette[token as ColorRole]?.hex;
    const hex = literal ?? String(token);

    switch (mode) {
      case "brand":
        return hex;
      case "black":
        // One-colour black: anything that was a light surface stays light so
        // knockouts still work; everything else collapses to black.
        return isLightToken(token, spec) ? "#ffffff" : "#000000";
      case "white":
        return isLightToken(token, spec) ? "#000000" : "#ffffff";
      case "monochrome":
        return toGrayscale(hex);
    }
  };
}

function isLightToken(token: string, spec: BrandIdentitySpec): boolean {
  if (token === "surface" || token === "surfaceAlt" || token === "primaryLight") return true;
  if (token === "transparent") return true;
  if (token.startsWith("#")) {
    const hexToken = token.toLowerCase();
    return hexToken === "#ffffff" || hexToken === "#fff";
  }
  return spec.palette[token as ColorRole] === spec.palette.surface;
}

export type Resolve = ReturnType<typeof colorResolver>;

// ---------------------------------------------------------------------------
// Document assembly
// ---------------------------------------------------------------------------

export interface SvgDocOptions {
  width: number;
  height: number;
  /** Defaults to `0 0 width height`. */
  viewBox?: string;
  defs?: string;
  /** Background fill; omit for transparency. */
  background?: string;
  /** Rendered into <title> for accessibility and file metadata. */
  title?: string;
  /** Extra attributes on the root element. */
  root?: Attrs;
}

export function svgDoc(options: SvgDocOptions, children: string): string {
  const { width, height, viewBox, defs, background, title, root } = options;
  const parts: string[] = [];

  if (title) parts.push(tag("title", {}, esc(title)));
  if (defs) parts.push(tag("defs", {}, defs));
  if (background && background !== "transparent") {
    parts.push(rect({ x: 0, y: 0, width, height, fill: background }));
  }
  parts.push(children);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${n(width)}" height="${n(height)}" viewBox="${viewBox ?? `0 0 ${n(width)} ${n(height)}`}" ` +
    `fill="none"${attrs(root ?? {})}>${parts.join("")}</svg>`
  );
}

/** Data URI for <img src>. `encodeURIComponent` beats base64 for SVG size. */
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ---------------------------------------------------------------------------
// Transforms
// ---------------------------------------------------------------------------

export function transform(parts: {
  translate?: [number, number];
  rotate?: number | [number, number, number];
  scale?: number | [number, number];
}): string | undefined {
  const out: string[] = [];
  if (parts.translate) out.push(`translate(${n(parts.translate[0])} ${n(parts.translate[1])})`);
  if (parts.rotate !== undefined) {
    out.push(
      Array.isArray(parts.rotate)
        ? `rotate(${parts.rotate.map(n).join(" ")})`
        : `rotate(${n(parts.rotate)})`,
    );
  }
  if (parts.scale !== undefined) {
    out.push(
      Array.isArray(parts.scale)
        ? `scale(${n(parts.scale[0])} ${n(parts.scale[1])})`
        : `scale(${n(parts.scale)})`,
    );
  }
  return out.length ? out.join(" ") : undefined;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export interface TextOptions {
  x: number;
  y: number;
  text: string;
  family: string;
  size: number;
  weight: number;
  fill: string;
  letterSpacing?: number;
  anchor?: "start" | "middle" | "end";
  transform?: "none" | "uppercase" | "lowercase";
  opacity?: number;
  /** Baseline handling; `central` is convenient for vertically centred labels. */
  dominantBaseline?: string;
}

export function text(options: TextOptions): string {
  const content =
    options.transform === "uppercase"
      ? options.text.toUpperCase()
      : options.transform === "lowercase"
        ? options.text.toLowerCase()
        : options.text;

  return tag(
    "text",
    {
      x: options.x,
      y: options.y,
      "font-family": options.family,
      "font-size": options.size,
      "font-weight": options.weight,
      fill: options.fill,
      // Expressed in px so it survives the SVG → PDF conversion, which has no
      // notion of em-relative tracking.
      "letter-spacing":
        options.letterSpacing !== undefined && options.letterSpacing !== 0
          ? n(options.letterSpacing * options.size)
          : undefined,
      "text-anchor": options.anchor ?? "start",
      "dominant-baseline": options.dominantBaseline,
      opacity: options.opacity !== undefined && options.opacity < 1 ? options.opacity : undefined,
      "xml:space": "preserve",
    },
    esc(content),
  );
}

/**
 * Advance-width estimate for a string.
 *
 * Real metrics need the font file, which is available server-side but not in
 * the studio's live preview. These per-class averages are accurate to roughly
 * ±8%, which is enough to centre a lockup and to warn the quality checker that
 * a name is too long — and the PDF pipeline measures properly with the embedded
 * font when exact placement matters.
 */
export function estimateTextWidth(
  content: string,
  size: number,
  opts: { weight?: number; letterSpacing?: number; serif?: boolean; script?: string } = {},
): number {
  const { weight = 400, letterSpacing = 0, serif = false, script = "latin" } = opts;

  // Indic scripts carry matras and conjuncts that widen the average advance.
  const scriptFactor = script === "latin" ? 1 : 1.12;
  const weightFactor = 1 + (weight - 400) / 4000;
  const serifFactor = serif ? 1.02 : 1;

  let units = 0;
  for (const ch of content) {
    if (ch === " ") units += 0.28;
    else if (/[iIlJjft.,;:'"!|]/.test(ch)) units += 0.32;
    else if (/[mwMW]/.test(ch)) units += 0.86;
    else if (/[A-Z]/.test(ch)) units += 0.66;
    else if (/[0-9]/.test(ch)) units += 0.56;
    else if (/[a-z]/.test(ch)) units += 0.52;
    else units += 0.6;
  }

  return units * size * scriptFactor * weightFactor * serifFactor + letterSpacing * size * Math.max(0, content.length - 1);
}

// ---------------------------------------------------------------------------
// Clip / mask helpers
// ---------------------------------------------------------------------------

let idCounter = 0;
/** Collision-free ids for defs within a single document. */
export function uid(prefix = "id"): string {
  idCounter = (idCounter + 1) % 1_000_000;
  return `${prefix}${idCounter.toString(36)}`;
}

/** Resets the counter so server renders are byte-stable across requests. */
export function resetUid(): void {
  idCounter = 0;
}
