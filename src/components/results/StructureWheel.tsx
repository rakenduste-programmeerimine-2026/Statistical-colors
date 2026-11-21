"use client";

import { useId, useState } from "react";
import type { ColorStructure, PaletteCluster } from "@/core/analysis/color-analysis";
import { MODEL_LABELS, structureLabel } from "@/core/analysis/ontology";
import { modelHue, wheelColor, type ColorModel } from "@/core/color/models";
import { clampChroma, formatOklch, oklchCss, oklchToSrgb, srgbToOklch, type Oklch } from "@/core/color/oklch";
import { arcPath, chromaRadius, deltaERadius, lightnessRingWidth, medianLightness, polar, ringChroma, ringSegments } from "@/core/color/wheel";
import { formatDelta } from "@/core/analysis/format";
import { hint } from "../ui";
import { ColorName, colorNameText, useNameIndex } from "../ColorName";

const SIZE = 320;
const C = SIZE / 2;
const OUTER = 150;
const RING = 14;
const PLOT = OUTER - RING - 6;
const CORE = 30;
const MODELS: ColorModel[] = ["oklch", "hsl", "hsv", "hwb", "ryb"];

/** Hue of an OKLCH colour on the given model's wheel; null for greys. */
function hueOn(model: ColorModel, color: Oklch): number | null {
  if (model === "oklch") return color.h;
  return modelHue(model, oklchToSrgb(color));
}

interface Props {
  structure: ColorStructure;
  palette: PaletteCluster[];
}

/**
 * One structure on a hue wheel (P-031 item 4). OKLCH is the default; hovering
 * or focusing the wheel reveals the other colour models. Ideal points are empty
 * circles that grow with their ΔE; actual colours are filled dots.
 */
export function StructureWheel({ structure, palette }: Props) {
  const nameIndex = useNameIndex();
  const named = (c: Oklch) => {
    const n = colorNameText(nameIndex, c);
    return n ? ` ≈ ${n}` : "";
  };
  const [model, setModel] = useState<ColorModel>("oklch");
  const titleId = useId();
  const descId = useId();
  const byId = new Map(palette.map((c) => [c.id, c]));
  const label = structureLabel(structure);

  // Spokes: on the OKLCH wheel at the ideal points' hues, on the structure's own wheel at its template.
  const spokes =
    model === structure.model && structure.template && structure.rotation !== undefined
      ? structure.template.offsets.map((o) => structure.rotation! + o)
      : model === "oklch"
        ? [...new Set(structure.points.map((p) => p.ideal.h).filter((h): h is number => h !== null))]
        : [];
  // Lightness is always OKLCH, whichever wheel is shown (P-033 item 4).
  const lightnesses = structure.points.map((p) => p.actual.l);
  const median = medianLightness(lightnesses);
  const darkest = Math.min(...lightnesses);
  const chroma = ringChroma(median);
  const ringColor = (h: number): string =>
    model === "oklch"
      ? oklchCss({ l: median, c: chroma, h })
      : oklchCss(clampChroma({ ...srgbToOklch(wheelColor(model, h)), l: median }));
  const at = (color: Oklch) => {
    const h = hueOn(model, color);
    return h === null ? { x: C, y: C } : polar(h, chromaRadius(color.c, CORE, PLOT), C, C);
  };
  const dotRadius = (clusterId: string) => 4 + Math.sqrt(byId.get(clusterId)?.share ?? 1) * 1.6;
  // Outer edge of a dot with its lightness ring; ΔE circles start just outside the largest one,
  // so they enclose the colour instead of hiding inside its ring.
  const outerRadius = (p: (typeof structure.points)[number]) => dotRadius(p.clusterId) + 1 + lightnessRingWidth(p.actual.l - darkest);
  const deltaEBase = Math.max(...structure.points.map(outerRadius)) + 3;
  const meanDeltaE = structure.points.reduce((s, p) => s + p.deltaE, 0) / structure.points.length;
  const maxDeltaE = Math.max(...structure.points.map((p) => p.deltaE));
  const description =
    `${label}, ${structure.points.length} punkti, leitud ${MODEL_LABELS[structure.model]} mudelis` +
    `${structure.rotation === undefined ? "" : `, pööre ${structure.rotation}°`}. ` +
    `Keskmine ΔE ideaalist ${meanDeltaE.toFixed(3)}, suurim ${maxDeltaE.toFixed(3)}. ` +
    `Ratas: ${MODEL_LABELS[model]}, OKLCH mediaanheledusel L ${median.toFixed(3)}. ` +
    `Heledusvahe tumedaimast kuni ${(Math.max(...lightnesses) - darkest).toFixed(3)}.`;

  return (
    <figure className="group m-0">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Värvimudel">
        {MODELS.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={model === m}
            onClick={() => setModel(m)}
            className={`rounded-md border px-2 py-1 text-sm transition-opacity ${
              model === m ? "border-ink opacity-100" : "border-line opacity-40 group-focus-within:opacity-100 group-hover:opacity-100"
            }`}
          >
            {MODEL_LABELS[m]}
            {m === structure.model && m !== "oklch" ? " · algne ratas" : ""}
          </button>
        ))}
      </div>
      <p className={`${hint} mt-1`}>Hõljuta ratta kohal, et vaadata teisi värvimudeleid.</p>

      <svg
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mt-2 h-auto w-full max-w-90"
      >
        <title id={titleId}>{label}</title>
        <desc id={descId}>{description}</desc>
        {ringSegments(72).map((s) => (
          <path key={s.h0} d={arcPath(s.h0, s.h1 + 0.4, OUTER - RING, OUTER, C, C)} fill={ringColor(s.mid)} />
        ))}
        {/* The achromatic core: hues here are not trusted. */}
        <circle cx={C} cy={C} r={CORE} fill="var(--color-line-soft)" stroke="var(--color-line)" />
        {spokes.map((h) => {
          const end = polar(h, OUTER - RING, C, C);
          return <line key={h} x1={C} y1={C} x2={end.x} y2={end.y} stroke="var(--color-ink)" strokeOpacity={0.35} strokeWidth={1.5} />;
        })}
        {structure.points.map((p, i) => {
          const ideal = at(p.ideal);
          const actual = at(p.actual);
          const cluster = byId.get(p.clusterId);
          const r = dotRadius(p.clusterId);
          const deltaL = p.actual.l - darkest;
          const ringWidth = lightnessRingWidth(deltaL);
          return (
            <g key={`${p.clusterId}-${i}`}>
              <line x1={ideal.x} y1={ideal.y} x2={actual.x} y2={actual.y} stroke="var(--color-ink)" strokeOpacity={0.5} />
              {/* Thicker the lighter than the darkest colour, in OKLCH L. */}
              <circle
                data-testid="lightness"
                cx={actual.x}
                cy={actual.y}
                r={r + 1 + ringWidth / 2}
                fill="none"
                stroke="var(--color-ink)"
                strokeWidth={ringWidth}
              />
              <circle data-testid="actual" cx={actual.x} cy={actual.y} r={r} fill={oklchCss(p.actual)} stroke="var(--color-page)" strokeWidth={2}>
                <title>{`Tegelik: ${formatOklch(p.actual)}${named(p.actual)}, L ${p.actual.l.toFixed(3)}, ΔL tumedaimast ${formatDelta(deltaL, "0, see on tumedaim")}${cluster ? `, osakaal ${cluster.share.toFixed(2)}%` : ""}`}</title>
              </circle>
            </g>
          );
        })}
        {/* The ΔE circles go last, on top of every dot and ring; they have no fill, so nothing is hidden.
            A page-coloured halo keeps them visible where they cross a dark ring. */}
        {structure.points.map((p, i) => {
          const ideal = at(p.ideal);
          const r = deltaERadius(p.deltaE, deltaEBase, deltaEBase + 21);
          return (
            <g key={`ideal-${p.clusterId}-${i}`}>
              <circle cx={ideal.x} cy={ideal.y} r={r} fill="none" stroke="var(--color-page)" strokeWidth={4} />
              <circle data-testid="ideal" cx={ideal.x} cy={ideal.y} r={r} fill="none" className="stroke-delta" strokeWidth={1.5}>
                <title>{`Ideaal: ${formatOklch(p.ideal)}${named(p.ideal)}, ΔE ${formatDelta(p.deltaE, "0, täpne")}`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
      <figcaption className={`${hint} mt-1`}>
        Tühi ring: ideaalne punkt (mida suurem, seda suurem ΔE). Täidetud täpp: tegelik värv; selle ümber olev rõngas on seda
        paksem, mida heledam on värv tumedaimast (OKLCH L). Ratas on värvide OKLCH mediaanheledusel. Keskne ala: madal küllastus, toon
        ebakindel.
      </figcaption>

      <details className="mt-2">
        <summary className="cursor-pointer text-sm">Punktid tabelina</summary>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr>
              {["Tegelik", "Ideaalne", "ΔE", "L", "ΔL"].map((h) => (
                <th key={h} className="border-b border-line-soft p-1.5 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {structure.points.map((p, i) => (
              <tr key={`${p.clusterId}-${i}`}>
                <td className="border-b border-line-soft p-1.5 font-mono">
                  {formatOklch(p.actual)} <ColorName color={p.actual} />
                </td>
                <td className="border-b border-line-soft p-1.5 font-mono">
                  {formatOklch(p.ideal)} <ColorName color={p.ideal} />
                </td>
                <td className="border-b border-line-soft p-1.5 font-mono">{formatDelta(p.deltaE, "0 (täpne)")}</td>
                <td className="border-b border-line-soft p-1.5 font-mono">{p.actual.l.toFixed(3)}</td>
                <td className="border-b border-line-soft p-1.5 font-mono">{formatDelta(p.actual.l - darkest, "tumedaim")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
