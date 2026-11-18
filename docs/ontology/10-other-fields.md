# 10 Other fields

What the colour practice of other fields adds, and how much of it maps onto the laws in `02`. [UNDERSTANDING] throughout unless marked.

## Data visualisation

| Palette type | Law | Code |
|---|---|---|
| Categorical | Pairwise ΔE equal and large, similar L | `palette.equal-spacing` |
| Sequential | One hue, L arith (light → dark) | `ramp.tonal` |
| Perceptual sequential (viridis-like) | L arith, h arith: a spiral | grid cell L arith, h arith (`02`) |
| Diverging | Two ramps meeting at a neutral midpoint | two `ramp.tonal` with opposite hues sharing a grey end; the finding notes "diverging", and it is not reported as complementary (`11`) |

## Art and painting

- **The RYB wheel:** artists' complements (red–green, blue–orange, yellow–violet) are RYB complements. See `structure.ryb-constructed` (`03`).
- **Limited palettes** (e.g. the Zorn palette: yellow ochre, vermilion, black, white) are a small fixed set. Detectable only as `palette.*` laws (few hues, many L levels), never by name.
- **Itten's contrasts:** see `03`.

## Brand

Brand colours appear as declared tokens (`09`). Drift from them is `tokens.brand-drift`. Recognising a logo or brand is out of scope.

## Out of scope

- **Print:** CMYK, spot colours, paper white and ink limits. sRGB only [PROMPT P-031].
- **Colour psychology and meaning:** not measurable from pixels.
- **Nature and seasonal palettes** ("autumn", "pastel"): pastel is expressible as a region (L ≥ 0.8, C ≤ 0.08), but the name is a judgement. A region test may be added later as `palette.region-*`; nothing is reported now.
- **Cultural colour meanings.**
