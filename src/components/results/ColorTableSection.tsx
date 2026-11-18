"use client";

import { useMemo, useState } from "react";
import { filterColors, isFiltered, NO_FILTER, type ColorFilter } from "@/core/analysis/color-filter";
import { shareBands } from "@/core/analysis/share-bands";
import type { ImageAnalysis } from "@/core/analysis/types";
import { card, hint } from "../ui";
import { ColorFilters } from "./ColorFilters";
import { ColorTable } from "./ColorTable";

/**
 * The top-N colour table with equivalence-class filters. Filters run over every
 * colour the analysis holds, not only the top N, and the table shows the N most
 * frequent matches (P-033 item 3).
 */
export function ColorTableSection({ analysis, topN }: { analysis: ImageAnalysis; topN: number }) {
  const [filter, setFilter] = useState<ColorFilter>(NO_FILTER);
  const bands = useMemo(() => shareBands(analysis.colors.map((c) => c.percent)), [analysis.colors]);
  const clusters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of analysis.colors) if (c.clusterId) counts.set(c.clusterId, (counts.get(c.clusterId) ?? 0) + 1);
    return (analysis.colorAnalysis?.palette ?? []).filter((p) => counts.has(p.id)).map((cluster) => ({ cluster, count: counts.get(cluster.id)! }));
  }, [analysis]);
  const hasArtefacts = analysis.colors.some((c) => c.artefacts?.length);
  const matches = useMemo(() => filterColors(analysis.colors, filter, bands), [analysis.colors, filter, bands]);
  const rows = matches.slice(0, topN);

  return (
    <section className={card} aria-labelledby="top-heading">
      <h2 id="top-heading" className="text-xl font-bold">
        {topN} sagedasemat värvi
      </h2>
      <p className={hint}>Kokkuvõtte CSV sisaldab kõiki värve; tabelis on {topN} kõige sagedasemat.</p>
      {analysis.rowDataStatus === "simulated" && (
        <p role="note" className="mt-2 rounded-lg border border-warn p-2.5">
          Näidisandmed: segupikslite ja artefaktide tõenäosuse ning värviklastrid arvutab server, mis pole veel valmis.
          {analysis.example ? " Värvid ja kogused on uuringu päris andmed." : ""}
        </p>
      )}
      <ColorFilters value={filter} onChange={setFilter} bands={bands} clusters={clusters} hasArtefacts={hasArtefacts} />
      {isFiltered(filter) && (
        <p role="status" className="mt-2">
          {matches.length === 0
            ? "Ükski värv ei vasta filtrile."
            : `${matches.length} värvi ${analysis.colors.length}-st vastab filtrile; tabelis on ${rows.length} sagedasemat.`}
        </p>
      )}
      <ColorTable colors={rows} includeAlpha={analysis.includeAlpha} />
    </section>
  );
}
