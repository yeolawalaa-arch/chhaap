import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRoute, badRequest } from "@/lib/http/errors";
import { buildLogoDocument, renderLogo, VARIATION_LABELS } from "@/lib/render/logo";
import { renderAssetByKind } from "@/lib/render/assets/templates";
import { assetDefinition, withDefaults } from "@/lib/render/assets/definitions";
import { guidelinePages, GUIDELINES_PAGE_SIZE } from "@/lib/export/guidelines";
import { svgToPdf, svgsToPdf } from "@/lib/export/pdf";
import { checkShaping } from "@/lib/export/shaping";
import { familiesUsed } from "@/lib/brand/typography";
import { colorResolver } from "@/lib/render/svg";
import { exportPixels } from "@/lib/render/dimensions";
import { RULES, clientIp, enforce } from "@/lib/security/rate-limit";
import { assetKinds } from "@/lib/http/schemas";
import {
  LOGO_VARIATIONS,
  type AssetData,
  type AssetKind,
  type BrandIdentitySpec,
  type BrandStrategy,
  type LogoVariation,
} from "@/types/brand";

/**
 * Guest export.
 *
 * The spec travels in the request rather than being loaded from a row, because
 * a guest brand exists only in their browser. That is the whole difference from
 * the signed-in export path — the renderers, the PDF pipeline and the shaping
 * checks are the same code, so a guest download is byte-for-byte what an
 * account holder would get at free-tier limits.
 *
 * Guest exports are always watermarked and capped at web resolution. Removing
 * either is what an account is for.
 */

const GUEST_MAX_PX = 1400;

// The spec is attacker-controlled here, so it is validated structurally rather
// than trusted. Anything malformed is rejected before it reaches a renderer.
const specSchema = z.object({
  directionId: z.string().max(60),
  name: z.string().min(1).max(60),
  descriptor: z.string().max(80).optional(),
  localName: z.string().max(80).optional(),
  language: z.string().max(12),
  script: z.string().max(20),
  palette: z.record(
    z.string().max(20),
    z.object({
      role: z.string().max(20),
      name: z.string().max(40),
      hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      rgb: z.array(z.number()).length(3),
      cmyk: z.array(z.number()).length(4),
      meaning: z.string().max(600).optional(),
    }),
  ),
  typography: z.object({
    display: z.object({
      family: z.string().max(60),
      weight: z.number().int().min(100).max(900),
      letterSpacing: z.number().min(-0.5).max(1),
      transform: z.enum(["none", "uppercase", "lowercase"]),
    }),
    body: z.object({
      family: z.string().max(60),
      weight: z.number().int().min(100).max(900),
      letterSpacing: z.number().min(-0.5).max(1),
      transform: z.enum(["none", "uppercase", "lowercase"]),
    }),
    local: z
      .object({
        family: z.string().max(60),
        weight: z.number().int().min(100).max(900),
        letterSpacing: z.number().min(-0.5).max(1),
        transform: z.enum(["none", "uppercase", "lowercase"]),
      })
      .optional(),
    scaleRatio: z.number().min(1).max(3),
  }),
  mark: z.object({
    style: z.string().max(30),
    glyph: z.string().max(40).optional(),
    initials: z.string().max(4).optional(),
    enclosure: z.string().max(30),
    strokeWeight: z.number().min(1).max(30),
    fillStyle: z.string().max(20),
    symmetry: z.number().int().min(2).max(12),
    cornerRadius: z.number().min(0).max(50),
    inset: z.number().min(0.1).max(1),
  }),
  patterns: z
    .array(
      z.object({
        kind: z.string().max(30),
        scale: z.number().min(0.1).max(5),
        opacity: z.number().min(0).max(1),
        colors: z.array(z.string().max(20)).max(4),
      }),
    )
    .max(6),
  layout: z.object({
    clearSpace: z.number().min(0).max(4),
    radius: z.number().min(0).max(60),
    unit: z.number().min(1).max(64),
    borderWidth: z.number().min(0).max(20),
  }),
  lockup: z.enum(["stacked", "horizontal", "badge"]),
});

const bodySchema = z.object({
  spec: specSchema,
  strategy: z.record(z.string(), z.unknown()).optional(),
  target: z.enum(["logo", "asset", "guidelines"]).default("logo"),
  variation: z.enum(LOGO_VARIATIONS as [string, ...string[]]).optional(),
  kind: z.enum(assetKinds).optional(),
  format: z.enum(["svg", "png", "pdf"]).default("png"),
});

const safeName = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand";

export const POST = handleRoute(async (req: Request) => {
  await enforce(RULES.exportAsset, `guest:${clientIp(req)}`);

  const input = bodySchema.parse(await req.json());
  const spec = input.spec as unknown as BrandIdentitySpec;
  const base = safeName(spec.name);
  const families = familiesUsed(spec.typography);
  const shaping = checkShaping(spec);
  const warning = shaping
    ? { message: shaping.message, recommendation: shaping.recommendation }
    : null;

  // ---- guidelines PDF ----------------------------------------------------
  if (input.target === "guidelines") {
    if (!input.strategy) throw badRequest("The brand strategy is required for a guidelines PDF.");
    const pages = guidelinePages({
      spec,
      strategy: input.strategy as unknown as BrandStrategy,
      quality: null,
    });
    const body = await svgsToPdf(
      pages.map((svg) => ({ svg, dimension: GUIDELINES_PAGE_SIZE })),
      { title: `${spec.name} — Brand Guidelines`, author: spec.name, families },
    );
    return binary(body, `${base}-brand-guidelines.pdf`, "application/pdf", warning);
  }

  // ---- business asset ----------------------------------------------------
  if (input.target === "asset") {
    if (!input.kind) throw badRequest("Specify which asset to export.");
    const def = assetDefinition(input.kind as AssetKind);
    const resolve = colorResolver(spec, "brand");
    const svg = renderAssetByKind(input.kind as AssetKind, {
      spec,
      resolve,
      dim: def.dimension,
      data: withDefaults(input.kind as AssetKind, {}) as AssetData,
      watermark: true,
    });

    if (input.format === "svg") {
      return binary(Buffer.from(svg, "utf8"), `${base}-${input.kind}.svg`, "image/svg+xml", warning);
    }
    if (input.format === "pdf") {
      const body = await svgToPdf({ svg, dimension: def.dimension, families, title: def.name });
      return binary(body, `${base}-${input.kind}.pdf`, "application/pdf", warning);
    }

    const full = exportPixels(def.dimension);
    const width = Math.min(GUEST_MAX_PX, full.width);
    return NextResponse.json({
      mode: "raster",
      filename: `${base}-${input.kind}.png`,
      contentType: "image/png",
      svg,
      width,
      height: Math.round((width / def.dimension.width) * def.dimension.height),
      background: null,
      warning,
    });
  }

  // ---- logo --------------------------------------------------------------
  const variation = (input.variation ?? "primary") as LogoVariation;
  const doc = buildLogoDocument(spec, variation);
  const svg = renderLogo({ doc, spec });
  const label = VARIATION_LABELS[variation];

  if (input.format === "svg") {
    return binary(Buffer.from(svg, "utf8"), `${base}-logo-${variation}.svg`, "image/svg+xml", warning);
  }
  if (input.format === "pdf") {
    const body = await svgToPdf({ svg, families, title: `${spec.name} logo — ${label}` });
    return binary(body, `${base}-logo-${variation}.pdf`, "application/pdf", warning);
  }

  const width = Math.min(GUEST_MAX_PX, doc.width * 3);
  return NextResponse.json({
    mode: "raster",
    filename: `${base}-logo-${variation}.png`,
    contentType: "image/png",
    svg,
    width,
    height: Math.round((width / doc.width) * doc.height),
    background: null,
    warning,
  });
});

function binary(
  body: Buffer,
  filename: string,
  contentType: string,
  warning: { message: string; recommendation: string } | null,
) {
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}"`,
      "content-length": String(body.length),
      "cache-control": "private, no-store",
      ...(warning
        ? { "x-chhaap-warning": encodeURIComponent(`${warning.message} ${warning.recommendation}`) }
        : {}),
    },
  });
}
