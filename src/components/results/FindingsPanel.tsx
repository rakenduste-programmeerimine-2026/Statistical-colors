import type { Finding, PaletteCluster } from "@/core/analysis/color-analysis";
import { AREA_LABELS, AREA_ORDER, CAVEAT_LABELS, findingLabel, PROVENANCE_LABELS, REQUIRES_LABELS, SEVERITY_LABELS } from "@/core/analysis/ontology";
import { formatOklch, oklchCss } from "@/core/color/oklch";

const SEVERITY_CLASS: Record<Finding["severity"], string> = {
  info: "border-line",
  notice: "border-notice",
  warning: "border-warn",
  problem: "border-error",
};

/** Any finding the server sends, grouped by ontology area; unknown kinds use their own title. */
export function FindingsPanel({ findings, palette }: { findings: Finding[]; palette: PaletteCluster[] }) {
  const byId = new Map(palette.map((c) => [c.id, c]));
  const areas = AREA_ORDER.filter((a) => findings.some((f) => f.area === a));
  return (
    <div className="flex flex-col gap-4">
      {areas.map((area) => (
        <section key={area} aria-labelledby={`area-${area}`}>
          <h3 id={`area-${area}`} className="text-lg font-bold">
            {AREA_LABELS[area]}
          </h3>
          <div className="mt-2 flex flex-col gap-2.5">
            {findings
              .filter((f) => f.area === area)
              .map((f) => (
                <article key={f.id} className={`rounded-lg border-l-4 border p-3 ${SEVERITY_CLASS[f.severity]}`}>
                  <header className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="font-bold">{findingLabel(f)}</h4>
                    <span className="text-sm">
                      {SEVERITY_LABELS[f.severity]} · kindlus {Math.round(f.meta.confidence * 100)}%
                    </span>
                  </header>
                  {f.detail && <p className="mt-1">{f.detail}</p>}
                  {f.metrics?.length ? (
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                      {f.metrics.map((m) => (
                        <div key={m.key} className="contents">
                          <dt className="text-muted">{m.label}</dt>
                          <dd className="m-0 flex items-center gap-2 font-mono">
                            {m.value}
                            {m.unit ? ` ${m.unit}` : ""}
                            {m.min !== undefined && m.max !== undefined && (
                              <meter min={m.min} max={m.max} value={m.value} aria-label={m.label} className="h-2 w-24" />
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {f.swatches?.length ? (
                    <ul className="mt-2 flex list-none flex-wrap gap-2 p-0">
                      {f.swatches.map((s, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-sm">
                          <span aria-hidden className="inline-block size-5 rounded-md border border-ink/25" style={{ background: oklchCss(s.color) }} />
                          <span className="font-mono">{formatOklch(s.color)}</span>
                          {s.label && <span className="text-muted">{s.label}</span>}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {f.gradient && f.gradient.length > 1 && (
                    <div
                      role="img"
                      aria-label={`Üleminek: ${f.gradient.map((g) => formatOklch(g.color)).join(" → ")}`}
                      className="mt-2 h-4 rounded-md border border-ink/25"
                      style={{
                        background: `linear-gradient(in oklch to right, ${f.gradient.map((g) => `${oklchCss(g.color)} ${g.at * 100}%`).join(", ")})`,
                      }}
                    />
                  )}
                  {f.clusterIds?.length ? (
                    <p className="mt-2 text-sm text-muted">
                      Värvid:{" "}
                      {f.clusterIds
                        .map((id) => byId.get(id))
                        .filter((c): c is PaletteCluster => !!c)
                        .map((c) => formatOklch(c.color))
                        .join(", ")}
                    </p>
                  ) : null}
                  {f.meta.caveats?.length ? (
                    <ul className="mt-2 list-disc pl-5 text-sm">
                      {f.meta.caveats.map((c) => (
                        <li key={c}>{CAVEAT_LABELS[c] ?? c}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-2 text-xs text-muted">
                    {PROVENANCE_LABELS[f.meta.provenance]} · {REQUIRES_LABELS[f.meta.requires]} · {f.meta.method}
                  </p>
                </article>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
