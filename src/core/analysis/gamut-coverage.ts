// Gamut coverage (#74, P-035, P-036 item 6): how much of sRGB the image's
// colours occupy, on the in-gamut points of a 0.02 ΔE_OK OKLab lattice.
import { latticeFor } from "../gamut/lattice";
import { snapColors } from "../gamut/snap";
import { OKLAB } from "../gamut/space";
import type { GamutCoverage } from "./color-analysis";
import type { ColorCount } from "./types";

/**
 * Snaps every colour to its nearest in-gamut lattice point and counts the
 * occupied points. `uniqueColors` is the image's total; when only part of the
 * colours is available (the stored top 5000), the figure is a lower bound and
 * the method says so.
 */
export function computeGamutCoverage(colors: readonly ColorCount[], uniqueColors = colors.length): GamutCoverage {
  const lattice = latticeFor(OKLAB);
  const occupiedCells = snapColors(lattice, [...colors]).occupied.length;
  const partial = uniqueColors > colors.length;
  return {
    space: "oklab",
    cellDeltaE: OKLAB.step,
    occupiedCells,
    totalCells: lattice.n,
    coverage: occupiedCells / lattice.n,
    meta: {
      provenance: "measured",
      confidence: 1,
      method:
        "each colour snapped to the nearest in-gamut cell of a 0.02 OKLab grid" +
        (partial ? `; from the ${colors.length} most frequent of ${uniqueColors} colours, so a lower bound` : ""),
      requires: "pixels",
    },
  };
}
