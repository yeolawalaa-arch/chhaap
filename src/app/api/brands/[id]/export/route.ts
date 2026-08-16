import { NextResponse } from "next/server";
import { handleRoute, badRequest } from "@/lib/http/errors";
import { exportSchema } from "@/lib/http/schemas";
import { requireUser } from "@/lib/auth/session";
import { loadBrand, loadLogo } from "@/lib/brand/service";
import { entitlementFor } from "@/lib/billing/plans";
import { exportAsset, exportBrandKit, exportGuidelines, exportLogo, type ExportContext } from "@/lib/export/service";
import { RULES, enforce } from "@/lib/security/rate-limit";
import { db } from "@/lib/db/client";
import { decodeJson } from "@/lib/db/json";
import type { AssetData, AssetKind, LogoVariation } from "@/types/brand";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handleRoute(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await enforce(RULES.exportAsset, `user:${user.id}`);

  const input = exportSchema.parse(await req.json());
  const brand = await loadBrand(id, user.id);
  if (!brand.spec) throw badRequest("Choose a brand direction before exporting.");

  const { limits } = await entitlementFor(user.id);
  const exportCtx: ExportContext = {
    spec: brand.spec,
    strategy: brand.strategy,
    quality: brand.quality,
    limits,
    brandName: brand.name,
  };

  let result;
  switch (input.target) {
    case "logo": {
      const variation = (input.variation ?? "primary") as LogoVariation;
      // Uses the saved document, so Studio edits are reflected in the export.
      const doc = await loadLogo(id, user.id, variation);
      result = await exportLogo(exportCtx, variation, input.format, {
        scale: input.scale,
        transparent: input.transparent,
        doc,
      });
      break;
    }
    case "asset": {
      if (!input.kind) throw badRequest("Specify which asset to export.");
      let data: AssetData = {};
      if (input.assetId) {
        const row = await db.brandAsset.findFirst({ where: { id: input.assetId, brandId: id } });
        if (row) data = decodeJson<AssetData>(row.dataJson, {});
      }
      result = await exportAsset(exportCtx, input.kind as AssetKind, input.format, data, {
        scale: input.scale,
      });
      break;
    }
    case "kit": {
      if (input.format === "pdf") {
        result = await exportGuidelines(exportCtx);
      } else {
        const rows = await db.brandAsset.findMany({ where: { brandId: id } });
        result = await exportBrandKit(exportCtx, {
          assets: rows.map((r) => ({
            kind: r.kind as AssetKind,
            data: decodeJson<AssetData>(r.dataJson, {}),
          })),
        });
      }
      break;
    }
  }

  await db.download.create({
    data: {
      userId: user.id,
      brandId: id,
      kind: input.target === "kit" ? "brand_kit" : input.target === "logo" ? "logo_pack" : "asset",
      format: input.format,
      detail: input.variation ?? input.kind ?? null,
      watermark: !limits.removeWatermark,
    },
  }).catch(() => {});

  // Raster formats come back as instructions for the browser to draw, since
  // rasterisation happens client-side.
  if (result.raster) {
    return NextResponse.json({
      mode: "raster",
      filename: result.filename,
      contentType: result.contentType,
      warning: result.warning ?? null,
      ...result.raster,
    });
  }

  return new NextResponse(new Uint8Array(result.body!), {
    headers: {
      "content-type": result.contentType,
      "content-disposition": `attachment; filename="${result.filename}"`,
      "content-length": String(result.body!.length),
      "cache-control": "private, no-store",
      // Read by the client so a shaping risk is surfaced next to the download.
      ...(result.warning
        ? { "x-chhaap-warning": encodeURIComponent(`${result.warning.message} ${result.warning.recommendation}`) }
        : {}),
    },
  });
});
