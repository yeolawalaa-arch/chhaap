import { FONTS, type FontDef, fontsForScript, getFont, resolveWeight } from "@/lib/fonts/catalog";
import { safeTracking } from "@/lib/brand/languages";
import type { Rng } from "@/lib/brand/rng";
import type { TraitProfile } from "@/lib/brand/personality";
import type { IndustryProfile } from "@/lib/brand/industries";
import type { BrandTypography, FontSpec, LanguageCode, ScriptCode } from "@/types/brand";

/**
 * Type pairing.
 *
 * Rather than sampling two fonts and hoping, the engine scores every candidate
 * against the personality profile, picks a display face, then chooses a body
 * face that *contrasts* with it on the serif/sans axis while staying a
 * workhorse. That contrast rule is the difference between a pairing and two
 * fonts sitting next to each other.
 */

interface ScoredFont {
  font: FontDef;
  score: number;
}

function scoreDisplay(font: FontDef, profile: TraitProfile, industry: IndustryProfile): number {
  // Primary signal: does the face sit where the personality wants on serif↔sans?
  let score = 3 - Math.abs(font.sansScore - profile.sansBias) * 2.2;

  // The face must be able to render the weight the personality is asking for.
  const nearestWeight = font.weights.reduce((b, w) =>
    Math.abs(w - profile.weight) < Math.abs(b - profile.weight) ? w : b,
  );
  score -= Math.abs(nearestWeight - profile.weight) / 320;

  if (industry.typeFeels?.includes(font.feel)) score += 1.1;
  if (industry.avoidFeels?.includes(font.feel)) score -= 2.2;

  // Signage-heavy categories cannot use faces that thin out at distance.
  if (industry.needsSignage && !font.workhorse) score -= 0.9;

  return score;
}

/**
 * Body type is chosen for reading, not for contrast.
 *
 * The naive rule — "maximise the serif/sans distance from the display face" —
 * produces a slab or serif body under every sans display, which is a pairing
 * almost no working brand system uses. In practice the body face carries
 * addresses, prices, GST numbers and menu lines at 8–11pt, so legibility
 * dominates and the real convention is narrower: a serif display takes a sans
 * body; a sans display takes a *different* sans, or the same family at a
 * lighter weight. A serif body is a deliberate editorial choice, earned only by
 * traditional or handcrafted personalities.
 */
function scoreBody(font: FontDef, display: FontDef, profile: TraitProfile): number {
  if (!font.categories.includes("body")) return -Infinity;
  let score = 0;

  // Small-size legibility is the primary criterion.
  if (font.workhorse) score += 2.4;

  const displayIsSerif = display.sansScore < 0;
  const bodyIsSerif = font.sansScore < 0;

  if (displayIsSerif) {
    // Classic and safe: serif headline, sans text.
    score += bodyIsSerif ? -1.4 : 2.2;
  } else {
    // Sans display. A sans body is the default; a serif body has to be
    // justified by the brand's personality rather than by novelty.
    if (bodyIsSerif) {
      const earnsSerif = profile.traits.some(
        (t) => t.id === "traditional" || t.id === "handcrafted" || t.id === "premium",
      );
      score += earnsSerif ? 0.6 : -1.8;
    } else {
      score += 1.6;
      // Two near-identical grotesques look like a mistake, not a system.
      const delta = Math.abs(font.sansScore - display.sansScore);
      if (font.family !== display.family && delta < 0.06) score -= 0.7;
    }
  }

  // A single-family system is disciplined and cheap to load — a real choice for
  // minimal brands, and never a bad one when the family has the range.
  if (font.family === display.family) {
    score += profile.traits.some((t) => t.id === "minimal" || t.id === "technical") ? 1.2 : 0.2;
  }

  return score;
}

function topPick(scored: ScoredFont[], rng: Rng, spread = 3): FontDef {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const pool = sorted.slice(0, Math.max(1, Math.min(spread, sorted.length)));
  // Weighted by score so the best face wins most of the time, but different
  // directions for the same brief still differ.
  return rng.weighted(
    pool.map((s, i) => ({ value: s.font, weight: Math.max(0.2, s.score + (pool.length - i) * 0.4) })),
  );
}

export interface TypographyOptions {
  industry: IndustryProfile;
  profile: TraitProfile;
  language: LanguageCode;
  script: ScriptCode;
  rng: Rng;
  /** Forces a serif or sans display face; used to differentiate directions. */
  forceDisplay?: "serif" | "sans";
}

export function generateTypography({
  industry,
  profile,
  language,
  script,
  rng,
  forceDisplay,
}: TypographyOptions): BrandTypography {
  // Display candidates must cover Latin — the business name is set in Latin in
  // every lockup, with the local script as an optional second line.
  let displayPool = fontsForScript("latin", "display");
  if (forceDisplay === "serif") displayPool = displayPool.filter((f) => f.sansScore < 0);
  if (forceDisplay === "sans") displayPool = displayPool.filter((f) => f.sansScore > 0);
  if (!displayPool.length) displayPool = fontsForScript("latin", "display");

  const display = topPick(
    displayPool.map((font) => ({ font, score: scoreDisplay(font, profile, industry) })),
    rng,
  );

  const bodyPool = fontsForScript("latin", "body");
  const body = topPick(
    bodyPool.map((font) => ({ font, score: scoreBody(font, display, profile) })),
    rng,
    2,
  );

  // Local-script face: prefer one that shares the display family (Poppins and
  // Baloo 2 both ship Devanagari), otherwise fall back to the Noto for the
  // script, which is metric-compatible across all of them.
  let local: FontDef | undefined;
  if (script !== "latin") {
    const sameFamily = display.scripts.includes(script) ? display : undefined;
    const candidates = fontsForScript(script, "local");
    local =
      sameFamily ??
      // Match the serif/sans feel of the display face where the script offers a
      // choice; today only Devanagari does.
      candidates.find((f) => Math.sign(f.sansScore) === Math.sign(display.sansScore)) ??
      candidates[0];
  }

  const displayCaps = profile.capsBias > 0.25;
  const displayTracking = safeTracking(
    language,
    displayCaps
      ? Math.max(0.04, profile.tracking + 0.06)
      : display.idealTracking + profile.tracking * 0.4,
  );

  const displaySpec: FontSpec = {
    family: display.family,
    weight: resolveWeight(display.family, profile.weight),
    letterSpacing: round3(displayTracking),
    transform: displayCaps ? "uppercase" : "none",
  };

  const bodySpec: FontSpec = {
    family: body.family,
    weight: resolveWeight(body.family, 400),
    letterSpacing: round3(safeTracking(language, body.idealTracking)),
    transform: "none",
  };

  const localSpec: FontSpec | undefined = local
    ? {
        family: local.family,
        weight: resolveWeight(local.family, Math.min(600, profile.weight)),
        // Indic scripts break when tracked; safeTracking clamps this to ~0.
        letterSpacing: round3(safeTracking(language, 0.01)),
        transform: "none",
      }
    : undefined;

  return {
    display: displaySpec,
    body: bodySpec,
    local: localSpec,
    // Tighter ratio for minimal/technical brands, looser for expressive ones.
    scaleRatio: round3(1.2 + Math.max(0, profile.contrast) * 0.14 + (displayCaps ? 0.03 : 0)),
  };
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** Human explanation of the pairing, shown in the kit and the strategy panel. */
export function describeTypography(typography: BrandTypography): string {
  const display = getFont(typography.display.family);
  const body = getFont(typography.body.family);
  const local = typography.local ? getFont(typography.local.family) : undefined;

  const parts: string[] = [];
  if (display) parts.push(`**${display.family}** carries the name. ${display.note}`);
  if (body && body.family !== display?.family) {
    parts.push(`**${body.family}** handles everything else. ${body.note}`);
  } else if (body) {
    parts.push(
      `The same family runs through body copy at a lighter weight — a single-family system that stays disciplined and cuts licensing and loading overhead.`,
    );
  }
  if (local) {
    parts.push(
      `**${local.family}** sets the local-script name. ${local.note} It is metric-matched to the Latin face so bilingual lockups sit on a shared baseline instead of drifting.`,
    );
  }
  if (typography.display.transform === "uppercase") {
    parts.push(
      `The display face is set in caps with ${(typography.display.letterSpacing * 1000).toFixed(0)}/1000 em tracking — caps need the extra air to avoid closing up at small sizes.`,
    );
  }
  return parts.join(" ");
}

/** CSS `font-family` stack with sensible fallbacks for a spec. */
export function fontStack(spec: FontSpec): string {
  const font = getFont(spec.family);
  const generic = font && font.sansScore < 0 ? "serif" : "sans-serif";
  return `"${spec.family}", ${generic}`;
}

/** All families referenced by an identity, for @font-face preloading. */
export function familiesUsed(typography: BrandTypography): string[] {
  const set = new Set<string>([typography.display.family, typography.body.family]);
  if (typography.local) set.add(typography.local.family);
  return [...set];
}

export const ALL_FAMILIES = FONTS.map((f) => f.family);
