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

## Effect on other results

- [UNDERSTANDING] Antialias blends and ClearType create **fake hues** between real colours. They can complete a false harmony or ramp unless removed first (`11`).
- [UNDERSTANDING] Chroma subsampling lowers the chroma of small details, so small accents may fall below c₀.
