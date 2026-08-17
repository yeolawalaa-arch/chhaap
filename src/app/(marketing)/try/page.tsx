import type { Metadata } from "next";
import { TryFlow } from "@/components/brand/TryFlow";
import { industriesByGroup } from "@/lib/brand/industries";
import { TRAIT_LIST } from "@/lib/brand/personality";
import { LANGUAGE_LIST } from "@/lib/brand/languages";
import { MOOD_LIST } from "@/lib/brand/palettes";
import { marketingSamples, assetShowcase } from "@/lib/marketing/samples";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Try it free — no account needed",
  description:
    "Generate a complete brand identity for your business in seconds. Logo, colours, typography and assets. No signup required.",
};

export default async function TryPage() {
  // Accounts need a database. Probing once here means the page can offer to
  // save the result only when saving actually works, instead of linking to a
  // signup that would fail.
  const accountsAvailable = await db.$queryRaw`SELECT 1`.then(
    () => true,
    () => false,
  );

  return (
    <TryFlow
      data={{
        industryGroups: industriesByGroup(),
        traits: TRAIT_LIST,
        languages: LANGUAGE_LIST,
        moods: [
          { mood: "auto", label: "Auto", hint: "Let the engine choose from your category and personality" },
          ...MOOD_LIST.map((m) => ({ mood: m.mood, label: m.label, hint: m.hint })),
        ],
        accountsAvailable,
        samples: marketingSamples(),
        showcase: assetShowcase(["visiting_card", "instagram_post", "signboard", "shopping_bag"]),
      }}
    />
  );
}
