import type { MetadataRoute } from "next";
import { db } from "@/lib/db/client";
import { env } from "@/lib/config/env";

export const dynamic = "force-dynamic";

/**
 * Public routes plus every brand its owner chose to publish. Published brands
 * are the organic-traffic surface — each is a real page about a real business.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.APP_URL.replace(/\/$/, "");

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/showcase`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/signup`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/login`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // A sitemap must still serve if the database is unreachable.
  const brands = await db.brand
    .findMany({
      where: { isPublic: true, archivedAt: null },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    })
    .catch(() => []);

  return [
    ...staticRoutes,
    ...brands.map((b) => ({
      url: `${base}/b/${b.slug}`,
      lastModified: b.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
