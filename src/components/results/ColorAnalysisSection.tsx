"use client";

import { useState } from "react";
import type { ColorAnalysis } from "@/core/analysis/color-analysis";
import { card, hint } from "../ui";
import { FindingsPanel } from "./FindingsPanel";
import { RampStrip, StructureList } from "./StructureList";
import { StructureWheel } from "./StructureWheel";

const STEP_LABELS: Record<ColorAnalysis["pipeline"][number]["step"], string> = {
  "blend-snap": "Segude tuvastus",
  "share-filter": "Osakaalu filter",
  convert: "OKLCH teisendus",
  cluster: "Klasterdamine",
  structures: "Struktuurid",
  contrast: "Kontrast",
  roles: "Rollid",
  findings: "Leiud",
};
/** Readable names for the analysis settings the server reports (#90: raw keys said nothing). */
const PARAM_LABELS: Record<string, string> = {
  maxDistance: "Suurim kaugus sirgest (sRGB väärtust)",
  maxSharePercent: "Segupiksli suurim osakaal (%)",
  endpointMinSharePercent: "Sirge otsa väikseim osakaal (%)",
  maxEndpoints: "Sirge otsi kuni",
  tMin: "Asukoht sirgel vähemalt",
  tMax: "Asukoht sirgel kuni",
  tolerance: "Lubatud kõrvalekalle",
  floorPercent: "Osakaalu alampiir (%)",
  z: "Haruldase värvi piir (z-skoor)",
  tau: "Klastri suurus (ΔE)",
  linkage: "Rühmitamise viis",
  maxColors: "Rühmitatavaid värve kuni",
  c0: "Väikseim kroom harmoonias",
  lambda: "Lihtsuse eelistus",
  maxErr: "Suurim toonivahe ideaalist (°)",
  minCoverage: "Vähim kaetud osa",
  minScore: "Vähim skoor",
  accentMaxHueSpread: "Aktsendi suurim toonihajuvus (°)",
  neutralMinShare: "Neutraalsete vähim osakaal (%)",
  maxClusters: "Võrreldavaid värve kuni",
  minSharePercent: "Vähim osakaal (%)",
  darkMinShare: "Tumeda tausta vähim osakaal (%)",
  darkMaxL: "Tumeda tausta suurim heledus",
  darkMaxSpread: "Tumeda tausta suurim hajuvus (ΔE)",
  contentMinDeltaL: "Sisu vähim heleduse vahe",
  contentMinShare: "Sisu vähim osakaal (%)",
};
const STATUS_LABELS = { done: "tehtud", skipped: "vahele jäetud", "not-implemented": "pole veel" } as const;

/** The server's colour analysis on the results page (P-030, P-031). */
export function ColorAnalysisSection({ analysis }: { analysis: ColorAnalysis }) {
  const [selectedId, setSelectedId] = useState(analysis.structures[0]?.id ?? "");
  const selected = analysis.structures.find((s) => s.id === selectedId);

  return (
    <section className={card} aria-labelledby="color-analysis-heading">
      <details open className="group/analysis">
      <summary className="cursor-pointer list-none">
        <h2 id="color-analysis-heading" className="inline text-xl font-bold">
          Värvianalüüs
        </h2>
        <span className="ml-2 text-sm text-muted group-open/analysis:hidden">(näita)</span>
        <span className="ml-2 hidden text-sm text-muted group-open/analysis:inline">(peida)</span>
      </summary>
      {analysis.status === "simulated" && (
        <p role="note" className="mt-2 rounded-lg border border-warn p-2.5">
          Näidisandmed: värvianalüüsi arvutab server, mis pole veel valmis. Allolev on genereeritud, et näidata, kuidas tulemus
          välja näeb.
        </p>
      )}
      <p className={`${hint} mt-2`}>Tulemus on pildiga kooskõlas, kuid ei tõesta, kuidas pilt tehti.</p>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm">Tehnilised üksikasjad: töötluse sammud ja seaded</summary>
        <ol className="mt-2 flex flex-col gap-2 pl-5 text-sm">
          {analysis.pipeline.map((p) => (
            <li key={p.step}>
              <span className="font-bold">{STEP_LABELS[p.step]}</span> — {STATUS_LABELS[p.status]}
              {p.removedShare ? <span className="text-muted">; eemaldati {p.removedShare.toFixed(1)} % pikslitest</span> : null}
              {p.params ? (
                <dl className="mt-0.5 grid grid-cols-[auto_auto] justify-start gap-x-3 text-muted">
                  {Object.entries(p.params).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt>{PARAM_LABELS[k] ?? k}</dt>
                      <dd className="m-0 font-mono">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </li>
          ))}
        </ol>
      </details>

      {analysis.structures.length > 0 && (
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <h3 className="text-lg font-bold">Struktuurid</h3>
            <div className="mt-2">
              <StructureList structures={analysis.structures} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
          </div>
          <div>
            {selected &&
              (selected.family === "harmony" ? (
                <StructureWheel key={selected.id} structure={selected} palette={analysis.palette} />
              ) : (
                <RampStrip structure={selected} />
              ))}
          </div>
        </div>
      )}

      {analysis.findings.length > 0 && (
        <div className="mt-6">
          <h3 className="sr-only">Leiud</h3>
          <FindingsPanel findings={analysis.findings} palette={analysis.palette} />
        </div>
      )}
      </details>
    </section>
  );
}
