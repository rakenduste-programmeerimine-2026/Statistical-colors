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
const STATUS_LABELS = { done: "tehtud", skipped: "vahele jäetud", "not-implemented": "pole veel" } as const;

/** The server's colour analysis on the results page (P-030, P-031). */
export function ColorAnalysisSection({ analysis }: { analysis: ColorAnalysis }) {
  const [selectedId, setSelectedId] = useState(analysis.structures[0]?.id ?? "");
  const selected = analysis.structures.find((s) => s.id === selectedId);

  return (
    <section className={card} aria-labelledby="color-analysis-heading">
      <h2 id="color-analysis-heading" className="text-xl font-bold">
        Värvianalüüs
      </h2>
      {analysis.status === "simulated" && (
        <p role="note" className="mt-2 rounded-lg border border-warn p-2.5">
          Näidisandmed: värvianalüüsi arvutab server, mis pole veel valmis. Allolev on genereeritud, et näidata, kuidas tulemus
          välja näeb.
        </p>
      )}
      <p className={`${hint} mt-2`}>Tulemus on sisendiga kooskõlas, kuid pole tõestatud originaal (#32).</p>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm">Töövoog</summary>
        <ol className="mt-2 pl-5 text-sm">
          {analysis.pipeline.map((p) => (
            <li key={p.step}>
              {STEP_LABELS[p.step]}: {STATUS_LABELS[p.status]}
              {p.params ? (
                <span className="font-mono text-muted">
                  {" "}
                  ({Object.entries(p.params)
                    .map(([k, v]) => `${k} ${v}`)
                    .join(", ")})
                </span>
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
    </section>
  );
}
