import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ui";
import { env } from "@/lib/config/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  title: {
    default: "Chhaap — Build a brand, not just a logo",
    template: "%s · Chhaap",
  },
  description:
    "Create your logo, identity and complete brand kit with AI — built for modern Indian businesses. Hindi, Tamil, Bengali, Marathi and more.",
  keywords: [
    "AI logo maker India",
    "brand kit generator",
    "business logo maker",
    "Indian business branding",
    "logo maker for small business",
  ],
  openGraph: {
    type: "website",
    siteName: "Chhaap",
    title: "Chhaap — Build a brand, not just a logo",
    description:
      "Your logo, colours, typography and every business asset, generated as one consistent system. Built for Indian businesses.",
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#14120f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        {/* The brand fonts are needed by every logo preview on every page. */}
        <link rel="preconnect" href="/" />
        <link rel="stylesheet" href="/fonts/fonts.css" />
      </head>
      <body className="antialiased min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[200] focus:bg-ink focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm"
        >
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
