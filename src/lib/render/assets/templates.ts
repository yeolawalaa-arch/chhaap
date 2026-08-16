import { renderPattern } from "@/lib/render/patterns";
import { renderMark } from "@/lib/render/mark";
import { isSerifDisplay } from "@/lib/render/mark";
import { trimBox } from "@/lib/render/dimensions";
import {
  circle,
  estimateTextWidth,
  group,
  n,
  rect,
  svgDoc,
  tag,
  text,
} from "@/lib/render/svg";
import {
  bool,
  cropMarks,
  inr,
  list,
  patternBackground,
  placeLogo,
  safe,
  solidBackground,
  str,
  textBlock,
  watermark,
  type AssetCtx,
} from "@/lib/render/assets/kit";
import type { AssetKind } from "@/types/brand";

/**
 * Asset templates.
 *
 * Each function returns the body of an SVG document plus any defs it needs.
 * They share the identity through `AssetCtx`, so colour, type and mark are
 * never re-decided here — a template only decides *arrangement*.
 */

export interface TemplateOutput {
  defs?: string;
  body: string;
}

type Template = (ctx: AssetCtx) => TemplateOutput;

// ===========================================================================
// Print & stationery
// ===========================================================================

const visitingCard: Template = (ctx) => {
  const { dim, resolve, spec, data } = ctx;
  const area = safe(ctx, 4);
  const trim = trimBox(dim);
  const body: string[] = [];
  let defs = "";

  // Full-bleed colour field on the left third; the logo sits on the light side
  // so it stays legible whichever way the card is picked up.
  const bandW = dim.width * 0.36;
  body.push(solidBackground(ctx, resolve("surface")));
  body.push(rect({ x: 0, y: 0, width: bandW, height: dim.height, fill: resolve("primary") }));

  if (bool(data, "showPattern", true) && spec.patterns[0]) {
    const { def, fill } = renderPattern(spec.patterns[0], spec, resolve, { opacity: 0.14, scale: 0.5, foreground: resolve("surface") });
    defs += def;
    body.push(rect({ x: 0, y: 0, width: bandW, height: dim.height, fill }));
  }

  body.push(
    placeLogo(ctx, "icon", { x: 0, y: 0, width: bandW, height: dim.height }, { onField: resolve("primary") }),
  );

  // Right side: name block then contact block, hung off the same left edge.
  const x = bandW + area.x * 1.1;
  const rightW = trim.x + trim.width - x - area.x * 0.6;
  let y = area.y + dim.height * 0.14;

  const nameSize = dim.height * 0.082;
  body.push(
    text({
      x,
      y,
      text: str(data, "personName", spec.name),
      family: spec.typography.display.family,
      size: nameSize,
      weight: 700,
      fill: resolve("ink"),
    }),
  );
  y += nameSize * 0.95;

  const role = str(data, "role");
  if (role) {
    body.push(
      text({
        x,
        y,
        text: role,
        family: spec.typography.body.family,
        size: nameSize * 0.46,
        weight: 500,
        fill: resolve("primary"),
        letterSpacing: 0.1,
        transform: "uppercase",
      }),
    );
    y += nameSize * 0.7;
  }

  body.push(
    tag("line", {
      x1: x,
      y1: y,
      x2: x + rightW * 0.3,
      y2: y,
      stroke: resolve("accent"),
      "stroke-width": Math.max(1, dim.height * 0.008),
    }),
  );
  y += dim.height * 0.09;

  const lineSize = dim.height * 0.044;
  const contacts = [
    str(data, "phone"),
    str(data, "email"),
    str(data, "website"),
  ].filter(Boolean);

  for (const lineText of contacts) {
    body.push(
      text({
        x,
        y,
        text: lineText,
        family: spec.typography.body.family,
        size: lineSize,
        weight: 400,
        fill: resolve("ink"),
      }),
    );
    y += lineSize * 1.55;
  }

  const address = str(data, "address");
  if (address) {
    const block = textBlock(address, {
      x,
      y,
      maxWidth: rightW,
      size: lineSize * 0.88,
      family: spec.typography.body.family,
      weight: 400,
      fill: resolve("muted"),
      maxLines: 2,
    });
    body.push(block.svg);
    y += block.height;
  }

  const gstin = str(data, "gstin");
  if (gstin) {
    body.push(
      text({
        x,
        y: trim.y + trim.height - area.y * 0.5,
        text: `GSTIN ${gstin}`,
        family: spec.typography.body.family,
        size: lineSize * 0.8,
        weight: 400,
        fill: resolve("muted"),
      }),
    );
  }

  body.push(cropMarks(ctx), watermark(ctx));
  return { defs, body: body.join("") };
};

const letterhead: Template = (ctx) => {
  const { dim, resolve, spec, data } = ctx;
  const area = safe(ctx, 12);
  const body: string[] = [];
  let defs = "";

  body.push(solidBackground(ctx, resolve("surface")));

  // Header band
  const headerH = dim.height * 0.115;
  body.push(rect({ x: 0, y: 0, width: dim.width, height: headerH, fill: resolve("primary") }));
  if (spec.patterns[0]) {
    const { def, fill } = renderPattern(spec.patterns[0], spec, resolve, { opacity: 0.12, scale: 0.6, foreground: resolve("surface") });
    defs += def;
    body.push(rect({ x: 0, y: 0, width: dim.width, height: headerH, fill }));
  }
  body.push(
    placeLogo(ctx, "horizontal", {
      x: area.x,
      y: headerH * 0.16,
      width: dim.width * 0.44,
      height: headerH * 0.68,
    }, { align: "start", onField: resolve("primary") }),
  );

  const metaSize = dim.height * 0.0105;
  const metaLines = [str(data, "phone"), str(data, "email"), str(data, "website")].filter(Boolean);
  metaLines.forEach((lineText, i) => {
    body.push(
      text({
        x: dim.width - area.x,
        y: headerH * 0.42 + i * metaSize * 1.5,
        text: lineText,
        family: spec.typography.body.family,
        size: metaSize,
        weight: 400,
        fill: resolve("surface"),
        anchor: "end",
        opacity: 0.92,
      }),
    );
  });

  // Accent rule under the header
  body.push(rect({ x: 0, y: headerH, width: dim.width, height: dim.height * 0.006, fill: resolve("accent") }));

  // Body ruled area — shown as light guides so the user sees where text goes.
  const bodyTop = headerH + dim.height * 0.09;
  const bodyBottom = dim.height - dim.height * 0.1;
  for (let i = 0; i < 16; i++) {
    const y = bodyTop + i * ((bodyBottom - bodyTop) / 16);
    if (y > bodyBottom) break;
    body.push(
      tag("line", {
        x1: area.x,
        y1: y,
        x2: dim.width - area.x,
        y2: y,
        stroke: resolve("muted"),
        "stroke-width": 0.5,
        opacity: 0.16,
      }),
    );
  }

  // Footer
  const footY = dim.height - dim.height * 0.055;
  body.push(
    tag("line", {
      x1: area.x,
      y1: footY - metaSize * 1.6,
      x2: dim.width - area.x,
      y2: footY - metaSize * 1.6,
      stroke: resolve("primary"),
      "stroke-width": 1,
      opacity: 0.35,
    }),
  );
  const footParts = [str(data, "address"), str(data, "gstin") ? `GSTIN ${str(data, "gstin")}` : ""]
    .filter(Boolean)
    .join("   ·   ");
  body.push(
    text({
      x: dim.width / 2,
      y: footY,
      text: footParts,
      family: spec.typography.body.family,
      size: metaSize * 0.92,
      weight: 400,
      fill: resolve("muted"),
      anchor: "middle",
    }),
  );

  body.push(cropMarks(ctx), watermark(ctx));
  return { defs, body: body.join("") };
};

const invoice: Template = (ctx) => {
  const { dim, resolve, spec, data } = ctx;
  const area = safe(ctx, 10);
  const body: string[] = [];
  const S = dim.height * 0.0105;

  body.push(solidBackground(ctx, resolve("surface")));

  // Header
  body.push(
    placeLogo(ctx, "horizontal", { x: area.x, y: area.y, width: dim.width * 0.4, height: dim.height * 0.058 }, { align: "start" }),
  );
  body.push(
    text({
      x: dim.width - area.x,
      y: area.y + S * 2,
      text: "TAX INVOICE",
      family: spec.typography.display.family,
      size: S * 2,
      weight: 700,
      fill: resolve("primary"),
      anchor: "end",
      letterSpacing: 0.06,
    }),
  );

  let y = area.y + dim.height * 0.085;

  // Seller / buyer blocks
  const colW = (dim.width - area.x * 2) / 2 - S;
  const sellerLines = [
    spec.name,
    str(data, "address"),
    str(data, "phone"),
    str(data, "gstin") ? `GSTIN: ${str(data, "gstin")}` : "",
  ].filter(Boolean);

  body.push(
    text({ x: area.x, y, text: "FROM", family: spec.typography.body.family, size: S * 0.82, weight: 600, fill: resolve("muted"), letterSpacing: 0.1 }),
    text({ x: area.x + colW + S * 2, y, text: "BILL TO", family: spec.typography.body.family, size: S * 0.82, weight: 600, fill: resolve("muted"), letterSpacing: 0.1 }),
  );
  y += S * 1.8;

  let sellerY = y;
  for (const lineText of sellerLines) {
    const block = textBlock(lineText, {
      x: area.x, y: sellerY, maxWidth: colW, size: S,
      family: spec.typography.body.family, weight: lineText === spec.name ? 600 : 400,
      fill: lineText === spec.name ? resolve("ink") : resolve("muted"), maxLines: 2,
    });
    body.push(block.svg);
    sellerY += block.height + S * 0.25;
  }

  const buyerY = y;
  ["Customer name", "Customer address", "GSTIN: —"].forEach((placeholder, i) => {
    body.push(
      text({
        x: area.x + colW + S * 2, y: buyerY + i * S * 1.6, text: placeholder,
        family: spec.typography.body.family, size: S, weight: 400,
        fill: resolve("muted"), opacity: 0.55,
      }),
    );
  });

  y = Math.max(sellerY, buyerY + S * 5) + S * 2;

  // Table
  const cols = [
    { label: "#", w: 0.06, align: "start" as const },
    { label: "Description", w: 0.4, align: "start" as const },
    { label: "HSN", w: 0.12, align: "start" as const },
    { label: "Qty", w: 0.1, align: "end" as const },
    { label: "Rate", w: 0.14, align: "end" as const },
    { label: "Amount", w: 0.18, align: "end" as const },
  ];
  const tableW = dim.width - area.x * 2;
  const rowH = S * 2.4;

  body.push(rect({ x: area.x, y, width: tableW, height: rowH, fill: resolve("primary") }));
  let cx = area.x;
  for (const col of cols) {
    const w = tableW * col.w;
    body.push(
      text({
        x: col.align === "end" ? cx + w - S * 0.6 : cx + S * 0.6,
        y: y + rowH * 0.66,
        text: col.label,
        family: spec.typography.body.family,
        size: S * 0.92,
        weight: 600,
        fill: resolve("surface"),
        anchor: col.align,
      }),
    );
    cx += w;
  }
  y += rowH;

  const sampleRows = [
    ["1", "Item description", "1234", "2", "500.00", "1,000.00"],
    ["2", "Item description", "1234", "1", "750.00", "750.00"],
  ];
  sampleRows.forEach((row, ri) => {
    if (ri % 2 === 1) body.push(rect({ x: area.x, y, width: tableW, height: rowH, fill: resolve("surfaceAlt") }));
    let rx = area.x;
    row.forEach((cell, i) => {
      const col = cols[i]!;
      const w = tableW * col.w;
      body.push(
        text({
          x: col.align === "end" ? rx + w - S * 0.6 : rx + S * 0.6,
          y: y + rowH * 0.64,
          text: cell,
          family: spec.typography.body.family,
          size: S * 0.95,
          weight: 400,
          fill: resolve("ink"),
          anchor: col.align,
          opacity: 0.6,
        }),
      );
      rx += w;
    });
    y += rowH;
  });

  // Totals
  y += S;
  const totalsX = area.x + tableW * 0.58;
  const totals: [string, string, boolean][] = [
    ["Subtotal", inr(1750), false],
    ["CGST 9%", inr(157.5), false],
    ["SGST 9%", inr(157.5), false],
    ["Total", inr(2065), true],
  ];
  for (const [label, value, strong] of totals) {
    if (strong) {
      body.push(rect({ x: totalsX, y: y - S * 0.4, width: area.x + tableW - totalsX, height: rowH, fill: resolve("primaryLight") }));
    }
    body.push(
      text({ x: totalsX + S * 0.6, y: y + S, text: label, family: spec.typography.body.family, size: S, weight: strong ? 700 : 400, fill: resolve("ink") }),
      text({ x: area.x + tableW - S * 0.6, y: y + S, text: value, family: spec.typography.body.family, size: S, weight: strong ? 700 : 400, fill: resolve("ink"), anchor: "end" }),
    );
    y += rowH * 0.82;
  }

  // Payment + terms footer
  const footY = dim.height - area.y - S * 8;
  const payLines = [
    str(data, "bankName") && `Bank: ${str(data, "bankName")}`,
    str(data, "accountNo") && `A/c: ${str(data, "accountNo")}`,
    str(data, "ifsc") && `IFSC: ${str(data, "ifsc")}`,
    str(data, "upi") && `UPI: ${str(data, "upi")}`,
  ].filter(Boolean) as string[];

  body.push(
    text({ x: area.x, y: footY, text: "PAYMENT DETAILS", family: spec.typography.body.family, size: S * 0.8, weight: 600, fill: resolve("muted"), letterSpacing: 0.1 }),
  );
  payLines.forEach((lineText, i) => {
    body.push(
      text({ x: area.x, y: footY + S * 1.8 + i * S * 1.45, text: lineText, family: spec.typography.body.family, size: S * 0.92, weight: 400, fill: resolve("ink") }),
    );
  });

  const terms = str(data, "terms");
  if (terms) {
    const block = textBlock(terms, {
      x: area.x + tableW * 0.5, y: footY + S * 1.8, maxWidth: tableW * 0.5,
      size: S * 0.85, family: spec.typography.body.family, weight: 400, fill: resolve("muted"), maxLines: 4,
    });
    body.push(
      text({ x: area.x + tableW * 0.5, y: footY, text: "TERMS", family: spec.typography.body.family, size: S * 0.8, weight: 600, fill: resolve("muted"), letterSpacing: 0.1 }),
      block.svg,
    );
  }

  body.push(watermark(ctx));
  return { body: body.join("") };
};

// ===========================================================================
// Social
// ===========================================================================

const profilePicture: Template = (ctx) => {
  const { dim, resolve, spec, data } = ctx;
  const style = str(data, "style", "mark");
  const body: string[] = [];
  let defs = "";

  const onBrand = style === "mark";
  const bg = onBrand ? resolve("primary") : resolve("surface");
  const fg = onBrand ? resolve("surface") : resolve("primary");

  body.push(solidBackground(ctx, bg));

  if (spec.patterns[0] && onBrand) {
    const { def, fill } = renderPattern(spec.patterns[0], spec, resolve, { opacity: 0.1, scale: 1.6, foreground: resolve("surface") });
    defs += def;
    body.push(rect({ x: 0, y: 0, width: dim.width, height: dim.height, fill }));
  }

  // Both WhatsApp and Instagram crop to a circle. Everything is kept inside the
  // inscribed circle with margin so nothing important is cut.
  const inner = dim.width * 0.54;
  const box = { x: (dim.width - inner) / 2, y: (dim.height - inner) / 2, width: inner, height: inner };

  if (style === "monogram") {
    body.push(
      text({
        x: dim.width / 2,
        y: dim.height / 2,
        text: spec.mark.initials ?? spec.name.slice(0, 2).toUpperCase(),
        family: spec.typography.display.family,
        size: dim.height * 0.42,
        weight: 700,
        fill: fg,
        anchor: "middle",
        dominantBaseline: "central",
      }),
    );
  } else {
    const markSvg = renderMark({
      mark: spec.mark,
      spec,
      resolve,
      colors: { fg, bg, accent: onBrand ? resolve("surface") : resolve("accent") },
    });
    const scale = inner / 100;
    body.push(group({ transform: `translate(${n(box.x)} ${n(box.y)}) scale(${n(scale)})` }, markSvg));
  }

  body.push(watermark(ctx));
  return { defs, body: body.join("") };
};

const instagramPost: Template = (ctx) => {
  const { dim, resolve, spec, data } = ctx;
  const layout = str(data, "layout", "centred");
  const area = safe(ctx);
  const body: string[] = [];
  let defs = "";
  const serif = isSerifDisplay(spec);

  const headline = str(data, "headline", spec.descriptor ?? spec.name);
  const subline = str(data, "subline");
  const cta = str(data, "cta");

  if (layout === "banded") {
    body.push(solidBackground(ctx, resolve("surface")));
    const bandH = dim.height * 0.46;
    body.push(rect({ x: 0, y: dim.height - bandH, width: dim.width, height: bandH, fill: resolve("primary") }));
    if (spec.patterns[0]) {
      const { def, fill } = renderPattern(spec.patterns[0], spec, resolve, { opacity: 0.1, scale: 1.4, foreground: resolve("surface") });
      defs += def;
      body.push(rect({ x: 0, y: 0, width: dim.width, height: dim.height - bandH, fill }));
    }
    body.push(
      placeLogo(ctx, "vertical", {
        x: area.x, y: dim.height * 0.08, width: dim.width - area.x * 2, height: dim.height * 0.34,
      }),
    );
    const hb = textBlock(headline, {
      x: dim.width / 2, y: dim.height - bandH + dim.height * 0.12, maxWidth: dim.width * 0.8,
      size: dim.width * 0.078, family: spec.typography.display.family,
      weight: spec.typography.display.weight, fill: resolve("surface"), anchor: "middle",
      letterSpacing: spec.typography.display.letterSpacing, serif, maxLines: 3,
    });
    body.push(hb.svg);
    if (cta) {
      body.push(ctaPill(ctx, dim.width / 2, dim.height - dim.height * 0.09, cta, resolve("surface"), resolve("primary")));
    }
  } else if (layout === "editorial") {
    body.push(solidBackground(ctx, resolve("surface")));
    body.push(rect({ x: 0, y: 0, width: dim.width * 0.16, height: dim.height, fill: resolve("accent") }));
    body.push(
      placeLogo(ctx, "horizontal", { x: dim.width * 0.22, y: area.y, width: dim.width * 0.5, height: dim.height * 0.09 }, { align: "start" }),
    );
    const hb = textBlock(headline, {
      x: dim.width * 0.22, y: dim.height * 0.42, maxWidth: dim.width * 0.66,
      size: dim.width * 0.082, family: spec.typography.display.family,
      weight: spec.typography.display.weight, fill: resolve("ink"),
      letterSpacing: spec.typography.display.letterSpacing, serif, maxLines: 4, lineHeight: 1.14,
    });
    body.push(hb.svg);
    if (subline) {
      body.push(
        textBlock(subline, {
          x: dim.width * 0.22, y: dim.height * 0.42 + hb.height + dim.height * 0.03,
          maxWidth: dim.width * 0.6, size: dim.width * 0.036,
          family: spec.typography.body.family, weight: 400, fill: resolve("muted"), maxLines: 3,
        }).svg,
      );
    }
    if (cta) body.push(ctaPill(ctx, dim.width * 0.22, dim.height - dim.height * 0.1, cta, resolve("primary"), resolve("surface"), "start"));
  } else {
    // Centred statement
    body.push(solidBackground(ctx, resolve("primary")));
    if (spec.patterns[0]) {
      const { def, fill } = renderPattern(spec.patterns[0], spec, resolve, { opacity: 0.12, scale: 1.5, foreground: resolve("surface") });
      defs += def;
      body.push(rect({ x: 0, y: 0, width: dim.width, height: dim.height, fill }));
    }
    body.push(
      placeLogo(ctx, "icon", { x: dim.width / 2 - dim.width * 0.09, y: dim.height * 0.14, width: dim.width * 0.18, height: dim.width * 0.18 }, { onField: resolve("primary") }),
    );
    const hb = textBlock(headline, {
      x: dim.width / 2, y: dim.height * 0.46, maxWidth: dim.width * 0.78,
      size: dim.width * 0.088, family: spec.typography.display.family,
      weight: spec.typography.display.weight, fill: resolve("surface"), anchor: "middle",
      letterSpacing: spec.typography.display.letterSpacing, serif, maxLines: 4, lineHeight: 1.16,
    });
    body.push(hb.svg);
    if (subline) {
      body.push(
        textBlock(subline, {
          x: dim.width / 2, y: dim.height * 0.46 + hb.height + dim.height * 0.035,
          maxWidth: dim.width * 0.7, size: dim.width * 0.036,
          family: spec.typography.body.family, weight: 400, fill: resolve("surface"),
          anchor: "middle", maxLines: 2,
        }).svg,
      );
    }
    if (cta) body.push(ctaPill(ctx, dim.width / 2, dim.height - dim.height * 0.11, cta, resolve("surface"), resolve("primary")));
  }

  body.push(watermark(ctx));
  return { defs, body: body.join("") };
};

function ctaPill(
  ctx: AssetCtx,
  cx: number,
  cy: number,
  label: string,
  fill: string,
  textColor: string,
  anchor: "start" | "middle" = "middle",
): string {
  const size = ctx.dim.width * 0.032;
  const padX = size * 1.5;
  const w = estimateTextWidth(label, size, { weight: 600 }) + padX * 2;
  const h = size * 2.6;
  const x = anchor === "start" ? cx : cx - w / 2;
  return (
    rect({ x, y: cy - h / 2, width: w, height: h, rx: h / 2, fill }) +
    text({
      x: x + w / 2,
      y: cy,
      text: label,
      family: ctx.spec.typography.body.family,
      size,
      weight: 600,
      fill: textColor,
      anchor: "middle",
      dominantBaseline: "central",
    })
  );
}

const instagramStory: Template = (ctx) => {
  const { dim, resolve, spec, data } = ctx;
  const body: string[] = [];
  let defs = "";
  const serif = isSerifDisplay(spec);

  body.push(solidBackground(ctx, resolve("primary")));
  if (spec.patterns[0]) {
    const { def, fill } = renderPattern(spec.patterns[0], spec, resolve, { opacity: 0.11, scale: 2, foreground: resolve("surface") });
    defs += def;
    body.push(rect({ x: 0, y: 0, width: dim.width, height: dim.height, fill }));
  }

  // Instagram overlays its own UI on the top ~14% and bottom ~14% of a story.
  // Everything meaningful is kept between those bands.
  const topSafe = dim.height * 0.16;
  const bottomSafe = dim.height * 0.84;

  body.push(
    placeLogo(ctx, "vertical", {
      x: dim.width * 0.2, y: topSafe, width: dim.width * 0.6, height: dim.height * 0.2,
    }, { onField: resolve("primary") }),
  );

  const headline = str(data, "headline", "Today only");
  const hb = textBlock(headline, {
    x: dim.width / 2, y: dim.height * 0.5, maxWidth: dim.width * 0.8,
    size: dim.width * 0.1, family: spec.typography.display.family,
    weight: spec.typography.display.weight, fill: resolve("surface"), anchor: "middle",
    letterSpacing: spec.typography.display.letterSpacing, serif, maxLines: 3, lineHeight: 1.15,
  });
  body.push(hb.svg);

  const subline = str(data, "subline");
  if (subline) {
    body.push(
      textBlock(subline, {
        x: dim.width / 2, y: dim.height * 0.5 + hb.height + dim.height * 0.025,
        maxWidth: dim.width * 0.72, size: dim.width * 0.038,
        family: spec.typography.body.family, weight: 400, fill: resolve("surface"),
        anchor: "middle", maxLines: 3,
      }).svg,
    );
  }

  const cta = str(data, "cta");
  if (cta) body.push(ctaPill(ctx, dim.width / 2, bottomSafe - dim.height * 0.04, cta, resolve("surface"), resolve("primary")));

  body.push(watermark(ctx));
  return { defs, body: body.join("") };
};

const wideBanner = (safeRatio: number): Template => (ctx) => {
  const { dim, resolve, spec, data } = ctx;
  const body: string[] = [];
  let defs = "";

  body.push(solidBackground(ctx, resolve("primary")));
  if (spec.patterns[0]) {
    const { def, fill } = renderPattern(spec.patterns[0], spec, resolve, { opacity: 0.1, scale: 1.4, foreground: resolve("surface") });
    defs += def;
    body.push(rect({ x: 0, y: 0, width: dim.width, height: dim.height, fill }));
  }

  // YouTube crops channel art aggressively on phones — only the central band is
  // guaranteed visible, so nothing important goes outside it.
  const safeW = dim.width * safeRatio;
  const safeH = Math.min(dim.height * 0.62, dim.height);
  const box = { x: (dim.width - safeW) / 2, y: (dim.height - safeH) / 2, width: safeW, height: safeH };

  const headline = str(data, "headline");
  const logoH = headline ? box.height * 0.55 : box.height;

  body.push(
    placeLogo(ctx, "horizontal", { ...box, height: logoH }, { onField: resolve("primary") }),
  );

  if (headline) {
    body.push(
      text({
        x: dim.width / 2,
        y: box.y + box.height * 0.86,
        text: headline,
        family: spec.typography.body.family,
        size: dim.height * 0.055,
        weight: 500,
        fill: resolve("surface"),
        anchor: "middle",
        opacity: 0.9,
      }),
    );
  }

  body.push(watermark(ctx));
  return { defs, body: body.join("") };
};

// ===========================================================================
// Web
// ===========================================================================

const websiteHero: Template = (ctx) => {
  const { dim, resolve, spec, data } = ctx;
  const body: string[] = [];
  let defs = "";
  const serif = isSerifDisplay(spec);

  body.push(solidBackground(ctx, resolve("surface")));

  const panelX = dim.width * 0.56;
  body.push(rect({ x: panelX, y: 0, width: dim.width - panelX, height: dim.height, fill: resolve("primary") }));
  if (spec.patterns[0]) {
    const { def, fill } = renderPattern(spec.patterns[0], spec, resolve, { opacity: 0.14, scale: 1.2, foreground: resolve("surface") });
    defs += def;
    body.push(rect({ x: panelX, y: 0, width: dim.width - panelX, height: dim.height, fill }));
  }
  body.push(
    placeLogo(ctx, "icon", {
      x: panelX + (dim.width - panelX) * 0.2, y: dim.height * 0.28,
      width: (dim.width - panelX) * 0.6, height: dim.height * 0.44,
    }, { onField: resolve("primary") }),
  );

  const padX = dim.width * 0.07;
  body.push(
    placeLogo(ctx, "horizontal", { x: padX, y: dim.height * 0.1, width: dim.width * 0.26, height: dim.height * 0.1 }, { align: "start" }),
  );

  const headline = str(data, "headline", spec.descriptor ? `${spec.name} — ${spec.descriptor}` : spec.name);
  const hb = textBlock(headline, {
    x: padX, y: dim.height * 0.38, maxWidth: panelX - padX * 1.6,
    size: dim.width * 0.048, family: spec.typography.display.family,
    weight: spec.typography.display.weight, fill: resolve("ink"),
    letterSpacing: spec.typography.display.letterSpacing, serif, maxLines: 3, lineHeight: 1.16,
  });
  body.push(hb.svg);

  const subline = str(data, "subline");
  if (subline) {
    body.push(
      textBlock(subline, {
        x: padX, y: dim.height * 0.38 + hb.height + dim.height * 0.05,
        maxWidth: panelX - padX * 2, size: dim.width * 0.019,
        family: spec.typography.body.family, weight: 400, fill: resolve("muted"), maxLines: 3,
      }).svg,
    );
  }

  const cta = str(data, "cta");
  if (cta) body.push(ctaPill(ctx, padX, dim.height * 0.8, cta, resolve("primary"), resolve("surface"), "start"));

  body.push(watermark(ctx));
  return { defs, body: body.join("") };
};

// ===========================================================================
// Marketing print
// ===========================================================================

const poster: Template = (ctx) => {
  const { dim, resolve, spec, data } = ctx;
  const area = safe(ctx, 8);
  const body: string[] = [];
  let defs = "";
  const serif = isSerifDisplay(spec);

  const bg = patternBackground(ctx, { opacity: 0.08, scale: 1.6, base: resolve("surface") });
  defs += bg.defs;
  body.push(bg.body);

  body.push(rect({ x: 0, y: 0, width: dim.width, height: dim.height * 0.22, fill: resolve("primary") }));
  body.push(
    placeLogo(ctx, "horizontal", { x: area.x, y: dim.height * 0.05, width: dim.width * 0.5, height: dim.height * 0.12 }, { align: "start", onField: resolve("primary") }),
  );

  const headline = str(data, "headline", spec.descriptor ?? spec.name);
  const hb = textBlock(headline, {
    x: dim.width / 2, y: dim.height * 0.42, maxWidth: dim.width * 0.82,
    size: dim.width * 0.11, family: spec.typography.display.family,
    weight: spec.typography.display.weight, fill: resolve("ink"), anchor: "middle",
    letterSpacing: spec.typography.display.letterSpacing, serif, maxLines: 3, lineHeight: 1.1,
  });
  body.push(hb.svg);

  const subline = str(data, "subline");
  if (subline) {
    body.push(
      textBlock(subline, {
        x: dim.width / 2, y: dim.height * 0.42 + hb.height + dim.height * 0.04,
        maxWidth: dim.width * 0.7, size: dim.width * 0.038,
        family: spec.typography.body.family, weight: 400, fill: resolve("muted"),
        anchor: "middle", maxLines: 3,
      }).svg,
    );
  }

  const footer = str(data, "footer");
  if (footer) {
    body.push(rect({ x: 0, y: dim.height - dim.height * 0.1, width: dim.width, height: dim.height * 0.1, fill: resolve("accent") }));
    body.push(
      text({
        x: dim.width / 2, y: dim.height - dim.height * 0.042, text: footer,
        family: spec.typography.body.family, size: dim.width * 0.032, weight: 600,
        fill: resolve("surface"), anchor: "middle",
      }),
    );
  }

  body.push(cropMarks(ctx), watermark(ctx));
  return { defs, body: body.join("") };
};

const flyer: Template = (ctx) => {
  const { dim, resolve, spec, data } = ctx;
  const area = safe(ctx, 6);
  const body: string[] = [];
  let defs = "";
  const serif = isSerifDisplay(spec);

  body.push(solidBackground(ctx, resolve("surface")));
  body.push(rect({ x: 0, y: 0, width: dim.width, height: dim.height * 0.34, fill: resolve("primary") }));
  if (spec.patterns[0]) {
    const { def, fill } = renderPattern(spec.patterns[0], spec, resolve, { opacity: 0.12, scale: 0.9, foreground: resolve("surface") });
    defs += def;
    body.push(rect({ x: 0, y: 0, width: dim.width, height: dim.height * 0.34, fill }));
  }

  body.push(
    placeLogo(ctx, "vertical", { x: area.x, y: dim.height * 0.05, width: dim.width - area.x * 2, height: dim.height * 0.24 }, { onField: resolve("primary") }),
  );

  let y = dim.height * 0.44;
  const headline = str(data, "headline", "Now open");
  const hb = textBlock(headline, {
    x: dim.width / 2, y, maxWidth: dim.width * 0.84, size: dim.width * 0.09,
    family: spec.typography.display.family, weight: spec.typography.display.weight,
    fill: resolve("ink"), anchor: "middle", letterSpacing: spec.typography.display.letterSpacing,
    serif, maxLines: 2, lineHeight: 1.12,
  });
  body.push(hb.svg);
  y += hb.height + dim.height * 0.03;

  const offer = str(data, "offer");
  if (offer) {
    const size = dim.width * 0.055;
    const w = estimateTextWidth(offer, size, { weight: 700 }) + size * 2;
    body.push(
      rect({ x: (dim.width - w) / 2, y: y - size, width: w, height: size * 2, rx: size * 0.3, fill: resolve("accent") }),
      text({ x: dim.width / 2, y, text: offer, family: spec.typography.display.family, size, weight: 700, fill: resolve("surface"), anchor: "middle", dominantBaseline: "central" }),
    );
    y += size * 2.2;
  }

  const details = str(data, "details");
  if (details) {
    const db = textBlock(details, {
      x: dim.width / 2, y: y + dim.height * 0.02, maxWidth: dim.width * 0.76,
      size: dim.width * 0.032, family: spec.typography.body.family, weight: 400,
      fill: resolve("muted"), anchor: "middle", maxLines: 4,
    });
    body.push(db.svg);
  }

  const phone = str(data, "phone");
  if (phone) {
    body.push(
      rect({ x: 0, y: dim.height - dim.height * 0.09, width: dim.width, height: dim.height * 0.09, fill: resolve("primary") }),
      text({
        x: dim.width / 2, y: dim.height - dim.height * 0.037, text: phone,
        family: spec.typography.body.family, size: dim.width * 0.038, weight: 600,
        fill: resolve("surface"), anchor: "middle",
      }),
    );
  }

  body.push(cropMarks(ctx), watermark(ctx));
  return { defs, body: body.join("") };
};

const menu: Template = (ctx) => {
  const { dim, resolve, spec, data } = ctx;
  const area = safe(ctx, 10);
  const body: string[] = [];
  const S = dim.height * 0.012;

  body.push(solidBackground(ctx, resolve("surface")));
  body.push(
    placeLogo(ctx, "vertical", { x: area.x, y: area.y, width: dim.width - area.x * 2, height: dim.height * 0.14 }),
  );

  let y = area.y + dim.height * 0.19;
  const sections = list(data, "sections");

  for (const raw of sections) {
    const [titleRaw, ...items] = raw.split("|").map((s) => s.trim());
    if (!titleRaw) continue;

    body.push(
      text({
        x: dim.width / 2, y, text: titleRaw,
        family: spec.typography.display.family, size: S * 1.9,
        weight: spec.typography.display.weight, fill: resolve("primary"),
        anchor: "middle", letterSpacing: 0.08, transform: "uppercase",
      }),
    );
    y += S * 1.5;
    body.push(
      tag("line", { x1: dim.width / 2 - S * 4, y1: y, x2: dim.width / 2 + S * 4, y2: y, stroke: resolve("accent"), "stroke-width": 1.2 }),
    );
    y += S * 2.4;

    for (const item of items) {
      const [nameRaw, priceRaw] = item.split(":").map((s) => s.trim());
      if (!nameRaw) continue;
      body.push(
        text({ x: area.x, y, text: nameRaw, family: spec.typography.body.family, size: S * 1.25, weight: 400, fill: resolve("ink") }),
      );
      if (priceRaw) {
        body.push(
          text({ x: dim.width - area.x, y, text: `₹${priceRaw}`, family: spec.typography.body.family, size: S * 1.25, weight: 600, fill: resolve("ink"), anchor: "end" }),
        );
        // Leader dots tie the item to its price across the gap.
        const nameW = estimateTextWidth(nameRaw, S * 1.25, { weight: 400 });
        const priceW = estimateTextWidth(`₹${priceRaw}`, S * 1.25, { weight: 600 });
        const dotStart = area.x + nameW + S * 0.8;
        const dotEnd = dim.width - area.x - priceW - S * 0.8;
        if (dotEnd > dotStart) {
          body.push(
            tag("line", {
              x1: dotStart, y1: y - S * 0.35, x2: dotEnd, y2: y - S * 0.35,
              stroke: resolve("muted"), "stroke-width": 1, "stroke-dasharray": "1 4",
              "stroke-linecap": "round", opacity: 0.5,
            }),
          );
        }
      }
      y += S * 2.3;
    }
    y += S * 1.6;
  }

  const footnote = str(data, "footnote");
  if (footnote) {
    body.push(
      textBlock(footnote, {
        x: dim.width / 2, y: dim.height - area.y, maxWidth: dim.width * 0.8,
        size: S * 0.95, family: spec.typography.body.family, weight: 400,
        fill: resolve("muted"), anchor: "middle", maxLines: 2,
      }).svg,
    );
  }

  body.push(cropMarks(ctx), watermark(ctx));
  return { body: body.join("") };
};

const brochure: Template = (ctx) => {
  const { dim, resolve, spec, data } = ctx;
  const body: string[] = [];
  let defs = "";
  const panelW = dim.width / 3;
  const pad = dim.width * 0.028;

  body.push(solidBackground(ctx, resolve("surface")));

  // Cover panel (rightmost in a trifold).
  body.push(rect({ x: panelW * 2, y: 0, width: panelW, height: dim.height, fill: resolve("primary") }));
  if (spec.patterns[0]) {
    const { def, fill } = renderPattern(spec.patterns[0], spec, resolve, { opacity: 0.12, scale: 0.8, foreground: resolve("surface") });
    defs += def;
    body.push(rect({ x: panelW * 2, y: 0, width: panelW, height: dim.height, fill }));
  }
  body.push(
    placeLogo(ctx, "vertical", { x: panelW * 2 + pad, y: dim.height * 0.3, width: panelW - pad * 2, height: dim.height * 0.34 }, { onField: resolve("primary") }),
  );

  const panels = list(data, "panels");
  panels.slice(0, 2).forEach((raw, i) => {
    const [heading, ...rest] = raw.split("|").map((s) => s.trim());
    const x = panelW * i + pad;
    let y = dim.height * 0.16;
    if (heading) {
      body.push(
        text({ x, y, text: heading, family: spec.typography.display.family, size: dim.height * 0.042, weight: spec.typography.display.weight, fill: resolve("primary") }),
      );
      y += dim.height * 0.06;
    }
    const copy = rest.join(" ");
    if (copy) {
      body.push(
        textBlock(copy, {
          x, y, maxWidth: panelW - pad * 2, size: dim.height * 0.022,
          family: spec.typography.body.family, weight: 400, fill: resolve("ink"), maxLines: 12,
        }).svg,
      );
    }
  });

  // Fold guides
  for (const fx of [panelW, panelW * 2]) {
    body.push(
      tag("line", { x1: fx, y1: 0, x2: fx, y2: dim.height, stroke: resolve("muted"), "stroke-width": 0.75, "stroke-dasharray": "6 6", opacity: 0.35 }),
    );
  }

  body.push(cropMarks(ctx), watermark(ctx));
  return { defs, body: body.join("") };
};

// ===========================================================================
// Packaging & merch
// ===========================================================================

const productLabel: Template = (ctx) => {
  const { dim, resolve, spec, data } = ctx;
  const area = safe(ctx, 4);
  const body: string[] = [];
  let defs = "";

  const bg = patternBackground(ctx, { opacity: 0.1, scale: 0.5, base: resolve("surface") });
  defs += bg.defs;
  body.push(bg.body);
  body.push(rect({ x: 0, y: 0, width: dim.width, height: dim.height * 0.3, fill: resolve("primary") }));
  body.push(
    placeLogo(ctx, "horizontal", { x: area.x, y: dim.height * 0.05, width: dim.width - area.x * 2, height: dim.height * 0.2 }, { onField: resolve("primary") }),
  );

  const nameSize = dim.width * 0.11;
  const pb = textBlock(str(data, "productName", "Product name"), {
    x: dim.width / 2, y: dim.height * 0.48, maxWidth: dim.width * 0.86, size: nameSize,
    family: spec.typography.display.family, weight: spec.typography.display.weight,
    fill: resolve("ink"), anchor: "middle", maxLines: 2, lineHeight: 1.1,
  });
  body.push(pb.svg);

  const variant = str(data, "variant");
  if (variant) {
    body.push(
      text({
        x: dim.width / 2, y: dim.height * 0.48 + pb.height + dim.height * 0.03, text: variant,
        family: spec.typography.body.family, size: dim.width * 0.05, weight: 500,
        fill: resolve("primary"), anchor: "middle", letterSpacing: 0.08, transform: "uppercase",
      }),
    );
  }

  body.push(
    tag("line", { x1: area.x, y1: dim.height * 0.78, x2: dim.width - area.x, y2: dim.height * 0.78, stroke: resolve("muted"), "stroke-width": 0.8, opacity: 0.4 }),
    text({
      x: area.x, y: dim.height * 0.85, text: `Net ${str(data, "netWeight", "250 g")}`,
      family: spec.typography.body.family, size: dim.width * 0.045, weight: 600, fill: resolve("ink"),
    }),
  );

  const mfg = str(data, "mfgBy");
  if (mfg) {
    body.push(
      textBlock(mfg, {
        x: area.x, y: dim.height * 0.9, maxWidth: dim.width - area.x * 2, size: dim.width * 0.03,
        family: spec.typography.body.family, weight: 400, fill: resolve("muted"), maxLines: 2,
      }).svg,
    );
  }

  body.push(cropMarks(ctx), watermark(ctx));
  return { defs, body: body.join("") };
};

const packaging: Template = (ctx) => {
  const { dim, resolve, spec, data } = ctx;
  const area = safe(ctx, 8);
  const body: string[] = [];
  let defs = "";

  body.push(solidBackground(ctx, resolve("primary")));
  if (spec.patterns[0]) {
    const { def, fill } = renderPattern(spec.patterns[0], spec, resolve, { opacity: 0.13, scale: 1.1, foreground: resolve("surface") });
    defs += def;
    body.push(rect({ x: 0, y: 0, width: dim.width, height: dim.height, fill }));
  }

  body.push(
    placeLogo(ctx, "vertical", { x: area.x, y: dim.height * 0.12, width: dim.width - area.x * 2, height: dim.height * 0.3 }, { onField: resolve("primary") }),
  );

  const panelY = dim.height * 0.55;
  const panelH = dim.height * 0.3;
  body.push(
    rect({ x: area.x, y: panelY, width: dim.width - area.x * 2, height: panelH, rx: spec.layout.radius, fill: resolve("surface") }),
  );

  const pb = textBlock(str(data, "productName", "Product name"), {
    x: dim.width / 2, y: panelY + panelH * 0.36, maxWidth: dim.width * 0.7,
    size: dim.width * 0.075, family: spec.typography.display.family,
    weight: spec.typography.display.weight, fill: resolve("ink"), anchor: "middle", maxLines: 2, lineHeight: 1.1,
  });
  body.push(pb.svg);

  const variant = str(data, "variant");
  if (variant) {
    body.push(
      text({
        x: dim.width / 2, y: panelY + panelH * 0.62, text: variant,
        family: spec.typography.body.family, size: dim.width * 0.036, weight: 500,
        fill: resolve("primary"), anchor: "middle", letterSpacing: 0.1, transform: "uppercase",
      }),
    );
  }
  body.push(
    text({
      x: dim.width / 2, y: panelY + panelH * 0.86, text: `Net ${str(data, "netWeight", "250 g")}`,
      family: spec.typography.body.family, size: dim.width * 0.032, weight: 400, fill: resolve("muted"), anchor: "middle",
    }),
  );

  body.push(cropMarks(ctx), watermark(ctx));
  return { defs, body: body.join("") };
};

const shoppingBag: Template = (ctx) => {
  const { dim, resolve, spec, data } = ctx;
  const body: string[] = [];
  let defs = "";

  const usePattern = bool(data, "showPattern", true);
  body.push(solidBackground(ctx, resolve("primary")));
  if (usePattern && spec.patterns[0]) {
    const { def, fill } = renderPattern(spec.patterns[0], spec, resolve, { opacity: 0.16, scale: 1.6, foreground: resolve("surface") });
    defs += def;
    body.push(rect({ x: 0, y: 0, width: dim.width, height: dim.height, fill }));
  }

  // The top ~18% is folded over and punched for handles, so nothing goes there.
  const handleZone = dim.height * 0.18;
  body.push(
    tag("line", { x1: 0, y1: handleZone, x2: dim.width, y2: handleZone, stroke: resolve("surface"), "stroke-width": 1, "stroke-dasharray": "8 8", opacity: 0.3 }),
  );
  const holeY = handleZone * 0.55;
  for (const hx of [dim.width * 0.33, dim.width * 0.67]) {
    body.push(circle({ cx: hx, cy: holeY, r: dim.width * 0.022, fill: "none", stroke: resolve("surface"), "stroke-width": 1.5, opacity: 0.4 }));
  }

  body.push(
    placeLogo(ctx, "vertical", {
      x: dim.width * 0.15, y: handleZone + dim.height * 0.16,
      width: dim.width * 0.7, height: dim.height * 0.42,
    }, { onField: resolve("primary") }),
  );

  body.push(cropMarks(ctx), watermark(ctx));
  return { defs, body: body.join("") };
};

const tshirt: Template = (ctx) => {
  const { dim, resolve, spec, data } = ctx;
  const body: string[] = [];
  const oneColour = bool(data, "oneColour", true);
  const variation = str(data, "variation", "vertical") as "vertical" | "icon" | "horizontal";

  // Screen printing charges per colour, so one-colour is the sane default for a
  // small business ordering fifty shirts.
  body.push(solidBackground(ctx, resolve("surface")));
  body.push(
    placeLogo(ctx, variation, { x: dim.width * 0.1, y: dim.height * 0.15, width: dim.width * 0.8, height: dim.height * 0.7 },
      oneColour ? { colorOverride: { fg: resolve("ink"), text: resolve("ink") } } : {}),
  );
  body.push(watermark(ctx));
  return { body: body.join("") };
};

const signboard: Template = (ctx) => {
  const { dim, resolve, spec, data } = ctx;
  const area = safe(ctx, 20);
  const body: string[] = [];
  let defs = "";

  body.push(solidBackground(ctx, resolve("primary")));
  if (spec.patterns[0]) {
    const { def, fill } = renderPattern(spec.patterns[0], spec, resolve, { opacity: 0.09, scale: 2.2, foreground: resolve("surface") });
    defs += def;
    body.push(rect({ x: 0, y: 0, width: dim.width, height: dim.height, fill }));
  }

  const showLocal = bool(data, "showLocal", true) && !!spec.localName;
  const hasMark = spec.mark.style !== "wordmark-only";

  // A board is read from across a road: the name gets the overwhelming majority
  // of the area, and the mark is a lock-up companion rather than a co-star.
  const markW = hasMark ? dim.height * 0.62 : 0;
  const gap = hasMark ? dim.width * 0.025 : 0;
  const textX = area.x + markW + gap;
  const textW = dim.width - area.x - textX;

  if (hasMark) {
    const markSvg = renderMark({
      mark: spec.mark, spec, resolve,
      colors: { fg: resolve("surface"), bg: resolve("primary"), accent: resolve("surface") },
    });
    const s = markW / 100;
    body.push(group({ transform: `translate(${n(area.x)} ${n((dim.height - markW) / 2)}) scale(${n(s)})` }, markSvg));
  }

  const nameSize = Math.min(dim.height * 0.3, (textW / estimateTextWidth(spec.name, 100, { weight: spec.typography.display.weight })) * 100);
  let ty = dim.height * (showLocal ? 0.42 : 0.52);

  body.push(
    text({
      x: textX, y: ty, text: spec.name,
      family: spec.typography.display.family, size: nameSize,
      weight: Math.max(600, spec.typography.display.weight), fill: resolve("surface"),
      letterSpacing: spec.typography.display.letterSpacing, transform: spec.typography.display.transform,
    }),
  );

  if (showLocal && spec.localName) {
    ty += nameSize * 0.72;
    body.push(
      text({
        x: textX, y: ty, text: spec.localName,
        family: (spec.typography.local ?? spec.typography.body).family,
        size: nameSize * 0.52, weight: 600, fill: resolve("surface"), opacity: 0.92,
      }),
    );
  }

  const subline = str(data, "subline", spec.descriptor ?? "");
  if (subline) {
    ty += nameSize * (showLocal ? 0.5 : 0.42);
    body.push(
      text({
        x: textX, y: ty, text: subline,
        family: spec.typography.body.family, size: nameSize * 0.26, weight: 500,
        fill: resolve("surface"), letterSpacing: 0.12, transform: "uppercase", opacity: 0.88,
      }),
    );
  }

  const phone = str(data, "phone");
  if (phone) {
    body.push(
      text({
        x: dim.width - area.x, y: dim.height - area.y * 0.6, text: phone,
        family: spec.typography.body.family, size: dim.height * 0.075, weight: 600,
        fill: resolve("surface"), anchor: "end", opacity: 0.95,
      }),
    );
  }

  body.push(cropMarks(ctx, "#fff"), watermark(ctx));
  return { defs, body: body.join("") };
};

// ===========================================================================
// Registry
// ===========================================================================

export const TEMPLATES: Record<AssetKind, Template> = {
  visiting_card: visitingCard,
  letterhead,
  invoice,
  whatsapp_profile: profilePicture,
  instagram_profile: profilePicture,
  instagram_post: instagramPost,
  instagram_story: instagramStory,
  youtube_banner: wideBanner(0.6),
  linkedin_banner: wideBanner(0.85),
  website_hero: websiteHero,
  menu,
  brochure,
  flyer,
  poster,
  product_label: productLabel,
  packaging,
  shopping_bag: shoppingBag,
  tshirt,
  signboard,
};

/** Renders a complete asset SVG document. */
export function renderAssetByKind(kind: AssetKind, ctx: AssetCtx): string {
  const template = TEMPLATES[kind];
  if (!template) throw new Error(`No template registered for asset kind "${kind}"`);
  const { defs, body } = template(ctx);
  return svgDoc(
    {
      width: ctx.dim.width,
      height: ctx.dim.height,
      defs: defs || undefined,
      title: `${ctx.spec.name} — ${kind.replace(/_/g, " ")}`,
    },
    body,
  );
}
