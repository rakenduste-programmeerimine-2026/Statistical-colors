# 07 Digital artefacts

Colours the image contains that nobody chose. All are deterministic tests on pixels (#63). Most are also cleaning steps before clustering (#29, #30).

| Kind | What causes it | Test [UNDERSTANDING unless marked] |
|---|---|---|
| `artefact.antialias-blend` | Edge pixels blend the two sides | The pixel is an sRGB blend t·A + (1 − t)·B of two neighbouring colours within 6 levels (slides, #29); a thin band at a boundary |
| `artefact.cleartype` | Subpixel text rendering colours glyph edges | Thin red/blue fringes left and right of text strokes, in R and B channels offset by ⅓ pixel; only around high-contrast text |
| `artefact.chroma-subsampling` | JPEG 4:2:0 stores colour at half resolution | Chroma (a, b) is smooth over 2×2 blocks while L is not; colour bleeds by one pixel across sharp edges |
| `artefact.jpeg-blocking` | JPEG's 8×8 DCT blocks | Discontinuities on the 8-pixel grid, stronger than inside blocks; reads the quantisation tables if the file has them |
| `artefact.banding` | An 8-bit gradient over a large area | Runs of equal colour with steps of one code value along a `gradient.*` path |
| `artefact.indexed-palette` | GIF or PNG-8, ≤ 256 colours | Unique colours ≤ 256 in an image with gradients; dithering patterns (alternating neighbours) |

Also known, with no separate kind yet:
- **gamma-incorrect blending:** blends done in encoded sRGB make edges between bright colours darker;
- **premultiplied-alpha halos:** dark fringes around transparent edges;
- **recompression:** reposted images, caveat `reposted-recompressed`.

## Per-colour chance (#69, P-033)

The server also reports, per colour in the results table, the chance that the colour is an artefact rather than a chosen colour (`ColorCount.artefacts`). [UNDERSTANDING] For `artefact.antialias-blend` this is the share of that colour's pixels that blend snap assigned to two neighbours. A colour that only appears at edges scores near 1; a flat swatch that is also a blend of two others, by coincidence, scores near 0. The table filters at 0.5 ("tõenäoline" / "puhas").

## Effect on other results

- [UNDERSTANDING] Antialias blends and ClearType create **fake hues** between real colours. They can complete a false harmony or ramp unless removed first (`11`).
- [UNDERSTANDING] Chroma subsampling lowers the chroma of small details, so small accents may fall below c₀.
