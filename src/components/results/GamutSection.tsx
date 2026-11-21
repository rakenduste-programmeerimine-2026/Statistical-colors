"use client";

import { useMemo, useState } from "react";
import type { GamutCoverage } from "@/core/analysis/color-analysis";
import type { ColorCount } from "@/core/analysis/types";
import { latticeFor } from "@/core/gamut/lattice";
import { selectLattice } from "@/core/gamut/select";
import { snapColors } from "@/core/gamut/snap";
import { SPACES, type GamutSpaceId } from "@/core/gamut/space";
import { BackgroundPicker, backgroundCss, contrastInk, type BackgroundPreset } from "../BackgroundPicker";
import { button, card, hint } from "../ui";
import { GamutCanvas, type CameraMode } from "./GamutCanvas";

const nf = new Intl.NumberFormat("et-EE");

interface Props {
  colors: ColorCount[];
  /** The table's count: the 3D view shows the same colours (#90). */
  topN?: number;
  /** The server's coverage figure; absent until it sends one. */
  coverage?: GamutCoverage;
  simulated: boolean;
}

/**
 * The 3D colour-space view (P-035). Step 1 is the notebook's sampled gamut
 * browser (cell 19): the in-gamut lattice with a hue and chroma selection.
 * Step 2 snaps the image's colours onto the lattice and colours them in, to
 * show how much of the sRGB gamut the image covers.
 */
export function GamutSection({ colors: allColors, topN, coverage, simulated }: Props) {
  const colors = useMemo(() => (topN === undefined ? allColors : allColors.slice(0, topN)), [allColors, topN]);
  const [spaceId, setSpaceId] = useState<GamutSpaceId>("oklab");
  const space = SPACES[spaceId];
  const [hueCenter, setHueCenter] = useState(270);
  const [hueWidth, setHueWidth] = useState(30);
  const [chroma, setChroma] = useState<[number, number]>(space.defaultChroma);
  const [includeNeutrals, setIncludeNeutrals] = useState(false);
  const [showImage, setShowImage] = useState(true);
  const [mode, setMode] = useState<CameraMode>("orbit");
  const [resetKey, setResetKey] = useState(0);
  // Null follows the page theme (P-037).
  const [background, setBackground] = useState<string | null>(null);

  const lattice = useMemo(() => latticeFor(space), [space]);
  const selection = useMemo(
    () => selectLattice(lattice, { hueCenter, hueWidth, chromaMin: chroma[0], chromaMax: chroma[1], includeNeutrals }),
    [lattice, hueCenter, hueWidth, chroma, includeNeutrals],
  );
  const snapped = useMemo(() => snapColors(lattice, colors), [lattice, colors]);

  const switchSpace = (id: GamutSpaceId) => {
    setSpaceId(id);
    setChroma(SPACES[id].defaultChroma);
  };
  const fmtC = (v: number) => v.toFixed(space.digits);
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
        Kõik sRGB värvid ühtlase tajuvõrgena: iga punkt on järgmisest sama kaugel (ΔE {space.step} kõigil telgedel). Pildi värvid
        tõmmatakse lähimasse punkti ja värvitakse sisse, nii et näed, kui suure osa tervikust pilt katab.
      </p>

      <p className="mt-3 text-lg" role="status">
        {coverage ? (
          <>
            Pilt katab <b>{(coverage.coverage * 100).toFixed(2)} %</b> sRGB gamutist ({nf.format(coverage.occupiedCells)} /{" "}
            {nf.format(coverage.totalCells)} OKLab-rakku, ΔE {coverage.cellDeltaE}).
            {simulated && <span className="text-muted"> Näidisandmed: arvutatud brauseris, kuni server seda saadab.</span>}
            {spaceId !== coverage.space && <span className="block text-sm text-muted">Katvus on määratud OKLab-is; CIELAB-i võrk on veidi teistsugune.</span>}
          </>
        ) : (
          <span className="text-muted">Katvust pole server veel saatnud.</span>
        )}
      </p>

      <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
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

        <Slider label="Tooni keskpunkt h°" value={hueCenter} min={0} max={360} step={1} onChange={setHueCenter} format={(v) => `${v.toFixed(1)}°`} />
        <Slider label="Tooni vahemiku laius" value={hueWidth} min={1} max={360} step={1} onChange={setHueWidth} format={(v) => `${v.toFixed(1)}°`} />
        <Slider label="Kroom min C" value={chroma[0]} min={0} max={space.chromaMax} step={space.chromaStep} onChange={(v) => setChroma([v, chroma[1]])} format={fmtC} />
        <Slider label="Kroom max C" value={chroma[1]} min={0} max={space.chromaMax} step={space.chromaStep} onChange={(v) => setChroma([chroma[0], v])} format={fmtC} />
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={includeNeutrals} onChange={(e) => setIncludeNeutrals(e.target.checked)} />
          Kaasa neutraalsed ja peaaegu neutraalsed (toon puudub)
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={showImage} onChange={(e) => setShowImage(e.target.checked)} />
          Näita pildi värve
        </label>
      </div>

      {!selection && (
        <p role="alert" className="mt-2">
          Vigane valik: kroomi miinimum peab olema ≤ maksimum.
        </p>
      )}

      <div className="mt-3">
        <BackgroundPicker label="Taust" value={background} onChange={setBackground} presets={GAMUT_PRESETS} defaultHex="#ffffff" defaultSwatch="bg-page" />
      </div>

      <GamutCanvas
        background={background ? backgroundCss(background) : undefined}
        ink={background ? contrastInk(background) : undefined}
        lattice={lattice} selection={selection} snapped={showImage ? snapped : null} mode={mode} resetKey={resetKey} label={summary} />

      <p className={`${hint} mt-1`}>
        {mode === "orbit"
          ? "Tiirle: lohista pööramiseks, keri suumimiseks; klaviatuuril nooled ja A/D pööravad, W/S või +/− suumivad."
          : "Lenda: W A S D või nooled liigutavad, Q ja E alla ja üles, lohista ringi vaatamiseks, keri edasi-tagasi."}{" "}
        Klahvid töötavad, kui pilt on fookuses.
      </p>
      <ul className="mt-2 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-sm">
        <li>· hall: võimalik sRGB värv</li>
        <li>▪ väike värviline: valitud tooni- ja kroomivahemik</li>
        <li>● suur värviline (raamiga): pildi värv, suurus osakaalu järgi</li>
      </ul>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
        <dt className="text-muted">Ruum</dt>
        <dd className="m-0">
          {space.label} ({space.axes[1]}, {space.axes[2]}, {space.axes[0]})
        </dd>
        <dt className="text-muted">Toon</dt>
        <dd className="m-0">
          keskpunkt {hueCenter.toFixed(1)}°, laius {hueWidth.toFixed(1)}°
        </dd>
        <dt className="text-muted">Kroom</dt>
        <dd className="m-0">
          {fmtC(chroma[0])} kuni {fmtC(chroma[1])}
        </dd>
        <dt className="text-muted">Neutraalsed kaasas</dt>
        <dd className="m-0">{includeNeutrals ? "jah" : "ei"}</dd>
        <dt className="text-muted">Võimalikke punkte</dt>
        <dd className="m-0">{nf.format(lattice.n)}</dd>
        <dt className="text-muted">Valitud punkte</dt>
        <dd className="m-0">{selection ? nf.format(selection.selectedCount) : "—"}</dd>
        <dt className="text-muted">Neutraalseid punkte</dt>
        <dd className="m-0">{nf.format(selection?.neutralCount ?? 0)}</dd>
        <dt className="text-muted">Pildi värve</dt>
        <dd className="m-0">
          {nf.format(colors.length)} → {nf.format(occupied)} punkti
        </dd>
        <dt className="text-muted">Võrk</dt>
        <dd className="m-0">
          Δ{space.axes[0]} = Δ{space.axes[1]} = Δ{space.axes[2]} = {space.step}
        </dd>
      </dl>
      <p className={`${hint} mt-2`}>See on sRGB gamuti sirvija, mitte ekraani bitisügavuse, heleduse ega JND analüsaator.</p>
    </section>
  );
}

const GAMUT_PRESETS: BackgroundPreset[] = [
  { label: "lehe taust", hex: null },
  { label: "valge", hex: "#ffffff" },
  { label: "hall", hex: "#808080" },
  { label: "tumehall", hex: "#1e1e1e" },
  { label: "must", hex: "#000000" },
];

function Slider(props: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  const { label, value, min, max, step, onChange, format } = props;
  return (
    <label className="flex flex-col gap-0.5 text-sm">
      <span>
        {label}: <span className="font-mono">{format(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
