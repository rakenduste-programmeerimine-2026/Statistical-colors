# 04 Harmonies, palette types, contrast and dark mode

## Harmonies (`harmonies.ts`)

- **Input:** chromatic clusters only (C ≥ 0.04).
- **Templates:** complementary, analogous, triadic, split-complementary, square. Rotations: 0..359, plus every rotation that puts a spoke exactly on a cluster hue.
- **Fit:** each cluster goes to its nearest spoke if the error is ≤ 15°.
- **Accepted when:**
  - every spoke is hit;
  - the fitted clusters hold ≥ 80 % of the chromatic share;
  - score = coverage · (1 − √cost / 15) ≥ 0.3, where cost = share-weighted error².
- [UNDERSTANDING] The hue arithmetic is on the circle (angles mod 360), which Lean core can model with integer degrees. This was not proven; the teammates' 5 tests cover it.
- [UNDERSTANDING] With the cluster-first change (#93), photos now produce real chromatic clusters, so harmonies can be found in photos at all.

## Palette types (`palette-types.ts`)

- **Achromatic:** every cluster has C < 0.04.
- **Neutral plus accent:** every chromatic cluster lies within 15° of the largest chromatic one, and neutrals hold ≥ 50 %.

These depend only on the palette, so they inherit the clustering's correctness.

## WCAG contrast (`contrast.ts`)

- **Pairs:** among the ≤ 6 largest clusters with share ≥ 1 %, each represented by its most frequent member.
- **Ratio:** (L₁ + 0.05)/(L₂ + 0.05), with relative luminance on linear sRGB. Thresholds: 4.5, 3 and 7.
- [UNDERSTANDING] The ratio uses the representative member, while the swatches show the share-weighted centre. Within a cluster of diameter ≤ τ they differ only slightly, but near a threshold they can disagree.
- [UNDERSTANDING] A measured contrast has confidence 1. Since #90 the page says "mõõdetud väärtus", not "100 %".

## Dark mode (`ui-mode.ts`)

- **Rule:** the largest cluster has share ≥ 35 %, L ≤ 0.3 and diameter ≤ 0.01; and content clusters with ΔL ≥ 0.4 hold ≥ 1 %.
- [LOCAL RUN: comparison] Clusters are built with τ = 0.02, so a background with JPEG-like noise has a diameter between 0.01 and 0.02. It fails the 0.01 test: a dark UI with background noise ±3 is **not detected**.
- **Improvement (#96):** the flatness limit becomes τ.
  - [LOCAL RUN: comparison] In the local build the same dark UI is detected. Its background forms clusters of diameter about 0.0197, and the light text forms its own cluster, because leftover colours now start clusters (#94).
