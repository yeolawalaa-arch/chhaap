import { DIMENSIONS } from "@/lib/render/dimensions";
import type { AssetDefinition, AssetKind } from "@/types/brand";

/**
 * Asset catalogue.
 *
 * The `fields` on each definition drive the editor UI automatically — add a
 * field here and it appears in the asset editor with validation, no component
 * changes. Defaults are written as real Indian business content (GSTIN lines,
 * UPI handles, "Sun closed") rather than lorem ipsum, because a user who never
 * edits a field should still get something they could hand to a printer.
 */

const def = (
  kind: AssetKind,
  name: string,
  description: string,
  group: AssetDefinition["group"],
  fields: AssetDefinition["fields"],
  defaults: Record<string, unknown>,
  tier: AssetDefinition["tier"] = "free",
): AssetDefinition => ({
  kind,
  name,
  description,
  group,
  dimension: DIMENSIONS[kind],
  fields,
  defaults,
  tier,
});

const CONTACT_FIELDS: AssetDefinition["fields"] = [
  { key: "personName", label: "Name", type: "text", maxLength: 40, placeholder: "Rohit Sharma" },
  { key: "role", label: "Designation", type: "text", maxLength: 40, placeholder: "Proprietor" },
  { key: "phone", label: "Phone", type: "text", maxLength: 24, placeholder: "+91 98765 43210" },
  { key: "email", label: "Email", type: "text", maxLength: 48, placeholder: "hello@business.in" },
  { key: "website", label: "Website", type: "text", maxLength: 48, placeholder: "www.business.in" },
  { key: "address", label: "Address", type: "textarea", maxLength: 120, placeholder: "Shop 12, MG Road, Indore 452001" },
];

export const ASSET_DEFINITIONS: Record<AssetKind, AssetDefinition> = {
  visiting_card: def(
    "visiting_card",
    "Visiting card",
    "Standard Indian 89 × 51 mm card, front and back, print-ready with bleed.",
    "print",
    [
      ...CONTACT_FIELDS,
      { key: "gstin", label: "GSTIN", type: "text", maxLength: 20, placeholder: "23AAAAA0000A1Z5" },
      { key: "showPattern", label: "Pattern on reverse", type: "toggle" },
    ],
    {
      personName: "Rohit Sharma",
      role: "Proprietor",
      phone: "+91 98765 43210",
      email: "hello@business.in",
      website: "www.business.in",
      address: "Shop 12, MG Road, Indore 452001",
      gstin: "",
      showPattern: true,
    },
  ),

  letterhead: def(
    "letterhead",
    "Letterhead",
    "A4 letterhead with header, footer rule and contact strip.",
    "print",
    [
      { key: "phone", label: "Phone", type: "text", maxLength: 24 },
      { key: "email", label: "Email", type: "text", maxLength: 48 },
      { key: "website", label: "Website", type: "text", maxLength: 48 },
      { key: "address", label: "Address", type: "textarea", maxLength: 140 },
      { key: "gstin", label: "GSTIN", type: "text", maxLength: 20 },
    ],
    {
      phone: "+91 98765 43210",
      email: "hello@business.in",
      website: "www.business.in",
      address: "Shop 12, MG Road, Indore 452001",
      gstin: "23AAAAA0000A1Z5",
    },
  ),

  invoice: def(
    "invoice",
    "GST invoice",
    "A4 tax invoice with GST columns, HSN and totals block.",
    "print",
    [
      { key: "gstin", label: "Your GSTIN", type: "text", maxLength: 20 },
      { key: "address", label: "Address", type: "textarea", maxLength: 140 },
      { key: "phone", label: "Phone", type: "text", maxLength: 24 },
      { key: "bankName", label: "Bank name", type: "text", maxLength: 40 },
      { key: "accountNo", label: "Account number", type: "text", maxLength: 24 },
      { key: "ifsc", label: "IFSC", type: "text", maxLength: 16 },
      { key: "upi", label: "UPI ID", type: "text", maxLength: 40 },
      { key: "terms", label: "Terms", type: "textarea", maxLength: 200 },
    ],
    {
      gstin: "23AAAAA0000A1Z5",
      address: "Shop 12, MG Road, Indore 452001",
      phone: "+91 98765 43210",
      bankName: "State Bank of India",
      accountNo: "00000000000",
      ifsc: "SBIN0000000",
      upi: "business@upi",
      terms: "Payment due within 15 days. Goods once sold will not be taken back.",
    },
    "pro",
  ),

  whatsapp_profile: def(
    "whatsapp_profile",
    "WhatsApp Business profile",
    "640 × 640 profile image sized for WhatsApp's circular crop.",
    "social",
    [{ key: "style", label: "Style", type: "select", options: [
      { value: "mark", label: "Mark on brand colour" },
      { value: "mark-light", label: "Mark on light" },
      { value: "monogram", label: "Monogram" },
    ] }],
    { style: "mark" },
  ),

  instagram_profile: def(
    "instagram_profile",
    "Instagram profile picture",
    "640 × 640, composed to survive Instagram's circular crop.",
    "social",
    [{ key: "style", label: "Style", type: "select", options: [
      { value: "mark", label: "Mark on brand colour" },
      { value: "mark-light", label: "Mark on light" },
      { value: "monogram", label: "Monogram" },
    ] }],
    { style: "mark" },
  ),

  instagram_post: def(
    "instagram_post",
    "Instagram post",
    "1080 × 1350 portrait post — the format that takes the most feed space.",
    "social",
    [
      { key: "headline", label: "Headline", type: "textarea", maxLength: 70, placeholder: "Fresh stock, every morning" },
      { key: "subline", label: "Sub-line", type: "text", maxLength: 60 },
      { key: "cta", label: "Call to action", type: "text", maxLength: 32, placeholder: "Order on WhatsApp" },
      { key: "layout", label: "Layout", type: "select", options: [
        { value: "centred", label: "Centred statement" },
        { value: "banded", label: "Colour band" },
        { value: "editorial", label: "Editorial left-aligned" },
      ] },
    ],
    { headline: "Fresh stock, every morning", subline: "", cta: "Order on WhatsApp", layout: "centred" },
  ),

  instagram_story: def(
    "instagram_story",
    "Instagram story",
    "1080 × 1920 with safe zones clear of Instagram's own UI.",
    "social",
    [
      { key: "headline", label: "Headline", type: "textarea", maxLength: 60 },
      { key: "subline", label: "Sub-line", type: "text", maxLength: 60 },
      { key: "cta", label: "Call to action", type: "text", maxLength: 32 },
    ],
    { headline: "Today only", subline: "", cta: "Swipe up" },
  ),

  youtube_banner: def(
    "youtube_banner",
    "YouTube banner",
    "2560 × 1440 channel art with the 1546 × 423 safe area respected.",
    "social",
    [
      { key: "headline", label: "Headline", type: "text", maxLength: 40 },
      { key: "subline", label: "Sub-line", type: "text", maxLength: 60 },
    ],
    { headline: "", subline: "" },
    "pro",
  ),

  linkedin_banner: def(
    "linkedin_banner",
    "LinkedIn banner",
    "1128 × 191 page banner.",
    "social",
    [
      { key: "headline", label: "Headline", type: "text", maxLength: 48 },
      { key: "subline", label: "Sub-line", type: "text", maxLength: 60 },
    ],
    { headline: "", subline: "" },
    "pro",
  ),

  website_hero: def(
    "website_hero",
    "Website hero",
    "1600 × 900 hero section with headline, sub-line and button.",
    "web",
    [
      { key: "headline", label: "Headline", type: "textarea", maxLength: 80 },
      { key: "subline", label: "Sub-line", type: "textarea", maxLength: 120 },
      { key: "cta", label: "Button label", type: "text", maxLength: 24 },
    ],
    { headline: "", subline: "", cta: "Get in touch" },
    "pro",
  ),

  menu: def(
    "menu",
    "Menu",
    "A4 menu with sections, items and prices in rupees.",
    "print",
    [
      { key: "sections", label: "Sections", type: "list", placeholder: "Starters | Paneer Tikka:280 | Veg Seekh:240" },
      { key: "footnote", label: "Footnote", type: "text", maxLength: 80 },
    ],
    {
      sections: [
        "Starters | Paneer Tikka:280 | Veg Seekh Kebab:240 | Chilli Mushroom:220",
        "Mains | Dal Makhani:260 | Kadhai Paneer:320 | Veg Biryani:290",
        "Breads | Tandoori Roti:40 | Butter Naan:70 | Laccha Paratha:80",
      ],
      footnote: "All prices in ₹ and inclusive of taxes. Jain options available on request.",
    },
    "pro",
  ),

  brochure: def(
    "brochure",
    "Trifold brochure",
    "297 × 210 mm trifold with three panels and fold marks.",
    "print",
    [
      { key: "headline", label: "Cover headline", type: "text", maxLength: 48 },
      { key: "panels", label: "Panel content", type: "list" },
    ],
    { headline: "", panels: ["What we do | Short description of your core offering.", "Why us | Three reasons customers choose you.", "Contact | Phone, address and hours."] },
    "pro",
  ),

  flyer: def(
    "flyer",
    "Flyer",
    "A5 single-sided flyer for offers and openings.",
    "print",
    [
      { key: "headline", label: "Headline", type: "textarea", maxLength: 60 },
      { key: "offer", label: "Offer line", type: "text", maxLength: 40, placeholder: "20% off this week" },
      { key: "details", label: "Details", type: "textarea", maxLength: 160 },
      { key: "phone", label: "Phone", type: "text", maxLength: 24 },
    ],
    { headline: "Now open", offer: "", details: "", phone: "+91 98765 43210" },
  ),

  poster: def(
    "poster",
    "Poster",
    "A3 poster for shopfront and noticeboard display.",
    "print",
    [
      { key: "headline", label: "Headline", type: "textarea", maxLength: 50 },
      { key: "subline", label: "Sub-line", type: "text", maxLength: 60 },
      { key: "footer", label: "Footer", type: "text", maxLength: 60 },
    ],
    { headline: "", subline: "", footer: "" },
  ),

  product_label: def(
    "product_label",
    "Product label",
    "70 × 100 mm label with net weight and manufacturer lines.",
    "packaging",
    [
      { key: "productName", label: "Product name", type: "text", maxLength: 32 },
      { key: "variant", label: "Variant", type: "text", maxLength: 28 },
      { key: "netWeight", label: "Net weight", type: "text", maxLength: 20, placeholder: "250 g" },
      { key: "mfgBy", label: "Marketed by", type: "textarea", maxLength: 100 },
    ],
    { productName: "Product name", variant: "", netWeight: "250 g", mfgBy: "" },
    "pro",
  ),

  packaging: def(
    "packaging",
    "Packaging face",
    "180 × 240 mm carton face with pattern and product block.",
    "packaging",
    [
      { key: "productName", label: "Product name", type: "text", maxLength: 32 },
      { key: "variant", label: "Variant", type: "text", maxLength: 28 },
      { key: "netWeight", label: "Net weight", type: "text", maxLength: 20 },
    ],
    { productName: "Product name", variant: "", netWeight: "250 g" },
    "pro",
  ),

  shopping_bag: def(
    "shopping_bag",
    "Shopping bag",
    "250 × 320 mm carry bag face with handle area kept clear.",
    "packaging",
    [{ key: "showPattern", label: "Pattern background", type: "toggle" }],
    { showPattern: true },
    "pro",
  ),

  tshirt: def(
    "tshirt",
    "T-shirt print",
    "280 × 340 mm chest print, one-colour ready for screen printing.",
    "merch",
    [
      { key: "variation", label: "Logo variation", type: "select", options: [
        { value: "vertical", label: "Stacked" },
        { value: "icon", label: "Icon only" },
        { value: "horizontal", label: "Horizontal" },
      ] },
      { key: "oneColour", label: "One colour only", type: "toggle" },
    ],
    { variation: "vertical", oneColour: true },
    "pro",
  ),

  signboard: def(
    "signboard",
    "Shop signboard",
    "4 × 2 ft flex/vinyl board with legibility checked at distance.",
    "print",
    [
      { key: "subline", label: "Sub-line", type: "text", maxLength: 48, placeholder: "Provision & Daily Needs" },
      { key: "phone", label: "Phone", type: "text", maxLength: 24 },
      { key: "showLocal", label: "Show local-script name", type: "toggle" },
    ],
    { subline: "", phone: "+91 98765 43210", showLocal: true },
  ),
};

export const ASSET_LIST: AssetDefinition[] = Object.values(ASSET_DEFINITIONS);

export function assetDefinition(kind: AssetKind): AssetDefinition {
  return ASSET_DEFINITIONS[kind];
}

export const ASSET_GROUPS: { key: AssetDefinition["group"]; label: string; hint: string }[] = [
  { key: "print", label: "Print & stationery", hint: "Cards, letterheads, menus, signage" },
  { key: "social", label: "Social media", hint: "Instagram, WhatsApp, YouTube, LinkedIn" },
  { key: "packaging", label: "Packaging", hint: "Labels, cartons, carry bags" },
  { key: "merch", label: "Merchandise", hint: "Apparel and giveaways" },
  { key: "web", label: "Web", hint: "Website sections" },
];

export function assetsByGroup() {
  return ASSET_GROUPS.map((g) => ({
    ...g,
    items: ASSET_LIST.filter((a) => a.group === g.key),
  })).filter((g) => g.items.length > 0);
}

/** Merges stored values over defaults so older rows survive new fields. */
export function withDefaults(kind: AssetKind, data: Record<string, unknown> | null | undefined) {
  return { ...ASSET_DEFINITIONS[kind].defaults, ...(data ?? {}) };
}
