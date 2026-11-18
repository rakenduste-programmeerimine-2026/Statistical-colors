# 09 Figma and design tokens

[PROMPT P-030] Cover all Figma colour features and tokens, plus meta information about recovered colours.

Figma features were checked against `@figma/plugin-typings` 1.142.0 [AUDIT: typings]. The plugin (#46, #66) reads them, and the server stores them in `colorAnalysis.figma` (#67). Values are converted to OKLCH from Figma's sRGB 0–1 floats. A Display P3 document is read as sRGB and flagged [PROMPT P-031].

## Coverage

`declared`: the plugin reads it from the file. `inferred`: the server can estimate it from pixels. `not-detectable`: neither.

| Feature | Schema field | From the file | From pixels |
|---|---|---|---|
| Solid fill | `paints[]` `SOLID` | declared | inferred (the cluster) |
| Linear, radial, angular, diamond gradient | `paints[]` `GRADIENT_*`, `stops` | declared | inferred (`gradient.*`, `04`) |
| Image, video fill | `IMAGE`, `VIDEO` | declared (with `imageFilters`) | not-detectable (looks like a photo) |
| Pattern fill | `PATTERN` | declared | not-detectable |
| Shader fill or effect | `SHADER` | declared (type only) | not-detectable |
| Paint opacity and visibility | `opacity`, `visible` | declared | inferred for flat areas over a known background (blend-snap) |
| Blend modes (19) | `blendMode` | declared | not-detectable in general; `figma.blend-mode` only from the file |
| Image filters: exposure, contrast, saturation, temperature, tint, highlights, shadows | `imageFilters` | declared | not-detectable; `figma.image-adjust` |
| Drop and inner shadow | `effects[]` | declared (colour, offset, radius, spread) | inferred: a soft, darker band with the shadow colour's hue |
| Layer and background blur, progressive | `effects[]` `*_BLUR`, `progressive` | declared | not-detectable |
| Noise, texture, glass | `effects[]` | declared | not-detectable (looks like noise or an artefact) |
| Strokes | `strokes[]` (colour, weight, alignment) | declared | inferred: thin outlines |
| Variables: collections, modes, aliases, scopes, code syntax | `variables[]` | declared | not-detectable |
| Paint and effect styles | `styles` | declared | not-detectable |
| Document colour profile | `documentColorProfile` | declared | not-detectable |

## Findings from Figma data

| Kind | Meaning |
|---|---|
| `figma.variable` | A colour variable, with values per mode and its aliases |
| `figma.mode-pair` | Light and dark values of one variable; an exact `ui.light-dark-pair` |
| `figma.blend-mode` | A non-normal blend mode on a visible paint: the rendered colour differs from the declared one |
| `figma.image-adjust` | Image filters on an image fill: the photo's colours are adjusted |

## Design tokens

- [UNDERSTANDING] The export follows the Design Tokens Community Group format: `$type: "color"`, a path name (`color.primary.500`), aliases as `{color.primary.500}` (#68).
- Tokens are `declared` when they come from Figma variables or the extension's CSS custom properties, and `inferred` when estimated from pixels (with a `role` guess, `tokens.role-guess`).
- `tokens.brand-drift`: a used colour within 0.02 < ΔE ≤ 0.06 of a declared token, which is probably meant to be that token. This needs declared tokens.
- **Manual flags (#19):** a person can mark a token or role, giving provenance `manual`. These win over inferred ones.

## Meta information about recovered colours

[PROMPT P-030] Every value says how it is known (`meta`):
- `provenance`;
- `confidence`;
- `method` with parameters;
- `requires`;
- `evidence` (swatches, regions, shares);
- `caveats` (e.g. `jpeg-approximate`, `alpha-composited`, `consistent-not-proven`).

The Figma export (#66) writes these as plugin data, so a designer sees where each recovered colour came from.
