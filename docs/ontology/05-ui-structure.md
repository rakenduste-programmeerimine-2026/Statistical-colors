# 05 UI structure

[PROMPT P-030] "also detect stuff like this is a ui with dark mode but keep it to stuff that can be detected reasonably and reliably without machine learning for now based on the pictures or with the extra information from screenshot tools."

## Dark and light mode (`ui.dark-mode`, `ui.light-mode`)

**From pixels** (`requires: pixels+layout`), [AUDIT: experiment E9]:
- **Dark:** the largest flat cluster (low spread, large connected area) covers ≥ 35 % of the image with L ≤ 0.3, **and** clusters that contrast with it (ΔL ≥ 0.4) cover ≥ 1 % (text, icons).
- **Light:** the same with L ≥ 0.85.
- **Undetermined** (no finding):
  - a photograph (no flat background);
  - a dark image without contrasting content (a night photo, a black slide);
  - a mid-grey app (0.3 < L < 0.85).

[AUDIT: experiment E9] On synthetic cases, a dashboard (background L 0.18, 62 %) is dark and a docs page (L 0.99, 70 %) is light; the three undetermined cases stay undetermined.

**From scene data** (`requires: scene`), #61:
- the page's computed `color-scheme` and the `prefers-color-scheme` it was captured with confirm it;
- if the pixel rule and the scene disagree, the scene wins and the finding says so.

The finding carries the caveat `needs-scene-data` when only pixels were used.

## Light and dark pairs (`ui.light-dark-pair`)

[UNDERSTANDING] Needs two captures of the same page, light and dark, which the extension takes with the emulated media feature (#61). Clusters are matched by layout position. Each pair is reported with its L difference, and the pair set becomes a token-mode suggestion (`09`).

## State layers (`ui.state-layer`)

[UNDERSTANDING] Material-style hover and press layers are a colour composited over a surface at a fixed opacity (8 %, 10 %, 12 %…). The test: the cluster lies on the **sRGB line** between a surface colour and an on-surface or primary colour, at an opacity in that set (blend-snap, #29). Needs layout, because antialiasing creates the same blends at edges; a state layer is a filled area.

## Focus rings (`ui.focus-ring`)

[UNDERSTANDING] A thin (1–4 px) closed outline of one high-contrast colour around a control, only on that control. Needs layout. Without scene data (a capture with focus) it is only possible, so confidence stays ≤ 0.5.

## Not reliable without scene data

- [UNDERSTANDING] Semantic roles (error, success, warning) from hue alone: red is not always an error. With the extension's DOM data (role, ARIA, class names) or Figma variable names they become `declared` (`09`).
- [UNDERSTANDING] Elevation tints (Material 3 surface tones): consistent with lighter surfaces, but indistinguishable from simply different surfaces without the DOM.
- [UNDERSTANDING] Disabled state (lower C or L): only with scene data.
