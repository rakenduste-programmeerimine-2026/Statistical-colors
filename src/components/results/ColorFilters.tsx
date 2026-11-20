import type { PaletteCluster } from "@/core/analysis/color-analysis";
import type { ColorFilter } from "@/core/analysis/color-filter";
import type { ShareBand } from "@/core/analysis/share-bands";
import { formatOklch, oklchCss } from "@/core/color/oklch";

interface Props {
  value: ColorFilter;
  onChange: (f: ColorFilter) => void;
  bands: ShareBand[];
  /** Clusters that at least one colour belongs to, with how many colours each has. */
  clusters: { cluster: PaletteCluster; count: number }[];
  hasArtefacts: boolean;
}

const chip = (on: boolean) => `rounded-md border px-2 py-1 text-sm ${on ? "border-ink font-bold" : "border-line"}`;

/** One row of equivalence-class filters above the colour table (P-032). */
export function ColorFilters({ value, onChange, bands, clusters, hasArtefacts }: Props) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div role="group" aria-label="Osakaalu klass" className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm text-muted">Osakaal:</span>
        <button type="button" aria-pressed={value.band === null} className={chip(value.band === null)} onClick={() => onChange({ ...value, band: null })}>
          kõik
        </button>
        {bands.map((b) => (
          <button key={b.id} type="button" aria-pressed={value.band === b.id} className={chip(value.band === b.id)} onClick={() => onChange({ ...value, band: b.id })}>
            {b.label} · {b.count} värvi
          </button>
        ))}
      </div>

      {clusters.length > 0 && (
        <div role="group" aria-label="Värviklaster" className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-muted">Klaster:</span>
          <button type="button" aria-pressed={value.cluster === null} className={chip(value.cluster === null)} onClick={() => onChange({ ...value, cluster: null })}>
            kõik
          </button>
          {clusters.map(({ cluster, count }) => (
            <button
              key={cluster.id}
              type="button"
              aria-pressed={value.cluster === cluster.id}
              className={`${chip(value.cluster === cluster.id)} inline-flex items-center gap-1.5`}
              onClick={() => onChange({ ...value, cluster: cluster.id })}
            >
              <span aria-hidden className="inline-block size-3.5 rounded-sm border border-ink/25" style={{ background: oklchCss(cluster.color) }} />
              <span className="font-mono text-xs">{formatOklch(cluster.color)}</span> · {count} värvi
            </button>
          ))}
        </div>
      )}

      {hasArtefacts && (
        <div role="group" aria-label="Segupiksel või artefakt" className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-muted">Segupiksel / artefakt:</span>
          {(
            [
              ["all", "kõik"],
              ["likely", "sarnane segupikslile (≥ 50 %)"],
              ["clean", "ei sarnane (< 50 %)"],
            ] as const
          ).map(([v, text]) => (
            <button key={v} type="button" aria-pressed={value.artefact === v} className={chip(value.artefact === v)} onClick={() => onChange({ ...value, artefact: v })}>
              {text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
