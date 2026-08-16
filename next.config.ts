import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `public/` is served from the CDN and is NOT part of the serverless function
  // filesystem. The PDF pipeline reads the TTFs off disk to embed them, so the
  // export route must trace them explicitly or every PDF download 500s in
  // production while working perfectly in local dev.
  //
  // Scoped to the routes that actually generate PDFs — tracing 11 MB of fonts
  // into every function would be wasteful.
  outputFileTracingIncludes: {
    "/api/brands/[id]/export": ["./public/fonts/**/*.ttf"],
  },

  // pdfkit ships its own font binaries and does dynamic requires that the
  // bundler cannot follow; leaving it external keeps it intact in the bundle.
  serverExternalPackages: ["pdfkit"],

  eslint: {
    // Lint runs in CI and locally via `npm run lint`. A deploy should not fail
    // on an unused import.
    ignoreDuringBuilds: true,
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The app holds authenticated sessions, so framing it is a
          // clickjacking route — a hidden iframe over a "Delete brand" button.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          // Stops browsers from MIME-sniffing an upload into something
          // executable.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Brand workspace URLs contain ids; don't leak them to third parties.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
      {
        // Fonts are immutable and content-addressed by filename; without this
        // every page load re-fetches several hundred KB of TTF.
        source: "/fonts/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
