"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { GamutCoverage } from "@/core/analysis/color-analysis";
import type { ColorCount } from "@/core/analysis/types";
import { latticeFor } from "@/core/gamut/lattice";
import { selectLattice } from "@/core/gamut/select";
import { snapColors } from "@/core/gamut/snap";
import { SPACES, type GamutSpace, type GamutSpaceId } from "@/core/gamut/space";
import { CIE_GREY } from "@/core/viewer/viewer-prefs";
import { BackgroundPicker, backgroundCss, contrastInk, type BackgroundPreset } from "../BackgroundPicker";
import { Term } from "../Term";
import { button, card, hint } from "../ui";
import { useViewerBackground } from "../useViewerBackground";
import { GamutCanvas, type CameraMode } from "./GamutCanvas";

const nf = new Intl.NumberFormat("et-EE");

interface Props {
  colors: ColorCount[];
  /** The table's count: the 3D view shows the same colours (#90). */
  topN?: number;
  /** The server's coverage figure; absent until it sends one. */
  coverage?: GamutCoverage;
}

/** The whole cloud: every hue, chroma and lightness, neutrals included (P-039 item 1). */
const wholeCloud = (space: GamutSpace) => ({
  hueCenter: 0,
  hueWidth: 360,
  chroma: [0, space.chromaMax] as [number, number],
  light: [0, space.lMax] as [number, number],
  includeNeutrals: true,
});

/**
 * The 3D colour-space view (P-035). Every possible sRGB colour is a small dot
 * on an even perceptual lattice; the image's colours snap onto it and are drawn
 * large, so you see how much of the whole the image covers. The notebook's
 * selection (cell 19) plus a lightness range sit in a collapsed filter panel.
 */
export function GamutSection({ colors: allColors, topN, coverage }: Props) {
  const colors = useMemo(() => (topN === undefined ? allColors : allColors.slice(0, topN)), [allColors, topN]);
  const [spaceId, setSpaceId] = useState<GamutSpaceId>("oklab");
  const space = SPACES[spaceId];
  const [sel, setSel] = useState(() => wholeCloud(space));
  const [showImage, setShowImage] = useState(true);
  const [mode, setMode] = useState<CameraMode>("orbit");
  const [resetKey, setResetKey] = useState(0);
  const [background, setBackground] = useViewerBackground("gamut");

  const lattice = useMemo(() => latticeFor(space), [space]);
  const selection = useMemo(
    () =>
      selectLattice(lattice, {
        hueCenter: sel.hueCenter,
        hueWidth: sel.hueWidth,
        chromaMin: sel.chroma[0],
        chromaMax: sel.chroma[1],
        lightMin: sel.light[0],
        lightMax: sel.light[1],
        includeNeutrals: sel.includeNeutrals,
      }),
    [lattice, sel],
  );
  const snapped = useMemo(() => snapColors(lattice, colors), [lattice, colors]);

  const switchSpace = (id: GamutSpaceId) => {
    setSpaceId(id);
    setSel(wholeCloud(SPACES[id]));
  };
  const filtered = selection !== null && selection.selectedCount < lattice.n;
  const fmt = (v: number) => v.toFixed(space.digits);
  const occupied = snapped.occupied.length;
  const summary =
    `Värviruum 3D: ${space.label}, ${nf.format(lattice.n)} võimalikku värvi. ` +
    (showImage ? `Pildi ${nf.format(colors.length)} värvi täidavad ${nf.format(occupied)} punkti. ` : "") +
    (coverage ? `Pilt katab ${(coverage.coverage * 100).toFixed(2)} % sRGB gamutist.` : "");

  return (
    <section className={card} aria-labelledby="gamut-heading">
      <h2 id="gamut-heading" className="text-xl font-bold">
        Värviruum 3D
      </h2>
      <p className={hint}>
        Iga väike täpp on üks võimalik <Term k="srgb">sRGB</Term> värv; täpid on ühtlaselt hajutatud nii, et naabrid erinevad
        silmale ühepalju (<Term k="deltaE">ΔE</Term> {space.step}). Pildi värvid joonistatakse suurelt lähima täpi kohale.
      </p>

      <p className="mt-3 text-lg" role="status">
        {coverage ? (
          <>
            Pilt <Term k="coverage">katab</Term> <b>{(coverage.coverage * 100).toFixed(2)} %</b> <Term k="gamut">sRGB gamutist</Term> (
            {nf.format(coverage.occupiedCells)} / {nf.format(coverage.totalCells)} <Term k="oklab">OKLab</Term>-rakku, iga rakk on üks{" "}
            <Term k="jnd">just märgatav erinevus</Term>).
            {spaceId !== coverage.space && <span className="block text-sm text-muted">Katvus on määratud OKLab-is; <Term k="cielab">CIELAB</Term>-i võrk on veidi teistsugune.</span>}
          </>
        ) : (
          <span className="text-muted">Katvust pole server veel saatnud.</span>
        )}
      </p>

      {/* What the dots mean, drawn like the dots themselves (#90). */}
      <ul aria-label="Legend" className="mt-3 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-sm">
        <li className="flex items-center gap-2">
          <span aria-hidden className="inline-block size-1.5 rounded-[1px] bg-[oklch(0.65_0.15_250)]" />
          väike täpp: võimalik värv (ei ole pildis)
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="inline-block size-4 rounded-full border-2 border-ink bg-[oklch(0.65_0.15_30)]" />
          suur raamiga täpp: pildi värv
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="inline-block size-2.5 rounded-full border-2 border-ink bg-[oklch(0.65_0.15_30)]" />
          <span aria-hidden className="inline-block size-5 rounded-full border-2 border-ink bg-[oklch(0.65_0.15_30)]" />
          mida suurem, seda suurem <Term k="share">osakaal</Term> pildist
        </li>
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">Värviruum</legend>
          {(Object.keys(SPACES) as GamutSpaceId[]).map((id) => (
            <label key={id} className="inline-flex items-center gap-1.5">
              <input type="radio" name="gamut-space" checked={spaceId === id} onChange={() => switchSpace(id)} />
              {SPACES[id].label}
            </label>
          ))}
        </fieldset>
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">Kaamera</legend>
          {(
            [
              ["orbit", "Tiirle"],
              ["fly", "Lenda"],
            ] as const
          ).map(([m, text]) => (
            <label key={m} className="inline-flex items-center gap-1.5">
              <input type="radio" name="gamut-camera" checked={mode === m} onChange={() => setMode(m)} />
              {text}
            </label>
          ))}
          <button type="button" className={`${button} px-2.5 py-1 text-sm`} onClick={() => setResetKey((k) => k + 1)}>
            Lähtesta vaade
          </button>
        </fieldset>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={showImage} onChange={(e) => setShowImage(e.target.checked)} />
          Näita pildi värve
        </label>
      </div>

      <details className="mt-3 rounded-lg border border-line p-3">
        <summary className="cursor-pointer font-bold">
          Filtreeri {filtered && <span className="font-normal text-muted">(näidatakse {nf.format(selection.selectedCount)} täppi {nf.format(lattice.n)}-st)</span>}
        </summary>
        <p className={`${hint} mt-1`}>Valitud täpid on värvilised, ülejäänud hallid.</p>
        <div className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Slider label="Toon" term="hue" hint="keskpunkt" unit="°" value={sel.hueCenter} min={0} max={360} step={1} format={(v) => v.toFixed(0)} onChange={(v) => setSel({ ...sel, hueCenter: v })} />
          <Slider label="Tooni vahemik" term="hue" hint="360 = kõik toonid" unit="°" value={sel.hueWidth} min={1} max={360} step={1} format={(v) => v.toFixed(0)} onChange={(v) => setSel({ ...sel, hueWidth: v })} />
          <Slider label="Kroom vähemalt" term="chroma" hint="0 = hall" value={sel.chroma[0]} min={0} max={space.chromaMax} step={space.chromaStep} format={fmt} onChange={(v) => setSel({ ...sel, chroma: [v, sel.chroma[1]] })} />
          <Slider label="Kroom kuni" term="chroma" hint="suurem = erksam" value={sel.chroma[1]} min={0} max={space.chromaMax} step={space.chromaStep} format={fmt} onChange={(v) => setSel({ ...sel, chroma: [sel.chroma[0], v] })} />
          <Slider label="Heledus vähemalt" term="lightness" hint="0 = must" value={sel.light[0]} min={0} max={space.lMax} step={space.lMax / 100} format={fmt} onChange={(v) => setSel({ ...sel, light: [v, sel.light[1]] })} />
          <Slider label="Heledus kuni" term="lightness" hint={`${space.lMax} = valge`} value={sel.light[1]} min={0} max={space.lMax} step={space.lMax / 100} format={fmt} onChange={(v) => setSel({ ...sel, light: [sel.light[0], v] })} />
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={sel.includeNeutrals} onChange={(e) => setSel({ ...sel, includeNeutrals: e.target.checked })} />
            Kaasa hallid (toon puudub)
          </label>
          <button type="button" className={`${button} justify-self-start px-2.5 py-1 text-sm`} onClick={() => setSel(wholeCloud(space))}>
            Näita kõiki täppe
          </button>
        </div>
        {!selection && (
          <p role="alert" className="mt-2">
            Vigane valik: vähim väärtus peab olema suurimast väiksem või sellega võrdne.
          </p>
        )}
      </details>

      <div className="mt-3">
        <BackgroundPicker label="Taust" value={background} onChange={setBackground} presets={GAMUT_PRESETS} defaultHex="#ffffff" defaultSwatch="bg-page" />
      </div>

      <GamutCanvas
        background={background ? backgroundCss(background) : undefined}
        ink={background ? contrastInk(background) : undefined}
        lattice={lattice}
        selection={selection}
        snapped={showImage ? snapped : null}
        mode={mode}
        resetKey={resetKey}
        label={summary}
      />

      <p className={`${hint} mt-1`}>
        {mode === "orbit"
          ? "Tiirle: lohista pööramiseks, keri suumimiseks; klaviatuuril nooled ja A/D pööravad, W/S või +/− suumivad."
          : "Lenda: W A S D või nooled liigutavad, Q ja E alla ja üles, lohista ringi vaatamiseks, keri edasi-tagasi."}{" "}
        Klahvid töötavad, kui pilt on fookuses.
      </p>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer">Tehnilised üksikasjad</summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <dt className="text-muted">Ruum</dt>
          <dd className="m-0">
            {space.label} ({space.axes[1]}, {space.axes[2]}, {space.axes[0]})
          </dd>
          <dt className="text-muted">Võimalikke täppe</dt>
          <dd className="m-0">{nf.format(lattice.n)}</dd>
          <dt className="text-muted">Valitud täppe</dt>
          <dd className="m-0">{selection ? nf.format(selection.selectedCount) : "—"}</dd>
          <dt className="text-muted">Neutraalseid täppe</dt>
          <dd className="m-0">{nf.format(selection?.neutralCount ?? 0)}</dd>
          <dt className="text-muted">Pildi värve</dt>
          <dd className="m-0">
            {nf.format(colors.length)} → {nf.format(occupied)} täppi
          </dd>
          <dt className="text-muted">Võrgu samm</dt>
          <dd className="m-0">
            Δ{space.axes[0]} = Δ{space.axes[1]} = Δ{space.axes[2]} = {space.step}
          </dd>
        </dl>
      </details>
    </section>
  );
}

const GAMUT_PRESETS: BackgroundPreset[] = [
  { label: "lehe taust", hex: null },
  { label: "valge", hex: "#ffffff" },
  { label: "CIE hall (L* 50)", hex: CIE_GREY },
  { label: "tumehall", hex: "#1e1e1e" },
  { label: "must", hex: "#000000" },
];

/** A slider with a readable label (with its explanation), the value in a badge, and the range ends (#90). */
function Slider(props: {
  label: string;
  term: Parameters<typeof Term>[0]["k"];
  hint?: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}): ReactNode {
  const { label, term, hint: help, unit = "", value, min, max, step, onChange, format } = props;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-base font-bold">
          <Term k={term}>{label}</Term>
        </span>
        <span className="rounded-md bg-line-soft px-2 py-0.5 font-mono text-base">
          {format(value)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        aria-valuetext={`${format(value)}${unit}`}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="flex justify-between text-xs text-muted">
        <span>
          {format(min)}
          {unit}
        </span>
        {help && <span>{help}</span>}
        <span>
          {format(max)}
          {unit}
        </span>
      </div>
    </div>
  );
}
