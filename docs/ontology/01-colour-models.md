# 01 Colour models

## Input: 8-bit sRGB

- [PROMPT P-031 item 6] Input and output are 8-bit sRGB; there are 16,777,216 colours, and alpha is 0–255.
- [PROMPT P-031 item 6] A Display P3-tagged image or Figma file is read as sRGB. The result gets `sourceProfile: "display-p3"`, the caveat `tagged-p3-read-as-srgb` and the finding `input.p3-read-as-srgb`. Colours may differ from the original.
- [UNDERSTANDING] An untagged PNG is assumed to be sRGB (the web default).

## OKLab and OKLCH

- [AUDIT: experiment E1] sRGB → linear → LMS → cube root → OKLab, with the CSS Color 4 matrices. OKLCH: C = √(a² + b²), h = atan2(b, a) in degrees.
- [AUDIT: experiment E1] Text `oklch(L% C h)` with 2, 5 and 2 decimals round-trips all 16.7M colours exactly. Greys (C < 0.000005) print hue `none`.
- [AUDIT: experiment E2] The widest chroma that stays inside sRGB at **every** hue is 0.127 at L 0.75, 0.068 at L 0.40 and 0.073 at L 0.85. The wheel ring uses L 0.75, C 0.127.

## Hue instability at low chroma

[AUDIT: experiment E1/E7] The worst hue change from a one-step change in a single 8-bit channel:

| Chroma below | Worst hue change |
|---|---|
| 0.01 | 35° |
| 0.03 | 15° |
| 0.04 | 9.3° |
| 0.06 | 6° |
| 0.2 | 1° |

So **c₀ = 0.04**: hue-based laws ignore clusters below it, and they get the caveat `low-chroma-hue-unstable`. The wheel draws them in the achromatic core.

## Distance

- [UNDERSTANDING] ΔE_OK is the Euclidean distance in OKLab, on a 0–1 scale. About 0.02 is just noticeable side by side; 0.005 is below the 8-bit step in most of the space.
- [UNDERSTANDING] CIEDE2000 (on CIELAB) is the print-industry reference, listed for comparison only. This project uses ΔE_OK everywhere.
- [UNDERSTANDING] Hue differences wrap: d(h₁, h₂) = min(|h₁ − h₂|, 360 − |h₁ − h₂|). Circular means use mean vectors, never arithmetic means.

## Other models (construction models)

[PROMPT P-031 item 4] Harmonies found in other models are shown on that model's own wheel, while the default view is OKLCH.

| Model | Hue | Notes |
|---|---|---|
| HSL | the sRGB hexcone hue | Same hue as HSV; lightness differs. Most CSS and design tools pick colours this way. |
| HSV/HSB | the same hue | Figma's and Photoshop's picker. |
| HWB | the same hue | CSS `hwb()`. |
| RYB (artist's wheel) | piecewise map from HSV hue: 0→0, 60→30, 120→60, 180→120, 240→240, 300→270 | Itten's red–yellow–blue wheel. The map is a convention, not a standard. |

[AUDIT: experiment E4] Equal angles in these models are not equal in OKLCH. Harmonies built in HSL or HSV drift 17–25° from the OKLCH ideal, and in RYB 25–38°. That is enough to tell the construction model apart (`03-harmonies.md`).

## What 8 bits cannot show

- [UNDERSTANDING] Steps smaller than one code value (gradients on large areas band; `07`).
- [UNDERSTANDING] Hue at very low chroma (above).
- [UNDERSTANDING] The original before compositing: alpha blends, antialiasing and JPEG change pixels in ways that are only partly reversible (#32, #45).
