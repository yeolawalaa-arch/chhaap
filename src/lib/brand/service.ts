import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { decodeJson, decodeJsonOrNull, encodeJson } from "@/lib/db/json";
import { buildAllVariations, buildLogoDocument } from "@/lib/render/logo";
import { scoreIdentity } from "@/lib/brand/quality";
import { notFound } from "@/lib/http/errors";
import { assertBrandQuota } from "@/lib/billing/plans";
import type {
  BrandBrief,
  BrandDirectionCandidate,
  BrandIdentitySpec,
  BrandStrategy,
  LogoDocument,
  LogoVariation,
  QualityReport,
} from "@/types/brand";

/**
 * Brand persistence and authorization.
 *
 * Every read and write of a brand goes through `loadBrand`, which takes the
 * requesting user and enforces ownership. Routes never query `db.brand`
 * directly — that single choke point is what makes "users cannot reach other
 * users' projects" a property of the system rather than a habit.
 */

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

const RESERVED = new Set([
  "admin", "api", "app", "login", "signup", "dashboard", "create", "pricing",
  "showcase", "blog", "settings", "new", "help", "about", "terms", "privacy",
]);

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "brand";
}

async function uniqueSlug(base: string): Promise<string> {
  const root = RESERVED.has(base) ? `${base}-brand` : base;
  let candidate = root;
  for (let i = 2; i < 200; i++) {
    const clash = await db.brand.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!clash) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export interface LoadedBrand {
  id: string;
  userId: string;
  name: string;
  slug: string;
  industry: string;
  language: string;
  status: string;
  isPublic: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  brief: BrandBrief;
  spec: BrandIdentitySpec | null;
  strategy: BrandStrategy | null;
  quality: QualityReport | null;
  qualityScore: number;
}

type BrandRow = Awaited<ReturnType<typeof fetchBrandRow>>;

function fetchBrandRow(id: string) {
  return db.brand.findUnique({ where: { id }, include: { identity: true } });
}

function hydrate(row: NonNullable<BrandRow>): LoadedBrand {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    slug: row.slug,
    industry: row.industry,
    language: row.language,
    status: row.status,
    isPublic: row.isPublic,
    viewCount: row.viewCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    brief: decodeJson<BrandBrief>(row.briefJson, {} as BrandBrief),
    spec: row.identity ? decodeJsonOrNull<BrandIdentitySpec>(row.identity.specJson) : null,
    strategy: row.identity ? decodeJsonOrNull<BrandStrategy>(row.identity.strategyJson) : null,
    quality: row.identity ? decodeJsonOrNull<QualityReport>(row.identity.qualityJson) : null,
    qualityScore: row.identity?.qualityScore ?? 0,
  };
}

/**
 * Loads a brand the user is allowed to see.
 *
 * `allowPublic` is for the public share page, which serves a brand to anyone
 * but only when its owner has explicitly published it.
 */
export async function loadBrand(
  brandId: string,
  userId: string | null,
  opts: { allowPublic?: boolean } = {},
): Promise<LoadedBrand> {
  const row = await fetchBrandRow(brandId);
  if (!row || row.archivedAt) throw notFound("That brand doesn't exist.");

  const owns = !!userId && row.userId === userId;
  if (!owns && !(opts.allowPublic && row.isPublic)) {
    // Deliberately 404 rather than 403 for non-owners: a 403 would confirm that
    // a brand with this id exists and belongs to someone else.
    throw notFound("That brand doesn't exist.");
  }

  return hydrate(row);
}

export async function loadBrandBySlug(slug: string): Promise<LoadedBrand | null> {
  const row = await db.brand.findUnique({ where: { slug }, include: { identity: true } });
  if (!row || row.archivedAt || !row.isPublic) return null;
  return hydrate(row);
}

export async function listBrands(userId: string) {
  const rows = await db.brand.findMany({
    where: { userId, archivedAt: null },
    include: { identity: true },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(hydrate);
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export async function createBrand(
  userId: string,
  brief: BrandBrief,
  directions: BrandDirectionCandidate[],
): Promise<LoadedBrand> {
  await assertBrandQuota(userId);

  const slug = await uniqueSlug(slugify(brief.businessName));

  const brand = await db.brand.create({
    data: {
      userId,
      name: brief.businessName.trim(),
      slug,
      industry: brief.industry,
      audience: brief.audience,
      personality: encodeJson(brief.personality),
      colorPref: encodeJson({ mode: brief.colorMood, seeds: brief.colorSeeds ?? [] }),
      language: brief.language,
      briefJson: encodeJson(brief),
      status: "draft",
      directions: {
        create: directions.map((d) => ({
          label: d.label,
          summary: d.summary,
          specJson: encodeJson({ spec: d.spec, strategy: d.strategy }),
          score: d.score,
        })),
      },
    },
    include: { identity: true },
  });

  return hydrate(brand);
}

export async function listDirections(brandId: string, userId: string) {
  await loadBrand(brandId, userId);
  const rows = await db.brandDirection.findMany({
    where: { brandId },
    orderBy: { score: "desc" },
  });
  return rows.map((row) => {
    const payload = decodeJson<{ spec: BrandIdentitySpec; strategy: BrandStrategy }>(row.specJson, {
      spec: {} as BrandIdentitySpec,
      strategy: {} as BrandStrategy,
    });
    return {
      id: row.id,
      label: row.label,
      summary: row.summary,
      score: row.score,
      isSelected: row.isSelected,
      spec: payload.spec,
      strategy: payload.strategy,
    };
  });
}

// ---------------------------------------------------------------------------
// Selecting a direction — locks in the identity
// ---------------------------------------------------------------------------

export async function selectDirection(
  brandId: string,
  userId: string,
  directionId: string,
): Promise<LoadedBrand> {
  await loadBrand(brandId, userId);

  const direction = await db.brandDirection.findFirst({ where: { id: directionId, brandId } });
  if (!direction) throw notFound("That direction is no longer available.");

  const { spec, strategy } = decodeJson<{ spec: BrandIdentitySpec; strategy: BrandStrategy }>(
    direction.specJson,
    { spec: {} as BrandIdentitySpec, strategy: {} as BrandStrategy },
  );

  const quality = scoreIdentity(spec, buildLogoDocument(spec, "primary"));
  const variations = buildAllVariations(spec);

  await db.$transaction([
    db.brandDirection.updateMany({ where: { brandId }, data: { isSelected: false } }),
    db.brandDirection.update({ where: { id: directionId }, data: { isSelected: true } }),

    db.brandIdentity.upsert({
      where: { brandId },
      create: {
        brandId,
        specJson: encodeJson(spec),
        strategyJson: encodeJson(strategy),
        qualityJson: encodeJson(quality),
        qualityScore: quality.score,
      },
      update: {
        specJson: encodeJson(spec),
        strategyJson: encodeJson(strategy),
        qualityJson: encodeJson(quality),
        qualityScore: quality.score,
        version: { increment: 1 },
      },
    }),

    // Rebuilding the logo set from scratch is correct here: choosing a
    // different direction replaces the identity, so keeping edits made against
    // the previous one would produce a logo that no longer matches its brand.
    db.logo.deleteMany({ where: { brandId } }),
    db.logo.createMany({
      data: Object.entries(variations).map(([variation, doc]) => ({
        brandId,
        variation,
        docJson: encodeJson(doc),
        isPrimary: variation === "primary",
      })),
    }),

    db.brand.update({
      where: { id: brandId },
      data: { status: "active", tagline: strategy.taglines?.[0] ?? null },
    }),
  ]);

  return loadBrand(brandId, userId);
}

// ---------------------------------------------------------------------------
// Identity updates (from the Studio and the kit editor)
// ---------------------------------------------------------------------------

export async function updateSpec(
  brandId: string,
  userId: string,
  spec: BrandIdentitySpec,
  opts: { rebuildLogos?: boolean } = {},
): Promise<LoadedBrand> {
  await loadBrand(brandId, userId);

  const quality = scoreIdentity(spec, buildLogoDocument(spec, "primary"));

  // Typed explicitly: TypeScript would otherwise narrow the array to the first
  // two element types and reject the batch operations pushed below.
  const writes: Prisma.PrismaPromise<unknown>[] = [
    db.brandIdentity.update({
      where: { brandId },
      data: {
        specJson: encodeJson(spec),
        qualityJson: encodeJson(quality),
        qualityScore: quality.score,
        version: { increment: 1 },
      },
    }),
    db.brand.update({ where: { id: brandId }, data: { name: spec.name } }),
  ];

  if (opts.rebuildLogos) {
    const variations = buildAllVariations(spec);
    writes.push(
      db.logo.deleteMany({ where: { brandId } }),
      db.logo.createMany({
        data: Object.entries(variations).map(([variation, doc]) => ({
          brandId,
          variation,
          docJson: encodeJson(doc),
          isPrimary: variation === "primary",
        })),
      }),
    );
  }

  await db.$transaction(writes);
  return loadBrand(brandId, userId);
}

// ---------------------------------------------------------------------------
// Logos
// ---------------------------------------------------------------------------

export async function loadLogos(brandId: string, userId: string | null, allowPublic = false) {
  await loadBrand(brandId, userId, { allowPublic });
  const rows = await db.logo.findMany({ where: { brandId } });
  const map = new Map<LogoVariation, LogoDocument>();
  for (const row of rows) {
    const doc = decodeJsonOrNull<LogoDocument>(row.docJson);
    if (doc) map.set(row.variation as LogoVariation, doc);
  }
  return map;
}

export async function loadLogo(
  brandId: string,
  userId: string | null,
  variation: LogoVariation,
  allowPublic = false,
): Promise<LogoDocument> {
  const brand = await loadBrand(brandId, userId, { allowPublic });
  const row = await db.logo.findUnique({ where: { brandId_variation: { brandId, variation } } });
  const doc = row ? decodeJsonOrNull<LogoDocument>(row.docJson) : null;

  // Older brands may predate a variation added later; build it on demand rather
  // than 404-ing on a logo the user is entitled to.
  if (!doc) {
    if (!brand.spec) throw notFound("This brand has no identity yet.");
    return buildLogoDocument(brand.spec, variation);
  }
  return doc;
}

export async function saveLogo(
  brandId: string,
  userId: string,
  variation: LogoVariation,
  doc: LogoDocument,
): Promise<QualityReport> {
  const brand = await loadBrand(brandId, userId);
  if (!brand.spec) throw notFound("This brand has no identity yet.");

  const quality = scoreIdentity(brand.spec, doc);

  await db.$transaction([
    db.logo.upsert({
      where: { brandId_variation: { brandId, variation } },
      create: { brandId, variation, docJson: encodeJson(doc), isPrimary: variation === "primary" },
      update: { docJson: encodeJson(doc) },
    }),
    // The score shown on the dashboard tracks the primary logo, which is the
    // one that actually gets used.
    ...(variation === "primary"
      ? [
          db.brandIdentity.update({
            where: { brandId },
            data: { qualityJson: encodeJson(quality), qualityScore: quality.score },
          }),
        ]
      : []),
    db.brand.update({ where: { id: brandId }, data: { updatedAt: new Date() } }),
  ]);

  return quality;
}

export async function resetLogo(
  brandId: string,
  userId: string,
  variation: LogoVariation,
): Promise<LogoDocument> {
  const brand = await loadBrand(brandId, userId);
  if (!brand.spec) throw notFound("This brand has no identity yet.");
  const doc = buildLogoDocument(brand.spec, variation);
  await saveLogo(brandId, userId, variation, doc);
  return doc;
}

// ---------------------------------------------------------------------------
// Publishing & lifecycle
// ---------------------------------------------------------------------------

export async function setPublic(brandId: string, userId: string, isPublic: boolean) {
  await loadBrand(brandId, userId);
  await db.brand.update({ where: { id: brandId }, data: { isPublic } });

  if (isPublic) {
    await db.showcaseEntry.upsert({
      where: { brandId },
      create: { brandId },
      update: {},
    });
  } else {
    await db.showcaseEntry.deleteMany({ where: { brandId } });
  }
}

export async function archiveBrand(brandId: string, userId: string) {
  await loadBrand(brandId, userId);
  await db.$transaction([
    db.brand.update({
      where: { id: brandId },
      data: { archivedAt: new Date(), status: "archived", isPublic: false },
    }),
    db.showcaseEntry.deleteMany({ where: { brandId } }),
  ]);
}

export async function renameBrand(brandId: string, userId: string, name: string) {
  const brand = await loadBrand(brandId, userId);
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) return brand;

  await db.brand.update({ where: { id: brandId }, data: { name: trimmed } });

  if (brand.spec) {
    await updateSpec(brandId, userId, { ...brand.spec, name: trimmed }, { rebuildLogos: true });
  }
  return loadBrand(brandId, userId);
}

/** Records a view on a public brand page, without inflating on the owner's own visits. */
export async function recordView(brandId: string, viewerId: string | null) {
  const brand = await db.brand.findUnique({ where: { id: brandId }, select: { userId: true } });
  if (!brand || brand.userId === viewerId) return;
  await db.brand.update({ where: { id: brandId }, data: { viewCount: { increment: 1 } } }).catch(() => {});
}
