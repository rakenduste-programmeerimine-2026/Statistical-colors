# 08 Accessibility

## Contrast (`accessibility.contrast`, `accessibility.wcag-fail`)

- [UNDERSTANDING] WCAG 2 relative luminance: Y = 0.2126 R + 0.7152 G + 0.0722 B on linear sRGB. The ratio is (Y₁ + 0.05) / (Y₂ + 0.05), from 1 to 21.
- Thresholds:
  - AA text 4.5;
  - AA large text and non-text (WCAG 1.4.11) 3;
  - AAA text 7.
- **Which pairs:** from pixels, adjacent clusters with a thin one on a large one (text on a surface). With scene data, the DOM's text and background colours (`requires: scene`).
- **JPEG margin:** for lossy inputs, `worstCaseRatio` is the lowest ratio over colours within the JPEG error of each cluster, caveat `jpeg-approximate`. A pair that passes only at its centre gets severity `warning`.
- [UNDERSTANDING] APCA (the WCAG 3 draft) is not used until it is final.

A failing pair is `accessibility.wcag-fail` (severity `problem` for text below AA). A passing pair may be reported as `accessibility.contrast` (info).

## Colour-vision deficiency (`accessibility.cvd-confusable`)

[UNDERSTANDING] Deterministic simulation, with no ML:
- Use the Machado–Oliveira–Fernandes (2009) matrices for protan, deutan and tritan at severity 1.0, on linear sRGB.
- Two clusters that differ by ΔE ≥ 0.1 in normal vision but by < 0.03 after simulation are confusable.
- They are only reported when both are used as distinct colours (both ≥ 1 % share, or distinct roles in scene data).

## Colour as the only signal

[UNDERSTANDING] Needs scene data (the DOM shows that two states differ only in colour). Not detectable from pixels alone.

## Isoluminant harmonies

[UNDERSTANDING] `harmony.isoluminant` (`03`) disappears in greyscale. Reported as a notice when it carries meaning, e.g. a chart's categories.
