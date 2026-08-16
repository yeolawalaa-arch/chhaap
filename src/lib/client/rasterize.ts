"use client";


/**
 * Client-side rasterisation and downloads.
 *
 * PNG and JPG are produced in the browser rather than on the server. That is a
 * deliberate choice, not a shortcut:
 *
 *  - the browser already has the brand's fonts loaded, and its text engine
 *    shapes Devanagari, Tamil and the rest correctly — a server-side
 *    rasteriser would need the same fonts plus a full shaping stack;
 *  - it removes a native image dependency (sharp/librsvg) from deployment;
 *  - the work happens on the user's machine, so large print-resolution exports
 *    cost the server nothing.
 */

export interface RasterInstruction {
  mode: "raster";
  filename: string;
  contentType: string;
  svg: string;
  width: number;
  height: number;
  background: string | null;
  warning?: { message: string; recommendation: string } | null;
}

/** Waits for brand fonts to be ready, so text isn't drawn in a fallback face. */
async function waitForFonts(families: string[]): Promise<void> {
  if (!("fonts" in document)) return;
  try {
    await Promise.all(
      families.flatMap((family) =>
        [400, 500, 600, 700].map((weight) =>
          document.fonts.load(`${weight} 16px "${family}"`).catch(() => undefined),
        ),
      ),
    );
    await document.fonts.ready;
  } catch {
    // Fonts unavailable — the draw still succeeds with a fallback face.
  }
}

/** Families referenced by `font-family` inside an SVG string. */
function familiesIn(svg: string): string[] {
  const found = new Set<string>();
  for (const match of svg.matchAll(/font-family="([^"]+)"/g)) {
    const family = match[1]!.split(",")[0]!.replace(/['"]/g, "").trim();
    if (family) found.add(family);
  }
  return [...found];
}

export async function svgToBlob(
  svg: string,
  width: number,
  height: number,
  options: { background?: string | null; type?: "image/png" | "image/jpeg"; quality?: number } = {},
): Promise<Blob> {
  await waitForFonts(familiesIn(svg));

  const type = options.type ?? "image/png";

  // A data: URI keeps the image same-origin, so the canvas stays untainted and
  // toBlob is allowed. A blob: URL would work too but needs manual revocation.
  const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The design could not be drawn. Try SVG export instead."));
    img.src = encoded;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser blocked canvas rendering, so PNG export is unavailable.");

  // JPEG has no alpha channel: without an explicit fill it composites onto
  // black rather than the brand's paper colour.
  if (options.background || type === "image/jpeg") {
    ctx.fillStyle = options.background ?? "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image."))),
      type,
      options.quality ?? 0.92,
    );
  });
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a tick to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface DownloadRequest {
  brandId: string;
  target: "logo" | "asset" | "kit";
  format: "svg" | "png" | "jpg" | "pdf";
  variation?: string;
  kind?: string;
  assetId?: string;
  scale?: number;
  transparent?: boolean;
}

export interface DownloadOutcome {
  filename: string;
  warning?: { message: string; recommendation: string } | null;
}

/**
 * Runs an export end to end: asks the server, rasterises if needed, saves.
 * Returns any warning so the caller can surface it rather than dropping it.
 */
export async function runExport(request: DownloadRequest): Promise<DownloadOutcome> {
  const res = await fetch(`/api/brands/${request.brandId}/export`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? `Export failed (${res.status}).`);
  }

  const contentType = res.headers.get("content-type") ?? "";

  // Server-rendered binary (PDF, ZIP, SVG).
  if (!contentType.includes("application/json")) {
    const blob = await res.blob();
    const disposition = res.headers.get("content-disposition") ?? "";
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `export.${request.format}`;
    saveBlob(blob, filename);

    const raw = res.headers.get("x-chhaap-warning");
    return {
      filename,
      warning: raw ? { message: decodeURIComponent(raw), recommendation: "" } : null,
    };
  }

  // Raster instruction — draw it here.
  const instruction = (await res.json()) as RasterInstruction;
  const blob = await svgToBlob(instruction.svg, instruction.width, instruction.height, {
    background: instruction.background,
    type: request.format === "jpg" ? "image/jpeg" : "image/png",
  });
  saveBlob(blob, instruction.filename);

  return { filename: instruction.filename, warning: instruction.warning ?? null };
}
