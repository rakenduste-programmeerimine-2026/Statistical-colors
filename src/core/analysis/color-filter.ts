// The colour table's equivalence-class filter (P-032, P-033 items 2 and 3):
// share band, colour cluster and artefact chance, combined with AND.
import { bandOf, type ShareBand } from "./share-bands";
import type { ColorCount } from "./types";

/** At or above this chance a colour counts as a likely blend pixel or artefact. */
export const LIKELY_ARTEFACT = 0.5;

export interface ColorFilter {
  band: string | null;
  cluster: string | null;
  artefact: "all" | "likely" | "clean";
}

export const NO_FILTER: ColorFilter = { band: null, cluster: null, artefact: "all" };

/** The highest artefact chance the server sent for a colour, or undefined. */
export function topArtefact(c: ColorCount) {
  return c.artefacts?.reduce((best, a) => (a.chance > best.chance ? a : best));
}

export function isFiltered(f: ColorFilter): boolean {
  return f.band !== null || f.cluster !== null || f.artefact !== "all";
}

/** Every colour that matches, in the original (most frequent first) order. */
export function filterColors(colors: ColorCount[], f: ColorFilter, bands: ShareBand[]): ColorCount[] {
  if (!isFiltered(f)) return colors;
  return colors.filter((c) => {
    if (f.band !== null && bandOf(bands, c.percent)?.id !== f.band) return false;
    if (f.cluster !== null && c.clusterId !== f.cluster) return false;
    if (f.artefact !== "all") {
      // Colours without a value are neither likely nor clean.
      const top = topArtefact(c);
      if (!top) return false;
      if ((top.chance >= LIKELY_ARTEFACT) !== (f.artefact === "likely")) return false;
    }
    return true;
  });
}
