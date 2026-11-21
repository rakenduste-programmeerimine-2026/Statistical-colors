# Colour analysis algorithms: formal model, checks and improvements

This folder models every step of the colour analysis that `analyseColors` (`src/core/analysis/compute-color-analysis.ts`) runs. The teammates own that code (P-039 item 10). Each page gives:
- the step's inputs, outputs and invariants;
- its parameters and complexity;
- what was checked;
- the improvement proposed in #93–#96.

Sources are tagged:
- **[AUDIT: lean T]**: theorem T in `ColourPipeline.lean`, checked locally with Lean 4.36.0. Only standard axioms (`propext`, `Quot.sound`, `Classical.choice`), no `sorryAx`. **Lean checks a small model written by hand, not the TypeScript.** The model matches the code only as far as the reading of the code is right; nothing links them mechanically. See "What Lean shows, and what it does not".
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

## What Lean shows, and what it does not

[UNDERSTANDING] After the user's challenge (P-042) every theorem was re-read for what it actually establishes. Three kinds:

- **Concrete run:** Lean evaluates a real algorithm on given inputs. It shows the effect happens, for that algorithm.
- **General fact:** a statement about every input of a model function. Useful when the model function is the code's rule.
- **Definitional:** restates a definition or is plain arithmetic. True, but it adds nothing beyond reading the definition. These are kept as documentation, not counted as evidence.

| Theorem | Kind | What it establishes |
|---|---|---|
| `Concrete.linkage_joins_shades`, `Concrete.current_order_loses_it`, `Concrete.proposed_order_keeps_it` | Concrete run | With **complete linkage itself** (closest pair first, every cross pair ≤ τ), two neighbouring shades of 6 pixels form a 12-pixel cluster. Filtering colours at floor 10 first loses that cluster; clustering first keeps it. #93 |
| `current_order_drops_heavy_cluster` | Concrete run, weak | The same effect with an arbitrary clustering ("put everything in one group"). Superseded by the three above. |
| `merge_tight` | General fact | If two clusters are tight and every cross pair is within τ, their union is tight. This is why complete linkage, and any variant that only merges under that condition, keeps every diameter ≤ τ. |
| `lance_williams` | General fact | The largest cross distance from a merged group is the max of the two parts'. The code's matrix update uses this rule (`palette-clusters.ts`, by reading). |
| `link_prune_safe` | General fact | Once a group is farther than τ from another, every group it later becomes part of is too. So a pair farther than τ can be dropped for good; the local faster linkage relies on this. |
| `grid_neighbours` | General fact | Two coordinates within τ fall in the same or neighbouring grid cells of size τ. So a grid search with cell τ misses no pair. |
| `gridIndex_injective` | General fact | The lattice index `(iL·nA + iA)·nB + iB` never maps two cells within bounds to one index. It is exactly the code's formula. |
| `pieces_flatten`, `pieces_total` | General fact, partly | Cutting a list anywhere and rejoining gives the list back, with the same total. The code's band lookup by share range is not modelled. |
| `proposed_order_keeps_heavy_clusters`, `proposed_order_kept_are_heavy` | Definitional | A filter keeps exactly what passes it. |
| `proposed_order_accounts`, `cap_leak`, `cap_leak_strict`, `cap_fixed` | Definitional | Kept + removed = total. The real evidence for #94 is the measured gap (3.45 % and 6.44 %), not the theorem. |
| `blend_score_gap`, `graded_hits_every_level`, `graded_monotone`, `graded_agrees_near` | Definitional | Restate the score formulas. They describe the formulas; they do not show that either score detects blends. |
| `singleton_tight` | Definitional | A single colour is tight. |

**What no theorem shows:**
- that the TypeScript implements the models (there is no refinement proof);
- that any score detects real antialiasing (a question about images, settled only by labelled test images);
- that the improved algorithm is better for users. The comparison below measures coverage and accounting, not perceived quality.

The existing visual-media model (`claude-setup/plan/VisualMedia.lean`, 20 theorems about recoverability) type-checks with Lean 4.36.0 with two deprecation warnings (`dif_pos`). It is not part of the analysis.

## The blend score is a threshold, not a probability

[UNDERSTANDING] The score uses only the colour list: a rare colour near the straight line between two frequent colours scores high, wherever its pixels are. That gives:
- false positives: a real flat swatch that happens to lie between two common colours;
- misses: blends whose end colours are under 1 %, which is most of a photo.

Grading the score (#95) removes the jump at 50 % but not these. Detecting antialiasing needs pixel neighbours: a blend pixel sits on an edge, between pixels of its two end colours. That redesign is proposed in #95.

## Improvements: what changes, measured

[AUDIT: comparison] Timings are medians of 15 runs after 3 warm-up runs, in Node (vitest). The earlier one-shot figures (31 → 130 ms) included start-up cost and are withdrawn. The input is the photo-like image: sky and sand with noise, 5000 colours.

| Version | Palette step | Whole analysis | Palette describes | Every pair in a cluster within τ |
|---|---|---|---|---|
| Current (filter, then link the first 300) | ≈20 ms | ≈27 ms | 24.0 % | yes |
| Local v5 (link 300, a greedy pass for the rest, then filter) | ≈62 ms | ≈72 ms | 86.4 % | yes |
| Local v6 (exact complete linkage over all 5000, pairs within τ only) | ≈7,800 ms | – | 86.4 % | yes |
| Local v7 (grid cells of side τ/√3, then complete linkage on the cells) | ≈32 ms | ≈41 ms | 86.4 % | yes |

Notes:
- **v6 is exact but unusable on photos.** 1.9 million of the 12.5 million colour pairs are within τ. At τ = 1 JND an 8-bit photo is a continuum: one 8-bit step is about 0.004 ΔE_OK. Exact complete linkage then costs O(n² log n). [AUDIT: property test] On 41 inputs of up to 290 colours it makes exactly the same groups as the current full scan.
- **v7 quantises first.** A cube of side τ/√3 has diameter τ, so every cell is already tight, in O(n). Only the 90 non-empty cells are then linked. [AUDIT: property test] On 21 inputs of up to 1000 colours, every colour is in exactly one cluster and every pair in a cluster is within τ. Its groups differ from exact complete linkage, because the cell boundaries are fixed.
- **Dark mode exposes a model limit.** A noisy dark background spreads wider than τ, so every version that keeps clusters within τ must split it (v7: four clusters of 20–28 %). The dark-mode rule needs one cluster over its share minimum, so v7 misses it; v5's greedy pass happened to detect it. [UNDERSTANDING] The rule should sum clusters by lightness band instead of requiring one cluster. This is a design question for the team (#96).
- **The other inputs:** demo palette 100 % → 99.06 %; dark UI 90.5 % → 100 %; flat graphic 99 % → 99 %. No share is unaccounted in v5 or v7.

[UNDERSTANDING] v7 is the local build's current version. The analysis runs once per results page, not per frame; the 3D view's render loop is separate.
