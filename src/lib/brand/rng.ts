/**
 * Seeded pseudo-randomness.
 *
 * Brand generation must be reproducible: opening the same brand tomorrow has to
 * show the same logo. Every "creative" choice in the engine draws from one of
 * these generators, seeded from the brand brief, so results are varied across
 * businesses but stable for any single business.
 */

/** FNV-1a — small, fast, good enough avalanche for seeding. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class Rng {
  private state: number;

  constructor(seed: string | number) {
    const s = typeof seed === "string" ? hashString(seed) : seed >>> 0;
    // Avoid the zero fixed point of xorshift.
    this.state = s === 0 ? 0x9e3779b9 : s;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5;
    x >>>= 0;
    this.state = x;
    return x / 0x100000000;
  }

  /** Integer in [min, max]. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Rng.pick called with an empty list");
    return items[Math.floor(this.next() * items.length)]!;
  }

  /** Weighted pick. Weights need not sum to 1. */
  weighted<T>(entries: readonly { value: T; weight: number }[]): T {
    const total = entries.reduce((sum, e) => sum + Math.max(0, e.weight), 0);
    if (total <= 0) return this.pick(entries).value;
    let roll = this.next() * total;
    for (const entry of entries) {
      roll -= Math.max(0, entry.weight);
      if (roll <= 0) return entry.value;
    }
    return entries[entries.length - 1]!.value;
  }

  /** Non-mutating Fisher–Yates. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }

  /** `count` distinct items, or all of them if the list is shorter. */
  sample<T>(items: readonly T[], count: number): T[] {
    return this.shuffle(items).slice(0, Math.min(count, items.length));
  }
}
