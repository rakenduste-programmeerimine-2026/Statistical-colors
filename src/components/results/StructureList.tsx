"use client";

import type { ColorStructure } from "@/core/analysis/color-analysis";
import { FAMILY_LABELS, MODEL_LABELS, structureLabel } from "@/core/analysis/ontology";
import { formatOklch, oklchCss } from "@/core/color/oklch";
import { ColorName } from "../ColorName";

interface Props {
  structures: ColorStructure[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const stats = (s: ColorStructure) => {
  const ds = s.points.map((p) => p.deltaE);
  return { mean: ds.reduce((a, b) => a + b, 0) / ds.length, max: Math.max(...ds) };
};

/** Every structure the server found; the selected one is drawn below the list. */
export function StructureList({ structures, selectedId, onSelect }: Props) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label="Leitud struktuurid">
      {structures.map((s) => {
        const { mean, max } = stats(s);
        const selected = s.id === selectedId;
        return (
          <li key={s.id}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(s.id)}
              className={`w-full rounded-lg border p-2.5 text-left ${selected ? "border-ink" : "border-line"}`}
            >
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <b>{structureLabel(s)}</b>
                <span className="text-sm text-muted">
                  {FAMILY_LABELS[s.family]} · {MODEL_LABELS[s.model]}
                </span>
              </span>
              <span className="mt-1 block font-mono text-sm">
                skoor {s.score.toFixed(2)} · katab {(s.coverage * 100).toFixed(0)}% · ΔE keskm. {mean.toFixed(3)}, suurim {max.toFixed(3)}
                {s.nestedIn?.length ? ` · sisaldub: ${s.nestedIn.join(", ")}` : ""}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** A ramp or gradient as a strip of its colours, with the ΔE of each step between them. */
export function RampStrip({ structure }: { structure: ColorStructure }) {
  const steps = structure.step?.deltaEs;
  return (
    <figure className="m-0">
      <div className="flex items-stretch overflow-x-auto" role="list" aria-label={structureLabel(structure)}>
        {structure.points.map((p, i) => (
          <div key={`${p.clusterId}-${i}`} className="flex items-stretch" role="listitem">
            {i > 0 && (
              <span className="flex w-14 shrink-0 items-center justify-center font-mono text-xs text-muted" title="ΔE eelmisest">
                {steps?.[i - 1] !== undefined ? `Δ ${steps[i - 1].toFixed(3)}` : ""}
              </span>
            )}
            <span className="flex w-24 shrink-0 flex-col gap-1">
              <span className="h-12 rounded-md border border-ink/25" style={{ background: oklchCss(p.actual) }} />
              <span className="font-mono text-[11px] leading-tight">{formatOklch(p.actual)}</span>
              <ColorName color={p.actual} className="text-[11px] leading-tight" />
              <span className="font-mono text-[11px] text-muted">ΔE ideaalist {p.deltaE.toFixed(3)}</span>
            </span>
          </div>
        ))}
      </div>
      {structure.step && (
        <figcaption className="mt-1 text-sm text-muted">
          Sihtsamm ΔE {structure.step.target.toFixed(3)}; mida ühtlasemad sammud, seda paremini sobib.
        </figcaption>
      )}
    </figure>
  );
}
