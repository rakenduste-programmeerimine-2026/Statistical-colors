# Colour-name list loader

Status: implicit
Code locations: `src/components/ColorName.tsx` (module-level `loaded`, `loader`, `listeners`), `src/core/color/names.ts` (`loading`, the cached promise)
Decision: keep implicit [UNDERSTANDING]: it only moves forward, and every component reads it through one store (`useSyncExternalStore`).
Analysis: none

## Transitions

| From | Event | To | Source |
|---|---|---|---|
| Not loaded | the first component that shows a name mounts | Loading: `import("color-name-list")` starts once; the promise is cached | [PROMPT P-040] item 2 "loaded with `import()` only when needed" |
| Loading | another name component mounts | Loading (the same promise is reused) | [UNDERSTANDING] |
| Loading | the list arrives and the index is built | Loaded: every listener re-renders with names | [UNDERSTANDING] |
| Loaded | any lookup | Loaded; the result is cached per colour | [UNDERSTANDING] |

Only mounted name components start loading. The closed theme widget does not mount its picker, so the upload page loads no names until a colour code is shown (P-040 item 2).

## Unknowns

- The chunk fails to load (offline). The promise rejects, codes stay without names, and a later mount does not retry. [UNDERSTANDING] Acceptable: names are an addition.
