# 03 Harmonies

A harmony is a structure whose hue follows `sym`: the chromatic clusters' hues match a template of k offsets, up to a rotation r.

## Templates

| Code | Offsets (degrees) | Slide name |
|---|---|---|
| `harmony.complementary` | 0, 180 | vastandvärvid |
| `harmony.analogous` | −30, 0, 30 | naabervärvid |
| `harmony.triadic` | 0, 120, 240 | kolmik |
| `harmony.split-complementary` | 0, 150, 210 | lõhestatud vastand |
| `harmony.square` | 0, 90, 180, 270 | ruut |
| `harmony.rectangle` | 0, 60, 180, 240 | ristkülik (tetrad) |

[UNDERSTANDING] Matsuda's (1995) sector templates (i, V, L, I, T, Y, X) replace points with sector widths. In the schema they are `template.widths`: a hue inside the sector has error 0. They are tolerances, not separate codes, until the backend team adopts them.

## Fitting

[AUDIT: experiment E3] From the slides:
- For each template and each rotation r in 1° steps, every chromatic cluster (C ≥ 0.04) is assigned to its nearest spoke. The error is the hue distance, weighted by share.
- The cost is J(P, r) + λ|P|. The best (template, r) pair wins if its maximum error is ≤ 15° and it passes the coverage rule (`02`).
- **Dominant-hue anchor (slides):** when two rotations tie, the one with a spoke on the largest chromatic cluster wins.
- **Low chroma:** clusters with C < 0.04 never count, so a grey background cannot complete a harmony. [AUDIT: experiment E3] neutrals are correctly left out of a complementary pair.

`harmony.isoluminant` is the same fit with `l: const`. Equal lightness makes the harmony disappear in greyscale, which is also an accessibility signal (`08`).

## Construction models

[PROMPT P-031] "when detecting color harmonies inn other colorspaces eg hsv, hsl add an option of showing them on the color wheel in their original colorwheel, but default view is oklch"

- The server also fits the templates on HSL, HSV, HWB and RYB hue. If a model's fit is clearly better than OKLCH's (lower J by a margin), the structure gets `model: "hsl"` etc., and the finding `structure.hsl-constructed` or `structure.ryb-constructed`.
- [AUDIT: experiment E4] An HSL triad from pure red lands at OKLCH hues 29.2°, 142.5° and 264.1° (gaps 113°, 122°, 125°). Over all base hues the worst drift is 17–25° in HSL and HSV and 25–38° in RYB, far above the noise level of a good OKLCH fit.
- [UNDERSTANDING] HSL, HSV and HWB share a hue, so the server reports the one whose other axes also fit best, or `hsl` by default (the most common in CSS).
- The UI marks that model's wheel "algne ratas" (original wheel). On the OKLCH wheel the ideal points are the OKLCH template, so the drift shows as larger ΔE circles.

## Not harmonies

- [UNDERSTANDING] Itten's seven contrasts are partly expressible as laws:
  - light–dark → `two-level` L;
  - saturation → C contrast;
  - complementary → `sym-2`.
  Warm–cool, simultaneous contrast and extension (area) contrast need judgements the ontology does not make, so they get no code.
- A hue sweep that spans 60° can fit `analogous` by accident. The ramp test runs first, and a sweep found as a ramp is not also reported as analogous (`11`).
