import type { Metadata } from "next";
import { CreateWizard } from "@/components/brand/CreateWizard";
import { industriesByGroup } from "@/lib/brand/industries";
import { TRAIT_LIST } from "@/lib/brand/personality";
import { LANGUAGE_LIST } from "@/lib/brand/languages";
import { MOOD_LIST } from "@/lib/brand/palettes";
import { requireUser } from "@/lib/auth/session";
import { generationQuota } from "@/lib/billing/plans";

export const metadata: Metadata = { title: "Create a brand" };

export default async function CreatePage() {
  const user = await requireUser();
  const quota = await generationQuota(user.id);

  return (
    <CreateWizard
      data={{
        industryGroups: industriesByGroup(),
        traits: TRAIT_LIST,
        languages: LANGUAGE_LIST,
        moods: [
          { mood: "auto", label: "Auto", hint: "Let the engine choose from your category and personality" },
          ...MOOD_LIST.map((m) => ({ mood: m.mood, label: m.label, hint: m.hint })),
        ],
        quota: { used: quota.used, limit: quota.limit, unlimited: quota.unlimited },
      }}
    />
  );
}
