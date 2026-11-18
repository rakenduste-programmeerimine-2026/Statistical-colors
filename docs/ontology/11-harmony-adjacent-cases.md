# 11 Hidden, faked and misleading structures

Cases where the laws in `02` give a wrong or incomplete answer, and how the server should handle each. [UNDERSTANDING] unless marked.

| Case | What goes wrong | Handling |
|---|---|---|
| Teal–orange grade vs orange objects | A grade looks like a complementary harmony | [AUDIT: experiment E5] The lighting test runs first. A grade is reported as `lighting.teal-orange`, and any complementary on the same clusters gets `lighting-confound` |
| HSL-built triad | Gaps of 113°, 122°, 125° in OKLCH look like a poor triad | [AUDIT: experiment E4] Fit in HSL too; report `model: "hsl"` with per-point drift |
| RYB complements | Red–green is not an OKLCH complement | Fit in RYB; `structure.ryb-constructed` |
| Monochrome palette | Every template fits trivially at one spoke | `palette.monochrome` first; harmonies need ≥ 2 occupied spokes |
| Achromatic palette | Hues are noise below c₀ | [AUDIT: experiment E7] `palette.achromatic`; no hue structures |
| Accent on grey | One chromatic colour plus greys | `palette.neutral-plus-accent`; the greys never complete a harmony |
| Hue-spanning gradient | A 60° sweep fits `analogous` | The ramp test runs first; a found sweep suppresses analogous on the same clusters |
| Colour cast over a harmony | All hues pulled one way; spokes off by a constant | A rotation absorbs a uniform shift, but a cast also changes C unevenly. Report the cast, and lower the harmony's confidence |
| Antialias and ClearType hues | Blends complete fake spokes or ramp steps | [PROMPT slides] Blend-snap (#29) runs before clustering |
| State layers | Hover tints look like a tonal ramp | Report as `ui.state-layer` when the blends lie on surface–colour lines (`05`) |
| Diverging data-viz | Two opposite ramps look complementary | Detect the two ramps with a shared neutral end first (`10`) |
| Light and dark modes in one image | Two palettes merged look like a busy one | With two captures, analyse each separately (#61); in one image, report `palette.two-level-lightness` |
| Per screen vs the whole app | A union of many screens hides each screen's structure | [UNDERSTANDING] Analyse per image; combining images is a later feature |
| Small accents lost | The share filter or subsampling removes a 0.1 % accent | [AUDIT: experiment E3b] The floor is 0.05 % share; subsampling caveat (`07`) |
| Hue wrap at 0/360 | Reds split into two clusters | Circular statistics everywhere (`01`) |
| Low-chroma noise | Hue jumps 9–35° from one 8-bit step | c₀ = 0.04 (`01`) |
| Lightness-only structure | Same hue, stepped L: no harmony, but structure | `ramp.tonal` |
| Busy palettes (colour pickers) | The top two colours form a false complementary | [AUDIT: experiment E3b] Coverage rule; `palette.full-wheel` |
| Deliberate discord | A designer breaks a harmony on purpose | Not detectable; results say "consistent, not proven" (#32) |
| Several valid templates | Complementary also fits square | Nesting and `structure.ambiguous-nesting` (`02`) |
