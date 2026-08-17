"use client";

import { useMemo, useState } from "react";
import { cx } from "@/components/ui";
import { GroupIcon, SearchIcon } from "@/components/marketing/icons";
import type { IndustryGroup, IndustryProfile } from "@/lib/brand/industries";

/**
 * Category selection for the guest brief.
 *
 * 68 categories is too many to scan as one flat list, so this leads with the
 * eight most-picked categories as large cards, falls back to the existing
 * grouped chip list underneath, and adds search across name + hint so anyone
 * whose business doesn't fit the obvious labels can still find it in one
 * keystroke rather than scanning nine group headings.
 */

const POPULAR_KEYS = [
  "kirana",
  "restaurant",
  "cafe",
  "salon",
  "clothing",
  "d2c",
  "bakery",
  "mobile_shop",
];

export function CategoryPicker({
  groups,
  value,
  onChange,
}: {
  groups: { group: IndustryGroup; label: string; items: IndustryProfile[] }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const [query, setQuery] = useState("");

  const all = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const popular = useMemo(
    () => POPULAR_KEYS.map((key) => all.find((i) => i.key === key)).filter((i): i is IndustryProfile => !!i),
    [all],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return all
      .filter((i) => i.name.toLowerCase().includes(q) || i.hint.toLowerCase().includes(q))
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)));
  }, [all, query]);

  return (
    <div>
      <div className="relative">
        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search categories — “sweets”, “gym”, “tailor”…"
          className="w-full h-11 pl-10 pr-3.5 bg-white border border-line rounded-[10px] text-[14px] text-ink placeholder:text-faint focus:border-ink/40 transition-colors"
        />
      </div>

      {results ? (
        results.length ? (
          <div className="mt-4 flex flex-wrap gap-2 animate-fade">
            {results.map((item) => (
              <CategoryChip key={item.key} item={item} selected={value === item.key} onClick={() => onChange(item.key)} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-[13px] text-muted">
            No match for “{query}”. Try a broader word, or clear the search to browse everything.
          </p>
        )
      ) : (
        <div className="mt-5 space-y-6 animate-fade">
          <div>
            <p className="text-[11.5px] uppercase tracking-[0.11em] text-faint font-semibold mb-2.5">
              Popular
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {popular.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onChange(item.key)}
                  title={item.hint}
                  aria-pressed={value === item.key}
                  className={cx(
                    "text-left p-3 rounded-[12px] border transition-all active:scale-[0.98]",
                    value === item.key
                      ? "border-ink ring-1 ring-ink bg-paper-alt"
                      : "border-line bg-white hover:border-ink/25 hover:shadow-card",
                  )}
                >
                  <span
                    className={cx(
                      "inline-flex items-center justify-center w-8 h-8 rounded-[8px] mb-2",
                      value === item.key ? "bg-ink text-white" : "bg-paper-alt text-ink-soft",
                    )}
                  >
                    <GroupIcon group={item.group} size={16} />
                  </span>
                  <p className="text-[13px] font-medium text-ink leading-snug">{item.name}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[11.5px] uppercase tracking-[0.11em] text-faint font-semibold">
              All categories
            </p>
            {groups.map((group) => (
              <div key={group.group}>
                <div className="flex items-center gap-1.5 mb-2 text-ink-soft">
                  <GroupIcon group={group.group} size={14} />
                  <p className="text-[12.5px] font-medium">{group.label}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <CategoryChip key={item.key} item={item} selected={value === item.key} onClick={() => onChange(item.key)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  item,
  selected,
  onClick,
}: {
  item: IndustryProfile;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={item.hint}
      aria-pressed={selected}
      className={cx(
        "px-3.5 h-9 rounded-full text-[13px] font-medium border transition-all duration-150",
        "active:scale-[0.97]",
        selected
          ? "bg-ink text-white border-ink"
          : "bg-white text-ink-soft border-line hover:border-ink/30 hover:text-ink",
      )}
    >
      {item.name}
    </button>
  );
}
