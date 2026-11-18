# Colour analysis contract (`colorAnalysis`, schema v1)

The server attaches `colorAnalysis` to each stored analysis returned by `getAnalysis` (#55). The frontend only displays it (#54). Until the server sends it, the frontend stub synthesises one with `status: "simulated"` (`src/adapters/stub/stub-color-analysis.ts`).

- Types: `src/core/analysis/color-analysis.ts`. That file is the contract; this page explains it.
- Check: `checkColorAnalysis()` in `src/core/analysis/color-analysis-check.ts`. The real adapter (#40) should run it, and the contract test `analysis-service.contract.ts` does.
- Codes and kinds: `docs/ontology/README.md`.

Sources: [PROMPT P-030], [PROMPT P-031]. Thresholds marked [AUDIT: experiment …] come from `prototypes/colour-analysis/` (unverified prototypes; the backend team decides the final values).

## Rules

1. **8-bit sRGB in, sRGB only.** No HDR, Display P3 or wider spaces. A P3-tagged input is read as sRGB, `sourceProfile: "display-p3"`, with the caveat `tagged-p3-read-as-srgb` (P-031 item 6).
2. **Every colour is an `Oklch` object** `{ l: 0–1, c: ≥ 0, h: 0 ≤ h < 360 or null, alpha?: 0–1 }`. `h` is `null` when C < 0.000005 (greys). The UI prints it as `oklch(L% C h)` with 2, 5 and 2 decimals, which is lossless for 8-bit sRGB [AUDIT: experiment E1]. The only RGB field is `PaletteCluster.representativeRgb`, which is for exports.
3. **ΔE is ΔE_OK**: Euclidean distance in OKLab, on the 0–1 scale (0.02 ≈ just noticeable).
4. **Shares** are percentages, 0–100. **Coverage, score and confidence** are 0–1.
5. **No machine learning.** Each result says what it needed in `meta.requires`: `pixels`, `pixels+layout`, or `scene` (data from the capture extension or the Figma plugin). Anything that needs recognising objects or scenes is out of scope (P-031 item 8).
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

## Server steps and default parameters

[UNDERSTANDING] Suggested order and defaults; the backend team decides the final values.

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
