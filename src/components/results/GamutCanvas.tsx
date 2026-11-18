"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { srgbToOklab, oklabToLinearSrgb, linearToSrgb8 } from "@/core/color/oklch";
import { basis, defaultCamera, GAMUT_CENTER, look, move, orbitCamera, orbitOf, project, type Camera } from "@/core/gamut/camera";
import type { Lattice } from "@/core/gamut/lattice";
import type { SelectionResult } from "@/core/gamut/select";
import type { SnappedColors } from "@/core/gamut/snap";
import { clearFrame, makeFrame, pack, pickNearest, splatDiscs, splatSquares, type Frame, type PointSet } from "@/core/gamut/splat";

export type CameraMode = "orbit" | "fly";

interface Props {
  lattice: Lattice;
  selection: SelectionResult | null;
  /** The image's colours snapped onto the lattice; null hides them (the notebook's view). */
  snapped: SnappedColors | null;
  mode: CameraMode;
  /** Changing this number resets the view. */
  resetKey: number;
  label: string;
  /** A chosen background (OKLCH CSS) and a text colour readable on it; absent follows the page theme (P-037). */
  background?: string;
  ink?: string;
}

const MAX_DPR = 2;
const FALLBACK_SIZE = { width: 640, height: 480 };

const resolved = new Map<string, [number, number, number]>();
/** Any CSS colour (including OKLCH tokens) as sRGB bytes, read back through a 1 × 1 canvas; cached per value. */
function resolveColor(css: string): [number, number, number] {
  const hit = resolved.get(css);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [128, 128, 128];
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  const rgb: [number, number, number] = [d[0], d[1], d[2]];
  resolved.set(css, rgb);
  return rgb;
}

/** A mix of two sRGB colours, done in OKLab so the step looks even. */
function mixOklab(p: [number, number, number], q: [number, number, number], t: number): [number, number, number] {
  const a = srgbToOklab({ r: p[0], g: p[1], b: p[2] });
  const b = srgbToOklab({ r: q[0], g: q[1], b: q[2] });
  const lin = oklabToLinearSrgb(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  return [linearToSrgb8(lin[0]), linearToSrgb8(lin[1]), linearToSrgb8(lin[2])];
}

/**
 * The 3D colour-space view (P-035): a Canvas 2D point splatter with a free
 * camera. Orbit: drag to turn around the gamut, scroll to zoom. Fly: W A S D
 * or the arrow keys to move, Q and E for down and up, drag to look.
 */
export function GamutCanvas({ lattice, selection, snapped, mode, resetKey, label, background, ink }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<Camera>(defaultCamera(lattice.space.abLimit * lattice.space.scale));
  const frameRef = useRef<Frame | null>(null);
  const drawRef = useRef<() => void>(() => {});
  const rafRef = useRef(0);
  const keysRef = useRef(new Set<string>());
  const [size, setSize] = useState(FALLBACK_SIZE);
  // The hover readout belongs to one view; a new space or a reset makes it stale, so it is not shown.
  const view = `${lattice.space.id}:${resetKey}`;
  const [hover, setHover] = useState<{ x: number; y: number; text: string; view: string } | null>(null);

  // World positions: x = a, y = b, z = lightness, scaled so lightness runs 0–1.
  const pts = useMemo<PointSet>(() => {
    const s = lattice.space.scale;
    return { x: lattice.a.map((v) => v * s), y: lattice.b.map((v) => v * s), z: lattice.l.map((v) => v * s) };
  }, [lattice]);
  const colors = useMemo(() => {
    const c = new Uint32Array(lattice.n);
    for (let i = 0; i < lattice.n; i++) c[i] = pack(lattice.rgb[3 * i], lattice.rgb[3 * i + 1], lattice.rgb[3 * i + 2]);
    return c;
  }, [lattice]);

  const schedule = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      drawRef.current();
    });
  };

  // Size the canvas to its box, capped at twice the CSS pixels.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(240, Math.floor(entry.contentRect.width));
      setSize({ width, height: Math.round(Math.min(560, width * 0.75)) });
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  // A new space or a reset puts the camera back to the default view, and drops a stale hover readout.
  useEffect(() => {
    camRef.current = defaultCamera(lattice.space.abLimit * lattice.space.scale);
    schedule();
  }, [lattice, resetKey]);

  // Fly → orbit aims the orbit at the gamut centre from where the camera is.
  useEffect(() => {
    if (mode === "orbit") {
      const o = orbitOf(camRef.current, GAMUT_CENTER);
      camRef.current = orbitCamera(GAMUT_CENTER, o.distance, o.yaw, o.pitch);
    }
    schedule();
  }, [mode]);

  // The draw function sees the latest props without re-binding listeners.
  useEffect(() => {
    drawRef.current = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      const w = Math.round(size.width * dpr);
      const h = Math.round(size.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      if (!frameRef.current || frameRef.current.width !== w || frameRef.current.height !== h) frameRef.current = makeFrame(w, h);
      const frame = frameRef.current;
      const style = getComputedStyle(canvas);
      const bg = resolveColor(style.backgroundColor);
      const ink = resolveColor(style.color);
      // Faint grey for the possible colours, like the notebook's rgba(120,120,120,0.12), from the theme.
      const faint = mixOklab(bg, ink, 0.18);
      const cam = camRef.current;
      clearFrame(frame, pack(...bg));
      const dot = Math.max(1, Math.round(dpr));
      if (selection) {
        splatSquares(frame, cam, pts, selection.background, () => pack(...faint), dot);
        splatSquares(frame, cam, pts, selection.foreground, (i) => colors[i], dot * 2);
      } else {
        splatSquares(frame, cam, pts, Int32Array.from({ length: lattice.n }, (_, i) => i), () => pack(...faint), dot);
      }
      if (snapped && snapped.occupied.length) {
        const max = snapped.maxShare || 1;
        splatDiscs(frame, cam, pts, snapped.occupied, (i) => colors[i], (i) => (2 + 6 * Math.sqrt(snapped.share[i] / max)) * dpr, pack(...ink));
      }
      ctx.putImageData(new ImageData(new Uint8ClampedArray(frame.pixels.buffer as ArrayBuffer), w, h), 0, 0);
      drawAxes(ctx, cam, w, h, dpr, style.color, lattice);
    };
    schedule();
  }, [size, selection, snapped, pts, colors, lattice, background, ink]);

  // Pointer, wheel and keys. The camera lives in a ref, so moving it never re-renders React.
  useEffect(() => {
    const canvas = canvasRef.current;
    const keys = keysRef.current;
    if (!canvas) return;
    let drag: { x: number; y: number } | null = null;
    let last = 0;
    const rotate = (dx: number, dy: number) => {
      const cam = camRef.current;
      if (mode === "orbit") {
        const o = orbitOf(cam, GAMUT_CENTER);
        camRef.current = orbitCamera(GAMUT_CENTER, o.distance, o.yaw - dx, o.pitch + dy);
      } else camRef.current = look(cam, -dx, -dy);
    };
    const onDown = (e: PointerEvent) => {
      drag = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture?.(e.pointerId);
      setHover(null);
    };
    const onMove = (e: PointerEvent) => {
      if (drag) {
        rotate((e.clientX - drag.x) * 0.008, (e.clientY - drag.y) * 0.008);
        drag = { x: e.clientX, y: e.clientY };
        schedule();
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const dpr = canvas.width / rect.width;
      const mx = (e.clientX - rect.left) * dpr;
      const my = (e.clientY - rect.top) * dpr;
      const sets = [snapped?.occupied, selection?.foreground].filter((s): s is Int32Array => !!s && s.length > 0);
      let k = -1;
      for (const s of sets) if ((k = pickNearest(camRef.current, canvas.width, canvas.height, pts, s, mx, my, 6 * dpr)) >= 0) break;
      setHover(k < 0 ? null : { x: e.clientX - rect.left, y: e.clientY - rect.top, text: describePoint(lattice, k, snapped), view });
    };
    const onUp = () => (drag = null);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = camRef.current;
      if (mode === "orbit") {
        const o = orbitOf(cam, GAMUT_CENTER);
        camRef.current = orbitCamera(GAMUT_CENTER, Math.min(6, Math.max(0.3, o.distance * Math.exp(e.deltaY * 0.001))), o.yaw, o.pitch);
      } else camRef.current = move(cam, -e.deltaY * 0.001, 0, 0);
      schedule();
    };
    const step = (t: number) => {
      const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016);
      last = t;
      const k = keysRef.current;
      if (k.size === 0) {
        last = 0;
        return;
      }
      const has = (...names: string[]) => names.some((n) => k.has(n));
      const speed = 0.7 * dt;
      if (mode === "fly") {
        const f = (has("w", "arrowup") ? 1 : 0) - (has("s", "arrowdown") ? 1 : 0);
        const r = (has("d", "arrowright") ? 1 : 0) - (has("a", "arrowleft") ? 1 : 0);
        const u = (has("e") ? 1 : 0) - (has("q") ? 1 : 0);
        camRef.current = move(camRef.current, f * speed, r * speed, u * speed);
      } else {
        const o = orbitOf(camRef.current, GAMUT_CENTER);
        const turn = (has("a", "arrowleft") ? 1 : 0) - (has("d", "arrowright") ? 1 : 0);
        const tilt = (has("arrowup") ? 1 : 0) - (has("arrowdown") ? 1 : 0);
        const zoom = (has("s", "-") ? 1 : 0) - (has("w", "+", "=") ? 1 : 0);
        camRef.current = orbitCamera(GAMUT_CENTER, Math.min(6, Math.max(0.3, o.distance * Math.exp(zoom * dt * 1.5))), o.yaw + turn * dt * 1.5, o.pitch + tilt * dt * 1.5);
      }
      drawRef.current();
      requestAnimationFrame(step);
    };
    const MOVE_KEYS = new Set(["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", "+", "=", "-"]);
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (!MOVE_KEYS.has(key)) return;
      e.preventDefault();
      const wasIdle = keysRef.current.size === 0;
      keysRef.current.add(key);
      if (wasIdle) requestAnimationFrame(step);
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    const onBlur = () => keysRef.current.clear();
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", () => setHover(null));
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("keydown", onKey);
    canvas.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("blur", onBlur);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("keydown", onKey);
      canvas.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("blur", onBlur);
      keys.clear();
    };
  }, [mode, lattice, pts, selection, snapped, view]);

  // Clear the pending id too: otherwise a remount (React's development double mount) never draws again.
  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    },
    [],
  );

  return (
    <div ref={wrapRef} className="relative mt-3 w-full">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="img"
        aria-label={label}
        className="block w-full cursor-grab touch-none rounded-lg border border-line bg-page text-ink focus-visible:outline-2 focus-visible:outline-ink active:cursor-grabbing"
        style={{ height: size.height, ...(background ? { background } : {}), ...(ink ? { color: ink } : {}) }}
      />
      {hover && hover.view === view && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 rounded-md border border-line bg-page px-2 py-1 font-mono text-xs whitespace-pre shadow"
          style={{ left: Math.min(hover.x + 12, size.width - 220), top: hover.y + 12 }}
        >
          {hover.text}
        </div>
      )}
    </div>
  );
}

/** The hover text for a lattice point (the notebook's hover: L, a, b), plus the image's share when occupied. */
export function describePoint(lattice: Lattice, k: number, snapped: SnappedColors | null): string {
  const { axes, digits } = lattice.space;
  const hex = "#" + [0, 1, 2].map((j) => lattice.rgb[3 * k + j].toString(16).padStart(2, "0")).join("").toUpperCase();
  const lines = [`${axes[0]}=${lattice.l[k].toFixed(digits)}  ${axes[1]}=${lattice.a[k].toFixed(digits)}  ${axes[2]}=${lattice.b[k].toFixed(digits)}  ${hex}`];
  if (snapped && snapped.count[k] > 0) lines.push(`Pildi värve: ${snapped.count[k]}, osakaal ${snapped.share[k].toFixed(2)} %`);
  return lines.join("\n");
}

/** Axis lines through the neutral axis and their labels, drawn in the text colour. */
function drawAxes(ctx: CanvasRenderingContext2D, cam: Camera, w: number, h: number, dpr: number, ink: string, lattice: Lattice) {
  const { abLimit, scale, axes } = lattice.space;
  const ab = abLimit * scale;
  const lines: [string, [number, number, number], [number, number, number]][] = [
    [axes[0], [0, 0, 0], [0, 0, 1]],
    [axes[1], [-ab, 0, 0], [ab, 0, 0]],
    [axes[2], [0, -ab, 0], [0, ab, 0]],
  ];
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = dpr;
  ctx.font = `${12 * dpr}px ui-monospace, monospace`;
  for (const [name, p, q] of lines) {
    const a = projectPoint(cam, w, h, p);
    const b = projectPoint(cam, w, h, q);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillText(name, b.sx + 4 * dpr, b.sy - 4 * dpr);
    ctx.globalAlpha = 0.55;
  }
  ctx.restore();
}

const projectPoint = (cam: Camera, w: number, h: number, p: [number, number, number]) => project(cam, basis(cam), w, h, ...p);
