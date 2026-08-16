import type { MetadataRoute } from "next";
import { env } from "@/lib/config/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Signed-in surfaces and the API carry no crawlable value, and brand
      // workspaces are private by definition.
      disallow: ["/api/", "/dashboard", "/create", "/brand/"],
    },
    sitemap: `${env.APP_URL}/sitemap.xml`,
  };
}
