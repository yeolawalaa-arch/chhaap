import type { LogoDocument, LogoLayer } from "@/types/brand";

/**
 * Studio document operations and undo history.
 *
 * Kept outside React so the editing rules are testable and the component only
 * deals with rendering. Every mutation returns a new document — the history
 * stack stores whole snapshots, which is the right trade at this size (a logo
 * has tens of layers, not thousands) and makes undo trivially correct.
 */

export interface HistoryState {
  past: LogoDocument[];
  present: LogoDocument;
  future: LogoDocument[];
}

const LIMIT = 60;

export function initHistory(doc: LogoDocument): HistoryState {
  return { past: [], present: doc, future: [] };
}

/**
 * Commits a new document state.
 *
 * `coalesce` merges the change into the previous entry instead of pushing a new
 * one — used for drags and slider scrubs, so one gesture is one undo rather
 * than two hundred.
 */
export function commit(
  state: HistoryState,
  next: LogoDocument,
  coalesce = false,
): HistoryState {
  if (next === state.present) return state;

  if (coalesce && state.past.length > 0) {
    return { past: state.past, present: next, future: [] };
  }

  const past = [...state.past, state.present].slice(-LIMIT);
  return { past, present: next, future: [] };
}

export function undo(state: HistoryState): HistoryState {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1]!;
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future].slice(0, LIMIT),
  };
}

export function redo(state: HistoryState): HistoryState {
  if (state.future.length === 0) return state;
  const next = state.future[0]!;
  return {
    past: [...state.past, state.present].slice(-LIMIT),
    present: next,
    future: state.future.slice(1),
  };
}

export const canUndo = (s: HistoryState) => s.past.length > 0;
export const canRedo = (s: HistoryState) => s.future.length > 0;

// ---------------------------------------------------------------------------
// Document operations
// ---------------------------------------------------------------------------

export function updateLayer(
  doc: LogoDocument,
  layerId: string,
  patch: Partial<LogoLayer>,
): LogoDocument {
  return {
    ...doc,
    layers: doc.layers.map((layer) =>
      layer.id === layerId ? ({ ...layer, ...patch } as LogoLayer) : layer,
    ),
  };
}

export function removeLayer(doc: LogoDocument, layerId: string): LogoDocument {
  return { ...doc, layers: doc.layers.filter((l) => l.id !== layerId) };
}

export function duplicateLayer(doc: LogoDocument, layerId: string): { doc: LogoDocument; newId: string } {
  const index = doc.layers.findIndex((l) => l.id === layerId);
  if (index === -1) return { doc, newId: layerId };

  const source = doc.layers[index]!;
  const newId = `${source.id}-${Math.random().toString(36).slice(2, 7)}`;
  // Offset so the copy is visibly distinct rather than hidden exactly behind.
  const copy = { ...source, id: newId, name: `${source.name} copy`, x: source.x + 16, y: source.y + 16 };

  const layers = [...doc.layers];
  layers.splice(index + 1, 0, copy as LogoLayer);
  return { doc: { ...doc, layers }, newId };
}

/** Moves a layer in z-order. Later in the array renders on top. */
export function reorderLayer(doc: LogoDocument, layerId: string, direction: -1 | 1): LogoDocument {
  const index = doc.layers.findIndex((l) => l.id === layerId);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= doc.layers.length) return doc;

  const layers = [...doc.layers];
  [layers[index], layers[target]] = [layers[target]!, layers[index]!];
  return { ...doc, layers };
}

export type AlignMode = "left" | "center-x" | "right" | "top" | "center-y" | "bottom";

/**
 * Aligns a layer against the canvas.
 *
 * Text layers anchor differently — a `middle`-anchored label is positioned by
 * its centre, not its left edge — so centring means setting x to the canvas
 * centre for those, and the caller must not offset by an estimated width.
 */
export function alignLayer(doc: LogoDocument, layerId: string, mode: AlignMode): LogoDocument {
  const layer = doc.layers.find((l) => l.id === layerId);
  if (!layer) return doc;

  const patch: Partial<LogoLayer> = {};
  const inset = 40;

  switch (mode) {
    case "left":
      patch.x = layer.kind === "text" && layer.align === "middle" ? inset : inset;
      break;
    case "center-x":
      patch.x = doc.width / 2;
      break;
    case "right":
      patch.x = doc.width - inset;
      break;
    case "top":
      patch.y = inset + (layer.kind === "mark" ? layer.size / 2 : 0);
      break;
    case "center-y":
      patch.y = doc.height / 2;
      break;
    case "bottom":
      patch.y = doc.height - inset - (layer.kind === "mark" ? layer.size / 2 : 0);
      break;
  }

  return updateLayer(doc, layerId, patch);
}

/** Nudges every layer so the group's bounds sit centred on the canvas. */
export function fitToCanvas(doc: LogoDocument): LogoDocument {
  const visible = doc.layers.filter((l) => l.visible);
  if (visible.length === 0) return doc;

  const xs = visible.map((l) => l.x);
  const ys = visible.map((l) => l.y);
  const dx = doc.width / 2 - (Math.min(...xs) + Math.max(...xs)) / 2;
  const dy = doc.height / 2 - (Math.min(...ys) + Math.max(...ys)) / 2;

  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return doc;

  return {
    ...doc,
    layers: doc.layers.map((l) => ({ ...l, x: l.x + dx, y: l.y + dy })),
  };
}

/** Approximate on-canvas bounds, for hit testing and selection outlines. */
export function layerBounds(layer: LogoLayer): { x: number; y: number; w: number; h: number } {
  switch (layer.kind) {
    case "mark": {
      const size = layer.size * layer.scale;
      return { x: layer.x - size / 2, y: layer.y - size / 2, w: size, h: size };
    }
    case "text": {
      // Rough: average advance ≈ 0.55em, cap height ≈ 0.72em.
      const w = layer.text.length * layer.size * 0.55 * layer.scale;
      const h = layer.size * 1.2 * layer.scale;
      const x =
        layer.align === "middle" ? layer.x - w / 2 : layer.align === "end" ? layer.x - w : layer.x;
      return { x, y: layer.y - layer.size * 0.78, w, h };
    }
    case "divider": {
      const w = layer.width * layer.scale;
      return { x: layer.x - w / 2, y: layer.y - 6, w, h: 12 };
    }
    case "shape": {
      const w = layer.width * layer.scale;
      const h = layer.height * layer.scale;
      return { x: layer.x - w / 2, y: layer.y - h / 2, w, h };
    }
  }
}

/** Topmost visible, unlocked layer under a point. */
export function hitTest(doc: LogoDocument, x: number, y: number): LogoLayer | null {
  for (let i = doc.layers.length - 1; i >= 0; i--) {
    const layer = doc.layers[i]!;
    if (!layer.visible || layer.locked) continue;
    const b = layerBounds(layer);
    // A small tolerance makes thin layers (dividers, rules) actually clickable.
    const pad = 6;
    if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) {
      return layer;
    }
  }
  return null;
}
