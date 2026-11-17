// Combination steps. Each runs only when every approach in `needs` ran.
// K1+S1 from the reference is left out: it compares the k× re-render with the
// paint record's replay, which the extension never has (P-025 item 6).
import type { D1Result } from "../approaches/d1-matte.ts";
import { D2, type D2Result } from "../approaches/d2-snap.ts";
import { candidateFonts, fitImage, type F1Result, type FitRegionResult } from "../approaches/f1-fit.ts";
import type { K1Result } from "../approaches/k1-hires.ts";
import type { S1Result } from "../approaches/s1-layout.ts";
import { rasteriseSvg, verifyScene, type S2Result } from "../approaches/s2-scene.ts";
import { crop, diff, parseColor, type DiffResult, type Pixels } from "./img.ts";
import { PATCH_COMBO } from "./patches.ts";
import { outOf, type Combination } from "./pipeline.ts";
import { embedMeta, forCheck, walkNodes, type SceneNode } from "./scene.ts";

export const pick = (d: DiffResult) => ({ exactPct: d.exactPct, tolPct: d.tolPct, maxDiff: d.maxDiff, ...(d.sizeMismatch ? { sizeMismatch: d.sizeMismatch } : {}) });

/** "r,g,b,a" for comparing colours written in different syntaxes. */
export const norm = (s: string) => {
  const c = parseColor(s);
  return c ? `${c[0]},${c[1]},${c[2]},${c[3]}` : s;
};

/** Words in `theirs` that `mine` lacks, and the reverse, counting repeats. */
export function wordDiff(mine: string[], theirs: string[]) {
  const bag = new Map<string, number>();
  for (const w of mine) bag.set(w, (bag.get(w) ?? 0) + 1);
  const missing: string[] = [];
  for (const w of theirs) {
    const n = bag.get(w) ?? 0;
    if (n) bag.set(w, n - 1);
    else missing.push(w);
  }
  return { missing, extra: [...bag].filter(([, n]) => n > 0).map(([w]) => w) };
}

/** Black-on-white targets from D1's coverage: averaged (grey text) and per channel (subpixel text). */
export function coverageTargets(alpha: Pixels) {
  const grey: Pixels = { width: alpha.width, height: alpha.height, data: new Uint8ClampedArray(alpha.data.length) };
  const colour: Pixels = { width: alpha.width, height: alpha.height, data: new Uint8ClampedArray(alpha.data.length) };
  for (let i = 0; i < alpha.data.length; i += 4) {
    const m = 255 - Math.round((alpha.data[i] + alpha.data[i + 1] + alpha.data[i + 2]) / 3);
    for (let c = 0; c < 3; c++) {
      grey.data[i + c] = m;
      colour.data[i + c] = 255 - alpha.data[i + c];
    }
    grey.data[i + 3] = colour.data[i + 3] = 255;
  }
  return { grey, colour };
}

/** Does text on an opaque canvas get subpixel smoothing in this browser? Runs inside the page. */
export function opaqueCanvasGivesSubpixelText(): boolean {
  const c = document.createElement("canvas");
  c.width = 120;
  c.height = 40;
  const g = c.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!g) return false;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, 120, 40);
  g.fillStyle = "#000";
  g.font = "16px sans-serif";
  g.fillText("Wilm vxk", 4, 26);
  const D = g.getImageData(0, 0, 120, 40).data;
  for (let i = 0; i < D.length; i += 4) if (Math.abs(D[i] - D[i + 2]) > 12) return true;
  return false;
}

export function summarise(res: FitRegionResult, truth: string) {
  const texts = res.items.flatMap((i) => (i.kind === "text" ? [i] : []));
  const got = texts.map((i) => i.text).join(" ");
  return {
    text: got,
    textCorrect: got === truth,
    font: texts[0] ? `${texts[0].weight} ${texts[0].size}px ${texts[0].family}` : null,
    residual: texts.reduce((s, i) => s + i.residual, 0),
    exact: texts.length > 0 && texts.every((i) => i.exact),
    ms: res.ms,
  };
}

const snapReport = (r: D2Result["report"]) => ({ snappedPct: r.snappedPct, snappedSubpixelPct: r.snappedSubpixelPct, unexplainedPct: r.unexplainedPct });

export const COMBINATIONS: Combination[] = [
  {
    id: "K1+D2",
    needs: ["K1", "D2"],
    what: "Snap the k× re-render to declared colours: a large, hard-edged, palette-only raster",
    async run(ctx) {
      const k1 = outOf<K1Result>(ctx, "K1");
      const r = await D2.run(ctx, { source: k1, name: `snapped@${k1.scale}x.png` });
      ctx.out["K1+D2"] = r;
      return { ...r.report, unexplainedAt1x: outOf<D2Result>(ctx, "D2").report.unexplainedPct };
    },
  },
  {
    id: "S1+D2",
    needs: ["S1", "D2"],
    what: "Use the browser record's colours as the palette instead of computed styles",
    async run(ctx) {
      const r = await D2.run(ctx, { extraPalette: outOf<S1Result>(ctx, "S1").palette, name: "snapped-paint-palette.png" });
      const d2 = outOf<D2Result>(ctx, "D2").report;
      return {
        declaredColours: r.report.declaredColours,
        unexplainedPct: r.report.unexplainedPct,
        observedFlatColours: r.report.observedFlatColours,
        withoutBrowserRecord: { declaredColours: d2.declaredColours, unexplainedPct: d2.unexplainedPct, observedFlatColours: d2.observedFlatColours },
      };
    },
  },
  {
    id: "D1+D2",
    needs: ["D1", "D2"],
    what: "Snap the text-free background plate: are the remaining blend colours all from text?",
    async run(ctx) {
      const r = await D2.run(ctx, { source: { image: outOf<D1Result>(ctx, "D1").background }, name: "snapped-background.png" });
      return { ...snapReport(r.report), withText: snapReport(outOf<D2Result>(ctx, "D2").report) };
    },
  },
  {
    id: "S1+S2",
    needs: ["S1", "S2"],
    what: "Cross-check the SVG scene against the browser's own record",
    async run(ctx) {
      const s1 = outOf<S1Result>(ctx, "S1");
      const s2 = outOf<S2Result>(ctx, "S2");
      const opaque = (list: string[]) => new Set(list.map(norm).filter((c) => c.endsWith(",1")));
      const a = opaque(s1.palette);
      const b = opaque(s2.palette);
      // Which words did the browser lay out that the SVG lacks?
      const words = (list: { text: string }[]) => list.flatMap((t) => t.text.split(/\s+/)).filter(Boolean);
      const mine = words(s2.texts);
      const theirs = words(s1.textBoxes);
      const { missing, extra } = wordDiff(mine, theirs);
      return {
        mode: s1.mode,
        coloursInBoth: [...a].filter((c) => b.has(c)).length,
        onlyInBrowserRecord: [...a].filter((c) => !b.has(c)),
        onlyInSvg: [...b].filter((c) => !a.has(c)),
        browserWords: theirs.length,
        svgWords: mine.length,
        wordsMissingFromSvg: missing.slice(0, 30),
        wordsOnlyInSvg: extra.slice(0, 30),
      };
    },
  },
  {
    id: "D1+S2",
    needs: ["D1", "S2"],
    what: "Score the SVG separately on text pixels and on everything else",
    async run(ctx) {
      const d1 = outOf<D1Result>(ctx, "D1");
      const s2 = outOf<S2Result>(ctx, "S2");
      const shot = await ctx.shot();
      const info = await ctx.info();
      const W = shot.width;
      const H = shot.height;
      const n = W * H;
      // Masks: 1 = ignore.
      const isText = new Uint8Array(n);
      const notText = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const t = d1.cover[i] > 0.02;
        isText[i] = t ? 0 : 1;
        notText[i] = t ? 1 : 0;
      }
      const inRun = new Uint8Array(n);
      for (const t of s2.texts) {
        const x0 = Math.max(0, Math.floor((t.x - 1) * info.dpr));
        const x1 = Math.min(W, Math.ceil((t.x + t.w + 1) * info.dpr));
        const y0 = Math.max(0, Math.floor((t.y - 1) * info.dpr));
        const y1 = Math.min(H, Math.ceil((t.y + t.h + 1) * info.dpr));
        for (let y = y0; y < y1; y++) inRun.fill(1, y * W + x0, y * W + x1);
      }
      let textPx = 0;
      let missed = 0;
      for (let i = 0; i < n; i++) {
        if (d1.cover[i] <= 0.02) continue;
        textPx++;
        if (!inRun[i]) missed++;
      }
      // The background plate against the SVG with its text removed.
      const noText = forCheck(s2.svg).replace(/<text\b[^>]*>[^<]*<\/text>/g, "");
      const plate = await ctx.decode(await ctx.host.page(rasteriseSvg, noText, info.dpr));
      return {
        onTextPixels: pick(diff(s2.raster, shot, { mask: isText })),
        offTextPixels: pick(diff(s2.raster, shot, { mask: notText })),
        onTextPixelsBrightnessOnly: {
          within8Pct: diff(s2.raster, shot, { mask: isText, luma: true }).tolPct,
          within48Pct: diff(s2.raster, shot, { mask: isText, luma: true, tol: 48 }).tolPct,
        },
        textPixelsOutsideAnySvgRunPct: textPx ? Math.round((missed / textPx) * 1e4) / 100 : 0,
        textFreeSvgVsBackgroundPlate: pick(diff(plate, d1.background)),
      };
    },
  },
  {
    id: "K1+S2",
    needs: ["K1", "S2"],
    what: "Does the SVG scene still match when both are zoomed k×?",
    async run(ctx) {
      const info = await ctx.info();
      const k1 = outOf<K1Result>(ctx, "K1");
      const s2 = outOf<S2Result>(ctx, "S2");
      const big = await ctx.decode(await ctx.host.page(rasteriseSvg, forCheck(s2.svg), info.dpr * k1.scale));
      await ctx.save(`scene@${k1.scale}x.png`, big);
      return { ...pick(diff(big, k1.image)), at1x: s2.report.vsShot };
    },
  },
  {
    id: "F1+S2",
    needs: ["F1", "S2"],
    what: "Replace canvas bitmaps in the SVG with fitted vectors where the fit is exact",
    async run(ctx) {
      const s2 = outOf<S2Result>(ctx, "S2");
      let svg = s2.svg;
      let replaced = 0;
      let kept = 0;
      const meta = structuredClone(s2.meta);
      for (const t of outOf<F1Result>(ctx, "F1").targets) {
        if (!t.svg || !t.snapped || !t.metaNode) continue;
        const [sx, sy] = t.snapped;
        const re = new RegExp(`<image data-raster-source="canvas" x="${sx}" y="${sy}"[^>]*/>`);
        if (!(t.allExact && re.test(svg))) {
          kept++;
          continue;
        }
        const fittedSvg = t.svg;
        const node = t.metaNode;
        svg = svg.replace(re, () => fittedSvg);
        replaced++;
        // The same swap in the metadata: the bitmap node becomes a frame of fitted vectors.
        walkNodes(meta.root, (parent) => {
          const kids = parent.children ?? [];
          const i = kids.findIndex((c: SceneNode) => c.kind === "image" && c.source?.tag === "canvas" && Math.abs(c.box[0] - sx) < 0.01 && Math.abs(c.box[1] - sy) < 0.01);
          if (i >= 0) kids[i] = node;
        });
      }
      svg = embedMeta(svg, meta);
      ctx.out["F1+S2"] = { svg, meta };
      await ctx.save("scene+fit.svg", svg);
      const v = await verifyScene(ctx, svg, s2.unsupported);
      return { canvasesVectorised: replaced, canvasesKeptAsBitmap: kept, vsShot: v.whole, before: s2.report.vsShot, rasterImagesLeft: (svg.match(/data-raster-source=/g) ?? []).length };
    },
  },
  {
    id: "D1+F1+S2",
    needs: ["D1", "F1", "S2"],
    what: "Recover DOM text from pixels alone (matte, then fit) and grade it against the DOM's own strings",
    async run(ctx) {
      const info = await ctx.info();
      const d = info.dpr;
      const d1 = outOf<D1Result>(ctx, "D1");
      const s2 = outOf<S2Result>(ctx, "S2");
      const { grey, colour } = coverageTargets(d1.alpha);
      const subpixelOnPage = d1.report.subpixelTextPct > 5;
      const opaqueCanvasSubpixel = await ctx.host.page(opaqueCanvasGivesSubpixelText);
      const trySubpixel = subpixelOnPage && opaqueCanvasSubpixel;
      const runs = s2.texts.filter((t) => t.text.length >= 3 && t.text.length <= 40 && t.y >= 0 && t.y + t.h <= info.vh).slice(0, 6);
      const rows: Record<string, unknown>[] = [];
      const ok = (row: Record<string, unknown>, k: string) => (row[k] as { textCorrect?: boolean } | undefined)?.textCorrect === true;
      for (const [i, t] of runs.entries()) {
        await ctx.host.ping?.();
        const box = [(t.x - 3) * d, (t.y - 2) * d, (t.w + 6) * d, (t.h + 4) * d] as const;
        const hint = { family: t.usedFamily, size: t.size * d, weight: +t.weight || 400 };
        const row: Record<string, unknown> = {
          truth: t.text,
          requestedFont: t.family.split(",")[0].trim(),
          usedFont: `${t.weight} ${t.size}px ${t.usedFamily}`,
          hinted: summarise(await fitImage(ctx, crop(grey, ...box), { hint, maxMs: 20000 }), t.text),
        };
        if (trySubpixel) row.hintedSubpixel = summarise(await fitImage(ctx, crop(colour, ...box), { hint, opaque: true, maxMs: 20000 }), t.text);
        if (i < 2) row.blind = summarise(await fitImage(ctx, crop(grey, ...box), { fonts: candidateFonts(ctx.opts.env, outOf<F1Result>(ctx, "F1").fonts), maxMs: 30000 }), t.text);
        rows.push(row);
      }
      const exact = (row: Record<string, unknown>) =>
        (row.hinted as { exact: boolean }).exact || (row.hintedSubpixel as { exact?: boolean } | undefined)?.exact === true;
      return {
        subpixelTextOnPage: subpixelOnPage,
        opaqueCanvasGivesSubpixelText: opaqueCanvasSubpixel,
        runsTried: rows.length,
        hintedCorrect: rows.filter((r) => ok(r, "hinted")).length,
        ...(trySubpixel ? { hintedSubpixelCorrect: rows.filter((r) => ok(r, "hintedSubpixel")).length } : {}),
        blindTried: rows.filter((r) => r.blind).length,
        blindCorrect: rows.filter((r) => ok(r, "blind")).length,
        exactPixelMatches: rows.filter(exact).length,
        rows,
      };
    },
  },
  // Last: it works on the best scene so far and can use every other output.
  PATCH_COMBO,
];
