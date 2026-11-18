# 02 The structure space

[PROMPT P-030] "support more than just hormonies eg that this is a gradiant of colors with a same lightness where every color is some delta E apart from other colors map the possibility space thoroughly and mathamatically"

## Setting

A palette is a set of clusters P = {pᵢ = (Lᵢ, Cᵢ, hᵢ)} inside sRGB, with weights wᵢ (share). A **structure** is a subset S ⊆ P together with a **law** on each OKLCH axis, and optionally a **path law** in OKLab. Each law has an explicit test. [UNDERSTANDING] All thresholds are starting values for the backend team to tune (#56).

## Axis laws

Let xᵢ be the values of one axis over S, sorted (for h: sorted around the circle).

| Law | Test | Default ε |
|---|---|---|
| `const` | spread ≤ ε. For h: circular SD ≤ ε | L 0.02, C 0.01, h 5° |
| `arith` | equal steps: residual of a linear fit on the sorted values ≤ ε, and step coefficient of variation ≤ 0.15 | as const |
| `geom` | equal ratios: `arith` on log x (C > 0, L > 0) | as const |
| `sym` (hue) | the offsets match a k-point template on the circle up to a rotation r (`03`) | 15° |
| `mono` | monotone in another ordering (e.g. L rises as C falls), without equal steps | – |
| `two-level` | two clusters with a gap ≥ 0.4 (L) and within-cluster spread ≤ ε | L 0.4 gap |
| `free` | none of the above | – |

## Path laws (in OKLab)

| Law | Test |
|---|---|
| `collinear` | all points within ε of the line through the two extremes (ε 0.01): a linear OKLab gradient |
| `arc` | constant L and C, varying h: a hue sweep |
| `equal-step` | consecutive ΔE all equal within CV ≤ 0.15, each ≥ 0.03 [AUDIT: experiment E3b] |
| `srgb-interpolated` | the points lie on the straight line between the extremes in **encoded sRGB**, which bends in OKLab (the curve sags in L and C in the middle) |
| `hsl-interpolated` | the points lie on a straight line in HSL: a hue sweep with HSL's lightness bumps |
| `none` | no path law |

[UNDERSTANDING] Curvature separates the interpolation spaces: an OKLab gradient has zero curvature in OKLab; an sRGB one has a predictable sag towards grey between complementary ends; an HSL one shows the HSL lightness profile (yellow and cyan bright, blue dark).

## The grid

3 axes × 7 laws give 343 combinations. Most are either meaningless or not detectable, and many are already named.

| L \ h | const | arith | sym | free |
|---|---|---|---|---|
| **const** | one colour, or `ramp.chroma` if C is arith | `ramp.hue-sweep` (C const) | `harmony.isoluminant` | equal-lightness set (a building block) |
| **arith** | `ramp.tonal` | spiral ramp (e.g. viridis-like) | harmony with stepped lightness | lightness ladder |
| **two-level** | light and dark of one hue | – | dark-mode accents | `palette.two-level-lightness` |
| **free** | `palette.monochrome` | – | `harmony.*` | no structure |

[UNDERSTANDING] Cells marked – are reachable but have no common use; the detector may still report them under a generic code `law.<l>-<c>-<h>` with the server's title.

Separate from the grid are the set-level laws:
- `palette.equal-spacing`: pairwise ΔE all equal within ε, as in categorical data-viz palettes.
- `palette.achromatic`, `palette.neutral-plus-accent`, `palette.full-wheel`: about which clusters are chromatic, not about axis laws.

## Per-point ΔE

[PROMPT P-030] "backend sends delta E for each harmony point seperately along side its code and meta info"

For each point the server gives the **ideal** OKLCH point and ΔE_OK to the actual cluster:
- **Harmonies:** ideal h = r + offset, with L and C from the actual cluster (so ΔE measures the hue error at that chroma).
- **Ramps:** the ideal is the point on the fitted line or arc at that step.
- **Construction models:** the ideal is the **OKLCH** template anchored on the dominant colour, so ΔE shows the construction drift.

## Several structures per image

[PROMPT P-030] "Allow for multible per image."

1. **Candidates:** every law test on every subset the search reaches. Harmonies use templates × 360 rotations on the chromatic clusters; ramps use greedy chains in sorted L, C or h.
2. **Cost:** J(S) = Σ wᵢ · errorᵢ² + λ|S|, with λ = 2 per point (slides; [AUDIT: experiment E3]). Lower is better; the λ term prefers simpler structures.
3. **Coverage rule:** a structure must explain ≥ 30 % of the chromatic share [UNDERSTANDING, threshold from AUDIT: experiment E3b]. Without it, the top two colours of any busy palette form a false "complementary".
4. **Overlap:** a cluster can be in several structures (a ramp's end can be a harmony's spoke).
5. **Nesting:** if S₁ ⊂ S₂ and both pass, S₁ gets `nestedIn: [S₂]` (complementary inside square, analogous inside split-complementary). When two templates fit almost equally well, the server adds the finding `structure.ambiguous-nesting`.
6. **Score:** 0–1, a monotone map of J and coverage; the list is sorted by it.

## Detection limits

- [AUDIT: experiment E3] On synthetic data the detector finds:
  - exact structures with ΔE 0;
  - triads with ±8° noise (max error 3.5°);
  - tonal, equal-step and sweep ramps.
- [AUDIT: experiment E3b] On the demo (295 picker colours, 93 clusters) it correctly finds no harmony and needs `palette.full-wheel`.
- [UNDERSTANDING] Photographs rarely contain clean structures. Lighting shifts hue and chroma (`06`), so results on photos carry the caveat `lighting-confound`.
