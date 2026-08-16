# Chhaap

**Build a brand, not just a logo.**

A branding platform for Indian businesses. A user answers five questions about
their business and gets a complete, internally-consistent brand identity — logo
in eight variations, palette, typography, patterns, brand voice, and business
assets from visiting cards to shop signboards — all rendered from one system.

*Chhaap* (छाप) means an imprint or impression: the mark a business leaves.

---

## Running it

```bash
npm install
npm run setup   # SQLite schema + fonts + seed data
npm run dev
```

`npm run setup` mirrors the PostgreSQL schema onto SQLite, downloads 76 OFL font
files, and seeds plans, templates and blog content. Nothing else is required —
no API keys, no external services.

For PostgreSQL (the production target), set `DATABASE_URL` and use
`npm run db:generate && npm run db:push` instead.

Copy `.env.example` to `.env`. Only `DATABASE_URL` and `AUTH_SECRET` are
required.

---

## The core design decision

**The visual system is deterministic. Only the words come from a language
model.**

Palettes, type pairings, marks and layouts are computed by the Brand Brain
(`src/lib/brand/`) from curated data and explicit rules, seeded from the brief.
This is not a fallback for a missing API key — it is the product:

- **It can be held to a standard.** A generated palette is contrast-corrected to
  WCAG before it is shown. A model asked for "a nice hex colour" cannot promise
  4.5:1 against the surface.
- **It is reproducible.** The same brief always produces the same brand. A logo
  that quietly changed shape between page loads would be unusable.
- **It costs nothing per generation** and works with no network.

Setting `AI_PROVIDER=anthropic` layers a model over naming, taglines, voice and
captions. The visual system is unchanged either way, so a model outage degrades
copy quality and nothing else.

---

## Architecture

```
src/
  types/brand.ts          The domain contract. BrandIdentitySpec is the single
                          source of truth every pixel derives from.
  lib/
    brand/                The Brand Brain — 17 Indian business categories,
                          11 languages, 12 personality traits, palette and type
                          engines, voice, direction generation, quality scoring.
    render/               SVG engine. 67 hand-authored glyphs, mark composition,
                          8 logo variations, patterns, 19 asset templates with
                          real Indian print dimensions.
    export/               SVG (native), vector PDF with embedded fonts, brand
                          guidelines document, ZIP kit.
    ai/                   Provider abstraction. Heuristic + Anthropic.
    auth/                 scrypt passwords, JWT sessions with server-side
                          revocation, Google OAuth with PKCE, OTP, reset.
    billing/              Plans, entitlements, quota metering.
```

**Consistency is structural, not conventional.** A visiting card and a signboard
both call `placeLogo()`, which calls `buildLogoDocument()`, which reads the same
`BrandIdentitySpec`. There is no second renderer that can drift. The Logo Studio
round-trips through that same renderer, so what you drag is literally what
exports.

**Authorization is a choke point.** Every brand read and write goes through
`loadBrand(brandId, userId)`. Routes never query `db.brand` directly.
Non-owners get a 404, not a 403 — a 403 confirms the record exists.

---

## What is genuinely real

- **SVG export is the source file.** The whole engine is vector — nothing is
  traced from a bitmap.
- **PDF export is true vector** with fonts embedded via pdfkit, so a print shop
  that has never heard of Baloo 2 still renders what you approved.
- **PNG/JPG are rasterised in the browser** from the same SVG. This uses the
  browser's own text shaping, which matters for Indic scripts, and keeps a
  native image dependency out of deployment.
- **Domain availability** uses live RDAP registry lookups. Social handles are
  reported as *not checked*, because no compliant public API exists — the UI
  never guesses.
- **Brand Readiness** runs eight measurements — contrast ratios, greyscale
  separation, stroke weight at 32px, tracking limits for the brand's script,
  wordmark width, print reproduction risk — each with a specific fix.

---

## Known limitation: Indic conjuncts in PDF

PDF export can render conjunct characters incorrectly. `शर्मा` may export as
`शमा` — the `र्` is dropped. pdfkit does not apply full Indic OpenType shaping.

This is detected (`src/lib/export/shaping.ts`) and surfaced to the user next to
the download, with a note in the brand kit README, because the failure mode —
a business's own name misspelled on 500 printed cards — is too expensive to
leave silent. SVG and PNG render these correctly; the recommendation is to give
printers the SVG.

Fixing it properly means either a shaping-capable PDF pipeline or converting
Indic text to outlines at export.

---

## Built and verified

Landing page · signup/login/OTP/password reset · Google OAuth · 5-step brand
wizard · direction picker · brand workspace · Brand Kit page · **Logo Studio**
(drag, layers, undo/redo, alignment, duplicate, live re-render, per-layer
properties) · export (SVG/PNG/PDF/ZIP with plan gating) · brand guidelines PDF ·
pricing · public brand pages · showcase gallery · quota metering · rate limiting

Verified end to end in the browser: signup → wizard → 4 directions → select →
8 variations → studio edit → save (score rescored 94/100) → PNG export
rasterised to a real file → SVG correctly gated behind Pro.

## Not built

These are scoped but not implemented. No UI links point at them.

- **Admin dashboard** — schema, plans-as-rows and the `admin` role exist; the
  panel does not.
- **Business asset editor UI** — all 19 templates render and export via the API
  and appear in the brand kit ZIP; there is no page to edit their field values.
- **Brand name generator UI** — `heuristicNames()` and the RDAP domain checker
  are implemented; no page wires them up.
- **Blog and SEO landing pages** — posts are seeded in the database; no routes
  render them.
- **Payments** — gateway architecture and `PAYMENT_GATEWAY` config exist;
  no checkout. Pricing says so on the page rather than pretending.
- **Teams, settings, downloads history pages** — schema exists, UI does not.
- **Marketplace** — deliberately only scaffolded (`Template.authorId`,
  `priceInr`, `commissionBps`, `marketplaceState`).

---

## Commands

| | |
|---|---|
| `npm run dev` | Development server |
| `npm run setup` | SQLite + fonts + seed, one shot |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run fonts:fetch` | Download OFL fonts, regenerate `fonts.css` |
| `npm run db:studio:local` | Prisma Studio against SQLite |

All typefaces are SIL Open Font Licence, so user exports are cleared for
commercial use.
