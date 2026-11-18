import type { ColorAnalysis, ColorStructure, Finding, Meta, PaletteCluster, StructurePoint } from "@/core/analysis/color-analysis";
import { wheelColor } from "@/core/color/models";
import { deltaEOk, oklchToSrgb, srgbToOklch, type Oklch } from "@/core/color/oklch";

// PLACEHOLDER(#55, #56, #57, #58, #60, #65): the server computes the colour
// analysis. This stub never reads pixels: it builds a believable, internally
// consistent result (ideal points, real ΔE per point, an HSL-built pair with
// its real drift) so the UI can be exercised, and marks it `simulated`.

const stubMeta = (requires: Meta["requires"], method: string, confidence = 0.8): Meta => ({
  provenance: "fitted",
  confidence,
  method: `simulated: ${method}`,
  requires,
  caveats: ["consistent-not-proven"],
});

/** Lowers chroma until the colour fits in sRGB (P-031 item 6). */
function inSrgb(o: Oklch): Oklch {
  let c = o.c;
  while (c > 0 && !oklchToSrgb({ ...o, c }).inGamut) c -= 0.002;
  return { ...o, c: Math.max(0, c) };
}

const wrap = (h: number) => ((h % 360) + 360) % 360;

export function generateColorAnalysis(random: () => number): ColorAnalysis {
  const palette: PaletteCluster[] = [];
  const add = (color: Oklch, share: number, method: string): PaletteCluster => {
    const c: PaletteCluster = {
      id: `c${palette.length}`,
      color,
      share,
      pixelCount: Math.round(share * 40),
      memberCount: 1 + Math.floor(random() * 12),
      spreadDeltaE: Number((random() * 0.02).toFixed(4)),
      meta: stubMeta("pixels", method),
    };
    palette.push(c);
    return c;
  };

  // A dark UI: background and text (two-level lightness).
  const bg = add({ l: 0.18 + random() * 0.06, c: 0.01, h: 260 }, 55, "largest flat cluster");
  const text = add({ l: 0.92 + random() * 0.04, c: 0, h: null }, 6, "text cluster");

  // A triad in OKLCH with a little error per point.
  const rotation = Math.round(random() * 360);
  const offsets = [0, 120, 240];
  const triad = offsets.map((o, i) => {
    const ideal = inSrgb({ l: 0.55 + i * 0.1, c: 0.12, h: wrap(rotation + o) });
    const actual = inSrgb({ ...ideal, h: wrap(ideal.h! + (random() - 0.5) * 12) });
    return { cluster: add(actual, 6 - i, "accent cluster"), ideal, spoke: i };
  });

  // An equal-lightness ramp with equal ΔE steps.
  const ramp = Array.from({ length: 5 }, (_, i) => {
    const ideal = inSrgb({ l: 0.68, c: 0.06 + i * 0.015, h: wrap(rotation + 60) });
    const actual = inSrgb({ ...ideal, l: ideal.l + (random() - 0.5) * 0.01 });
    return { cluster: add(actual, 2, "ramp step"), ideal };
  });

  // A complementary pair built in HSL: real OKLCH colours of HSL hues h and h + 180.
  const hslBase = Math.round(random() * 360);
  const hslPair = [hslBase, hslBase + 180].map((h) => srgbToOklch(wheelColor("hsl", wrap(h))));
  const hslClusters = hslPair.map((o) => add(o, 3, "accent cluster"));

  const point = (clusterId: string, ideal: Oklch, actual: Oklch, spoke?: number): StructurePoint => ({
    clusterId,
    ideal,
    actual,
    deltaE: Number(deltaEOk(ideal, actual).toFixed(4)),
    ...(spoke === undefined ? {} : { spoke }),
  });
  const hueError = (a: Oklch, b: Oklch) => {
    const d = Math.abs((a.h ?? 0) - (b.h ?? 0)) % 360;
    return Math.min(d, 360 - d);
  };

  const structures: ColorStructure[] = [
    {
      id: "s0",
      code: "harmony.triadic",
      family: "harmony",
      title: "Kolmikharmoonia",
      model: "oklch",
      laws: { l: "free", c: "const", h: "sym" },
      template: { offsets },
      rotation,
      points: triad.map((t) => point(t.cluster.id, t.ideal, t.cluster.color, t.spoke)),
      coverage: 0.62,
      score: 0.81,
      residual: Number((triad.reduce((s, t) => s + hueError(t.ideal, t.cluster.color), 0) / 3).toFixed(2)),
      meta: stubMeta("pixels", "template fit, 360 rotations, λ 2, C ≥ 0.04"),
    },
    {
      id: "s1",
      code: "ramp.iso-lightness-equal-step",
      family: "ramp",
      title: "Sama heledus, võrdsed ΔE sammud",
      model: "oklch",
      laws: { l: "const", c: "arith", h: "const", path: "equal-step" },
      points: ramp.map((r) => point(r.cluster.id, r.ideal, r.cluster.color)),
      step: {
        target: 0.015,
        deltaEs: ramp.slice(1).map((r, i) => Number(deltaEOk(ramp[i].cluster.color, r.cluster.color).toFixed(4))),
      },
      coverage: 0.2,
      score: 0.74,
      residual: 0.004,
      meta: stubMeta("pixels", "collinear in OKLab, step CV ≤ 0.15"),
    },
  ];
  // The HSL pair against the ideal OKLCH complementary anchored on its first colour.
  const anchor = hslPair[0].h ?? 0;
  structures.push({
    id: "s2",
    code: "harmony.complementary",
    family: "harmony",
    title: "Vastandvärvid (ehitatud HSL-is)",
    model: "hsl",
    laws: { l: "free", c: "free", h: "sym" },
    template: { offsets: [0, 180] },
    rotation: hslBase,
    points: hslPair.map((o, i) => point(hslClusters[i].id, { ...o, h: wrap(anchor + i * 180) }, o, i)),
    coverage: 0.15,
    score: 0.66,
    residual: Number((hueError({ ...hslPair[1], h: wrap(anchor + 180) }, hslPair[1]) / 2).toFixed(2)),
    meta: stubMeta("pixels", "template fit in HSL hue; drift measured in OKLCH"),
  });

  const contrastRatio = 14.2;
  const findings: Finding[] = [
    {
      id: "f0",
      kind: "ui.dark-mode",
      area: "ui",
      severity: "info",
      title: "Tume režiim",
      detail: "Suurim ühtlane värv on tume ja katab üle poole pildist; selle peal on heledad tekstivärvid.",
      metrics: [
        { key: "bgL", label: "Tausta heledus (L)", value: Number(bg.color.l.toFixed(3)), min: 0, max: 1 },
        { key: "bgShare", label: "Tausta osakaal", value: bg.share, unit: "%", min: 0, max: 100 },
      ],
      swatches: [
        { color: bg.color, label: "taust", share: bg.share },
        { color: text.color, label: "tekst", share: text.share },
      ],
      clusterIds: [bg.id, text.id],
      meta: { ...stubMeta("pixels+layout", "largest flat cluster ≥ 35 % with L ≤ 0.3, contrasting clusters ≥ 1 %"), caveats: ["consistent-not-proven", "needs-scene-data"] },
    },
    {
      id: "f1",
      kind: "structure.hsl-constructed",
      area: "structure",
      severity: "notice",
      title: "Ehitatud HSL-is, mitte OKLCH-s",
      detail: "Paar on HSL-i ratta peal täpselt vastas, kuid OKLCH-s nihkunud.",
      structureIds: ["s2"],
      clusterIds: hslClusters.map((c) => c.id),
      meta: stubMeta("pixels", "fit in HSL hue beats the OKLCH fit"),
    },
    {
      id: "f2",
      kind: "accessibility.wcag-fail",
      area: "accessibility",
      severity: "info",
      title: "Kontrast",
      detail: "Tekst ja taust ületavad WCAG AA ja AAA piiri.",
      metrics: [{ key: "ratio", label: "Kontrastsuhe", value: contrastRatio, unit: ": 1", min: 1, max: 21 }],
      clusterIds: [text.id, bg.id],
      meta: stubMeta("pixels", "WCAG 2 relative luminance"),
    },
    {
      id: "f3",
      kind: "artefact.antialias-blend",
      area: "artefact",
      severity: "info",
      title: "Servade silumise vahevärvid",
      metrics: [{ key: "share", label: "Segupiksleid", value: 1.9, unit: "%", min: 0, max: 100 }],
      gradient: [
        { color: text.color, at: 0 },
        { color: bg.color, at: 1 },
      ],
      meta: { ...stubMeta("pixels", "blend snap in sRGB, tolerance 6"), caveats: ["antialias-blend"] },
    },
  ];

  return {
    schemaVersion: 1,
    status: "simulated",
    inputKind: "png-lossless",
    sourceProfile: "srgb",
    pipeline: [
      { step: "blend-snap", status: "done", params: { tolerance: 6 }, removedShare: 1.9 },
      { step: "share-filter", status: "done", params: { z: -2, floorPercent: 0.05 }, removedShare: 0.4 },
      { step: "convert", status: "done" },
      { step: "cluster", status: "done", params: { tau: 0.02, linkage: "complete" } },
      { step: "structures", status: "done", params: { c0: 0.04, lambda: 2 } },
      { step: "contrast", status: "done" },
      { step: "roles", status: "not-implemented" },
      { step: "findings", status: "done" },
    ],
    palette,
    structures,
    contrast: [
      {
        fgClusterId: text.id,
        bgClusterId: bg.id,
        ratio: contrastRatio,
        passes: { aaText: true, aaLargeText: true, aaNonText: true, aaaText: true },
        meta: stubMeta("pixels", "WCAG 2 relative luminance"),
      },
    ],
    findings,
  };
}
