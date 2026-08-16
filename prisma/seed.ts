import { PrismaClient } from "@prisma/client";
import { PLAN_SEED } from "../src/lib/billing/plans";
import { ASSET_LIST } from "../src/lib/render/assets/definitions";
import { INDUSTRIES } from "../src/lib/brand/industries";

const db = new PrismaClient();

/**
 * Seeds the reference data the app needs to run: plans, templates and a small
 * amount of blog content. Idempotent — every write is an upsert keyed on a
 * stable natural key, so running it twice is safe.
 */

const encode = (value: unknown) => JSON.stringify(value ?? null);

async function seedPlans() {
  for (const plan of PLAN_SEED) {
    await db.plan.upsert({
      where: { key: plan.key },
      create: {
        key: plan.key,
        name: plan.name,
        description: plan.description,
        priceInr: plan.priceInr,
        priceInrYear: plan.priceInrYear,
        limitsJson: encode(plan.limits),
        featuresJson: encode(plan.features),
        isPopular: plan.isPopular,
        sortOrder: plan.sortOrder,
      },
      // Price and copy are admin-editable, so an existing row keeps its values.
      // Limits are code-owned and always re-synced.
      update: { limitsJson: encode(plan.limits) },
    });
  }
  console.log(`✓ ${PLAN_SEED.length} plans`);
}

async function seedTemplates() {
  let count = 0;

  // A universal template per asset kind — the default arrangement.
  for (const asset of ASSET_LIST) {
    await db.template.upsert({
      where: { key: `universal-${asset.kind}` },
      create: {
        key: `universal-${asset.kind}`,
        kind: asset.kind,
        name: asset.name,
        description: asset.description,
        category: "universal",
        tier: asset.tier,
        configJson: encode({ defaults: asset.defaults }),
        sortOrder: 0,
      },
      update: { name: asset.name, description: asset.description, tier: asset.tier },
    });
    count++;
  }

  // Category-flavoured presets: each industry's priority assets get a variant
  // pre-filled with content that suits the category.
  for (const industry of INDUSTRIES) {
    for (const [index, kind] of industry.priorityAssets.slice(0, 3).entries()) {
      const asset = ASSET_LIST.find((a) => a.kind === kind);
      if (!asset) continue;

      await db.template.upsert({
        where: { key: `${industry.key}-${kind}` },
        create: {
          key: `${industry.key}-${kind}`,
          kind,
          name: `${industry.name} — ${asset.name}`,
          description: `${asset.description} Preset for ${industry.name.toLowerCase()}.`,
          category: industry.key,
          tier: asset.tier,
          configJson: encode({
            defaults: {
              ...asset.defaults,
              ...(kind === "signboard" ? { subline: industry.descriptorSeeds[0] } : {}),
              ...(kind === "instagram_post" ? { headline: industry.taglineSeeds[0] } : {}),
            },
          }),
          sortOrder: index + 1,
        },
        update: {},
      });
      count++;
    }
  }

  console.log(`✓ ${count} templates`);
}

const POSTS = [
  {
    slug: "how-to-name-your-indian-business",
    title: "How to name your Indian business (without regretting it in year three)",
    excerpt:
      "Place-led, root-led or coined? The three naming patterns Indian businesses actually use, and what each one costs you later.",
    tags: ["naming", "branding"],
    readMinutes: 7,
    body: `Most naming advice is written for software companies. It does not survive contact with a shop on a street where six competitors already trade under a version of the same word.

## The three patterns

**Place-led.** *Indore Sweets*, *Chennai Silks*. Instant local trust and the easiest to explain to a customer standing in front of you. The cost arrives when you open a second location — and it is a real cost, because renaming after five years throws away every rupee of recognition you built.

**Root-led.** A Sanskrit or Hindi word with meaning, paired with a category word: *Sattva Provisions*, *Dhara Textiles*. Customers grasp the meaning immediately, and it travels to other cities. This is the pattern most businesses should default to.

**Coined.** A single invented word — hardest to secure, easiest to own. Only worth it if you are building something that will outgrow its category.

## The test that matters

Say it out loud to someone over a bad phone line. If they can spell it back to you, it works on a signboard, in a WhatsApp forward, and in a domain name.

## Before you commit

Check the domain and check the registrar of companies. Chhaap's name generator runs live RDAP lookups so the availability you see is a real registry answer, not a guess.`,
  },
  {
    slug: "logo-black-and-white-test",
    title: "If your logo fails in black and white, it fails",
    excerpt:
      "The single cheapest test of a logo, why it matters more in India than most places, and how to run it in ten seconds.",
    tags: ["logo", "design"],
    readMinutes: 5,
    body: `Convert your logo to greyscale. If the mark disappears into the background, or two colours collapse into the same grey, the logo is not finished.

## Why this matters more here

A logo in India lives on surfaces that do not care about your palette:

- A rubber stamp on a receipt
- A single-colour screen print on a carry bag
- A photocopied invoice
- A newspaper classified
- A vinyl cut for a board, where every colour costs extra

Each of those is one colour. If your identity only works in full colour, it does not work on the surfaces your customers actually touch.

## The failure mode nobody catches

Two colours can have completely different hues and near-identical *lightness*. A mid-blue and a mid-orange look nothing alike — until you desaturate them, and they become the same grey.

The fix is not a different hue. It is a different lightness. Make one colour meaningfully lighter or darker than the other, not just a different colour.

## Running the test

Chhaap runs this automatically and refuses to call a brand ready if it fails — greyscale separation is one of the eight checks behind your Brand Readiness score.`,
  },
  {
    slug: "print-sizes-indian-businesses",
    title: "The print sizes Indian printers actually use",
    excerpt:
      "Visiting cards, signboards and flex banners — the dimensions your local press expects, and why the international defaults get rejected.",
    tags: ["print", "practical"],
    readMinutes: 6,
    body: `Send a printer the wrong trim size and one of two things happens: they reject the file, or they scale it and crop your logo. Neither is discovered until you collect five hundred cards.

## Visiting cards

The standard sold by most Indian printers is **89 × 51 mm**. The US standard is 3.5 × 2 inches — 88.9 × 50.8 mm. Close enough that people assume they are interchangeable, and different enough that a design running to the edge loses about a millimetre.

Always add **3 mm bleed** on every side. Anything touching the edge must extend into it.

## Stationery

A-series throughout. A4 (210 × 297 mm) for letterheads and invoices, A5 (148 × 210 mm) for flyers, A3 (297 × 420 mm) for posters.

## Signboards

Flex and vinyl are quoted in feet. A **4 × 2 ft** board is the common shopfront size. Do not send these at 300 dpi — a board is read from across a road, and 72 dpi at full size is plenty. A 300 dpi 4-foot board is a file your printer cannot open.

## Colour

Give your printer hex values and ask them to convert using their own ICC profile. Unmanaged CMYK conversions — including the ones in most brand guideline PDFs, Chhaap's included — are for reference only.`,
  },
];

async function seedBlog() {
  for (const post of POSTS) {
    await db.blogPost.upsert({
      where: { slug: post.slug },
      create: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        body: post.body,
        tags: encode(post.tags),
        readMinutes: post.readMinutes,
        isPublished: true,
        publishedAt: new Date(),
        seoTitle: post.title,
        seoDesc: post.excerpt,
      },
      update: { body: post.body, excerpt: post.excerpt },
    });
  }
  console.log(`✓ ${POSTS.length} blog posts`);
}

async function seedSettings() {
  const settings: [string, unknown][] = [
    ["showcase.featured_limit", 12],
    ["signup.welcome_credits", 10],
    ["export.max_concurrent", 3],
  ];
  for (const [key, value] of settings) {
    await db.setting.upsert({
      where: { key },
      create: { key, valueJson: encode(value) },
      update: {},
    });
  }
  console.log(`✓ ${settings.length} settings`);
}

async function main() {
  console.log("Seeding Chhaap…\n");
  await seedPlans();
  await seedTemplates();
  await seedBlog();
  await seedSettings();
  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
