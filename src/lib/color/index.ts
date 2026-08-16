/**
 * Colour utilities.
 *
 * Everything the platform knows about colour lives here: conversion, contrast,
 * harmony and CMYK. The quality scorer and the palette generator both depend on
 * it, which is why contrast is computed properly (WCAG relative luminance)
 * rather than by eyeballing lightness.
 */

export type RGB = [number, number, number];
export type HSL = [number, number, number];
export type CMYK = [number, number, number, number];

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export function normalizeHex(input: string): string {
  let hex = input.trim().replace(/^#/, "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "#000000";
  return `#${hex.toLowerCase()}`;
}

export function isValidHex(input: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(input.trim());
}

export function hexToRgb(hex: string): RGB {
  const h = normalizeHex(hex).slice(1);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgbToHex([r, g, b]: RGB): string {
  const to = (v: number) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function rgbToHsl([r, g, b]: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h * 360, s, l];
}

export function hslToRgb([h, s, l]: HSL): RGB {
  const hn = ((h % 360) + 360) % 360 / 360;
  const sn = clamp(s);
  const ln = clamp(l);
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return [v, v, v];
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const channel = (t: number) => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };
  return [
    Math.round(channel(hn + 1 / 3) * 255),
    Math.round(channel(hn) * 255),
    Math.round(channel(hn - 1 / 3) * 255),
  ];
}

export const hexToHsl = (hex: string): HSL => rgbToHsl(hexToRgb(hex));
export const hslToHex = (hsl: HSL): string => rgbToHex(hslToRgb(hsl));

/**
 * Naive device-independent CMYK. Real print work uses an ICC profile, and the
 * brand guidelines PDF says so explicitly next to these values rather than
 * pretending they are press-ready separations.
 */
export function rgbToCmyk([r, g, b]: RGB): CMYK {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k === 1) return [0, 0, 0, 100];
  const c = (1 - rn - k) / (1 - k);
  const m = (1 - gn - k) / (1 - k);
  const y = (1 - bn - k) / (1 - k);
  return [
    Math.round(c * 100),
    Math.round(m * 100),
    Math.round(y * 100),
    Math.round(k * 100),
  ];
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as RGB;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Picks whichever of `light`/`dark` reads better on `bg`. */
export function readableOn(bg: string, light = "#ffffff", dark = "#101014"): string {
  return contrastRatio(bg, light) >= contrastRatio(bg, dark) ? light : dark;
}

export function lighten(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex([h, s, clamp(l + amount)]);
}

export function darken(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex([h, s, clamp(l - amount)]);
}

export function saturate(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex([h, clamp(s + amount), l]);
}

export function rotateHue(hex: string, degrees: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex([h + degrees, s, l]);
}

export function toGrayscale(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  // Luma-weighted, matching how a black-and-white press reproduction behaves.
  const v = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  return rgbToHex([v, v, v]);
}

/** Adjusts `fg` toward black/white until it clears `target` contrast on `bg`. */
export function ensureContrast(fg: string, bg: string, target = 4.5): string {
  if (contrastRatio(fg, bg) >= target) return fg;
  const bgLum = relativeLuminance(bg);
  const goDarker = bgLum > 0.4;
  const [h, s, startL] = hexToHsl(fg);
  let l = startL;
  for (let i = 0; i < 40; i++) {
    l = clamp(goDarker ? l - 0.025 : l + 0.025);
    const candidate = hslToHex([h, s, l]);
    if (contrastRatio(candidate, bg) >= target) return candidate;
    if (l <= 0 || l >= 1) break;
  }
  return goDarker ? "#000000" : "#ffffff";
}

export type HarmonyKind = "analogous" | "complementary" | "triadic" | "split" | "monochrome";

/** Returns accent-hue candidates for a base colour. */
export function harmonize(hex: string, kind: HarmonyKind): string[] {
  const [h, s, l] = hexToHsl(hex);
  switch (kind) {
    case "analogous":
      return [hslToHex([h + 28, s, l]), hslToHex([h - 28, s, l])];
    case "complementary":
      return [hslToHex([h + 180, clamp(s * 0.92), l])];
    case "triadic":
      return [hslToHex([h + 120, s, l]), hslToHex([h + 240, s, l])];
    case "split":
      return [hslToHex([h + 150, s, l]), hslToHex([h + 210, s, l])];
    case "monochrome":
      return [hslToHex([h, clamp(s * 0.6), clamp(l + 0.18)]), hslToHex([h, s, clamp(l - 0.18)])];
  }
}

/** Human-readable colour family, used to write the colour-psychology copy. */
export function colorFamily(hex: string): string {
  const [h, s, l] = hexToHsl(hex);
  if (l < 0.12) return "near-black";
  if (l > 0.92 && s < 0.15) return "off-white";
  if (s < 0.12) return "neutral grey";
  if (h < 15 || h >= 345) return "red";
  if (h < 40) return "orange";
  if (h < 65) return "gold";
  if (h < 95) return "lime";
  if (h < 160) return "green";
  if (h < 195) return "teal";
  if (h < 250) return "blue";
  if (h < 290) return "violet";
  if (h < 330) return "magenta";
  return "crimson";
}
