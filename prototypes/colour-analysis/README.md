# Colour analysis prototypes (unverified)

> **For the backend team: please verify before integrating.** These are Claude's experiments for #54 (P-030, P-031 item 10). They are not part of the app: nothing builds, imports or tests them. Before any of it goes into backend code, check the maths, write your own tests, and decide the thresholds yourselves. Each result below is tagged [AUDIT: experiment …] (measured by running the script) or [UNDERSTANDING] (Claude's reading).

Run any of them from the repository root with Node 24 or later (it runs TypeScript `.mts` files directly):

```
node prototypes/colour-analysis/E3-E8-structures.mts
```

Contract the server fills: `docs/api/color-analysis.md`. Ontology and thresholds: `docs/ontology/`.

## Summary

| Experiment | Question | Result | Use |
|---|---|---|---|
| E1 `E1-oklch-roundtrip.mts` | Is `oklch(L% C h)` text with 2, 5 and 2 decimals lossless for 8-bit sRGB? | [AUDIT: experiment E1] Yes. All 16,777,216 colours round-trip exactly with the CSS Color 4 matrices. Greys need hue `none` (C prints as 0). | The frontend uses this format (`src/core/color/oklch.ts`). The server can send these numbers as-is. |
| E7 (in E1) | How unstable is hue at low chroma? | [AUDIT: experiment E1] The worst hue change for a one-step change in one 8-bit channel is 35° below C 0.01, 15° below 0.03, 9.3° below 0.04, 6° below 0.06 and 1° below 0.2. | c₀ = 0.04: colours below it are left out of hue-based structures (#57). |
| E2 `E2-E4-wheel-and-drift.mts` | What is the widest constant chroma inside sRGB for every hue? | [AUDIT: experiment E2] C 0.127 at L 0.75 (0.068 at L 0.40, 0.073 at L 0.85). | The wheel's ring colour (`src/core/color/wheel.ts`). |
| E4 (same file) | How far do harmonies built in another colour model drift in OKLCH? | [AUDIT: experiment E4] Worst spoke error over all base hues: HSL and HSV 17–25°, RYB 25–38°, depending on the template. An HSL triad from red lands at OKLCH hues 29.2°, 142.5°, 264.1°, gaps 113°, 122°, 125°. | Fitting in the construction model (#57) is clearly distinguishable from an OKLCH fit. |
| E3 / E8 `E3-E8-structures.mts` | Can harmonies, ramps and hue sweeps be detected exactly, with ΔE per point? | [AUDIT: experiment E3] On synthetic palettes: an exact triad gives ΔE 0 at every point; ±8° noise still fits the triad (max error 3.5°); neutrals are left out of a complementary pair; tonal ladders, equal-lightness equal-ΔE ramps and hue sweeps are all recognised with step CV 0. | The detector shape for #56, #57, #58. |
| E3b `E3b-demo-subsets.mts` | Does it work on a real palette (the demo, 295 colours)? | [AUDIT: experiment E3b] 93 clusters at τ 0.02, 65 chromatic, hues 2°–355°: a colour picker's swatches spread over the whole wheel, and correctly no harmony. Two weaknesses found: (1) requiring every colour in a template fails on busy palettes, while fitting only the 2 largest colours reports a false "complementary"; (2) ramps with steps of about 0.015 ΔE appear, below the just-noticeable 0.02. | Add a coverage rule (a structure must explain a minimum share of the chromatic pixels) and a step floor of 0.03 ΔE; report "colours across the whole wheel" as a palette type (#59). |
| E5 `E5-E9-lighting-and-dark-mode.mts` | Can teal–orange grading be told apart from orange objects, from pixel statistics only? | [AUDIT: experiment E5] On synthetic scenes: graded teal–orange is found (shadow hue 208°, highlight hue 55°, mean chroma offsets 0.026 and 0.033); orange objects under neutral light and a warm-only cast are not. A weak grade (offset 0.025 before mixing) is below the detection limit. | The rule and thresholds for #62. [UNDERSTANDING] Real photographs need testing; the synthetic scenes are simple. |
| E9 (same file) | Can a dark-mode UI be detected from pixels? | [AUDIT: experiment E9] A dashboard (background L 0.18, 62 %) is dark and a docs page (L 0.99, 70 %) light; a photograph (no flat background), a dark image without text and a mid-grey app stay undetermined. | The rule for #60: the largest flat cluster ≥ 35 % with L ≤ 0.3 and contrasting clusters (ΔL ≥ 0.4) ≥ 1 %. Confirm with the extension's colour-scheme data (#61). |
| E10 `E10-gamut-lattice.mts` | How large is an even lattice of sRGB, and how much of it does an image cover? | [AUDIT: experiment E10] OKLab step 0.02: 6,789 in-gamut points (25 ms); CIELAB ΔE*ab 4: 13,000. Snapping 4,096 test colours: about 5 % at the gamut edge snap to a point up to 1.3 steps (OKLab) or 2.1 steps (CIELAB) away. The demo's 295 colours occupy 88 points: 1.30 %. Run it with `npx jiti`, because it imports the app's TypeScript. | The `gamut` coverage figure (#74) and the 3D view (#75). |

## What to verify

1. **The OKLab matrices:** compare `E1` with a reference implementation, such as culori or colorjs.io, on a sample.
2. **Clustering:** complete linkage is O(n²) per merge in the prototype. That is fine for about 300 colours (440 ms) and not for 100,000. [UNDERSTANDING] The server needs the share filter (#30) first, or a faster method.
3. **The harmony cost:**
   - λ = 2 per template point and the 15° acceptance limit were picked by hand;
   - the nesting rule (complementary inside square) is not implemented;
   - Matsuda sector templates are not tried.
4. **The coverage rule** and the step floor from E3b are not in the prototype code yet.
5. **E5 and E9** ran only on synthetic data. Run them on real screenshots and photographs before trusting the thresholds.
6. **Gamut coverage (E10):** decide whether edge colours should count toward cells just outside the gamut (a surface lattice), and whether coverage should also be weighted by pixel share.
7. **Missing tests:** none of these scripts have unit tests. Please write your own, using the cases in each script's `isMain` block as a starting point.
