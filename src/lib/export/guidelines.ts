import { buildLogoDocument, renderLogo, VARIATION_HINTS, VARIATION_LABELS } from "@/lib/render/logo";
import { patternSwatch, PATTERN_LABELS, PATTERN_USAGE } from "@/lib/render/patterns";
import { contrastMatrix } from "@/lib/brand/palettes";
import { describeTypography } from "@/lib/brand/typography";
import { GRADE_LABELS } from "@/lib/brand/quality";
import { colorResolver, group, n, rect, svgDoc, tag, text } from "@/lib/render/svg";
import { textBlock } from "@/lib/render/assets/kit";
import { COLOR_ROLES, type BrandIdentitySpec, type BrandStrategy, type QualityReport } from "@/types/brand";
import type { AssetDimension } from "@/types/brand";

/**
 * The brand guidelines document.
 *
 * Generated as A4 SVG pages that the PDF pipeline turns into a real vector
 * document — so the guidelines themselves are set in the brand's own
 * typefaces, which is both the point and the proof that the system works.
 */

const A4: AssetDimension = {
  width: 595,
  height: 842,
  widthMm: 210,
  heightMm: 297,
  dpi: 300,
  bleedMm: 0,
  label: "A4",
  print: true,
};

const MARGIN = 48;
const CONTENT_W = A4.width - MARGIN * 2;

interface PageCtx {
  spec: BrandIdentitySpec;
  resolve: ReturnType<typeof colorResolver>;
  pageNumber: number;
  totalPages: number;
}

function pageChrome(ctx: PageCtx, title: string): string {
  const { spec, resolve } = ctx;
  return (
    rect({ x: 0, y: 0, width: A4.width, height: A4.height, fill: resolve("surface") }) +
    text({
      x: MARGIN,
      y: MARGIN * 0.7,
      text: spec.name,
      family: spec.typography.body.family,
      size: 8,
      weight: 600,
      fill: resolve("muted"),
      letterSpacing: 0.14,
      transform: "uppercase",
    }) +
    text({
      x: A4.width - MARGIN,
      y: MARGIN * 0.7,
      text: title,
      family: spec.typography.body.family,
      size: 8,
      weight: 400,
      fill: resolve("muted"),
      anchor: "end",
      letterSpacing: 0.14,
      transform: "uppercase",
    }) +
    tag("line", {
      x1: MARGIN, y1: MARGIN * 0.85, x2: A4.width - MARGIN, y2: MARGIN * 0.85,
      stroke: resolve("muted"), "stroke-width": 0.5, opacity: 0.3,
    }) +
    text({
      x: A4.width / 2,
      y: A4.height - MARGIN * 0.55,
      text: `${ctx.pageNumber} / ${ctx.totalPages}`,
      family: spec.typography.body.family,
      size: 8,
      weight: 400,
      fill: resolve("muted"),
      anchor: "middle",
    })
  );
}

function heading(ctx: PageCtx, y: number, title: string, sub?: string): { svg: string; y: number } {
  const { spec, resolve } = ctx;
  let out = text({
    x: MARGIN, y, text: title,
    family: spec.typography.display.family, size: 26,
    weight: spec.typography.display.weight, fill: resolve("ink"),
    letterSpacing: spec.typography.display.letterSpacing,
  });
  let next = y + 18;
  if (sub) {
    const block = textBlock(sub, {
      x: MARGIN, y: next, maxWidth: CONTENT_W, size: 9.5, lineHeight: 1.5,
      family: spec.typography.body.family, weight: 400, fill: resolve("muted"), maxLines: 4,
    });
    out += block.svg;
    next += block.height;
  }
  return { svg: out, y: next + 14 };
}

/** Strips the light markdown emphasis the narrative generators emit. */
const plain = (s: string) => s.replace(/\*\*/g, "");

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function coverPage(ctx: PageCtx, strategy: BrandStrategy): string {
  const { spec, resolve } = ctx;
  const doc = buildLogoDocument(spec, "primary");
  const scale = Math.min((CONTENT_W * 0.62) / doc.width, 260 / doc.height);

  const logoLayer = renderLogo({ doc, spec })
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "");

  return (
    rect({ x: 0, y: 0, width: A4.width, height: A4.height, fill: resolve("surface") }) +
    rect({ x: 0, y: 0, width: A4.width, height: 6, fill: resolve("primary") }) +
    group(
      {
        transform: `translate(${n((A4.width - doc.width * scale) / 2)} ${n(200)}) scale(${n(scale)})`,
      },
      logoLayer,
    ) +
    text({
      x: A4.width / 2, y: 520, text: "Brand Guidelines",
      family: spec.typography.display.family, size: 30,
      weight: spec.typography.display.weight, fill: resolve("ink"), anchor: "middle",
      letterSpacing: spec.typography.display.letterSpacing,
    }) +
    text({
      x: A4.width / 2, y: 548, text: new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      family: spec.typography.body.family, size: 10, weight: 400,
      fill: resolve("muted"), anchor: "middle",
    }) +
    textBlock(strategy.positioning, {
      x: A4.width / 2, y: 600, maxWidth: CONTENT_W * 0.8, size: 10.5, lineHeight: 1.6,
      family: spec.typography.body.family, weight: 400, fill: resolve("ink"),
      anchor: "middle", maxLines: 5,
    }).svg +
    rect({ x: 0, y: A4.height - 6, width: A4.width, height: 6, fill: resolve("accent") })
  );
}

function logoPage(ctx: PageCtx): string {
  const { spec, resolve } = ctx;
  const parts = [pageChrome(ctx, "Logo")];
  const head = heading(
    ctx,
    MARGIN + 46,
    "The logo",
    "Eight variations, one system. Pick by the space you are filling, not by preference — each exists for a specific job.",
  );
  parts.push(head.svg);

  const variations = ["primary", "horizontal", "vertical", "icon", "black", "white"] as const;
  const cols = 2;
  const cellW = CONTENT_W / cols;
  const cellH = 118;

  variations.forEach((variation, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * cellW;
    const y = head.y + row * cellH;
    const dark = variation === "white";

    parts.push(
      rect({
        x: x + 4, y, width: cellW - 12, height: cellH - 26,
        fill: dark ? resolve("ink") : resolve("surfaceAlt"),
        rx: 4,
      }),
    );

    const doc = buildLogoDocument(spec, variation);
    const box = { w: cellW - 40, h: cellH - 52 };
    const scale = Math.min(box.w / doc.width, box.h / doc.height);
    const inner = renderLogo({ doc, spec }).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");

    parts.push(
      group(
        {
          transform:
            `translate(${n(x + (cellW - 12) / 2 - (doc.width * scale) / 2 + 4)} ` +
            `${n(y + (cellH - 26) / 2 - (doc.height * scale) / 2)}) scale(${n(scale)})`,
        },
        inner,
      ),
      text({
        x: x + 6, y: y + cellH - 14, text: VARIATION_LABELS[variation],
        family: spec.typography.body.family, size: 8.5, weight: 600, fill: resolve("ink"),
      }),
      text({
        x: x + 6, y: y + cellH - 5, text: VARIATION_HINTS[variation],
        family: spec.typography.body.family, size: 6.8, weight: 400, fill: resolve("muted"),
      }),
    );
  });

  return parts.join("");
}

function colorPage(ctx: PageCtx, strategy: BrandStrategy): string {
  const { spec, resolve } = ctx;
  const parts = [pageChrome(ctx, "Colour")];
  const head = heading(ctx, MARGIN + 46, "Colour", plain(strategy.colorPsychology));
  parts.push(head.svg);

  let y = head.y;
  const swatchH = 54;

  for (const role of COLOR_ROLES) {
    const color = spec.palette[role];
    parts.push(
      rect({ x: MARGIN, y, width: 92, height: swatchH - 8, fill: color.hex, rx: 3 }),
      text({
        x: MARGIN + 104, y: y + 12, text: color.name,
        family: spec.typography.body.family, size: 10, weight: 600, fill: resolve("ink"),
      }),
      text({
        x: MARGIN + 104, y: y + 25,
        text: `${color.hex.toUpperCase()}   ·   RGB ${color.rgb.join(" ")}   ·   CMYK ${color.cmyk.join(" ")}`,
        family: spec.typography.body.family, size: 7.6, weight: 400, fill: resolve("muted"),
      }),
      text({
        x: MARGIN + 104, y: y + 36, text: `Token: ${role}`,
        family: spec.typography.body.family, size: 7, weight: 400, fill: resolve("muted"), opacity: 0.75,
      }),
    );
    y += swatchH;
  }

  y += 10;
  parts.push(
    text({
      x: MARGIN, y, text: "Contrast",
      family: spec.typography.display.family, size: 13,
      weight: spec.typography.display.weight, fill: resolve("ink"),
    }),
  );
  y += 8;
  parts.push(
    textBlock(
      "Measured to WCAG 2.1. Any pair marked AA is safe for body text; AA Large is for 18pt and above, including the logo.",
      {
        x: MARGIN, y: y + 6, maxWidth: CONTENT_W, size: 8, lineHeight: 1.5,
        family: spec.typography.body.family, weight: 400, fill: resolve("muted"), maxLines: 2,
      },
    ).svg,
  );
  y += 26;

  for (const pair of contrastMatrix(spec.palette)) {
    const verdict = pair.passesAA ? "AA" : pair.passesAALarge ? "AA Large only" : "Fails";
    parts.push(
      text({
        x: MARGIN, y, text: `${pair.fg} on ${pair.bg}`,
        family: spec.typography.body.family, size: 8, weight: 400, fill: resolve("ink"),
      }),
      text({
        x: MARGIN + 190, y, text: `${pair.ratio}:1`,
        family: spec.typography.body.family, size: 8, weight: 600, fill: resolve("ink"),
      }),
      text({
        x: MARGIN + 250, y, text: verdict,
        family: spec.typography.body.family, size: 8, weight: 500,
        fill: pair.passesAA ? resolve("primary") : resolve("muted"),
      }),
    );
    y += 13;
  }

  parts.push(
    textBlock(
      "CMYK values are an unmanaged conversion for reference only. For production printing, ask your press for their ICC profile and convert against it.",
      {
        x: MARGIN, y: A4.height - MARGIN - 24, maxWidth: CONTENT_W, size: 7.2, lineHeight: 1.5,
        family: spec.typography.body.family, weight: 400, fill: resolve("muted"), maxLines: 2,
      },
    ).svg,
  );

  return parts.join("");
}

function typePage(ctx: PageCtx, strategy: BrandStrategy): string {
  const { spec, resolve } = ctx;
  const parts = [pageChrome(ctx, "Typography")];
  const head = heading(ctx, MARGIN + 46, "Typography", plain(describeTypography(spec.typography)));
  parts.push(head.svg);

  let y = head.y + 10;
  const specimens: [string, typeof spec.typography.display, number][] = [
    ["Display", spec.typography.display, 34],
    ["Body", spec.typography.body, 17],
  ];
  if (spec.typography.local) specimens.push(["Local script", spec.typography.local, 26]);

  for (const [label, font, size] of specimens) {
    parts.push(
      text({
        x: MARGIN, y, text: `${label} · ${font.family} ${font.weight}`,
        family: spec.typography.body.family, size: 8, weight: 600,
        fill: resolve("muted"), letterSpacing: 0.12, transform: "uppercase",
      }),
      text({
        x: MARGIN, y: y + size + 6,
        text: label === "Local script" ? (spec.localName ?? spec.name) : spec.name,
        family: font.family, size, weight: font.weight, fill: resolve("ink"),
        letterSpacing: font.letterSpacing, transform: font.transform,
      }),
      text({
        x: MARGIN, y: y + size + 26,
        text: label === "Local script" ? "क ख ग घ  ०१२३४५६७८९" : "ABCDEFGHIJKLM  abcdefghijklm  0123456789  ₹",
        family: font.family, size: 11, weight: 400, fill: resolve("muted"),
      }),
    );
    y += size + 52;
  }

  y += 6;
  parts.push(
    text({
      x: MARGIN, y, text: "Scale",
      family: spec.typography.display.family, size: 13,
      weight: spec.typography.display.weight, fill: resolve("ink"),
    }),
  );
  y += 16;

  const steps = [32, 24, 18, 14, 11, 9];
  for (const step of steps) {
    parts.push(
      text({
        x: MARGIN, y, text: `${step}pt`,
        family: spec.typography.body.family, size: 7.5, weight: 400, fill: resolve("muted"),
      }),
      text({
        x: MARGIN + 40, y, text: "Build a brand, not just a logo",
        family: step >= 18 ? spec.typography.display.family : spec.typography.body.family,
        size: step, weight: step >= 18 ? spec.typography.display.weight : 400, fill: resolve("ink"),
      }),
    );
    y += step + 10;
  }

  return parts.join("");
}

function patternPage(ctx: PageCtx): string {
  const { spec, resolve } = ctx;
  const parts = [pageChrome(ctx, "Patterns")];
  const head = heading(
    ctx,
    MARGIN + 46,
    "Patterns",
    "Derived from the identity, not decoration. Use one per surface, and keep them out from under body copy.",
  );
  parts.push(head.svg);

  let y = head.y;
  for (const pattern of spec.patterns) {
    const swatch = patternSwatch(pattern, spec, resolve, 120)
      .replace(/^<svg[^>]*>/, "")
      .replace(/<\/svg>$/, "");

    parts.push(
      group({ transform: `translate(${n(MARGIN)} ${n(y)}) scale(${n(96 / 120)})` }, swatch),
      rect({ x: MARGIN, y, width: 96, height: 96, fill: "none", stroke: resolve("muted"), "stroke-width": 0.5, opacity: 0.3 }),
      text({
        x: MARGIN + 112, y: y + 16, text: PATTERN_LABELS[pattern.kind],
        family: spec.typography.body.family, size: 11, weight: 600, fill: resolve("ink"),
      }),
    );
    parts.push(
      textBlock(PATTERN_USAGE[pattern.kind], {
        x: MARGIN + 112, y: y + 32, maxWidth: CONTENT_W - 112, size: 8.5, lineHeight: 1.5,
        family: spec.typography.body.family, weight: 400, fill: resolve("muted"), maxLines: 3,
      }).svg,
    );
    y += 116;
  }

  return parts.join("");
}

function usagePage(ctx: PageCtx, quality: QualityReport | null): string {
  const { spec, resolve } = ctx;
  const parts = [pageChrome(ctx, "Usage")];
  const head = heading(ctx, MARGIN + 46, "Do and don't", "The rules that keep the brand recognisable when other people apply it.");
  parts.push(head.svg);

  let y = head.y;

  const dos = [
    `Keep clear space of at least ${spec.layout.clearSpace}× the mark's height on every side.`,
    "Use the one-colour variation on rough surfaces — kraft, cloth, corrugate, vinyl.",
    "Reverse to the white variation on photographs and dark backgrounds.",
    "Reproduce the mark no smaller than 12 mm wide in print, 32 px on screen.",
  ];
  const donts = [
    "Don't stretch, squash or rotate the logo.",
    "Don't recolour it outside the palette in this document.",
    "Don't add drop shadows, outlines, bevels or gradients to the mark.",
    "Don't set the name in a different typeface, however close it looks.",
    "Don't place the full-colour logo on a busy photograph — use the white variation.",
  ];

  parts.push(
    text({
      x: MARGIN, y, text: "Do",
      family: spec.typography.display.family, size: 13,
      weight: spec.typography.display.weight, fill: resolve("primary"),
    }),
  );
  y += 16;
  for (const item of dos) {
    const block = textBlock(`•  ${item}`, {
      x: MARGIN, y, maxWidth: CONTENT_W, size: 9, lineHeight: 1.5,
      family: spec.typography.body.family, weight: 400, fill: resolve("ink"), maxLines: 2,
    });
    parts.push(block.svg);
    y += block.height + 5;
  }

  y += 14;
  parts.push(
    text({
      x: MARGIN, y, text: "Don't",
      family: spec.typography.display.family, size: 13,
      weight: spec.typography.display.weight, fill: resolve("ink"),
    }),
  );
  y += 16;
  for (const item of donts) {
    const block = textBlock(`•  ${item}`, {
      x: MARGIN, y, maxWidth: CONTENT_W, size: 9, lineHeight: 1.5,
      family: spec.typography.body.family, weight: 400, fill: resolve("muted"), maxLines: 2,
    });
    parts.push(block.svg);
    y += block.height + 5;
  }

  if (quality) {
    y += 18;
    parts.push(
      rect({ x: MARGIN, y, width: CONTENT_W, height: 58, rx: 4, fill: resolve("surfaceAlt") }),
      text({
        x: MARGIN + 14, y: y + 24, text: `Brand readiness: ${quality.score}/100`,
        family: spec.typography.display.family, size: 16,
        weight: spec.typography.display.weight, fill: resolve("ink"),
      }),
      text({
        x: MARGIN + 14, y: y + 42, text: GRADE_LABELS[quality.grade],
        family: spec.typography.body.family, size: 9, weight: 400, fill: resolve("muted"),
      }),
    );
  }

  return parts.join("");
}

function voicePage(ctx: PageCtx, strategy: BrandStrategy): string {
  const { spec, resolve } = ctx;
  const parts = [pageChrome(ctx, "Voice")];
  const head = heading(ctx, MARGIN + 46, "Brand voice", `Tone: ${strategy.voice.tone.join(" · ")}`);
  parts.push(head.svg);

  let y = head.y;

  const section = (title: string, items: string[]) => {
    parts.push(
      text({
        x: MARGIN, y, text: title,
        family: spec.typography.body.family, size: 8, weight: 600,
        fill: resolve("muted"), letterSpacing: 0.12, transform: "uppercase",
      }),
    );
    y += 14;
    for (const item of items) {
      const block = textBlock(`•  ${item}`, {
        x: MARGIN, y, maxWidth: CONTENT_W, size: 9, lineHeight: 1.5,
        family: spec.typography.body.family, weight: 400, fill: resolve("ink"), maxLines: 3,
      });
      parts.push(block.svg);
      y += block.height + 5;
    }
    y += 12;
  };

  section("Do", strategy.voice.dos);
  section("Don't", strategy.voice.donts);

  parts.push(
    rect({ x: MARGIN, y, width: CONTENT_W, height: 72, rx: 4, fill: resolve("surfaceAlt") }),
    text({
      x: MARGIN + 14, y: y + 18, text: "INSTAGRAM CAPTION",
      family: spec.typography.body.family, size: 7, weight: 600,
      fill: resolve("muted"), letterSpacing: 0.14,
    }),
  );
  parts.push(
    textBlock(strategy.voice.sampleCaption, {
      x: MARGIN + 14, y: y + 36, maxWidth: CONTENT_W - 28, size: 10, lineHeight: 1.5,
      family: spec.typography.body.family, weight: 400, fill: resolve("ink"), maxLines: 3,
      script: spec.script,
    }).svg,
  );
  y += 86;

  parts.push(
    rect({ x: MARGIN, y, width: CONTENT_W, height: 72, rx: 4, fill: resolve("surfaceAlt") }),
    text({
      x: MARGIN + 14, y: y + 18, text: "WHATSAPP GREETING",
      family: spec.typography.body.family, size: 7, weight: 600,
      fill: resolve("muted"), letterSpacing: 0.14,
    }),
  );
  parts.push(
    textBlock(strategy.voice.sampleWhatsApp, {
      x: MARGIN + 14, y: y + 36, maxWidth: CONTENT_W - 28, size: 10, lineHeight: 1.5,
      family: spec.typography.body.family, weight: 400, fill: resolve("ink"), maxLines: 3,
      script: spec.script,
    }).svg,
  );

  return parts.join("");
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export interface GuidelinesInput {
  spec: BrandIdentitySpec;
  strategy: BrandStrategy;
  quality: QualityReport | null;
}

/** Every guidelines page as a standalone A4 SVG. */
export function guidelinePages({ spec, strategy, quality }: GuidelinesInput): string[] {
  const resolve = colorResolver(spec, "brand");
  const builders = [
    (ctx: PageCtx) => coverPage(ctx, strategy),
    (ctx: PageCtx) => logoPage(ctx),
    (ctx: PageCtx) => colorPage(ctx, strategy),
    (ctx: PageCtx) => typePage(ctx, strategy),
    (ctx: PageCtx) => patternPage(ctx),
    (ctx: PageCtx) => usagePage(ctx, quality),
    (ctx: PageCtx) => voicePage(ctx, strategy),
  ];

  return builders.map((build, i) => {
    const ctx: PageCtx = { spec, resolve, pageNumber: i + 1, totalPages: builders.length };
    return svgDoc(
      { width: A4.width, height: A4.height, title: `${spec.name} brand guidelines — page ${i + 1}` },
      build(ctx),
    );
  });
}

export const GUIDELINES_PAGE_SIZE = A4;
