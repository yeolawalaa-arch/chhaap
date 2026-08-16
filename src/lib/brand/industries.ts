import type { ColorMood, MarkStyle, PatternKind, PersonalityTrait } from "@/types/brand";
import type { AssetKind } from "@/types/brand";
import type { FontFeel } from "@/lib/fonts/catalog";

/**
 * The Indian business taxonomy.
 *
 * This is the platform's core proprietary data. Each entry encodes what a
 * category actually needs — which marks read correctly for it, which colours
 * its customers expect, which assets it will genuinely print, and the language
 * its owners use — so the generator produces something a kirana owner or a
 * jewellery house would recognise as theirs, not a generic startup logo.
 */

export interface IndustryProfile {
  key: string;
  name: string;
  /** Shown in the picker; deliberately uses the vocabulary owners use. */
  hint: string;
  group: IndustryGroup;
  /** Glyph library keys ranked best-first. */
  glyphs: string[];
  markStyles: { value: MarkStyle; weight: number }[];
  /** Colour moods that suit the category, best-first. */
  moods: ColorMood[];
  /** Hue windows (degrees) that perform well in this category. */
  hueWindows: [number, number][];
  personality: PersonalityTrait[];
  patterns: PatternKind[];
  /** Assets this category almost always needs, in priority order. */
  priorityAssets: AssetKind[];
  /** Category-flavoured tagline scaffolds; `{name}` and `{city}` interpolate. */
  taglineSeeds: string[];
  /** Words that make good brand-name components for this category. */
  nameRoots: string[];
  voiceHint: string;
  packagingHint: string;
  /** Typical descriptor line under the name in a lockup. */
  descriptorSeeds: string[];

  // --- typographic constraints -------------------------------------------
  // Filled in from GROUP_TYPE_DEFAULTS below unless an entry overrides them,
  // so the table stays readable instead of repeating the same three fields
  // thirty times.
  /** Type feels that flatter the category. */
  typeFeels?: FontFeel[];
  /** Type feels that misread for the category. */
  avoidFeels?: FontFeel[];
  /**
   * True when the business lives or dies by a physical board read from across
   * a road. Rules out delicate high-contrast faces at the pairing stage.
   */
  needsSignage?: boolean;
}

export type IndustryGroup =
  | "food"
  | "retail"
  | "beauty"
  | "fashion"
  | "services"
  | "professional"
  | "property"
  | "industry"
  | "creator";

export const INDUSTRY_GROUPS: { key: IndustryGroup; label: string }[] = [
  { key: "food", label: "Food & Beverage" },
  { key: "retail", label: "Retail & Kirana" },
  { key: "beauty", label: "Beauty & Wellness" },
  { key: "fashion", label: "Fashion & Jewellery" },
  { key: "services", label: "Local Services" },
  { key: "professional", label: "Professional & Agency" },
  { key: "property", label: "Real Estate" },
  { key: "industry", label: "Manufacturing & Trade" },
  { key: "creator", label: "Creators & Coaches" },
];

export const INDUSTRIES: IndustryProfile[] = [
  {
    key: "kirana",
    name: "Kirana / General Store",
    hint: "Neighbourhood provision store, supermarket, daily needs",
    group: "retail",
    glyphs: ["basket", "shop-front", "grain-sack", "scale", "bag"],
    markStyles: [
      { value: "glyph", weight: 5 },
      { value: "monogram", weight: 3 },
      { value: "abstract-stack", weight: 2 },
    ],
    moods: ["warm", "vibrant", "earthy"],
    hueWindows: [[10, 45], [95, 145], [200, 225]],
    personality: ["friendly", "trustworthy", "warm"],
    patterns: ["grid-dots", "chevron", "mark-tile"],
    priorityAssets: [
      "signboard",
      "visiting_card",
      "whatsapp_profile",
      "shopping_bag",
      "invoice",
      "poster",
    ],
    taglineSeeds: [
      "Everything your home needs",
      "Fresh stock, fair price",
      "Your daily needs, sorted",
      "Ghar ka saara saamaan",
      "Quality you can trust, daily",
    ],
    nameRoots: ["Bazaar", "Mart", "Stores", "Provision", "Daily", "Ghar", "Apna", "Suvidha"],
    voiceHint: "plain-spoken, neighbourly, price-and-stock led",
    packagingHint: "sturdy kraft carry bags with a bold single-colour mark",
    descriptorSeeds: ["General Store", "Provision & Daily Needs", "Since {year}", "Kirana Store"],
  },
  {
    key: "restaurant",
    name: "Restaurant",
    hint: "Dine-in, family restaurant, thali house, dhaba",
    group: "food",
    glyphs: ["thali", "flame", "spoon-fork", "chef-hat", "leaf-spice", "pot"],
    markStyles: [
      { value: "glyph", weight: 4 },
      { value: "monogram", weight: 4 },
      { value: "abstract-petal", weight: 2 },
    ],
    moods: ["warm", "jewel", "earthy"],
    hueWindows: [[0, 30], [25, 48], [340, 360]],
    personality: ["warm", "traditional", "premium"],
    patterns: ["arches", "lattice", "mark-tile"],
    priorityAssets: [
      "menu",
      "signboard",
      "instagram_post",
      "visiting_card",
      "poster",
      "packaging",
    ],
    taglineSeeds: [
      "Cooked the way it should be",
      "Taste that brings you back",
      "Ghar jaisa swaad",
      "Every plate, a promise",
      "Slow-cooked, freshly served",
    ],
    nameRoots: ["Rasoi", "Tadka", "Angan", "Darbar", "Zaika", "Bhoj", "Swaad", "Chulha"],
    voiceHint: "appetising and hospitable, leads with dishes not adjectives",
    packagingHint: "printed parcel boxes and sleeves in one hot colour on kraft",
    descriptorSeeds: ["Family Restaurant", "Pure Veg", "Since {year}", "Multi-Cuisine"],
  },
  {
    key: "cafe",
    name: "Cafe / Chai Shop",
    hint: "Coffee shop, chai tapri, bakery cafe, dessert bar",
    group: "food",
    glyphs: ["cup", "chai-glass", "bean", "croissant", "steam"],
    markStyles: [
      { value: "glyph", weight: 4 },
      { value: "monogram", weight: 3 },
      { value: "lettermark-cut", weight: 3 },
    ],
    moods: ["earthy", "warm", "pastel"],
    hueWindows: [[15, 40], [140, 165], [330, 355]],
    personality: ["friendly", "modern", "handcrafted"],
    patterns: ["grid-dots", "waves", "mark-tile"],
    priorityAssets: [
      "menu",
      "instagram_post",
      "signboard",
      "packaging",
      "visiting_card",
      "instagram_story",
    ],
    taglineSeeds: [
      "Brewed slow, served warm",
      "Your third place",
      "One more cup",
      "Chai, conversation, repeat",
      "Small batch, big comfort",
    ],
    nameRoots: ["Adda", "Tapri", "Brew", "Roast", "Chaupal", "Kettle", "Cup", "Baithak"],
    voiceHint: "relaxed and personal, second-person, low on exclamation marks",
    packagingHint: "matte cups and sleeves, mark stamped in one colour",
    descriptorSeeds: ["Coffee & Bakes", "Chai & Snacks", "Est. {year}", "Roastery"],
  },
  {
    key: "cloud_kitchen",
    name: "Cloud Kitchen / Tiffin",
    hint: "Delivery-only kitchen, tiffin service, home chef",
    group: "food",
    glyphs: ["tiffin", "pot", "flame", "leaf-spice", "spoon-fork"],
    markStyles: [
      { value: "glyph", weight: 4 },
      { value: "monogram", weight: 3 },
      { value: "abstract-orbit", weight: 2 },
    ],
    moods: ["vibrant", "warm"],
    hueWindows: [[0, 25], [30, 50], [100, 140]],
    personality: ["friendly", "energetic", "warm"],
    patterns: ["grid-dots", "chevron"],
    priorityAssets: [
      "instagram_post",
      "packaging",
      "whatsapp_profile",
      "menu",
      "flyer",
      "product_label",
    ],
    taglineSeeds: [
      "Home food, delivered hot",
      "Cooked fresh, every order",
      "Ghar ka khana, roz",
      "Real food, real fast",
    ],
    nameRoots: ["Dabba", "Tiffin", "Rasoi", "Daily", "Fresh", "Ghar", "Thali"],
    voiceHint: "practical and warm, menu-and-timing led",
    packagingHint: "food-grade containers with a sticker label system",
    descriptorSeeds: ["Home Kitchen", "Tiffin Service", "Delivery Only"],
  },
  {
    key: "salon",
    name: "Salon & Spa",
    hint: "Hair salon, beauty parlour, spa, barbershop",
    group: "beauty",
    glyphs: ["scissors", "comb", "lotus", "mirror", "razor", "petal"],
    markStyles: [
      { value: "monogram", weight: 4 },
      { value: "glyph", weight: 3 },
      { value: "abstract-petal", weight: 3 },
    ],
    moods: ["jewel", "pastel", "monochrome"],
    hueWindows: [[275, 320], [330, 355], [160, 190]],
    personality: ["premium", "modern", "warm"],
    patterns: ["concentric", "lattice", "diagonal-stripes"],
    priorityAssets: [
      "signboard",
      "instagram_post",
      "visiting_card",
      "poster",
      "instagram_story",
      "menu",
    ],
    taglineSeeds: [
      "Look like yourself, only better",
      "Care that shows",
      "Your chair is ready",
      "Style, unhurried",
    ],
    nameRoots: ["Glow", "Studio", "Salon", "Roop", "Shringar", "Bloom", "Kanti", "Mirror"],
    voiceHint: "confident and caring, never body-critical",
    packagingHint: "soft-touch boxes for retail products, foil-look mark",
    descriptorSeeds: ["Hair & Beauty", "Unisex Salon", "Salon & Spa", "Est. {year}"],
  },
  {
    key: "clothing",
    name: "Clothing Brand",
    hint: "Apparel label, boutique, saree house, streetwear",
    group: "fashion",
    glyphs: ["thread", "hanger", "fold", "button", "loom"],
    markStyles: [
      { value: "monogram", weight: 5 },
      { value: "lettermark-cut", weight: 3 },
      { value: "wordmark-only", weight: 3 },
    ],
    moods: ["monochrome", "jewel", "earthy"],
    hueWindows: [[0, 20], [200, 240], [20, 40]],
    personality: ["premium", "minimal", "modern"],
    patterns: ["diagonal-stripes", "lattice", "mark-tile"],
    priorityAssets: [
      "instagram_post",
      "product_label",
      "shopping_bag",
      "visiting_card",
      "tshirt",
      "instagram_story",
    ],
    taglineSeeds: [
      "Made to be worn, not stored",
      "Cloth with a memory",
      "Everyday, elevated",
      "Cut for real life",
    ],
    nameRoots: ["Kapda", "Vastra", "Loom", "Thread", "Weave", "Taana", "Baana", "Studio"],
    voiceHint: "understated and tactile, talks about fabric and fit",
    packagingHint: "cotton bags and hang tags, mark blind-embossed or single-colour",
    descriptorSeeds: ["Clothing", "Apparel Co.", "Handloom", "Est. {year}"],
  },
  {
    key: "jewellery",
    name: "Jewellery Brand",
    hint: "Gold, silver, artificial jewellery, showroom",
    group: "fashion",
    glyphs: ["gem", "necklace", "lotus", "sun-rays", "ring"],
    markStyles: [
      { value: "monogram", weight: 5 },
      { value: "glyph", weight: 3 },
      { value: "abstract-petal", weight: 2 },
    ],
    moods: ["jewel", "monochrome"],
    hueWindows: [[35, 50], [0, 15], [255, 285]],
    personality: ["premium", "traditional", "trustworthy"],
    patterns: ["concentric", "lattice", "arches"],
    priorityAssets: [
      "visiting_card",
      "signboard",
      "instagram_post",
      "packaging",
      "letterhead",
      "poster",
    ],
    taglineSeeds: [
      "Kept for generations",
      "Weight you can trust",
      "Craft that outlives trend",
      "Hallmarked, always",
    ],
    nameRoots: ["Swarna", "Ratna", "Jewels", "Kalash", "Heera", "Aabharan", "Sona"],
    voiceHint: "assured and heritage-leaning, purity and craft over discounts",
    packagingHint: "rigid boxes with pouch inserts, foil-stamped mark",
    descriptorSeeds: ["Jewellers", "Fine Jewellery", "Since {year}", "Gold & Diamonds"],
  },
  {
    key: "footwear",
    name: "Footwear Brand",
    hint: "Shoes, sandals, sneakers, mochi/repair",
    group: "fashion",
    glyphs: ["shoe", "sole", "lace", "step", "thread"],
    markStyles: [
      { value: "lettermark-cut", weight: 4 },
      { value: "monogram", weight: 4 },
      { value: "abstract-stack", weight: 2 },
    ],
    moods: ["monochrome", "earthy", "vibrant"],
    hueWindows: [[0, 20], [20, 40], [210, 245]],
    personality: ["bold", "modern", "handcrafted"],
    patterns: ["diagonal-stripes", "chevron", "mark-tile"],
    priorityAssets: [
      "instagram_post",
      "packaging",
      "product_label",
      "shopping_bag",
      "visiting_card",
      "poster",
    ],
    taglineSeeds: [
      "Built for the long walk",
      "Every step, held",
      "Made to be worn out",
      "Comfort, mile after mile",
    ],
    nameRoots: ["Step", "Chaal", "Sole", "Pace", "Mochi", "Charan", "Stride"],
    voiceHint: "direct and durable-sounding, comfort and craft first",
    packagingHint: "printed shoe boxes with a repeating mark tile inside the lid",
    descriptorSeeds: ["Footwear", "Handcrafted Shoes", "Est. {year}"],
  },
  {
    key: "d2c",
    name: "D2C Brand",
    hint: "Direct-to-consumer product brand, wellness, home, packaged goods",
    group: "retail",
    glyphs: ["leaf-spice", "bottle", "jar", "drop", "sprout", "box"],
    markStyles: [
      { value: "abstract-petal", weight: 3 },
      { value: "monogram", weight: 3 },
      { value: "glyph", weight: 4 },
    ],
    moods: ["pastel", "earthy", "vibrant"],
    hueWindows: [[100, 150], [25, 45], [170, 200]],
    personality: ["modern", "friendly", "minimal"],
    patterns: ["grid-dots", "waves", "mark-tile"],
    priorityAssets: [
      "product_label",
      "packaging",
      "instagram_post",
      "website_hero",
      "shopping_bag",
      "instagram_story",
    ],
    taglineSeeds: [
      "Made small, made well",
      "Nothing you can't pronounce",
      "Straight from source",
      "Better basics",
    ],
    nameRoots: ["Nature", "Pure", "Shuddh", "Origin", "Roots", "Amrit", "Bhoomi", "Sattva"],
    voiceHint: "ingredient-honest and calm, avoids miracle claims",
    packagingHint: "label-led system with a consistent panel grid across SKUs",
    descriptorSeeds: ["{city}", "Small Batch", "Est. {year}", "Made in India"],
  },
  {
    key: "realestate",
    name: "Real Estate",
    hint: "Builder, broker, property consultant, interiors",
    group: "property",
    glyphs: ["house", "building", "key", "arch-door", "pillar"],
    markStyles: [
      { value: "glyph", weight: 4 },
      { value: "monogram", weight: 4 },
      { value: "abstract-stack", weight: 3 },
    ],
    moods: ["cool", "monochrome", "jewel"],
    hueWindows: [[200, 235], [35, 48], [155, 180]],
    personality: ["trustworthy", "premium", "modern"],
    patterns: ["lattice", "grid-dots", "concentric"],
    priorityAssets: [
      "visiting_card",
      "letterhead",
      "signboard",
      "brochure",
      "linkedin_banner",
      "poster",
    ],
    taglineSeeds: [
      "Addresses worth keeping",
      "Built on paperwork you can read",
      "Where the city is going next",
      "Property, without the runaround",
    ],
    nameRoots: ["Griha", "Nivas", "Estate", "Bhoomi", "Realty", "Aangan", "Sthal", "Vastu"],
    voiceHint: "precise and reassuring, specifics over superlatives",
    packagingHint: "presentation folders and site brochures on uncoated stock",
    descriptorSeeds: ["Realty", "Property Consultants", "Builders & Developers", "Since {year}"],
  },
  {
    key: "agency",
    name: "Agency / Studio",
    hint: "Marketing, design, IT services, consulting",
    group: "professional",
    glyphs: ["spark", "node", "prism", "arrow-up", "layers"],
    markStyles: [
      { value: "abstract-orbit", weight: 4 },
      { value: "lettermark-cut", weight: 3 },
      { value: "monogram", weight: 3 },
    ],
    moods: ["cool", "monochrome", "vibrant"],
    hueWindows: [[220, 265], [265, 300], [0, 15]],
    personality: ["modern", "bold", "technical"],
    patterns: ["grid-dots", "diagonal-stripes", "concentric"],
    priorityAssets: [
      "linkedin_banner",
      "letterhead",
      "visiting_card",
      "website_hero",
      "invoice",
      "brochure",
    ],
    taglineSeeds: [
      "Work that ships",
      "Fewer decks, more outcomes",
      "Built to be measured",
      "Strategy you can act on",
    ],
    nameRoots: ["Labs", "Works", "Studio", "Collective", "Forge", "Yantra", "Kaarya", "Nexus"],
    voiceHint: "sharp and specific, claims backed by numbers",
    packagingHint: "not applicable — invest in deck and document templates instead",
    descriptorSeeds: ["Studio", "Consulting", "Digital Agency", "Est. {year}"],
  },
  {
    key: "freelancer",
    name: "Freelancer",
    hint: "Solo designer, developer, photographer, writer",
    group: "creator",
    glyphs: ["pen", "camera", "cursor", "spark", "quill"],
    markStyles: [
      { value: "monogram", weight: 5 },
      { value: "lettermark-cut", weight: 3 },
      { value: "wordmark-only", weight: 2 },
    ],
    moods: ["monochrome", "cool", "vibrant"],
    hueWindows: [[0, 20], [240, 275], [155, 180]],
    personality: ["minimal", "modern", "handcrafted"],
    patterns: ["grid-dots", "diagonal-stripes"],
    priorityAssets: [
      "visiting_card",
      "invoice",
      "linkedin_banner",
      "instagram_profile",
      "letterhead",
      "website_hero",
    ],
    taglineSeeds: [
      "One person, all in",
      "Small studio, sharp work",
      "Available for select projects",
      "Design that earns its keep",
    ],
    nameRoots: ["Studio", "Works", "Co.", "Craft", "Atelier", "Kalam", "Chitra"],
    voiceHint: "first-person and candid, portfolio-led",
    packagingHint: "not applicable — focus on invoice and proposal templates",
    descriptorSeeds: ["Design Studio", "Photography", "Independent", "{city}"],
  },
  {
    key: "coach",
    name: "Coach / Educator",
    hint: "Tuition, coaching class, fitness trainer, online course",
    group: "creator",
    glyphs: ["book", "lamp", "sprout", "arrow-up", "compass"],
    markStyles: [
      { value: "glyph", weight: 4 },
      { value: "monogram", weight: 4 },
      { value: "abstract-orbit", weight: 2 },
    ],
    moods: ["cool", "vibrant", "warm"],
    hueWindows: [[205, 240], [15, 40], [140, 170]],
    personality: ["trustworthy", "energetic", "friendly"],
    patterns: ["concentric", "grid-dots", "chevron"],
    priorityAssets: [
      "instagram_post",
      "poster",
      "visiting_card",
      "youtube_banner",
      "flyer",
      "whatsapp_profile",
    ],
    taglineSeeds: [
      "Results you can measure",
      "Learn it once, properly",
      "Small batches, full attention",
      "Progress, every week",
    ],
    nameRoots: ["Vidya", "Gurukul", "Path", "Academy", "Shiksha", "Uday", "Prayas", "Disha"],
    voiceHint: "encouraging and concrete, outcomes and schedules up front",
    packagingHint: "not applicable — invest in worksheets and certificate templates",
    descriptorSeeds: ["Coaching Classes", "Academy", "Since {year}", "{city}"],
  },
  {
    key: "local_service",
    name: "Local Service",
    hint: "Electrician, plumber, packers & movers, laundry, repairs",
    group: "services",
    glyphs: ["wrench", "bolt", "truck", "drop", "gear", "brush"],
    markStyles: [
      { value: "glyph", weight: 5 },
      { value: "monogram", weight: 3 },
      { value: "abstract-stack", weight: 1 },
    ],
    moods: ["vibrant", "cool"],
    hueWindows: [[205, 235], [35, 50], [0, 20]],
    personality: ["trustworthy", "friendly", "bold"],
    patterns: ["chevron", "diagonal-stripes", "grid-dots"],
    priorityAssets: [
      "visiting_card",
      "signboard",
      "flyer",
      "whatsapp_profile",
      "invoice",
      "poster",
    ],
    taglineSeeds: [
      "On time, every time",
      "Call once, fixed once",
      "Same-day service",
      "Honest work, fair rate",
    ],
    nameRoots: ["Seva", "Fix", "Care", "Sahayak", "Quick", "Sudhaar", "Bandhu"],
    voiceHint: "practical and reassuring, leads with response time and phone number",
    packagingHint: "not applicable — put the mark on van livery and uniforms",
    descriptorSeeds: ["Services", "Repairs & Service", "{city}", "24×7"],
  },
  {
    key: "startup",
    name: "Startup",
    hint: "App, SaaS, fintech, marketplace",
    group: "professional",
    glyphs: ["spark", "node", "arrow-up", "prism", "shield", "layers"],
    markStyles: [
      { value: "abstract-orbit", weight: 4 },
      { value: "abstract-stack", weight: 3 },
      { value: "lettermark-cut", weight: 3 },
    ],
    moods: ["cool", "vibrant"],
    hueWindows: [[225, 270], [155, 180], [270, 300]],
    personality: ["modern", "technical", "bold"],
    patterns: ["grid-dots", "concentric", "waves"],
    priorityAssets: [
      "website_hero",
      "linkedin_banner",
      "instagram_post",
      "visiting_card",
      "letterhead",
      "instagram_profile",
    ],
    taglineSeeds: [
      "The simple way to {verb}",
      "Built for how India actually works",
      "Less process, more progress",
      "Made for the next hundred million",
    ],
    nameRoots: ["Setu", "Yatra", "Kosh", "Flow", "Lekha", "Udaan", "Kite", "Arc"],
    voiceHint: "clear and unhyped, explains the job to be done in one line",
    packagingHint: "not applicable — focus on app icon and store assets",
    descriptorSeeds: ["Technologies", "Labs", "{city}", "Est. {year}"],
  },
  {
    key: "manufacturer",
    name: "Manufacturer / Trader",
    hint: "Factory, wholesale, exports, B2B supply",
    group: "industry",
    glyphs: ["gear", "factory", "box", "shield", "pillar", "scale"],
    markStyles: [
      { value: "monogram", weight: 4 },
      { value: "glyph", weight: 4 },
      { value: "abstract-stack", weight: 2 },
    ],
    moods: ["cool", "monochrome", "earthy"],
    hueWindows: [[205, 235], [0, 18], [30, 45]],
    personality: ["trustworthy", "bold", "technical"],
    patterns: ["chevron", "lattice", "diagonal-stripes"],
    priorityAssets: [
      "letterhead",
      "visiting_card",
      "invoice",
      "brochure",
      "packaging",
      "signboard",
    ],
    taglineSeeds: [
      "Supplying since {year}",
      "Specification, met",
      "Volume without variance",
      "Built to tolerance",
    ],
    nameRoots: ["Udyog", "Industries", "Works", "Enterprises", "Nirman", "Shakti", "Bharat"],
    voiceHint: "specification-led and formal, certifications and capacity up front",
    packagingHint: "master cartons with stencil-style marks and clear grade panels",
    descriptorSeeds: ["Industries", "Enterprises", "Est. {year}", "Manufacturers & Exporters"],
  },
  {
    key: "healthcare",
    name: "Clinic / Healthcare",
    hint: "Doctor, dental, diagnostics, pharmacy, wellness",
    group: "services",
    glyphs: ["pulse", "cross-care", "lotus", "shield", "drop"],
    markStyles: [
      { value: "glyph", weight: 5 },
      { value: "monogram", weight: 3 },
      { value: "abstract-petal", weight: 2 },
    ],
    moods: ["cool", "pastel"],
    hueWindows: [[160, 195], [200, 225], [140, 165]],
    personality: ["trustworthy", "warm", "minimal"],
    patterns: ["concentric", "grid-dots"],
    priorityAssets: [
      "visiting_card",
      "letterhead",
      "signboard",
      "invoice",
      "poster",
      "whatsapp_profile",
    ],
    taglineSeeds: [
      "Care that listens",
      "Right diagnosis, first",
      "Health, close to home",
      "Appointments that run on time",
    ],
    nameRoots: ["Arogya", "Swasthya", "Care", "Jeevan", "Nirog", "Sanjivani", "Ayu"],
    voiceHint: "calm and plain, never over-promises outcomes",
    packagingHint: "not applicable — prioritise prescription pads and signage",
    descriptorSeeds: ["Clinic", "Multi-Speciality", "Diagnostics", "Since {year}"],
  },
];

/**
 * Typographic defaults per business group.
 *
 * These encode observations about what actually works on Indian high streets
 * and feeds: retail and services need faces that survive a vinyl print read
 * from ten metres, jewellery and property can carry high-contrast serifs
 * because their touchpoints are held in the hand, and creator brands can take
 * risks their customers reward rather than distrust.
 */
const GROUP_TYPE_DEFAULTS: Record<
  IndustryGroup,
  { typeFeels: FontFeel[]; avoidFeels: FontFeel[]; needsSignage: boolean }
> = {
  food: {
    typeFeels: ["rounded", "slab", "humanist", "serif-classic"],
    avoidFeels: ["condensed"],
    needsSignage: true,
  },
  retail: {
    typeFeels: ["rounded", "geometric", "slab", "grotesque"],
    // Delicate moderns disappear on a painted board and in low-res WhatsApp
    // forwards, which is where these businesses are actually seen.
    avoidFeels: ["serif-modern", "serif-classic"],
    needsSignage: true,
  },
  beauty: {
    typeFeels: ["serif-modern", "geometric", "humanist"],
    avoidFeels: ["slab"],
    needsSignage: true,
  },
  fashion: {
    typeFeels: ["serif-modern", "serif-classic", "geometric"],
    avoidFeels: ["rounded", "slab"],
    needsSignage: false,
  },
  services: {
    typeFeels: ["grotesque", "geometric", "slab"],
    avoidFeels: ["serif-classic"],
    needsSignage: true,
  },
  professional: {
    typeFeels: ["grotesque", "geometric", "humanist"],
    avoidFeels: ["rounded"],
    needsSignage: false,
  },
  property: {
    typeFeels: ["serif-modern", "grotesque", "geometric"],
    avoidFeels: ["rounded"],
    needsSignage: true,
  },
  industry: {
    typeFeels: ["grotesque", "condensed", "slab", "geometric"],
    avoidFeels: ["serif-classic", "rounded"],
    needsSignage: true,
  },
  creator: {
    typeFeels: ["geometric", "grotesque", "serif-modern"],
    avoidFeels: [],
    needsSignage: false,
  },
};

/** Applies group defaults to any entry that did not state its own. */
function withTypeDefaults(profile: IndustryProfile): IndustryProfile {
  const defaults = GROUP_TYPE_DEFAULTS[profile.group];
  return {
    ...profile,
    typeFeels: profile.typeFeels ?? defaults.typeFeels,
    avoidFeels: profile.avoidFeels ?? defaults.avoidFeels,
    needsSignage: profile.needsSignage ?? defaults.needsSignage,
  };
}

for (let i = 0; i < INDUSTRIES.length; i++) INDUSTRIES[i] = withTypeDefaults(INDUSTRIES[i]!);

export const INDUSTRY_MAP: Record<string, IndustryProfile> = Object.fromEntries(
  INDUSTRIES.map((i) => [i.key, i]),
);

export function getIndustry(key: string): IndustryProfile {
  return INDUSTRY_MAP[key] ?? INDUSTRY_MAP.startup!;
}

export function industriesByGroup(): { group: IndustryGroup; label: string; items: IndustryProfile[] }[] {
  return INDUSTRY_GROUPS.map((g) => ({
    group: g.key,
    label: g.label,
    items: INDUSTRIES.filter((i) => i.group === g.key),
  })).filter((g) => g.items.length > 0);
}
