"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, useToast } from "@/components/ui";
import { ApiError, api } from "@/lib/client/api";

/**
 * Publishes a brand to a public URL.
 *
 * This is the growth loop: a public page is a real, shareable artefact the
 * owner wants to send to customers, and it carries the platform's name. It is
 * off by default and explicitly opt-in — a generated brand is commercially
 * sensitive until its owner decides otherwise.
 */
export function PublishToggle({
  brandId,
  slug,
  isPublic,
}: {
  brandId: string;
  slug: string;
  isPublic: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [published, setPublished] = useState(isPublic);
  const [busy, setBusy] = useState(false);

  const url = typeof window !== "undefined" ? `${window.location.origin}/b/${slug}` : `/b/${slug}`;

  async function toggle() {
    setBusy(true);
    try {
      await api.patch(`/api/brands/${brandId}`, { isPublic: !published });
      setPublished(!published);
      toast.success(
        !published ? "Your brand is now public." : "Your brand is private again.",
        !published ? "Anyone with the link can view it." : undefined,
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update sharing.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.error("Could not copy. Select the link and copy it manually.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {published && (
        <button
          onClick={copyLink}
          className="px-3 h-9 rounded-[10px] bg-paper-alt border border-line text-[12.5px] text-muted hover:text-ink hover:border-ink/25 transition-colors font-mono truncate max-w-[240px]"
          title={url}
        >
          /b/{slug}
        </button>
      )}
      <Button variant={published ? "outline" : "secondary"} onClick={toggle} loading={busy}>
        {published ? "Make private" : "Publish"}
      </Button>
    </div>
  );
}
