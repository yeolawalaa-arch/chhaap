import { z } from "zod";
import { COLOR_MOODS, LANGUAGES, LOGO_VARIATIONS, PERSONALITY_TRAITS } from "@/types/brand";
import { INDUSTRIES } from "@/lib/brand/industries";
import { isValidHex } from "@/lib/color";

/**
 * Request validation.
 *
 * Every route parses its body through one of these. Beyond type safety, the
 * `.max()` bounds are a denial-of-service control: without them a caller could
 * post a megabyte business name and have the render engine try to lay it out.
 */

const INDUSTRY_KEYS = INDUSTRIES.map((i) => i.key) as [string, ...string[]];

export const hexColor = z
  .string()
  .refine(isValidHex, { message: "Enter a valid hex colour, like #C2410C." });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(254);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const signUpSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Use at least 8 characters.").max(200),
  name: z.string().trim().max(80).optional(),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(200),
});

export const otpRequestSchema = z.object({ email: emailSchema });

export const otpVerifySchema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().max(200),
  newPassword: z.string().min(8, "Use at least 8 characters.").max(200),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().max(80).optional(),
  locale: z.enum(LANGUAGES).optional(),
});

// ---------------------------------------------------------------------------
// Brand brief
// ---------------------------------------------------------------------------

export const briefSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(1, "Enter your business name.")
    .max(60, "Keep the name under 60 characters — longer names can't lock up as a logo."),
  descriptor: z.string().trim().max(60).optional(),
  industry: z.enum(INDUSTRY_KEYS, { message: "Choose a category." }),
  audience: z
    .string()
    .trim()
    .min(3, "Describe who you sell to.")
    .max(200),
  personality: z
    .array(z.enum(PERSONALITY_TRAITS))
    .min(1, "Pick at least one trait.")
    .max(4, "Pick at most four — more than that and they cancel each other out."),
  colorMood: z.enum(COLOR_MOODS).default("auto"),
  colorSeeds: z.array(hexColor).max(3).optional(),
  language: z.enum(LANGUAGES).default("en"),
  localName: z.string().trim().max(60).optional(),
  city: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(600).optional(),
});

export const createBrandSchema = z.object({
  brief: briefSchema,
  count: z.coerce.number().int().min(2).max(7).default(7),
});

export const regenerateSchema = z.object({
  count: z.coerce.number().int().min(2).max(7).default(7),
});

export const selectDirectionSchema = z.object({
  directionId: z.string().min(1).max(60),
});

export const updateBrandSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  isPublic: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Logo studio
// ---------------------------------------------------------------------------

const layerBase = {
  id: z.string().max(40),
  name: z.string().max(60),
  x: z.number().finite(),
  y: z.number().finite(),
  rotation: z.number().finite().min(-360).max(360),
  scale: z.number().finite().min(0.01).max(20),
  opacity: z.number().min(0).max(1),
  visible: z.boolean(),
  locked: z.boolean(),
};

const colorToken = z.string().max(30);

const fontSpecSchema = z.object({
  family: z.string().max(60),
  weight: z.number().int().min(100).max(900),
  letterSpacing: z.number().min(-0.5).max(1),
  transform: z.enum(["none", "uppercase", "lowercase"]),
});

const markSpecSchema = z.object({
  style: z.enum([
    "monogram",
    "glyph",
    "abstract-petal",
    "abstract-orbit",
    "abstract-stack",
    "lettermark-cut",
    "wordmark-only",
  ]),
  glyph: z.string().max(40).optional(),
  initials: z.string().max(4).optional(),
  enclosure: z.enum([
    "none",
    "circle",
    "rounded-square",
    "squircle",
    "hexagon",
    "shield",
    "arch",
    "diamond",
    "banner",
  ]),
  strokeWeight: z.number().min(1).max(30),
  fillStyle: z.enum(["solid", "outline", "duotone", "gradient", "monoline"]),
  symmetry: z.number().int().min(2).max(12),
  cornerRadius: z.number().min(0).max(50),
  inset: z.number().min(0.1).max(1),
});

const layerSchema = z.discriminatedUnion("kind", [
  z.object({
    ...layerBase,
    kind: z.literal("mark"),
    mark: markSpecSchema,
    size: z.number().min(1).max(2000),
    colors: z.object({ fg: colorToken, bg: colorToken, accent: colorToken }),
  }),
  z.object({
    ...layerBase,
    kind: z.literal("text"),
    text: z.string().max(120),
    font: fontSpecSchema,
    size: z.number().min(1).max(600),
    color: colorToken,
    align: z.enum(["start", "middle", "end"]),
    isLocalScript: z.boolean().optional(),
  }),
  z.object({
    ...layerBase,
    kind: z.literal("shape"),
    shape: z.enum(["rect", "circle", "line", "triangle", "hexagon", "arch"]),
    width: z.number().min(0).max(3000),
    height: z.number().min(0).max(3000),
    fill: colorToken,
    stroke: colorToken,
    strokeWidth: z.number().min(0).max(200),
    radius: z.number().min(0).max(500),
  }),
  z.object({
    ...layerBase,
    kind: z.literal("divider"),
    width: z.number().min(0).max(3000),
    thickness: z.number().min(0.1).max(100),
    color: colorToken,
    orientation: z.enum(["horizontal", "vertical"]),
  }),
]);

export const logoDocumentSchema = z.object({
  variation: z.enum(LOGO_VARIATIONS as [string, ...string[]]),
  width: z.number().min(16).max(4000),
  height: z.number().min(16).max(4000),
  background: z.string().max(30),
  // Bounded so a crafted request can't make the renderer emit an enormous file.
  layers: z.array(layerSchema).max(60),
  colorMode: z.enum(["brand", "black", "white", "monochrome"]),
});

// ---------------------------------------------------------------------------
// Identity edits
// ---------------------------------------------------------------------------

export const updatePaletteSchema = z.object({
  primary: hexColor.optional(),
  accent: hexColor.optional(),
  ink: hexColor.optional(),
  surface: hexColor.optional(),
});

export const updateTypographySchema = z.object({
  displayFamily: z.string().max(60).optional(),
  displayWeight: z.number().int().min(100).max(900).optional(),
  bodyFamily: z.string().max(60).optional(),
});

// ---------------------------------------------------------------------------
// Assets & export
// ---------------------------------------------------------------------------

export const assetKinds = [
  "visiting_card", "letterhead", "invoice", "whatsapp_profile", "instagram_profile",
  "instagram_post", "instagram_story", "youtube_banner", "linkedin_banner",
  "website_hero", "menu", "brochure", "flyer", "poster", "product_label",
  "packaging", "shopping_bag", "tshirt", "signboard",
] as const;

export const saveAssetSchema = z.object({
  kind: z.enum(assetKinds),
  name: z.string().trim().max(80).optional(),
  data: z.record(z.string().max(40), z.union([z.string().max(2000), z.boolean(), z.array(z.string().max(500)).max(40)])),
});

export const exportSchema = z.object({
  target: z.enum(["logo", "asset", "kit"]),
  variation: z.enum(LOGO_VARIATIONS as [string, ...string[]]).optional(),
  kind: z.enum(assetKinds).optional(),
  assetId: z.string().max(40).optional(),
  format: z.enum(["svg", "png", "jpg", "pdf"]),
  scale: z.coerce.number().min(0.25).max(12).default(1),
  transparent: z.coerce.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Name generator
// ---------------------------------------------------------------------------

export const nameGeneratorSchema = z.object({
  industry: z.enum(INDUSTRY_KEYS),
  keywords: z.array(z.string().trim().max(30)).max(5).default([]),
  personality: z.array(z.enum(PERSONALITY_TRAITS)).max(4).default([]),
  language: z.enum(LANGUAGES).default("en"),
  city: z.string().trim().max(60).optional(),
  count: z.coerce.number().int().min(3).max(12).default(8),
});

export const domainCheckSchema = z.object({
  // Bounded and charset-restricted: this value is interpolated into an
  // outbound RDAP request, so it must not carry anything but a hostname label.
  stem: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Use letters, numbers and hyphens only."),
  tlds: z.array(z.enum(["in", "com", "co.in", "shop", "store"])).max(5).default(["in", "com"]),
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const updatePlanSchema = z.object({
  name: z.string().trim().max(40).optional(),
  description: z.string().trim().max(200).optional(),
  priceInr: z.number().int().min(0).max(1_000_000).optional(),
  priceInrYear: z.number().int().min(0).max(10_000_000).optional(),
  isActive: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  limits: z
    .object({
      aiGenerationsPerMonth: z.number().int().min(-1).max(100_000),
      maxBrands: z.number().int().min(1).max(1000),
      maxTeamMembers: z.number().int().min(1).max(500),
      maxExportPx: z.number().int().min(256).max(20_000),
      vectorExport: z.boolean(),
      transparentPng: z.boolean(),
      pdfExport: z.boolean(),
      brandKitPdf: z.boolean(),
      removeWatermark: z.boolean(),
      premiumTemplates: z.boolean(),
      commercialLicense: z.boolean(),
      priorityGeneration: z.boolean(),
    })
    .optional(),
  features: z.array(z.string().max(120)).max(20).optional(),
});

export const couponSchema = z.object({
  code: z.string().trim().toUpperCase().min(3).max(24).regex(/^[A-Z0-9_-]+$/),
  description: z.string().trim().max(160).optional(),
  percentOff: z.number().int().min(1).max(100).optional(),
  amountOffInr: z.number().int().min(1).max(1_000_000).optional(),
  maxRedemptions: z.number().int().min(1).max(100_000).optional(),
  appliesToPlan: z.enum(["free", "pro", "business"]).optional(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
});

export const grantPlanSchema = z.object({
  userId: z.string().min(1).max(40),
  planKey: z.enum(["free", "pro", "business"]),
  months: z.coerce.number().int().min(1).max(36).default(12),
});
