# 05 Gamut lattice and coverage

## Model (`gamut/lattice.ts`, `gamut/snap.ts`, `gamut-coverage.ts`)

- **Lattice:** a cubic grid in OKLab with step 0.02: L from 0 to 1 and a, b within ±0.4. That is 51 × 41 × 41 cells, of which 6,789 grid points are inside sRGB [AUDIT: experiment E10, vitest].
- **Snapping:** each image colour is rounded to its grid cell. If that point is outside sRGB, the search grows a cube until it finds an in-gamut point and takes the nearest one there.
- **Coverage:** the number of occupied points divided by 6,789. It is marked a lower bound when the image has more than 5000 colours.

## Checks

- [AUDIT: lean `gridIndex_injective`] Within bounds, the grid index (iL·nA + iA)·nB + iB never maps two cells to one index. So each lattice point has its own slot.
- [AUDIT: experiment E10] About 5 % of colours lie at the sRGB edge. They snap at most 1.3 steps (OKLab) or 2.1 steps (CIELAB) away.
- [UNDERSTANDING] `nearestPoint` stops at the first ring that holds an in-gamut point. That is not always the true nearest point: a point in the next ring can be nearer than a corner of this one.
  - For coverage this hardly matters (one cell either way).
  - The colour-name search (`src/core/color/names.ts`) uses the correct stop rule instead: it keeps searching until the best distance is at most the ring radius. It is tested against brute force.
