"use client";

import { cx } from "@/components/ui";
import { moodSwatchHexes } from "@/lib/brand/palettes";
import type { ColorMood } from "@/types/brand";

/**
 * Colour mood selection, as swatches rather than a dropdown of words.
 *
 * The three chips per card are computed by `moodSwatchHexes` from the same
 * hue/saturation/lightness ranges the generator samples from — a real
 * preview of what that mood produces, not a decorative stand-in.
 */

export function MoodPicker({
  moods,
  value,
  onChange,
}: {
  moods: { mood: ColorMood; label: string; hint: string }[];
  value: ColorMood;
  onChange: (mood: ColorMood) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {moods.map((m) => {
        const selected = value === m.mood;
        const swatches = moodSwatchHexes(m.mood);
        return (
          <button
            key={m.mood}
            type="button"
            onClick={() => onChange(m.mood)}
            title={m.hint}
            aria-pressed={selected}
            className={cx(
              "text-left p-3 rounded-[12px] border transition-all active:scale-[0.98]",
              selected
                ? "border-ink ring-1 ring-ink bg-paper-alt"
                : "border-line bg-white hover:border-ink/25 hover:shadow-card",
            )}
          >
            <div className="flex gap-1">
              {swatches.map((hex, i) => (
                <span
                  key={i}
                  className="h-7 flex-1 rounded-[5px] border border-ink/8"
                  style={{ background: hex }}
                />
              ))}
            </div>
            <p className="mt-2 text-[13px] font-medium text-ink">{m.label}</p>
          </button>
        );
      })}
    </div>
  );
}
