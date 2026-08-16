"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Field, Input, Select, cx, useToast } from "@/components/ui";
import { ApiError, api } from "@/lib/client/api";
import {
  alignLayer,
  canRedo,
  canUndo,
  commit,
  duplicateLayer,
  fitToCanvas,
  hitTest,
  initHistory,
  layerBounds,
  redo,
  removeLayer,
  reorderLayer,
  undo,
  updateLayer,
  type AlignMode,
  type HistoryState,
} from "@/lib/studio/history";
import type {
  BrandIdentitySpec,
  LogoDocument,
  LogoLayer,
  LogoVariation,
  QualityReport,
} from "@/types/brand";

/**
 * The Logo Studio.
 *
 * The canvas is the same SVG the renderer produces — the server sends rendered
 * markup for the current document, and the editor overlays interaction on top.
 * That means what you drag is literally what exports; there is no second
 * "preview" renderer that can drift from the real one.
 */

export interface StudioProps {
  brandId: string;
  brandName: string;
  spec: BrandIdentitySpec;
  variations: { variation: LogoVariation; label: string }[];
  initialVariation: LogoVariation;
  initialDoc: LogoDocument;
  initialSvg: string;
  glyphOptions: { key: string; label: string }[];
  fontOptions: { family: string; label: string }[];
}

const COLOR_TOKENS = [
  { value: "primary", label: "Primary" },
  { value: "primaryDark", label: "Deep shade" },
  { value: "primaryLight", label: "Light tint" },
  { value: "accent", label: "Accent" },
  { value: "ink", label: "Ink" },
  { value: "muted", label: "Muted" },
  { value: "surface", label: "Surface" },
];

export function LogoStudio(props: StudioProps) {
  const toast = useToast();

  const [variation, setVariation] = useState<LogoVariation>(props.initialVariation);
  const [history, setHistory] = useState<HistoryState>(() => initHistory(props.initialDoc));
  const [svg, setSvg] = useState(props.initialSvg);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [rendering, setRendering] = useState(false);

  const doc = history.present;
  const selected = doc.layers.find((l) => l.id === selectedId) ?? null;

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const renderSeq = useRef(0);

  // -------------------------------------------------------------------------
  // Rendering — the server renders, so the canvas is always the real output.
  // -------------------------------------------------------------------------

  const rerender = useCallback(
    async (next: LogoDocument) => {
      const seq = ++renderSeq.current;
      setRendering(true);
      try {
        const res = await api.post<{ svg: string }>(`/api/brands/${props.brandId}/render`, {
          doc: next,
        });
        // Ignore responses that arrived after a newer edit.
        if (seq === renderSeq.current) setSvg(res.svg);
      } catch {
        // Keep the last good frame rather than blanking the canvas.
      } finally {
        if (seq === renderSeq.current) setRendering(false);
      }
    },
    [props.brandId],
  );

  const apply = useCallback(
    (next: LogoDocument, opts: { coalesce?: boolean } = {}) => {
      setHistory((h) => commit(h, next, opts.coalesce));
      setDirty(true);
      void rerender(next);
    },
    [rerender],
  );

  // -------------------------------------------------------------------------
  // Variation switching
  // -------------------------------------------------------------------------

  async function switchVariation(next: LogoVariation) {
    if (dirty && !confirm("You have unsaved changes. Switch variation and discard them?")) return;
    try {
      const res = await api.get<{ doc: LogoDocument }>(
        `/api/brands/${props.brandId}/logo/${next}`,
      );
      setVariation(next);
      setHistory(initHistory(res.doc));
      setSelectedId(null);
      setDirty(false);
      void rerender(res.doc);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load that variation.");
    }
  }

  // -------------------------------------------------------------------------
  // Saving
  // -------------------------------------------------------------------------

  async function save() {
    setSaving(true);
    try {
      const res = await api.put<{ quality: QualityReport }>(
        `/api/brands/${props.brandId}/logo/${variation}`,
        doc,
      );
      setQuality(res.quality);
      setDirty(false);
      toast.success("Saved.", `Brand readiness ${res.quality.score}/100`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function resetVariation() {
    if (!confirm("Discard all edits to this variation and rebuild it from your brand system?")) return;
    try {
      const res = await api.delete<{ doc: LogoDocument }>(
        `/api/brands/${props.brandId}/logo/${variation}`,
      );
      setHistory(initHistory(res.doc));
      setSelectedId(null);
      setDirty(false);
      void rerender(res.doc);
      toast.success("Reset to the generated version.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not reset.");
    }
  }

  // -------------------------------------------------------------------------
  // Pointer interaction
  // -------------------------------------------------------------------------

  /** Canvas pixel → document coordinate. */
  const toDocCoords = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const scale = rect.width / doc.width;
      return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
    },
    [doc.width],
  );

  function onPointerDown(e: React.PointerEvent) {
    const { x, y } = toDocCoords(e.clientX, e.clientY);
    const hit = hitTest(doc, x, y);

    setSelectedId(hit?.id ?? null);
    if (!hit) return;

    dragRef.current = { id: hit.id, startX: x, startY: y, originX: hit.x, originY: hit.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;

    const { x, y } = toDocCoords(e.clientX, e.clientY);
    let nextX = drag.originX + (x - drag.startX);
    let nextY = drag.originY + (y - drag.startY);

    // Shift constrains to one axis, matching every other design tool.
    if (e.shiftKey) {
      if (Math.abs(x - drag.startX) > Math.abs(y - drag.startY)) nextY = drag.originY;
      else nextX = drag.originX;
    }

    // The whole gesture coalesces into a single undo entry.
    apply(updateLayer(doc, drag.id, { x: Math.round(nextX), y: Math.round(nextY) }), {
      coalesce: true,
    });
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  // -------------------------------------------------------------------------
  // Keyboard
  // -------------------------------------------------------------------------

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        setHistory((h) => {
          const next = e.shiftKey ? redo(h) : undo(h);
          if (next !== h) {
            setDirty(true);
            void rerender(next.present);
          }
          return next;
        });
        return;
      }

      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
        return;
      }

      if (!selectedId) return;

      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const { doc: next, newId } = duplicateLayer(doc, selectedId);
        apply(next);
        setSelectedId(newId);
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        apply(removeLayer(doc, selectedId));
        setSelectedId(null);
        return;
      }

      const step = e.shiftKey ? 10 : 1;
      const nudges: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const nudge = nudges[e.key];
      if (nudge) {
        e.preventDefault();
        const layer = doc.layers.find((l) => l.id === selectedId);
        if (layer) apply(updateLayer(doc, selectedId, { x: layer.x + nudge[0], y: layer.y + nudge[1] }), { coalesce: true });
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc, selectedId, apply, rerender]);

  // Warn before losing unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const selectionBox = useMemo(() => (selected ? layerBounds(selected) : null), [selected]);

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col lg:flex-row">
      {/* ------------------------------------------------------------------ */}
      {/* Left: layers                                                        */}
      {/* ------------------------------------------------------------------ */}
      <aside className="w-full lg:w-60 border-b lg:border-b-0 lg:border-r border-line bg-white flex flex-col shrink-0">
        <div className="px-3.5 py-3 border-b border-line-soft">
          <Link
            href={`/brand/${props.brandId}`}
            className="text-[12.5px] text-muted hover:text-ink transition-colors"
          >
            ← {props.brandName}
          </Link>
        </div>

        <div className="px-3.5 py-3 border-b border-line-soft">
          <Field label="Variation" htmlFor="variation">
            <Select
              id="variation"
              value={variation}
              onChange={(e) => switchVariation(e.target.value as LogoVariation)}
            >
              {props.variations.map((v) => (
                <option key={v.variation} value={v.variation}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grow overflow-y-auto">
          <p className="px-3.5 pt-3 pb-2 text-[10.5px] uppercase tracking-[0.12em] text-faint font-semibold">
            Layers
          </p>
          <ul className="pb-3">
            {[...doc.layers].reverse().map((layer) => (
              <li key={layer.id}>
                <div
                  className={cx(
                    "px-3.5 py-2 flex items-center gap-2 cursor-pointer transition-colors group",
                    selectedId === layer.id ? "bg-paper-alt" : "hover:bg-paper",
                  )}
                  onClick={() => setSelectedId(layer.id)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      apply(updateLayer(doc, layer.id, { visible: !layer.visible }));
                    }}
                    aria-label={layer.visible ? "Hide layer" : "Show layer"}
                    className="text-faint hover:text-ink transition-colors shrink-0"
                  >
                    {layer.visible ? "◉" : "○"}
                  </button>
                  <span
                    className={cx(
                      "text-[12.5px] truncate grow",
                      layer.visible ? "text-ink" : "text-faint line-through",
                    )}
                  >
                    {layer.name}
                  </span>
                  <span className="text-[10px] text-faint uppercase shrink-0">{layer.kind}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-3.5 py-3 border-t border-line-soft space-y-2">
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              disabled={!canUndo(history)}
              onClick={() => {
                setHistory((h) => {
                  const next = undo(h);
                  if (next !== h) { setDirty(true); void rerender(next.present); }
                  return next;
                });
              }}
            >
              Undo
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              disabled={!canRedo(history)}
              onClick={() => {
                setHistory((h) => {
                  const next = redo(h);
                  if (next !== h) { setDirty(true); void rerender(next.present); }
                  return next;
                });
              }}
            >
              Redo
            </Button>
          </div>
          <Button size="sm" variant="ghost" full onClick={resetVariation}>
            Reset to generated
          </Button>
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Centre: canvas                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="grow bg-paper-alt flex flex-col min-h-[420px]">
        <div className="px-4 py-2.5 border-b border-line bg-white flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {(
              [
                ["left", "Align left"],
                ["center-x", "Centre horizontally"],
                ["right", "Align right"],
                ["top", "Align top"],
                ["center-y", "Centre vertically"],
                ["bottom", "Align bottom"],
              ] as [AlignMode, string][]
            ).map(([mode, label]) => (
              <button
                key={mode}
                title={label}
                disabled={!selectedId}
                onClick={() => selectedId && apply(alignLayer(doc, selectedId, mode))}
                className="px-2 h-7 rounded-md text-[11px] text-muted hover:bg-paper-alt hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {mode.replace("center-", "C").replace("-", "")}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-line" />

          <Button size="sm" variant="ghost" onClick={() => apply(fitToCanvas(doc))}>
            Fit to canvas
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!selectedId}
            onClick={() => {
              if (!selectedId) return;
              const { doc: next, newId } = duplicateLayer(doc, selectedId);
              apply(next);
              setSelectedId(newId);
            }}
          >
            Duplicate
          </Button>

          <div className="ml-auto flex items-center gap-2">
            {rendering && <span className="text-[11.5px] text-faint">Rendering…</span>}
            {dirty && <Badge tone="warn">Unsaved</Badge>}
            {quality && (
              <Badge tone={quality.score >= 72 ? "success" : "warn"}>{quality.score}/100</Badge>
            )}
            <Button size="sm" variant="secondary" onClick={save} loading={saving} disabled={!dirty}>
              Save
            </Button>
          </div>
        </div>

        <div className="grow flex items-center justify-center p-6 overflow-auto">
          <div
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative bg-white shadow-card rounded-[6px] touch-none select-none cursor-crosshair max-w-full"
            style={{ width: doc.width, aspectRatio: `${doc.width} / ${doc.height}` }}
          >
            <div
              className="absolute inset-0 svg-fit pointer-events-none"
              dangerouslySetInnerHTML={{ __html: svg }}
            />

            {selectionBox && (
              <div
                className="absolute border-2 border-brand-500 pointer-events-none rounded-[2px]"
                style={{
                  left: `${(selectionBox.x / doc.width) * 100}%`,
                  top: `${(selectionBox.y / doc.height) * 100}%`,
                  width: `${(selectionBox.w / doc.width) * 100}%`,
                  height: `${(selectionBox.h / doc.height) * 100}%`,
                }}
              />
            )}
          </div>
        </div>

        <p className="px-4 py-2 text-[11.5px] text-muted border-t border-line bg-white">
          Drag to move · Shift-drag to constrain · Arrows to nudge · ⌘Z undo · ⌘D duplicate · ⌘S save
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Right: properties                                                   */}
      {/* ------------------------------------------------------------------ */}
      <aside className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-line bg-white overflow-y-auto shrink-0">
        {!selected ? (
          <div className="p-5">
            <p className="text-[13px] text-muted leading-relaxed">
              Select a layer on the canvas or in the layer list to edit it.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-ink">{selected.name}</p>
              <button
                onClick={() => {
                  apply(removeLayer(doc, selected.id));
                  setSelectedId(null);
                }}
                className="text-[11.5px] text-danger hover:underline"
              >
                Delete
              </button>
            </div>

            {/* Common transform */}
            <div className="grid grid-cols-2 gap-2">
              <Field label="X" htmlFor="x">
                <Input
                  id="x"
                  type="number"
                  value={Math.round(selected.x)}
                  onChange={(e) => apply(updateLayer(doc, selected.id, { x: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Y" htmlFor="y">
                <Input
                  id="y"
                  type="number"
                  value={Math.round(selected.y)}
                  onChange={(e) => apply(updateLayer(doc, selected.id, { y: Number(e.target.value) }))}
                />
              </Field>
            </div>

            <Field label={`Scale · ${selected.scale.toFixed(2)}×`} htmlFor="scale">
              <input
                id="scale"
                type="range"
                min={0.1}
                max={3}
                step={0.01}
                value={selected.scale}
                onChange={(e) =>
                  apply(updateLayer(doc, selected.id, { scale: Number(e.target.value) }), { coalesce: true })
                }
                className="w-full accent-ink"
              />
            </Field>

            <Field label={`Rotation · ${Math.round(selected.rotation)}°`} htmlFor="rotation">
              <input
                id="rotation"
                type="range"
                min={-180}
                max={180}
                step={1}
                value={selected.rotation}
                onChange={(e) =>
                  apply(updateLayer(doc, selected.id, { rotation: Number(e.target.value) }), { coalesce: true })
                }
                className="w-full accent-ink"
              />
            </Field>

            <Field label={`Opacity · ${Math.round(selected.opacity * 100)}%`} htmlFor="opacity">
              <input
                id="opacity"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={selected.opacity}
                onChange={(e) =>
                  apply(updateLayer(doc, selected.id, { opacity: Number(e.target.value) }), { coalesce: true })
                }
                className="w-full accent-ink"
              />
            </Field>

            {/* Text layer */}
            {selected.kind === "text" && (
              <>
                <Field label="Text" htmlFor="text">
                  <Input
                    id="text"
                    value={selected.text}
                    onChange={(e) => apply(updateLayer(doc, selected.id, { text: e.target.value }))}
                    maxLength={120}
                  />
                </Field>

                <Field label="Font" htmlFor="font">
                  <Select
                    id="font"
                    value={selected.font.family}
                    onChange={(e) =>
                      apply(
                        updateLayer(doc, selected.id, {
                          font: { ...selected.font, family: e.target.value },
                        }),
                      )
                    }
                  >
                    {props.fontOptions.map((f) => (
                      <option key={f.family} value={f.family}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Weight" htmlFor="weight">
                    <Select
                      id="weight"
                      value={selected.font.weight}
                      onChange={(e) =>
                        apply(
                          updateLayer(doc, selected.id, {
                            font: { ...selected.font, weight: Number(e.target.value) },
                          }),
                        )
                      }
                    >
                      {[400, 500, 600, 700].map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Size" htmlFor="size">
                    <Input
                      id="size"
                      type="number"
                      value={Math.round(selected.size)}
                      onChange={(e) => apply(updateLayer(doc, selected.id, { size: Number(e.target.value) }))}
                    />
                  </Field>
                </div>

                <Field label={`Tracking · ${(selected.font.letterSpacing * 1000).toFixed(0)}/1000`} htmlFor="tracking">
                  <input
                    id="tracking"
                    type="range"
                    min={-0.05}
                    max={0.3}
                    step={0.005}
                    value={selected.font.letterSpacing}
                    onChange={(e) =>
                      apply(
                        updateLayer(doc, selected.id, {
                          font: { ...selected.font, letterSpacing: Number(e.target.value) },
                        }),
                        { coalesce: true },
                      )
                    }
                    className="w-full accent-ink"
                  />
                </Field>

                <Field label="Case" htmlFor="case">
                  <Select
                    id="case"
                    value={selected.font.transform}
                    onChange={(e) =>
                      apply(
                        updateLayer(doc, selected.id, {
                          font: { ...selected.font, transform: e.target.value as "none" | "uppercase" | "lowercase" },
                        }),
                      )
                    }
                  >
                    <option value="none">As typed</option>
                    <option value="uppercase">UPPERCASE</option>
                    <option value="lowercase">lowercase</option>
                  </Select>
                </Field>

                <Field label="Colour" htmlFor="textcolor">
                  <Select
                    id="textcolor"
                    value={selected.color}
                    onChange={(e) => apply(updateLayer(doc, selected.id, { color: e.target.value }))}
                  >
                    {COLOR_TOKENS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            )}

            {/* Mark layer */}
            {selected.kind === "mark" && (
              <>
                <Field label="Size" htmlFor="marksize">
                  <Input
                    id="marksize"
                    type="number"
                    value={Math.round(selected.size)}
                    onChange={(e) => apply(updateLayer(doc, selected.id, { size: Number(e.target.value) }))}
                  />
                </Field>

                <Field label="Symbol style" htmlFor="markstyle">
                  <Select
                    id="markstyle"
                    value={selected.mark.style}
                    onChange={(e) =>
                      apply(
                        updateLayer(doc, selected.id, {
                          mark: { ...selected.mark, style: e.target.value as typeof selected.mark.style },
                        }),
                      )
                    }
                  >
                    <option value="glyph">Icon</option>
                    <option value="monogram">Monogram</option>
                    <option value="lettermark-cut">Cut letterform</option>
                    <option value="abstract-petal">Abstract — petal</option>
                    <option value="abstract-orbit">Abstract — orbit</option>
                    <option value="abstract-stack">Abstract — stack</option>
                  </Select>
                </Field>

                {selected.mark.style === "glyph" && (
                  <Field label="Icon" htmlFor="glyph">
                    <Select
                      id="glyph"
                      value={selected.mark.glyph ?? ""}
                      onChange={(e) =>
                        apply(
                          updateLayer(doc, selected.id, {
                            mark: { ...selected.mark, glyph: e.target.value },
                          }),
                        )
                      }
                    >
                      {props.glyphOptions.map((g) => (
                        <option key={g.key} value={g.key}>
                          {g.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}

                {(selected.mark.style === "monogram" || selected.mark.style === "lettermark-cut") && (
                  <Field label="Initials" htmlFor="initials">
                    <Input
                      id="initials"
                      value={selected.mark.initials ?? ""}
                      maxLength={2}
                      onChange={(e) =>
                        apply(
                          updateLayer(doc, selected.id, {
                            mark: { ...selected.mark, initials: e.target.value.toUpperCase() },
                          }),
                        )
                      }
                    />
                  </Field>
                )}

                <Field label="Enclosure" htmlFor="enclosure">
                  <Select
                    id="enclosure"
                    value={selected.mark.enclosure}
                    onChange={(e) =>
                      apply(
                        updateLayer(doc, selected.id, {
                          mark: { ...selected.mark, enclosure: e.target.value as typeof selected.mark.enclosure },
                        }),
                      )
                    }
                  >
                    {["none", "circle", "rounded-square", "squircle", "hexagon", "shield", "arch", "diamond", "banner"].map(
                      (shape) => (
                        <option key={shape} value={shape}>
                          {shape.replace("-", " ")}
                        </option>
                      ),
                    )}
                  </Select>
                </Field>

                <Field label="Fill" htmlFor="fill">
                  <Select
                    id="fill"
                    value={selected.mark.fillStyle}
                    onChange={(e) =>
                      apply(
                        updateLayer(doc, selected.id, {
                          mark: { ...selected.mark, fillStyle: e.target.value as typeof selected.mark.fillStyle },
                        }),
                      )
                    }
                  >
                    <option value="solid">Solid</option>
                    <option value="outline">Outline</option>
                    <option value="duotone">Duotone</option>
                    <option value="monoline">Monoline (fine)</option>
                    <option value="gradient">Gradient</option>
                  </Select>
                </Field>

                <Field label={`Stroke weight · ${selected.mark.strokeWeight}`} htmlFor="stroke">
                  <input
                    id="stroke"
                    type="range"
                    min={2}
                    max={20}
                    step={1}
                    value={selected.mark.strokeWeight}
                    onChange={(e) =>
                      apply(
                        updateLayer(doc, selected.id, {
                          mark: { ...selected.mark, strokeWeight: Number(e.target.value) },
                        }),
                        { coalesce: true },
                      )
                    }
                    className="w-full accent-ink"
                  />
                </Field>

                <Field label="Symbol colour" htmlFor="markfg">
                  <Select
                    id="markfg"
                    value={String(selected.colors.fg)}
                    onChange={(e) =>
                      apply(
                        updateLayer(doc, selected.id, {
                          colors: { ...selected.colors, fg: e.target.value },
                        }),
                      )
                    }
                  >
                    {COLOR_TOKENS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            )}

            {/* Z-order */}
            <div className="pt-3 border-t border-line-soft flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => apply(reorderLayer(doc, selected.id, -1))}
              >
                Send back
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => apply(reorderLayer(doc, selected.id, 1))}
              >
                Bring front
              </Button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
