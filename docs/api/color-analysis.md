# Colour analysis contract (`colorAnalysis`, schema v1)

The server attaches `colorAnalysis` to each stored analysis returned by `getAnalysis` (#55). The frontend only displays it (#54). The real adapter computes it with `status: "computed"` (see [What is computed](#what-is-computed)); the stub and the demo synthesise one with `status: "simulated"` (`src/adapters/simulated/color-analysis.ts`).

- Types: `src/core/analysis/color-analysis.ts`. That file is the contract; this page explains it.
- Check: `checkColorAnalysis()` in `src/core/analysis/color-analysis-check.ts`. The real adapter (#40) should run it, and the contract test `analysis-service.contract.ts` does.
- Codes and kinds: `docs/ontology/README.md`.

Sources: [PROMPT P-030], [PROMPT P-031]. Thresholds marked [AUDIT: experiment …] come from `prototypes/colour-analysis/` (unverified prototypes; the backend team decides the final values).

## Rules

1. **8-bit sRGB in, sRGB only.** No HDR, Display P3 or wider spaces. A P3-tagged input is read as sRGB, `sourceProfile: "display-p3"`, with the caveat `tagged-p3-read-as-srgb` (P-031 item 6).
2. **Every colour is an `Oklch` object** `{ l: 0–1, c: ≥ 0, h: 0 ≤ h < 360 or null, alpha?: 0–1 }`. `h` is `null` when C < 0.000005 (greys). The UI prints it as `oklch(L% C h)` with 2, 5 and 2 decimals, which is lossless for 8-bit sRGB [AUDIT: experiment E1]. The only RGB field is `PaletteCluster.representativeRgb`, which is for exports.
3. **ΔE is ΔE_OK**: Euclidean distance in OKLab, on the 0–1 scale (0.02 ≈ just noticeable).
4. **Shares** are percentages, 0–100. **Coverage, score and confidence** are 0–1.
5. **No machine learning.** Each result says what it needed in `meta.requires`: `pixels`, `pixels+layout`, or `scene` (data from the capture extension or the Figma plugin). Anything that needs recognising objects or scenes is out of scope (P-031 item 5).
6. **Unknown codes and kinds are allowed.** The UI falls back to the server's Estonian `title`. Add new ones to `docs/ontology/README.md`.

## Fields

| Field | Type | Meaning |
|---|---|---|
| `schemaVersion` | `1` | Bump on breaking changes; the UI ignores unknown versions. |
| `status` | `"computed"` \| `"simulated"` | The server always sends `"computed"`. |
| `inputKind` | see type | design-file, source-code, scene-capture, png-lossless, jpeg-lossy, reposted, unknown. |
| `sourceProfile` | `"srgb"` \| `"untagged"` \| `"display-p3"` \| `"other"` | Anything except srgb/untagged is read as sRGB and flagged. |
| `pipeline[]` | `PipelineStep` | Each server step, its status, parameters and the share it set aside. |
| `palette[]` | `PaletteCluster` | Clusters: OKLCH centre, share, pixel count, member count, ΔE spread, optional role. |
| `structures[]` | `ColorStructure` | Any number per image, possibly overlapping. See below. |
| `contrast[]?` | `ContrastPair` | WCAG 2 ratios between used pairs, with `worstCaseRatio` for JPEG. |
| `tokens?` | `TokenSet` | DTCG-named tokens, roles, aliases, tonal ladders. |
| `figma?` | `FigmaColorFeatures` | Everything a Figma file declares about colour (#66, #67). |
| `findings[]` | `Finding` | Everything else, by ontology area. |

Every object that reports something carries `meta`: `provenance` (declared, measured, fitted, inferred, manual), `confidence`, `method` (in words, with parameters), `methodVersion?`, `requires`, `evidence?`, `caveats?` and `references?` (ontology anchors).

### Structures

A structure is a set of palette clusters that follow laws on the OKLCH axes and in OKLab (`docs/ontology/02-structure-space.md`).

| Field | Meaning |
|---|---|
| `code` | e.g. `harmony.triadic`, `ramp.iso-lightness-equal-step`, `palette.neutral-plus-accent`. |
| `family` | harmony, ramp, gradient, palette. |
| `model` | Where it was found: `oklch`, or `hsl`/`hsv`/`hwb`/`ryb` when the palette was built in that model (#57). The UI shows that model's wheel as the "original wheel". |
| `laws` | `{ l, c, h, path? }`: const, arith, geom, sym, mono, two-level, free; path collinear, arc, equal-step, srgb-interpolated, hsl-interpolated, none. |
| `template`, `rotation` | Harmonies: template offsets (degrees) and optional sector widths; rotation on the model's wheel. |
| `points[]` | **Per point**: `clusterId`, `ideal` (OKLCH point of the ideal structure), `actual` (the cluster centre), `deltaE` between them, `spoke?`. The UI draws the ideal point as an empty circle whose size grows with `deltaE` (P-031 item 4). |
| `step?` | Equal-step ramps: target ΔE and each consecutive ΔE. |
| `coverage` | Share of chromatic pixels the structure explains, 0–1. |
| `score` | 0–1, higher means a better and simpler explanation. |
| `residual` | Mean hue error in degrees (harmonies) or mean ΔE (others). |
| `nestedIn?` | Ids of structures this one is part of (complementary inside square). |

For a structure found in HSL etc., the `ideal` points are still the **OKLCH** ideal (the same template on the OKLCH wheel, anchored on the dominant colour), so `deltaE` shows the drift a construction model causes (#57).

### Findings

`kind` (registry code), `area` (palette, structure, ui, lighting, artefact, accessibility, tokens, figma, input, other), `severity` (info, notice, warning, problem), `title`, `detail?`, `metrics?` (`{key, label, value, unit?, min?, max?}`; with min and max the UI draws a meter), `swatches?`, `gradient?`, `clusterIds?`, `structureIds?`, `meta`.

## Per-colour fields (#69, P-033)

These go on each row of `ImageAnalysis.colors`, the colour list behind the "sagedasemat värvi" table, not inside `colorAnalysis`.

| Field | Type | Meaning |
|---|---|---|
| `artefacts?` | `{ kind, chance }[]` | The likelihood (0–1) that this colour is a blend pixel (segupiksel, `artefact.antialias-blend`) or another artefact (`docs/ontology/07-digital-artefacts.md`). [UNDERSTANDING] For blends, the share of the colour's pixels that blend snap (#29) assigned to two neighbours. |
| `clusterId?` | string | The `colorAnalysis.palette` cluster the colour belongs to (#31). Computed: the nearest cluster centre within τ 0.02, otherwise absent. |
| `ImageAnalysis.rowDataStatus?` | `"computed"` | `"simulated"` | The real adapter sends `"computed"` (clusters only; `artefacts` is not sent yet, #29, #63). The stub and the demo send `"simulated"`; the table then says so. |

- **Row count:** the table filters by share band, cluster and artefact over **every colour in `colors`**, and shows the N most frequent matches (P-033 item 3). #69 asks the server to send every colour, or to add a filter query to the port.
- **Check:** `checkColorRows()` checks these fields (chance 0–1, non-empty kind, known cluster ids).
- **Share bands** are computed in the browser from `percent` alone (`src/core/analysis/share-bands.ts`), so the server sends nothing for them.

## Gamut coverage (#74, P-035, P-036)

`colorAnalysis.gamut` says how much of the sRGB gamut the image's colours occupy. The 3D view on the results page shows it as a headline (#75).

| Field | Meaning |
|---|---|
| `space` | `"oklab"` |
| `cellDeltaE` | Lattice step, 0.02 ΔE_OK |
| `totalCells` | In-gamut points of a cubic OKLab grid with that step: 6,789 [AUDIT: experiment E10] |
| `occupiedCells` | Points that at least one image colour snaps to (its nearest in-gamut point) |
| `coverage` | `occupiedCells / totalCells`, 0–1 |
| `meta` | As everywhere |

- **Reference code:** the frontend uses the same lattice and snapping for drawing (`src/core/gamut/lattice.ts`, `snap.ts`), and the stub uses it to simulate the figure. An unverified prototype is `prototypes/colour-analysis/E10-gamut-lattice.mts`.
- **Colours counted:** every colour of the image counts (all of them, not the top N; #69). The computed figure uses the stored colours (up to 5000); when the image has more, `meta.method` says the figure is a lower bound.
- **Check:** `checkColorAnalysis` verifies that `coverage` equals `occupiedCells / totalCells`.
- **Simulated values:** the stub's and the demo's figure carries `provenance: "measured"` (it is measured from their colours), and simulation is flagged by `colorAnalysis.status === "simulated"`, which the page shows as "Näidisandmed".
- **The 3D view gets nothing else from the server.** It builds the lattice and snaps `analysis.colors` itself.

## What is computed

`computeColorAnalysis()` (`src/core/analysis/compute-color-analysis.ts`) builds the analysis from the stored colour list (up to 5000 colours, most frequent first). `SupabaseAnalysisService.getAnalysis` (#40) runs it on every read, because the analysis itself is not stored yet (#73), so a reload gives the same result. Nothing needs pixel positions.

| Step | Status | What it does | Code |
|---|---|---|---|
| `blend-snap` | not-implemented | Needs pixel neighbours and storage (#29, #73) | – |
| `share-filter` | done | Drops colours under 0.05 % share or with z < −2 on the log10 share; `removedShare` is their sum | `palette-clusters.ts` |
| `convert` | done | sRGB → OKLab/OKLCH, CSS Color 4 matrices | `src/core/color/oklch.ts` |
| `cluster` | done (skipped when no colour is left) | Complete linkage in OKLab, τ 0.02, on the 300 most frequent kept colours (distance matrix, Lance–Williams max update) | `palette-clusters.ts` |
| `structures` | done | Harmony templates and two palette types, see below. Ramps, the other palette types and other models are not implemented (#56, #58, #59) | `harmonies.ts`, `palette-types.ts` |
| `contrast` | done (skipped with fewer than 2 large clusters) | WCAG 2 contrast, see below | `contrast.ts` |
| `roles` | not-implemented | Needs scene data or Figma variables (#60, #66) | – |
| `findings` | done | `accessibility.contrast` and `ui.dark-mode`; the dark-mode thresholds are its parameters | `contrast.ts`, `ui-mode.ts` |

Also: `inputKind` comes from the stored image format (png, gif, bmp → `png-lossless`; jpeg → `jpeg-lossy`; webp or unknown → `unknown`). `sourceProfile` is `"srgb"`, because every image is decoded as 8-bit sRGB (P-031 item 6).

### Harmonies

- **Templates:** complementary (0, 180), analogous (−30, 0, 30), triadic (0, 120, 240), split-complementary (0, 150, 210), square (0, 90, 180, 270). Rectangle, Matsuda sectors and HSL/HSV/RYB fitting (#57) are not implemented.
- **Input:** clusters with C ≥ 0.04; greys never count toward coverage or fill a spoke.
- **Rotations:** whole degrees, plus every rotation that puts a spoke exactly on a cluster (the dominant-hue anchor of #33), so an exact template gives ΔE 0.
- **A template fits** when every spoke has a cluster within 15° and those clusters hold at least **0.8** of the chromatic share (`coverage`). Clusters further away are simply not part of the structure. Per template the rotation with the lowest Σ w·err² / Σ w wins.
- **Score** = coverage × (1 − rms hue error / 15°). Fits with a score under **0.3** are not reported. `residual` is the share-weighted mean hue error in degrees; `meta.confidence` equals the score.
- **Points:** only the clusters on spokes. The ideal keeps the cluster's L and C and moves h to the spoke, so `deltaE` is the hue error at that chroma.
- **Nesting:** a complementary whose clusters all belong to a fitting square gets `nestedIn: [square]`. A pure square is reported only as a square (the complementary covers 0.5).
- **Not added:** a minimum share per spoke (for example 10 %). It would reject 60–30–10 accent designs.

**Why 0.8 and 0.3** [AUDIT: measurement 2026-11-19, a script outside the repository; equal-chroma random hues, random shares, spokes within 15°]:

| Random hues | Palettes passing any one template at coverage ≥ 0.3 (docs/ontology/02) | at ≥ 0.8 |
|---|---|---|
| 5 | 3–78 % | 2–20 % |
| 8 | 31–95 % | 1–8 % |
| 12 | 71–99 % | 0–2 % |
| 20 | 89–100 % | 0 % |

300 palettes per row; the range is over the five templates. Each spoke catches ±15°, so four spokes cover a third of the wheel by chance; 0.3 lets most random palettes through. In the unit test (100 fixed-seed 12-hue palettes), coverage 0.8 alone let 5 through, with scores 0.18–0.65: all chance clusters of hues, two of them with one spoke held by a single 7–9 % cluster. With the 0.3 score floor, 2 of 100 pass (scores 0.31 and 0.38). Palettes of 3–5 colours can still look like a harmony by chance; every structure carries `consistent-not-proven`.

### Palette types (#59)

Structures with `family: "palette"`, after the harmonies. Chromatic means C ≥ 0.04, as for harmonies.

- **`palette.achromatic`:** every cluster has C < 0.04 (`docs/ontology/README.md`: "all C < 0.04").
- **`palette.neutral-plus-accent`:** every chromatic cluster lies within 15° of the largest chromatic cluster's hue (shades of one accent, such as a button and its hover colour, count as one), and the neutral clusters cover at least 50 %. The ontology says only "one chromatic cluster plus neutrals"; 15° and 50 % are chosen values.
- **Points:** every cluster. A neutral's ideal is the pure grey of its lightness, so `deltaE` is its chroma; an accent's ideal is itself. `coverage` and `score` are 1, `provenance: "measured"`, caveat `consistent-not-proven`.
- `palette.monochrome`, `two-level-lightness`, `equal-spacing` and `full-wheel` are not implemented.

### Contrast

- **Pairs:** every pair of the up to 6 largest clusters with at least 1 % share, using each cluster's `representativeRgb` (its most frequent colour). The lighter colour is `fgClusterId`. `worstCaseRatio` is not sent.
- **Passes:** AA text ≥ 4.5, AA large text and non-text ≥ 3, AAA text ≥ 7.
- **Finding `accessibility.contrast`:** one per image, rating the palette as a whole, because two similar tones are normal design: **info** when any pair reaches 4.5, **notice** when the best reaches 3, **warning** otherwise. Metrics: highest and lowest ratio, pairs ≥ 4.5 and pairs ≥ 3. Swatches: the highest-contrast pair (the best text and background candidate). Whether the colours are next to each other is not known from colours alone; the detail says so.

### Dark mode (#60)

The E9 rule from `docs/ontology/05-ui-structure.md` on the clusters, plus a flatness test, so it needs no layout:

- **Background:** the largest cluster covers ≥ 35 %, has L ≤ 0.3 and `spreadDeltaE` ≤ 0.01 (a flat colour, not a noisy dark photo).
- **Content:** the other clusters with |ΔL| ≥ 0.4 from it cover ≥ 1 % in total.
- **Finding `ui.dark-mode`:** severity info, `provenance: "inferred"`, confidence 0.6, caveat `needs-scene-data`, `requires: "pixels"`. Metrics: background L, background share, content share. Swatches: the background and the largest content cluster.
- **No finding:** a dark background without light content, a noisy dark background, a light image, or a mid-tone one. `ui.light-mode` is not reported. The extension's colour-scheme data (#61) would confirm it.

## Server steps and default parameters

[UNDERSTANDING] Suggested order and defaults; the backend team decides the final values. What is implemented, with its final values, is in [What is computed](#what-is-computed).

| Step | Default | Source |
|---|---|---|
| `blend-snap` | Pixels that are an sRGB blend of two neighbours within 6 levels are assigned to them | #29, slides |
| `share-filter` | Drop colours under 0.05 % share or z < −2 in log share | #30, slides |
| `convert` | sRGB → OKLab/OKLCH (CSS Color 4 matrices) | [AUDIT: experiment E1] |
| `cluster` | Complete linkage in OKLab, τ = 0.02 | #31, [AUDIT: experiment E3b] |
| `structures` | Hue structures only on C ≥ 0.04; templates × 360 rotations; λ = 2 per point; a coverage rule; ramp steps ≥ 0.03 ΔE | [AUDIT: experiments E7, E3, E3b] |
| `contrast` | WCAG 2 relative luminance; JPEG worst case | #64 |
| `roles` | From scene data or Figma variables only | #60, #66 |
| `findings` | Registry rules, `docs/ontology/` | #65 |

## Example

Trimmed: one structure, one finding.

```json
{
  "schemaVersion": 1,
  "status": "computed",
  "inputKind": "png-lossless",
  "sourceProfile": "srgb",
  "pipeline": [{ "step": "cluster", "status": "done", "params": { "tau": 0.02, "linkage": "complete" } }],
  "palette": [
    { "id": "c0", "color": { "l": 0.2, "c": 0.01, "h": 260 }, "share": 55, "pixelCount": 22000, "memberCount": 3, "spreadDeltaE": 0.008,
      "meta": { "provenance": "measured", "confidence": 1, "method": "complete linkage τ 0.02", "requires": "pixels" } },
    { "id": "c1", "color": { "l": 0.55, "c": 0.12, "h": 31.2 }, "share": 6, "pixelCount": 2400, "memberCount": 2, "spreadDeltaE": 0.004,
      "meta": { "provenance": "measured", "confidence": 1, "method": "complete linkage τ 0.02", "requires": "pixels" } }
  ],
  "structures": [
    { "id": "s0", "code": "harmony.triadic", "family": "harmony", "title": "Kolmikharmoonia", "model": "oklch",
      "laws": { "l": "free", "c": "const", "h": "sym" }, "template": { "offsets": [0, 120, 240] }, "rotation": 30,
      "points": [
        { "clusterId": "c1", "ideal": { "l": 0.55, "c": 0.12, "h": 30 }, "actual": { "l": 0.55, "c": 0.12, "h": 31.2 }, "deltaE": 0.0025, "spoke": 0 }
      ],
      "coverage": 0.62, "score": 0.81, "residual": 1.2,
      "meta": { "provenance": "fitted", "confidence": 0.8, "method": "template fit, 360 rotations, λ 2, C ≥ 0.04", "requires": "pixels" } }
  ],
  "findings": [
    { "id": "f0", "kind": "ui.dark-mode", "area": "ui", "severity": "info", "title": "Tume režiim",
      "metrics": [{ "key": "bgL", "label": "Tausta heledus (L)", "value": 0.2, "min": 0, "max": 1 }],
      "clusterIds": ["c0"],
      "meta": { "provenance": "inferred", "confidence": 0.85, "method": "largest flat cluster ≥ 35 % with L ≤ 0.3, contrasting clusters ≥ 1 %",
                "requires": "pixels+layout", "caveats": ["needs-scene-data"] } }
  ]
}
```

## Validation and versioning

- `checkColorAnalysis()` returns an empty list for a valid object. It checks ranges, unique ids, references between parts, share totals, `deltaE ≥ 0`, spoke indexes, contrast 1–21 and non-empty titles.
- New optional fields and new codes or kinds are not breaking. Renaming or removing a field, or changing a unit, needs `schemaVersion: 2` and a frontend change.
