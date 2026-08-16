/**
 * The brand domain model.
 *
 * `BrandIdentitySpec` is the single source of truth for every pixel the
 * platform produces. Logos, business cards, Instagram stories and signboards
 * are all pure functions of this object, which is what makes the output
 * consistent by construction rather than by convention.
 */

// ---------------------------------------------------------------------------
// Input: what the user tells us
// ---------------------------------------------------------------------------

export const LANGUAGES = [
  "en",
  "hi",
  "hinglish",
  "mr",
  "gu",
  "ta",
  "te",
  "bn",
  "kn",
  "ml",
  "pa",
] as const;
export type LanguageCode = (typeof LANGUAGES)[number];

export const SCRIPTS = [
  "latin",
  "devanagari",
  "gujarati",
  "tamil",
  "telugu",
  "bengali",
  "kannada",
  "malayalam",
  "gurmukhi",
] as const;
export type ScriptCode = (typeof SCRIPTS)[number];

export const PERSONALITY_TRAITS = [
  "premium",
  "friendly",
  "trustworthy",
  "modern",
  "traditional",
  "playful",
  "bold",
  "minimal",
  "warm",
  "energetic",
  "handcrafted",
  "technical",
] as const;
export type PersonalityTrait = (typeof PERSONALITY_TRAITS)[number];

export const COLOR_MOODS = [
  "auto",
  "warm",
  "cool",
  "earthy",
  "vibrant",
  "monochrome",
  "pastel",
  "jewel",
] as const;
export type ColorMood = (typeof COLOR_MOODS)[number];

/** Exactly what the create-brand wizard collects. */
export interface BrandBrief {
  businessName: string;
  /** Optional second line rendered under the name in lockups. */
  descriptor?: string;
  industry: string;
  audience: string;
  personality: PersonalityTrait[];
  colorMood: ColorMood;
  /** Optional user-picked hex seeds; overrides the mood-derived palette. */
  colorSeeds?: string[];
  language: LanguageCode;
  /** Business name transliterated into the local script, if the user wants it. */
  localName?: string;
  city?: string;
  /** Free-text notes fed to the AI layer as extra context. */
  notes?: string;
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

export interface BrandColor {
  /** Stable token id used by every template: `primary`, `accent`, `ink`… */
  role: ColorRole;
  name: string;
  hex: string;
  /** Populated by the colour pipeline; CMYK is a conversion, flagged as such. */
  rgb: [number, number, number];
  cmyk: [number, number, number, number];
  /** Human-readable rationale surfaced in the brand guidelines PDF. */
  meaning?: string;
}

export const COLOR_ROLES = [
  "primary",
  "primaryDark",
  "primaryLight",
  "accent",
  "ink",
  "muted",
  "surface",
  "surfaceAlt",
] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];

export type BrandPalette = Record<ColorRole, BrandColor>;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export interface FontSpec {
  /** Family name as registered in src/lib/fonts/catalog.ts. */
  family: string;
  weight: number;
  /** em units */
  letterSpacing: number;
  /** `uppercase` etc. applied at render time. */
  transform: "none" | "uppercase" | "lowercase";
}

export interface BrandTypography {
  display: FontSpec;
  body: FontSpec;
  /** Font used when rendering the local-script name; may differ from display. */
  local?: FontSpec;
  scaleRatio: number;
}

// ---------------------------------------------------------------------------
// The mark (logo symbol)
// ---------------------------------------------------------------------------

export type MarkStyle =
  | "monogram"
  | "glyph"
  | "abstract-petal"
  | "abstract-orbit"
  | "abstract-stack"
  | "lettermark-cut"
  | "wordmark-only";

export type EnclosureShape =
  | "none"
  | "circle"
  | "rounded-square"
  | "squircle"
  | "hexagon"
  | "shield"
  | "arch"
  | "diamond"
  | "banner";

export interface MarkSpec {
  style: MarkStyle;
  /** Key into the glyph library, when style === "glyph". */
  glyph?: string;
  /** 1–2 characters, when style is monogram/lettermark. */
  initials?: string;
  enclosure: EnclosureShape;
  /** Stroke weight in the mark's 100×100 design space. */
  strokeWeight: number;
  /** Fill treatment of the enclosure. */
  fillStyle: "solid" | "outline" | "duotone" | "gradient" | "monoline";
  /** Rotational symmetry count for abstract marks (petal/orbit). */
  symmetry: number;
  cornerRadius: number;
  /** Scale of the glyph inside the enclosure (0–1). */
  inset: number;
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

export type PatternKind =
  | "grid-dots"
  | "diagonal-stripes"
  | "arches"
  | "waves"
  | "mark-tile"
  | "chevron"
  | "concentric"
  | "lattice";

export interface PatternSpec {
  kind: PatternKind;
  scale: number;
  opacity: number;
  /** Colour roles used, e.g. ["primary", "surface"]. */
  colors: ColorRole[];
}

// ---------------------------------------------------------------------------
// The locked-in identity
// ---------------------------------------------------------------------------

export interface LayoutTokens {
  /** Clear-space around the logo, in multiples of the mark's cap height. */
  clearSpace: number;
  radius: number;
  /** Base grid unit in px used by asset templates. */
  unit: number;
  borderWidth: number;
}

export interface BrandIdentitySpec {
  /** Deterministic id of the generating direction, e.g. "warm-artisan". */
  directionId: string;
  name: string;
  descriptor?: string;
  localName?: string;
  language: LanguageCode;
  script: ScriptCode;
  palette: BrandPalette;
  typography: BrandTypography;
  mark: MarkSpec;
  patterns: PatternSpec[];
  layout: LayoutTokens;
  /** Preferred lockup for the primary logo. */
  lockup: "stacked" | "horizontal" | "badge";
}

// ---------------------------------------------------------------------------
// Strategy (the words half of the brand)
// ---------------------------------------------------------------------------

export interface BrandStrategy {
  personalitySummary: string;
  positioning: string;
  audience: string;
  colorPsychology: string;
  visualStyle: string;
  voice: {
    tone: string[];
    /** Short do/don't guidance for copywriters. */
    dos: string[];
    donts: string[];
    sampleCaption: string;
    sampleWhatsApp: string;
  };
  taglines: string[];
  socialStyle: string;
  packagingStyle: string;
  logoDirection: string;
  fontRationale: string;
}

// ---------------------------------------------------------------------------
// Directions offered at step 3 of the flow
// ---------------------------------------------------------------------------

export interface BrandDirectionCandidate {
  id: string;
  label: string;
  summary: string;
  spec: BrandIdentitySpec;
  strategy: BrandStrategy;
  score: number;
}

// ---------------------------------------------------------------------------
// Logo document — the editable representation used by the Logo Studio
// ---------------------------------------------------------------------------

export type LogoVariation =
  | "primary"
  | "secondary"
  | "horizontal"
  | "vertical"
  | "icon"
  | "black"
  | "white"
  | "monochrome";

export const LOGO_VARIATIONS: LogoVariation[] = [
  "primary",
  "secondary",
  "horizontal",
  "vertical",
  "icon",
  "black",
  "white",
  "monochrome",
];

export type LayerKind = "mark" | "text" | "shape" | "divider";

export interface LayerBase {
  id: string;
  kind: LayerKind;
  name: string;
  x: number;
  y: number;
  /** Degrees. */
  rotation: number;
  scale: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
}

export interface MarkLayer extends LayerBase {
  kind: "mark";
  mark: MarkSpec;
  size: number;
  colors: { fg: ColorRole | string; bg: ColorRole | string; accent: ColorRole | string };
}

export interface TextLayer extends LayerBase {
  kind: "text";
  text: string;
  font: FontSpec;
  size: number;
  color: ColorRole | string;
  align: "start" | "middle" | "end";
  /** Renders the local-script variant with the `local` font. */
  isLocalScript?: boolean;
}

export interface ShapeLayer extends LayerBase {
  kind: "shape";
  shape: "rect" | "circle" | "line" | "triangle" | "hexagon" | "arch";
  width: number;
  height: number;
  fill: ColorRole | string | "none";
  stroke: ColorRole | string | "none";
  strokeWidth: number;
  radius: number;
}

export interface DividerLayer extends LayerBase {
  kind: "divider";
  width: number;
  thickness: number;
  color: ColorRole | string;
  orientation: "horizontal" | "vertical";
}

export type LogoLayer = MarkLayer | TextLayer | ShapeLayer | DividerLayer;

export interface LogoDocument {
  variation: LogoVariation;
  width: number;
  height: number;
  background: "transparent" | "surface" | "primary" | "ink" | string;
  layers: LogoLayer[];
  /** Rendering overrides — e.g. force every colour to black. */
  colorMode: "brand" | "black" | "white" | "monochrome";
}

// ---------------------------------------------------------------------------
// Quality scoring
// ---------------------------------------------------------------------------

export type CheckStatus = "pass" | "warn" | "fail";

export interface QualityCheck {
  id: string;
  label: string;
  status: CheckStatus;
  score: number;
  weight: number;
  detail: string;
  /** Concrete, actionable remedy shown next to the score. */
  fix?: string;
}

export interface QualityReport {
  score: number;
  grade: "excellent" | "good" | "needs-work" | "poor";
  checks: QualityCheck[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Business assets
// ---------------------------------------------------------------------------

export type AssetKind =
  | "visiting_card"
  | "letterhead"
  | "invoice"
  | "whatsapp_profile"
  | "instagram_profile"
  | "instagram_post"
  | "instagram_story"
  | "youtube_banner"
  | "linkedin_banner"
  | "website_hero"
  | "menu"
  | "brochure"
  | "flyer"
  | "poster"
  | "product_label"
  | "packaging"
  | "shopping_bag"
  | "tshirt"
  | "signboard";

export interface AssetDimension {
  /** Pixel design space the SVG is authored in. */
  width: number;
  height: number;
  /** Physical size for print assets. */
  widthMm?: number;
  heightMm?: number;
  dpi?: number;
  bleedMm?: number;
  /** Human label, e.g. "Standard Indian visiting card · 89 × 51 mm". */
  label: string;
  print: boolean;
}

export interface AssetFieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "list" | "toggle" | "select";
  placeholder?: string;
  maxLength?: number;
  options?: { value: string; label: string }[];
}

export interface AssetDefinition {
  kind: AssetKind;
  name: string;
  description: string;
  group: "print" | "social" | "web" | "merch" | "packaging";
  dimension: AssetDimension;
  fields: AssetFieldDef[];
  defaults: Record<string, unknown>;
  /** Minimum plan tier required to export at full resolution. */
  tier: "free" | "pro" | "business";
}

export type AssetData = Record<string, string | string[] | boolean>;

// ---------------------------------------------------------------------------
// Render context passed to every template function
// ---------------------------------------------------------------------------

export interface RenderContext {
  spec: BrandIdentitySpec;
  /** Adds the "Made with Chhaap" mark for free-tier exports. */
  watermark: boolean;
  /** When true, embeds @font-face-free text — used for print exports. */
  outlineText?: boolean;
}
