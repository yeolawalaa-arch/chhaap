import type { Rng } from "@/lib/brand/rng";

/**
 * The glyph library.
 *
 * Every mark is authored inside a 100×100 box with its optical mass centred on
 * (50, 50) and its extents held inside 18–82, so any glyph can be dropped into
 * any enclosure without re-tuning. Forms are geometric rather than illustrative
 * on purpose: a logo has to survive being embroidered on a shirt pocket, cut in
 * vinyl for a board, and shrunk to a 16px favicon, and detail is the first
 * thing that dies at those sizes.
 *
 * `strokes` are drawn with the mark's stroke weight and round caps, so they
 * inherit the identity's weight. `fills` are solid. Keeping them separate is
 * what lets the same glyph render as outline, solid or duotone.
 */

export interface Glyph {
  key: string;
  label: string;
  /** Path data drawn with stroke, no fill. */
  strokes?: string[];
  /** Path data drawn filled, no stroke. */
  fills?: string[];
  /** [cx, cy, r] circles rendered as solid dots. */
  dots?: [number, number, number][];
  /** Paths that should take the accent colour in duotone mode. */
  accents?: string[];
  tags: string[];
}

const G = (
  key: string,
  label: string,
  parts: Omit<Glyph, "key" | "label" | "tags">,
  tags: string[] = [],
): Glyph => ({ key, label, ...parts, tags });

export const GLYPHS: Glyph[] = [
  // --- retail & commerce ---------------------------------------------------
  G("basket", "Basket", {
    strokes: ["M20 40 H80 L71 78 H29 Z", "M36 40 A14 14 0 0 1 64 40"],
    accents: ["M40 52 V66", "M50 52 V66", "M60 52 V66"],
  }, ["kirana", "grocery", "retail"]),

  G("bag", "Shopping bag", {
    strokes: ["M27 38 H73 L77 82 H23 Z", "M40 38 V30 A10 10 0 0 1 60 30 V38"],
  }, ["retail", "shopping", "d2c"]),

  G("shop-front", "Shop front", {
    strokes: ["M20 44 L28 26 H72 L80 44 Z", "M26 44 V80 H74 V44", "M42 80 V58 H58 V80"],
  }, ["kirana", "store", "local"]),

  G("box", "Box", {
    strokes: ["M20 36 L50 21 L80 36 L50 51 Z", "M20 36 V69 L50 84 V51", "M80 36 V69 L50 84"],
  }, ["packaging", "logistics", "d2c"]),

  G("grain-sack", "Grain sack", {
    strokes: ["M33 36 C28 46 26 60 28 80 H72 C74 60 72 46 67 36 Z", "M33 36 C40 30 60 30 67 36"],
    accents: ["M42 54 H58"],
  }, ["kirana", "agri", "wholesale"]),

  G("scale", "Weighing scale", {
    strokes: ["M50 22 V74", "M28 74 H72", "M24 36 H76", "M24 36 L16 54 A10 10 0 0 0 32 54 Z", "M76 36 L68 54 A10 10 0 0 0 84 54 Z"],
    dots: [[50, 26, 4]],
  }, ["kirana", "trade", "fair"]),

  G("jar", "Jar", {
    strokes: ["M34 30 H66", "M36 30 V38 C30 44 30 50 30 58 V78 H70 V58 C70 50 70 44 64 38 V30"],
    accents: ["M38 60 H62"],
  }, ["pickle", "kirana", "packaged"]),

  G("truck", "Delivery truck", {
    strokes: ["M16 66 V38 H56 V66", "M56 46 H70 L82 58 V66 H56"],
    dots: [[32, 70, 7], [70, 70, 7]],
  }, ["logistics", "delivery", "d2c"]),

  // --- food & beverage -----------------------------------------------------
  G("chai-glass", "Cutting chai", {
    strokes: ["M35 34 L41 78 H59 L65 34 Z"],
    accents: ["M40 50 H60"],
  }, ["chai", "cafe", "tea"]),

  G("cup", "Cup", {
    strokes: ["M26 36 H66 V58 A20 20 0 0 1 26 58 Z", "M66 42 H74 A8 8 0 0 1 74 58 H66", "M22 78 H70"],
  }, ["cafe", "coffee", "restaurant"]),

  G("steam", "Steam", {
    strokes: ["M38 66 C32 56 44 50 38 40 C34 33 40 26 40 22", "M56 66 C50 56 62 50 56 40 C52 33 58 26 58 22"],
  }, ["hot", "fresh", "kitchen"]),

  G("thali", "Thali", {
    strokes: ["M50 50 m-32 0 a32 32 0 1 0 64 0 a32 32 0 1 0 -64 0"],
    dots: [[38, 40, 8], [62, 40, 8], [50, 63, 9]],
  }, ["restaurant", "meals", "indian"]),

  G("tiffin", "Tiffin box", {
    strokes: ["M32 34 H68 V48 H32 Z", "M32 52 H68 V66 H32 Z", "M36 70 H64 V80 H36 Z", "M50 34 V22", "M38 22 H62"],
  }, ["tiffin", "dabba", "cloud-kitchen"]),

  G("pot", "Cooking pot", {
    strokes: ["M24 40 H76", "M28 40 V64 A22 14 0 0 0 72 64 V40", "M20 44 H28", "M72 44 H80"],
  }, ["kitchen", "restaurant", "home"]),

  G("chef-hat", "Chef hat", {
    strokes: ["M32 56 V78 H68 V56", "M32 56 A13 13 0 0 1 34 32 A15 15 0 0 1 66 32 A13 13 0 0 1 68 56 Z"],
  }, ["chef", "restaurant", "kitchen"]),

  G("spoon-fork", "Cutlery", {
    strokes: ["M36 24 V44 M30 24 V38 M42 24 V38 M36 44 V80", "M64 80 V52", "M64 52 A9 14 0 0 0 64 24 A9 14 0 0 0 64 52"],
  }, ["restaurant", "dining", "menu"]),

  G("croissant", "Bakery", {
    strokes: ["M20 62 C28 40 48 30 68 34 C80 37 84 48 78 56 C70 66 46 70 20 62 Z", "M38 44 L34 60", "M52 38 L50 58"],
  }, ["bakery", "cafe", "patisserie"]),

  G("flame", "Flame", {
    fills: ["M50 18 C61 35 73 43 73 58 A23 23 0 0 1 27 58 C27 43 39 35 50 18 Z"],
    accents: ["M50 44 C56 53 60 57 60 63 A10 10 0 0 1 40 63 C40 57 44 53 50 44 Z"],
  }, ["tandoor", "spice", "energy"]),

  G("bean", "Coffee bean", {
    strokes: ["M50 50 m-26 -14 a30 30 0 1 0 52 28 a30 30 0 1 0 -52 -28", "M34 68 C44 58 56 42 66 32"],
  }, ["coffee", "cafe", "roastery"]),

  G("bottle", "Bottle", {
    strokes: ["M43 20 H57 V32 L64 44 V78 A4 4 0 0 1 60 82 H40 A4 4 0 0 1 36 78 V44 L43 32 Z"],
    accents: ["M40 56 H60"],
  }, ["beverage", "d2c", "packaged"]),

  G("leaf-spice", "Spice leaf", {
    strokes: ["M50 20 C72 32 76 60 50 82 C24 60 28 32 50 20 Z", "M50 26 V78"],
  }, ["spice", "organic", "ayurveda"]),

  G("sprout", "Sprout", {
    strokes: ["M50 82 V44", "M50 52 C34 52 26 42 26 30 C40 30 50 38 50 52 Z", "M50 46 C64 46 72 38 72 26 C58 26 50 34 50 46 Z"],
  }, ["organic", "fresh", "agri"]),

  // --- beauty & wellness ---------------------------------------------------
  G("scissors", "Scissors", {
    strokes: ["M28 22 L64 62", "M72 22 L36 62", "M30 74 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0", "M70 74 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0"],
  }, ["salon", "barber", "tailor"]),

  G("comb", "Comb", {
    strokes: ["M22 38 H78 V52 H22 Z", "M30 52 V74 M40 52 V78 M50 52 V74 M60 52 V78 M70 52 V74"],
  }, ["salon", "barber", "grooming"]),

  G("razor", "Razor", {
    strokes: ["M30 70 L58 42 A10 10 0 0 1 72 56 L44 84", "M26 34 L44 52"],
  }, ["barber", "grooming", "men"]),

  G("mirror", "Mirror", {
    strokes: ["M50 44 m-22 0 a22 26 0 1 0 44 0 a22 26 0 1 0 -44 0", "M50 70 V82", "M38 82 H62"],
  }, ["salon", "beauty", "studio"]),

  G("lotus", "Lotus", {
    strokes: [
      "M50 78 C36 70 28 58 28 46 C38 48 46 56 50 66 C54 56 62 48 72 46 C72 58 64 70 50 78 Z",
      "M50 66 C44 54 44 40 50 26 C56 40 56 54 50 66 Z",
    ],
  }, ["wellness", "yoga", "ayurveda", "spa"]),

  G("drop", "Drop", {
    strokes: ["M50 20 C50 20 73 47 73 61 A23 23 0 0 1 27 61 C27 47 50 20 50 20 Z"],
  }, ["skincare", "purity", "water"]),

  G("cross-care", "Care cross", {
    strokes: ["M42 22 H58 V42 H78 V58 H58 V78 H42 V58 H22 V42 H42 Z"],
  }, ["clinic", "pharmacy", "health"]),

  G("pulse", "Pulse", {
    strokes: ["M18 54 H34 L42 34 L54 70 L62 54 H82"],
  }, ["clinic", "fitness", "diagnostics"]),

  // --- fashion, jewellery, footwear ---------------------------------------
  G("hanger", "Hanger", {
    strokes: ["M50 27 a7 7 0 1 1 6 11 V46", "M22 72 L56 46 L84 68 A4 4 0 0 1 81 76 H25 A4 4 0 0 1 22 72 Z"],
  }, ["clothing", "boutique", "fashion"]),

  G("thread", "Thread spool", {
    strokes: ["M32 24 H68 M32 76 H68", "M38 24 V76 M62 24 V76", "M38 36 H62 M38 48 H62 M38 60 H62"],
  }, ["tailor", "textile", "handloom"]),

  G("loom", "Handloom", {
    strokes: ["M24 24 V76 M40 24 V76 M56 24 V76 M72 24 V76", "M20 36 H80 M20 52 H80 M20 68 H80"],
  }, ["handloom", "weave", "textile"]),

  G("fold", "Folded cloth", {
    strokes: ["M20 44 L50 26 L80 44 L50 62 Z", "M20 58 L50 76 L80 58"],
  }, ["textile", "linen", "fabric"]),

  G("button", "Button", {
    strokes: ["M50 50 m-26 0 a26 26 0 1 0 52 0 a26 26 0 1 0 -52 0"],
    dots: [[42, 42, 4], [58, 42, 4], [42, 58, 4], [58, 58, 4]],
  }, ["tailor", "clothing", "detail"]),

  G("gem", "Gem", {
    strokes: ["M28 40 H72 L50 80 Z", "M28 40 L38 22 H62 L72 40", "M38 22 L50 40 L62 22", "M28 40 L50 80 L72 40"],
  }, ["jewellery", "premium", "luxury"]),

  G("ring", "Ring", {
    strokes: ["M50 58 m-20 0 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0", "M40 30 H60 L50 44 Z"],
  }, ["jewellery", "bridal", "gold"]),

  G("necklace", "Necklace", {
    strokes: ["M22 28 A32 32 0 0 0 78 28", "M50 60 L58 70 L50 80 L42 70 Z"],
    dots: [[36, 48, 3], [64, 48, 3], [50, 56, 3]],
  }, ["jewellery", "bridal", "gold"]),

  G("shoe", "Shoe", {
    strokes: ["M18 66 V48 H34 L46 58 H72 A12 12 0 0 1 84 70 V74 H18 Z", "M34 48 V58"],
  }, ["footwear", "shoes", "sneaker"]),

  G("sole", "Sole", {
    strokes: ["M38 20 C26 30 26 46 32 58 C38 70 36 78 44 82 C54 86 62 78 64 66 C66 52 74 42 70 30 C66 20 50 14 38 20 Z"],
  }, ["footwear", "sports", "comfort"]),

  G("lace", "Laces", {
    strokes: ["M32 26 L68 46 M68 26 L32 46", "M32 54 L68 74 M68 54 L32 74"],
    dots: [[32, 26, 3], [68, 26, 3], [32, 74, 3], [68, 74, 3]],
  }, ["footwear", "sneaker", "street"]),

  // --- property & construction --------------------------------------------
  G("house", "House", {
    strokes: ["M18 52 L50 24 L82 52", "M28 47 V80 H72 V47"],
    accents: ["M44 80 V60 H56 V80"],
  }, ["realestate", "home", "interiors"]),

  G("building", "Building", {
    strokes: ["M26 82 V24 H74 V82"],
    dots: [[38, 38, 4], [56, 38, 4], [38, 54, 4], [56, 54, 4]],
    accents: ["M42 82 V68 H58 V82"],
  }, ["realestate", "commercial", "office"]),

  G("arch-door", "Arch", {
    strokes: ["M26 82 V48 A24 24 0 0 1 74 48 V82"],
    accents: ["M40 82 V58 A10 10 0 0 1 60 58 V82"],
  }, ["heritage", "realestate", "traditional"]),

  G("pillar", "Pillar", {
    strokes: ["M28 26 H72", "M32 34 H68", "M38 34 V70 M50 34 V70 M62 34 V70", "M32 70 H68", "M26 78 H74"],
  }, ["legal", "finance", "institution"]),

  G("key", "Key", {
    strokes: ["M38 38 m-16 0 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0", "M50 50 L78 78", "M66 66 L58 74", "M74 74 L66 82"],
  }, ["realestate", "security", "access"]),

  G("step", "Steps", {
    strokes: ["M20 80 H38 V62 H56 V44 H74 V26"],
  }, ["growth", "coaching", "consulting"]),

  // --- industry & services -------------------------------------------------
  G("gear", "Gear", {
    strokes: [
      "M50 50 m-16 0 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0",
      "M50 18 V30 M50 70 V82 M18 50 H30 M70 50 H82 M27 27 L36 36 M64 64 L73 73 M73 27 L64 36 M36 64 L27 73",
    ],
  }, ["manufacturing", "service", "engineering"]),

  G("wrench", "Wrench", {
    strokes: ["M62 22 A18 18 0 1 0 78 44 L46 76 A9 9 0 0 1 32 62 L64 30 A18 18 0 0 0 62 22 Z"],
  }, ["repair", "service", "local"]),

  G("bolt", "Bolt", {
    fills: ["M57 18 L33 56 H47 L43 84 L69 44 H53 Z"],
  }, ["electrical", "energy", "fast"]),

  G("factory", "Factory", {
    strokes: ["M20 82 V50 L40 62 V50 L60 62 V50 L80 62 V82 Z", "M68 50 V26 H80 V62"],
  }, ["manufacturing", "industry", "b2b"]),

  G("shield", "Shield", {
    strokes: ["M50 20 L78 30 V52 C78 68 66 78 50 84 C34 78 22 68 22 52 V30 Z"],
  }, ["security", "trust", "insurance"]),

  G("lamp", "Lamp", {
    strokes: ["M50 18 V28", "M28 52 L50 28 L72 52 Z", "M40 52 A10 10 0 0 0 60 52"],
    accents: ["M34 66 L28 74 M66 66 L72 74 M50 70 V80"],
  }, ["interiors", "idea", "electrical"]),

  G("compass", "Compass", {
    strokes: ["M50 50 m-30 0 a30 30 0 1 0 60 0 a30 30 0 1 0 -60 0", "M64 36 L56 56 L36 64 L44 44 Z"],
  }, ["travel", "consulting", "direction"]),

  // --- professional, agency, creator --------------------------------------
  G("spark", "Spark", {
    fills: ["M50 16 L57 41 L82 48 L57 55 L50 80 L43 55 L18 48 L43 41 Z"],
  }, ["agency", "creative", "ai"]),

  G("prism", "Prism", {
    strokes: ["M50 20 L80 74 H20 Z"],
    accents: ["M50 20 V74 M35 47 H65"],
  }, ["studio", "design", "creative"]),

  G("layers", "Layers", {
    strokes: ["M50 20 L78 36 L50 52 L22 36 Z", "M22 50 L50 66 L78 50", "M22 64 L50 80 L78 64"],
  }, ["saas", "product", "stack"]),

  G("node", "Network", {
    strokes: ["M50 34 L26 68 M50 34 L74 68 M26 68 H74"],
    dots: [[50, 30, 9], [26, 70, 9], [74, 70, 9]],
  }, ["tech", "startup", "network"]),

  G("cursor", "Cursor", {
    strokes: ["M32 22 L74 46 L54 52 L46 74 Z"],
  }, ["digital", "agency", "web"]),

  G("pen", "Pen nib", {
    strokes: ["M50 18 L72 62 L50 82 L28 62 Z", "M50 44 V70"],
    dots: [[50, 60, 5]],
  }, ["design", "writer", "studio"]),

  G("quill", "Quill", {
    strokes: ["M24 78 C40 76 66 62 74 32 C50 26 30 44 26 68", "M24 78 L44 58"],
  }, ["writer", "legal", "heritage"]),

  G("brush", "Brush", {
    strokes: ["M62 20 L80 38 L48 70 L30 52 Z", "M30 52 L20 80 L48 70"],
  }, ["art", "design", "painting"]),

  G("book", "Book", {
    strokes: ["M50 32 V80", "M50 32 C42 25 27 24 20 28 V74 C27 70 42 71 50 80", "M50 32 C58 25 73 24 80 28 V74 C73 70 58 71 50 80"],
  }, ["coaching", "education", "publishing"]),

  G("camera", "Camera", {
    strokes: ["M18 38 H34 L40 28 H60 L66 38 H82 V76 H18 Z", "M50 56 m-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0"],
  }, ["photo", "creator", "studio"]),

  G("sun-rays", "Sun", {
    strokes: [
      "M50 50 m-16 0 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0",
      "M50 20 V28 M50 72 V80 M20 50 H28 M72 50 H80 M29 29 L35 35 M65 65 L71 71 M71 29 L65 35 M35 65 L29 71",
    ],
  }, ["solar", "wellness", "morning"]),

  G("petal", "Petal", {
    strokes: ["M50 18 C68 34 68 62 50 82 C32 62 32 34 50 18 Z"],
  }, ["beauty", "organic", "soft"]),

  G("arrow-up", "Growth arrow", {
    strokes: ["M50 82 V24", "M30 44 L50 24 L70 44"],
  }, ["finance", "growth", "startup"]),
];

export const GLYPH_MAP: Record<string, Glyph> = Object.fromEntries(
  GLYPHS.map((g) => [g.key, g]),
);

export function getGlyph(key: string): Glyph | undefined {
  return GLYPH_MAP[key];
}

export function glyphExists(key: string | undefined): boolean {
  return !!key && key in GLYPH_MAP;
}

/**
 * Picks from an industry's ranked glyph list, favouring the first entries but
 * leaving room for the later ones so two businesses in the same category don't
 * end up with the same symbol.
 */
export function pickGlyph(candidates: string[], rng: Rng): string {
  const valid = candidates.filter(glyphExists);
  if (!valid.length) return "spark";
  return rng.weighted(valid.map((value, i) => ({ value, weight: Math.max(1, valid.length - i) })));
}

/** Glyphs offered in the Logo Studio's icon picker, grouped for browsing. */
export function glyphsByTag(): { tag: string; glyphs: Glyph[] }[] {
  const groups = new Map<string, Glyph[]>();
  for (const glyph of GLYPHS) {
    for (const tag of glyph.tags) {
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag)!.push(glyph);
    }
  }
  return [...groups.entries()]
    .map(([tag, glyphs]) => ({ tag, glyphs }))
    .filter((g) => g.glyphs.length >= 2)
    .sort((a, b) => b.glyphs.length - a.glyphs.length);
}

export function searchGlyphs(query: string): Glyph[] {
  const q = query.trim().toLowerCase();
  if (!q) return GLYPHS;
  return GLYPHS.filter(
    (g) =>
      g.key.includes(q) ||
      g.label.toLowerCase().includes(q) ||
      g.tags.some((t) => t.includes(q)),
  );
}
