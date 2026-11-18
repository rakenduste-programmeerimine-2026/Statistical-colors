# Colour ontology

What an image's colours can hold, which parts of that can be detected reliably, and the code the server reports each one under. Wire format: `docs/api/color-analysis.md`. Types: `src/core/analysis/color-analysis.ts`. Estonian UI labels: `src/core/analysis/ontology.ts`.

Each statement is tagged by source:

- **[PROMPT P-###]**: quoted or required by a prompt in `docs/prompts.md`.
- **[AUDIT: experiment E#]**: measured by an unverified prototype in `prototypes/colour-analysis/`. The backend team still has to verify these.
- **[UNDERSTANDING]**: Claude's own reading, not yet confirmed.

## Scope

- [PROMPT P-030] 8-bit sRGB only: "No hdr or wider color spaces stick to srgb".
- [PROMPT P-030] Only what is detectable "reasonably and reliably without machine learning for now based on the pictures or with the extra information from screenshot tools".
- [UNDERSTANDING] The **reliability rule**: every code lists what it needs (`pixels`, `pixels+layout` or `scene`), the test it runs, its thresholds, and the inputs where it stays undetermined. A kind with no such test is not in the registry.

**Out of scope:**
- anything that needs recognising objects, faces, materials, scenes or intent;
- HDR, Display P3, Rec. 2020 and other wide gamuts;
- print (CMYK, spot colours);
- the meaning or emotion of colours.

## Files

| File | Covers |
|---|---|
| `01-colour-models.md` | sRGB, OKLab/OKLCH, HSL/HSV/HWB, RYB, ΔE, 8-bit limits |
| `02-structure-space.md` | **The mathematical map**: axis and path laws, the grid of combinations, several structures per image, per-point ΔE |
| `03-harmonies.md` | Hue templates, sector widths, nesting, construction models |
| `04-ramps-and-gradients.md` | Tonal ladders, equal-step ramps, sweeps, interpolation spaces |
| `05-ui-structure.md` | Dark and light mode, pairs, state layers, focus rings |
| `06-lighting-in-photos.md` | Teal–orange, casts, split toning, duotone, sepia |
| `07-digital-artefacts.md` | Antialias, ClearType, subsampling, JPEG, banding, indexed palettes |
| `08-accessibility.md` | WCAG contrast, colour-vision-deficiency pairs |
| `09-figma-and-tokens.md` | Every Figma colour feature, DTCG tokens |
| `10-other-fields.md` | Data visualisation, art, print, nature: what transfers |
| `11-harmony-adjacent-cases.md` | Where a structure is hidden, faked or misleading |

## Registry: structure codes

| Code | Family | Laws (L, C, h, path) | Requires | Issue |
|---|---|---|---|---|
| `harmony.complementary` | harmony | free, free, sym-2 | pixels | #57 |
| `harmony.analogous` | harmony | free, free, sym-3 (±30°) | pixels | #57 |
| `harmony.triadic` | harmony | free, free, sym-3 | pixels | #57 |
| `harmony.split-complementary` | harmony | free, free, sym-3 (0, 150, 210) | pixels | #57 |
| `harmony.square` | harmony | free, free, sym-4 | pixels | #57 |
| `harmony.rectangle` | harmony | free, free, sym-4 (0, 60, 180, 240) | pixels | #57 |
| `harmony.isoluminant` | harmony | const, free, sym-k | pixels | #57 |
| `ramp.tonal` | ramp | arith or mono, free, const | pixels | #58 |
| `ramp.iso-lightness-equal-step` | ramp | const, any, any, equal-step | pixels | #58 |
| `ramp.hue-sweep` | ramp | const, const, arith, arc | pixels | #58 |
| `ramp.chroma` | ramp | const, arith, const, collinear | pixels | #58 |
| `gradient.linear-oklab` | gradient | –, –, –, collinear | pixels+layout | #58 |
| `gradient.linear-srgb` | gradient | –, –, –, srgb-interpolated | pixels+layout | #58 |
| `gradient.hsl` | gradient | –, –, –, hsl-interpolated | pixels+layout | #58 |
| `palette.monochrome` | palette | free, free, const | pixels | #59 |
| `palette.achromatic` | palette | free, all C < 0.04, – | pixels | #59 |
| `palette.neutral-plus-accent` | palette | one chromatic cluster plus neutrals | pixels | #59 |
| `palette.two-level-lightness` | palette | two-level, free, free | pixels | #59 |
| `palette.equal-spacing` | palette | pairwise ΔE equal within ε | pixels | #59 |
| `palette.full-wheel` | palette | chromatic hues spread over the circle, no template fits | pixels | #59 |

## Registry: finding kinds

| Kind | Area | Requires | Issue | File |
|---|---|---|---|---|
| `ui.dark-mode`, `ui.light-mode` | ui | pixels+layout (scene confirms) | #60, #61 | 05 |
| `ui.light-dark-pair` | ui | scene (two captures) | #60, #61 | 05 |
| `ui.state-layer` | ui | pixels+layout | #60 | 05 |
| `ui.focus-ring` | ui | pixels+layout | #60 | 05 |
| `lighting.teal-orange` | lighting | pixels | #62 | 06 |
| `lighting.white-balance-cast` | lighting | pixels | #62 | 06 |
| `lighting.split-toning` | lighting | pixels | #62 | 06 |
| `lighting.duotone` | lighting | pixels | #62 | 06 |
| `lighting.sepia` | lighting | pixels | #62 | 06 |
| `structure.hsl-constructed`, `structure.ryb-constructed` | structure | pixels | #57 | 03 |
| `structure.ambiguous-nesting` | structure | pixels | #56 | 02 |
| `palette.dominant`, `palette.full-wheel` | palette | pixels | #59 | 02 |
| `accessibility.contrast`, `accessibility.wcag-fail` | accessibility | pixels | #64 | 08 |
| `accessibility.cvd-confusable` | accessibility | pixels | #64 | 08 |
| `tokens.tonal-ladder`, `tokens.role-guess`, `tokens.brand-drift` | tokens | pixels / scene | #58, #68 | 04, 09 |
| `figma.variable`, `figma.mode-pair`, `figma.blend-mode`, `figma.image-adjust` | figma | scene (plugin) | #66, #67 | 09 |
| `input.p3-read-as-srgb` | input | scene or file tag | #67 | 01 |
| `artefact.antialias-blend`, `artefact.cleartype`, `artefact.chroma-subsampling`, `artefact.jpeg-blocking`, `artefact.banding`, `artefact.indexed-palette` | artefact | pixels | #63 | 07 |

Every result also carries the caveat `consistent-not-proven` where relevant: a structure that fits the colours is consistent with them, not proof the designer used it (#32, slides).
