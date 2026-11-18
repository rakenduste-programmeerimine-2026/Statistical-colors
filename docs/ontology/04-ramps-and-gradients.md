# 04 Ramps and gradients

A **ramp** is a discrete set of colours ordered by a law (a scale of tokens). A **gradient** is a continuous transition in the image, whose pixels form a dense path. Both are tested with the path laws in `02`.

## Tonal ladders (`ramp.tonal`)

h const, L arith or mono, and C usually rising and then falling (highest in the middle).

| System | Steps | Known shape | Source |
|---|---|---|---|
| Tailwind | 50, 100–900, 950 (11) | L roughly 0.97 → 0.28; v4 defines the steps in OKLCH | [UNDERSTANDING] |
| Material 3 tones | 0, 10, …, 90, 95, 99, 100 | Tone = CIELAB L*; equal L* steps, not equal OKLCH L | [UNDERSTANDING] |
| Radix | 12 steps | Steps 1–2 background, 3–5 component, 6–8 border, 9–10 solid, 11–12 text | [UNDERSTANDING] |
| Open Color | 0–9 (10) | Equal steps by eye | [UNDERSTANDING] |

[UNDERSTANDING] The server matches a found ladder against these by step count and L profile. It reports a `TonalLadder` with `system` and the missing steps, plus the finding `tokens.tonal-ladder` (#58, #68).

## Equal-lightness, equal-step ramps (`ramp.iso-lightness-equal-step`)

[PROMPT P-031] "a gradiant of colors with a same lightness where every color is some delta E apart from other colors"

- L `const` (spread ≤ 0.02), path `collinear` or `arc`, and consecutive ΔE equal (CV ≤ 0.15).
- `step.target` is the mean step and `step.deltaEs` lists each step. The UI shows the strip with each step's ΔE.
- [AUDIT: experiment E3] Recognised exactly on synthetic data (step CV 0).
- [AUDIT: experiment E3b] On the demo, ramps with steps around 0.015 appear by chance, below the just-noticeable 0.02. Floor: each step ≥ 0.03.

## Hue sweeps and chroma ladders

- `ramp.hue-sweep`: L and C const, h arith, path `arc`. Rainbow and spectrum UIs. [AUDIT: experiment E3] recognised.
- `ramp.chroma`: L and h const, C arith, path `collinear` towards grey. Saturation scales and disabled states.

## Gradient interpolation space

[UNDERSTANDING] For a gradient region (needs layout: a run of pixels along a line), the server fits the path:

| Code | Signature |
|---|---|
| `gradient.linear-oklab` | Straight in OKLab: CSS `linear-gradient(in oklab, …)`, Figma's newer gradients |
| `gradient.linear-srgb` | Straight in encoded sRGB: the CSS default before Color 4, most older tools. Between complementary ends it sags towards grey and darkens in the middle |
| `gradient.hsl` | Straight in HSL: lightness bumps at yellow and cyan |

Banding along a gradient is an artefact (`07`).

## What is not reliable

- [UNDERSTANDING] Ramps of two colours: any two colours are "a ramp". The minimum is 3 points.
- [UNDERSTANDING] Gradients under JPEG: blocking breaks the path into 8×8 steps. Fit on block means, with the caveat `jpeg-approximate`.
