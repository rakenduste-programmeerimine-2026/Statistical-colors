"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cssColor, formatHex } from "@/core/analysis/format";
import { formatOklch, srgbToOklch } from "@/core/color/oklch";
import {
  accumulateWheel,
  fit,
  GRID_MIN_FACTOR,
  ONE_TO_ONE,
  centered,
  pixelAt,
  ZOOM_LEVELS,
  zoomAt,
  zoomFactor,
  zoomLabel,
  wheelPixels,
  type Size,
  type View,
} from "@/core/preview/zoom";
import { BackgroundPicker, backgroundCss, type BackgroundPreset } from "../BackgroundPicker";
import { button, hint } from "../ui";
import { decodeImage, MAX_PREVIEW_PIXELS, PreviewTooLargeError, type DecodedImage } from "./decode";

/** Used when the browser cannot report the canvas size (no ResizeObserver). */
const FALLBACK_VIEWPORT: Size = { width: 640, height: 360 };
const GRID_COLOR = "oklch(0.6 0 0 / 0.7)";

type Decoded = { source: Blob | string; image: DecodedImage | null; tooLarge?: PreviewTooLargeError };
type Hover = {
  image: DecodedImage;
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
};

async function toBlob(source: Blob | string): Promise<Blob> {
  if (typeof source !== "string") return source;
  const response = await fetch(source);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.blob();
}

/** Stage colours the viewer offers (P-037); null is the reference viewer's own stage colour. */
const STAGE_PRESETS: BackgroundPreset[] = [
  { label: "vaikimisi", hex: null },
  { label: "valge", hex: "#ffffff" },
  { label: "hall", hex: "#808080" },
  { label: "must", hex: "#000000" },
];

/**
 * Exact pixel preview, ported from the reference Exact Pixel Viewer (P-019):
 * nearest-neighbour drawing at whole-number zoom, so every screen pixel shows a
 * stored image value and nothing is blended.
 */

export function PixelViewer({ source, name }: { source: Blob | string; name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [decoded, setDecoded] = useState<Decoded | null>(null);
  const [viewport, setViewport] = useState<Size | null>(null);
  // Until the user zooms or pans, the view follows Fit, so it adapts when the canvas is resized.
  const [manual, setManual] = useState<{ image: DecodedImage; view: View } | null>(null);
  const [grid, setGrid] = useState(false);
  // Null keeps the reference viewer's stage colour (P-037).
  const [stage, setStage] = useState<string | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // A new source drops everything that holds the old image, so its memory can be freed.
  const [shownSource, setShownSource] = useState(source);
  if (shownSource !== source) {
    setShownSource(source);
    setDecoded(null);
    setManual(null);
    setHover(null);
  }

  const current = decoded?.source === source ? decoded : null;
  const image = current?.image ?? null;

  useEffect(() => {
    let active = true;
    toBlob(source)
      .then(decodeImage)
      .then(
        (img) => active && setDecoded({ source, image: img }),
        (err) =>
          active &&
          setDecoded({ source, image: null, tooLarge: err instanceof PreviewTooLargeError ? err : undefined }),
      );
    return () => {
      active = false;
    };
  }, [source]);

  // Keep the canvas backing store equal to its size in device pixels, so one
  // canvas pixel is one screen pixel at any display scaling.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof ResizeObserver === "undefined") {
      setViewport(FALLBACK_VIEWPORT); // eslint-disable-line react-hooks/set-state-in-effect -- one-off for old browsers and jsdom
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.devicePixelContentBoxSize?.[0];
      const width = box ? box.inlineSize : Math.round(entry.contentRect.width * devicePixelRatio);
      const height = box ? box.blockSize : Math.round(entry.contentRect.height * devicePixelRatio);
      if (width > 0 && height > 0)
        setViewport((old) => (old?.width === width && old.height === height ? old : { width, height }));
    });
    try {
      observer.observe(canvas, { box: "device-pixel-content-box" });
    } catch {
      observer.observe(canvas);
    }
    return () => observer.disconnect();
  }, []);

  const view = useMemo<View>(() => {
    if (manual && manual.image === image) return manual.view;
    return image && viewport ? fit(image, viewport) : { level: ONE_TO_ONE, ox: 0, oy: 0 };
  }, [manual, image, viewport]);
  const setView = (next: View) => image && setManual({ image, view: next });
  const shownHover = hover?.image === image ? hover : null;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !viewport) return;
    ctx.clearRect(0, 0, viewport.width, viewport.height);
    if (!image) return;
    const z = zoomFactor(view.level);
    const dw = Math.ceil(image.width * z);
    const dh = Math.ceil(image.height * z);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image.source, view.ox, view.oy, dw, dh);
    if (!grid || z < GRID_MIN_FACTOR) return;
    ctx.fillStyle = GRID_COLOR;
    const top = Math.max(view.oy, 0);
    const bottom = Math.min(view.oy + dh, viewport.height);
    const left = Math.max(view.ox, 0);
    const right = Math.min(view.ox + dw, viewport.width);
    for (
      let x = Math.max(0, Math.floor(-view.ox / z));
      x <= Math.min(image.width, Math.ceil((viewport.width - view.ox) / z));
      x++
    ) {
      ctx.fillRect(view.ox + x * z, top, 1, bottom - top);
    }
    for (
      let y = Math.max(0, Math.floor(-view.oy / z));
      y <= Math.min(image.height, Math.ceil((viewport.height - view.oy) / z));
      y++
    ) {
      ctx.fillRect(left, view.oy + y * z, right - left, 1);
    }
  }, [image, view, viewport, grid]);

  const area = viewport ?? FALLBACK_VIEWPORT;
  const zoomBy = (step: number, ax = area.width / 2, ay = area.height / 2) =>
    setView(zoomAt(view, view.level + step, ax, ay));
  const oneToOne = () => image && setView(centered(ONE_TO_ONE, image, area));
  const fitView = () => setManual(null);

  // React's wheel listener is passive, so preventDefault needs a native one.
  const wheel = useRef<(e: WheelEvent) => void>(() => {});
  // Wheel movement not yet turned into a zoom level (#90: trackpads send many small steps).
  const wheelRest = useRef(0);
  useEffect(() => {
    wheel.current = (e) => {
      // Plain scrolling scrolls the page; Ctrl (or Cmd) + scroll zooms, as in embedded maps.
      if (!image || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const [x, y] = toDevice(canvasRef.current, e);
      const { levels, rest } = accumulateWheel(wheelRest.current, wheelPixels(e.deltaY, e.deltaMode));
      wheelRest.current = rest;
      if (levels) zoomBy(levels, x, y);
    };
  });
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const listener = (e: WheelEvent) => wheel.current(e);
    canvas.addEventListener("wheel", listener, { passive: false });
    return () => canvas.removeEventListener("wheel", listener);
  }, []);

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    const [x, y] = toDevice(e.currentTarget, e);
    const start = drag.current;
    const next = start
      ? {
          ...view,
          ox: Math.round(start.ox + x - start.x),
          oy: Math.round(start.oy + y - start.y),
        }
      : view;
    if (start) setView(next);
    const at = image && pixelAt(next, x, y, image);
    if (!image || !at) return setHover(null);
    const i = (at.y * image.width + at.x) * 4;
    const p = image.pixels;
    setHover({ image, ...at, r: p[i], g: p[i + 1], b: p[i + 2], a: p[i + 3] });
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const actions: Record<string, () => void> = {
      "+": () => zoomBy(1),
      "=": () => zoomBy(1),
      "-": () => zoomBy(-1),
      "1": oneToOne,
      "0": fitView,
    };
    const action = actions[e.key];
    if (!action) return;
    e.preventDefault();
    action();
  }

  const n = ZOOM_LEVELS[view.level];
  const failed = current && !image;

  return (
    <section aria-label="Pikslieelvaade" className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={button} onClick={() => zoomBy(-1)} disabled={!image} aria-label="Vähenda">
          −
        </button>
        <span className="min-w-12 text-center font-mono" aria-live="polite" aria-label="Suurendus">
          {zoomLabel(view.level)}
        </span>
        <button type="button" className={button} onClick={() => zoomBy(1)} disabled={!image} aria-label="Suurenda">
          +
        </button>
        <button type="button" className={button} onClick={oneToOne} disabled={!image}>
          1:1
        </button>
        <button type="button" className={button} onClick={fitView} disabled={!image}>
          Mahuta
        </button>
        <label className="ml-2 flex items-center gap-2">
          <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} />
          Pikslivõrk
        </label>
      </div>
      <div className="mt-2">
        <BackgroundPicker label="Taust" value={stage} onChange={setStage} presets={STAGE_PRESETS} defaultHex="#8a929c" defaultSwatch="bg-stage" />
      </div>

      <canvas
        ref={canvasRef}
        width={area.width}
        height={area.height}
        tabIndex={0}
        role="img"
        aria-label={`${name} täpses eelvaates. Suurenda klahviga +, vähenda klahviga −, 1 on 1:1, 0 mahutab.`}
        className="mt-3 block h-90 w-full cursor-crosshair touch-none rounded-lg bg-stage"
        style={stage ? { background: backgroundCss(stage) } : undefined}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          const [x, y] = toDevice(e.currentTarget, e);
          drag.current = { x, y, ox: view.ox, oy: view.oy };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onPointerLeave={() => setHover(null)}
      />

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-mono">{name}</span>
        {image && (
          <span className="font-mono text-muted">
            {image.width} × {image.height} px
          </span>
        )}
        {!current && <span className="text-muted">Avan pilti…</span>}
        <span className="flex items-center gap-2 font-mono" aria-label="Piksel kursori all">
          {shownHover ? (
            <>
              <i
                className="inline-block size-4 rounded-sm border border-line"
                style={{ background: cssColor(shownHover) }}
              />
              x {shownHover.x}, y {shownHover.y} · {formatHex({ r: shownHover.r, g: shownHover.g, b: shownHover.b })} ·
              rgb {shownHover.r}, {shownHover.g}, {shownHover.b}
              {shownHover.a < 255 && `, a ${shownHover.a}`} ·{" "}
              {formatOklch(srgbToOklch(shownHover.a < 255 ? shownHover : { r: shownHover.r, g: shownHover.g, b: shownHover.b }))}
            </>
          ) : (
            image && <span className="text-muted">Liigu pildil, et näha pikslit.</span>
          )}
        </span>
      </div>
      {failed && (
        <p role="alert" className="mt-2">
          {current.tooLarge
            ? `Pilt „${name}” (${current.tooLarge.width} × ${current.tooLarge.height}) on eelvaate jaoks liiga suur. ` +
              `Eelvaade näitab kuni ${MAX_PREVIEW_PIXELS.toLocaleString("et")} pikslit; analüüsi saab ikka käivitada.`
            : `See brauser ei suuda faili „${name}” täpsete väärtustega avada. Salvesta pilt BMP või PNG kujul ja proovi uuesti.`}
        </p>
      )}
      {image && (
        <p className={`${hint} mt-1`}>
          {n > 0
            ? `Iga pildi pikslit näidatakse ${n} × ${n} ekraanipikslina, ilma silumise ja segamiseta.`
            : `Vähendatud: näidatakse iga ${-n}. pikslit, segamata. Kõigi pikslite nägemiseks vali 1:1 või suurem.`}{" "}
          Ctrl + kerimine suurendab, lohistamine liigutab.
        </p>
      )}
    </section>
  );
}

/** Pointer position in canvas device pixels. */
function toDevice(canvas: HTMLCanvasElement | null, e: { clientX: number; clientY: number }): [number, number] {
  const rect = canvas?.getBoundingClientRect();
  if (!canvas || !rect || rect.width === 0 || rect.height === 0) return [e.clientX, e.clientY];
  return [
    ((e.clientX - rect.left) * canvas.width) / rect.width,
    ((e.clientY - rect.top) * canvas.height) / rect.height,
  ];
}
