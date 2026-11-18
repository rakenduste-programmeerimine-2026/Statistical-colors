import type { GamutCoverage } from "@/core/analysis/color-analysis";
import type { ColorCount } from "@/core/analysis/types";
import { latticeFor } from "@/core/gamut/lattice";
import { snapColors } from "@/core/gamut/snap";
import { OKLAB } from "@/core/gamut/space";

// PLACEHOLDER(#74): the server computes the gamut coverage. Until
// then the stub and the demo compute it the same way the server will (prototype
// E10): snap every colour to the OKLab lattice of 0.02 cells and count occupied
// cells. It is marked simulated in its meta (P-035, P-036).
export function simulateGamut(colors: ColorCount[]): GamutCoverage {
  const lattice = latticeFor(OKLAB);
  const occupiedCells = snapColors(lattice, colors).occupied.length;
  return {
    space: "oklab",
    cellDeltaE: OKLAB.step,
    occupiedCells,
    totalCells: lattice.n,
    coverage: occupiedCells / lattice.n,
    meta: {
      provenance: "measured",
      confidence: 1,
      method: "simulated: each colour snapped to the nearest in-gamut cell of a 0.02 OKLab grid",
      requires: "pixels",
      caveats: ["consistent-not-proven"],
    },
  };
}
