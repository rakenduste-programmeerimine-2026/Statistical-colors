# Colour analysis algorithms: formal model, checks and improvements

This folder models every step of the colour analysis that `analyseColors` (`src/core/analysis/compute-color-analysis.ts`) runs. The teammates own that code (P-039 item 10). Each page gives:
- the step's inputs, outputs and invariants;
- its parameters and complexity;
- what was checked;
- the improvement proposed in #93–#96.

Sources are tagged:
- **[AUDIT: lean T]**: theorem T in `ColourPipeline.lean`, checked locally with Lean 4.36.0. Only standard axioms: `propext`, `Quot.sound`, and `Classical.choice` in one counterexample. No `sorryAx`.
- **[AUDIT: comparison]**: measured locally by running the current and the improved code on the same inputs.
- **[AUDIT: property test]**: an executable property, run on random inputs.
- **[PROMPT P-###]**: a requirement.
- **[UNDERSTANDING]**: Claude's reading.

The Lean sources, the comparison harness and the improved code stay local (P-039 item 9: "Local test build only"). This folder carries their statements and results.

## The pipeline as functions

[UNDERSTANDING] With the colour list `C` (each colour has an 8-bit sRGB value, a pixel count and a share in %, sorted by count), the analysis is the composition:

```
blend : C → C × C              (blend candidates, the rest)
filter: C → C × share          (colours kept, share removed)
cluster: C → Palette           (complete linkage in OKLab, τ = 0.02, first 300 colours)
structures, contrast, findings, gamut : Palette → …
```

Today the order is `cluster ∘ filter ∘ blend`. The improvement swaps it to `filter_on_clusters ∘ cluster ∘ blend`. Details are on the pages.

| Page | Step | Code |
|---|---|---|
| [01-counting-and-shares.md](01-counting-and-shares.md) | colour counting, top N, share bands | `count-colors.ts`, `share-bands.ts` |
| [02-blends.md](02-blends.md) | antialias blend score | `blends.ts` |
| [03-filter-and-clustering.md](03-filter-and-clustering.md) | share filter, complete-linkage clusters, the 300 cap | `palette-clusters.ts`, `compute-color-analysis.ts` |
| [04-structures-contrast-dark-mode.md](04-structures-contrast-dark-mode.md) | harmonies, palette types, WCAG contrast, dark mode | `harmonies.ts`, `palette-types.ts`, `contrast.ts`, `ui-mode.ts` |
| [05-gamut-coverage.md](05-gamut-coverage.md) | gamut lattice and coverage | `gamut-coverage.ts`, `gamut/lattice.ts`, `gamut/snap.ts` |

## Checked results

| Theorem | Statement | Consequence |
|---|---|---|
| `current_order_drops_heavy_cluster` | There are colours, a floor and a clustering for which a cluster reaches the floor, yet "filter, then cluster" returns no cluster. | The current order loses clusters made of rare shades (photos, gradients). Issue #93. |
| `proposed_order_keeps_heavy_clusters`, `proposed_order_kept_are_heavy` | "Cluster, then filter by cluster total" keeps exactly the clusters that reach the floor. | Fixes #93. |
| `proposed_order_accounts` | Kept plus removed cluster totals equal the clustered total. | Shares still add up. |
| `cap_leak`, `cap_leak_strict` | Clustering only the first 300 colours leaves the rest out of every total. The accounting is short by exactly their share. | #94 |
| `cap_fixed` | Adding the leftover colours' share makes the accounting exact. | #94 |
| `merge_tight`, `singleton_tight` | Complete linkage only merges when every cross pair is within τ, so every cluster's diameter stays ≤ τ. | Correctness of the current clustering; also allows adding leftover colours safely. |
| `lance_williams` | The update `d(A∪B, K) = max(d(A,K), d(B,K))` used by the code is exact for complete linkage. | The current code is correct here. |
| `blend_score_gap` | The current blend score is never strictly between 0 and 50 %. | It is a yes/no flag with a bonus, not a graded chance. #95 |
| `graded_hits_every_level`, `graded_monotone`, `graded_agrees_near` | The proposed score 1 − d/12 for d ≤ 12 takes every level, falls with distance, and equals today's score at ≥ 50 %. | #95 keeps "likely" unchanged. |
| `gridIndex_injective` | The lattice grid index never maps two cells within bounds to one index. | The gamut lattice is sound. |
| `pieces_flatten`, `pieces_total` | Cutting a list at any indices gives bands that put back together form the list, with the same total. | Share bands are a partition. |

The existing visual-media model (`claude-setup/plan/VisualMedia.lean`, 20 theorems about recoverability) type-checks with Lean 4.36.0 with two deprecation warnings (`dif_pos`). It is not part of the analysis.

## Improvements: what changes, measured

[AUDIT: comparison] Current algorithm vs the improved one (#93–#96) on the same colour lists, in Node:

| Input | Palette describes (current → improved) | Unaccounted share | Dark mode | Time |
|---|---|---|---|---|
| Demo palette, 295 colours | 100 % → 99.06 % | 0 → 0 | – | ≈100 → ≈72 ms |
| Photo-like image (sky and sand, noise), 5000 colours | 24.0 % → 86.3 % | 3.45 % → 0 | – | ≈31 → ≈130 ms |
| Dark UI with background noise ±3 | 90.5 % → 100 % | 6.44 % → 0 | not detected → detected | ≈24 → ≈24 ms |
| Flat graphic with antialias edges | 99 % → 99 % | 0 → 0 | – | ≈2 → ≈2 ms |

Five iterations got there:
1. Cluster, then filter.
2. Colours past the cap first went into an "other" bucket, which took 46 % of a photo. Instead they now start their own clusters, staying within τ of every member.
3. Pruning.
4. Diameters tracked as members join.
5. Triangle-inequality bounds around each cluster's first member.

[AUDIT: property test] The improved code passes 17 properties on random inputs (50, 400 and 3000 colours, five seeds each):
- shares account to 100 %;
- every cluster is within τ;
- every kept cluster reaches the floor;
- the heavy-cluster counterexample: the current code drops it, the improved code keeps it;
- the blend score is graded.

[UNDERSTANDING] The photo-like image takes ≈130 ms instead of ≈31 ms, once per results page, because it now describes 86 % of the image instead of 24 %. Rendering the colour table costs far more.
