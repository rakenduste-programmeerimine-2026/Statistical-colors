# Roadmap

Requirements live in `docs/prompts.md` (P-010, P-011). This file is the plan that follows from them. The slides and Lean model it is based on are informal reference and are not in the repository.

## Goal

Upload images and get an exact, readable and machine-readable account of their colours, without an account or a download.

Beyond exact counting, the target is the **colour tokens** of a design (primary, surface, error, …) and, later, **which component uses which colour**. Grids, spacing and type scales are out of scope.

## Colour recovery pipeline

Colours come in and go out as 8-bit sRGB. Each step is a pure TypeScript function with unit tests.

| Step | What it does | Space | Issue |
|---|---|---|---|
| 0. Decode and count | Exact pixels, every unique colour with count and share | sRGB | #11, #12 |
| 0b. Save, read, export | Store the analysis, read it back by id, summary and pixel CSVs | — | #13, #39, #14, #38 |
| 1. Blend test | Antialiased edge pixels between two real colours snap to the nearer one | encoded sRGB | #29 |
| 2. Share filter | Drop rare colours (edges, JPEG noise) and optionally small icons | — | #30 |
| 3. Convert | sRGB → linear → OKLab → OKLCH, ΔE_OK distance | OKLab / OKLCH | #28 |
| 4. Cluster | Merge colours closer than τ by complete linkage; centres are token estimates | OKLab | #31 |
| 5. Harmony | Fit hue templates on the hue circle, chromatic colours only | OKLCH | #33 |
| 6. Contrast | WCAG contrast between token pairs | relative luminance | #34 |
| 7. Roles and relations | Token roles and colour ↔ component rules, needs scene capture | — | #35 |

Step 1 runs before step 3 because browsers blend in encoded sRGB, so blends are straight lines there and curves in OKLab.

## Ground-truth loop

People enter the real tokens by hand (#19). A record is flagged when the prediction and the manual value differ by more than τ in ΔE_OK, or get different roles. Store the prediction, the manual value, the input and the method, so flagged records can become regression tests.

## What the results can promise

- **PNG, BMP, lossless WebP:** exact pixels, no structure behind them.
- **JPEG:** colours are approximate. Contrast checks need a margin. Different decoders can give slightly different pixels, so exact counts hold for one decoder only.
- **Scene capture** (feedback-shot extension or Figma plugin): declared colours tied to elements. This comes from outside the project (#35).
- A result that re-renders to the same pixels is **consistent** with the input, not proven to be the original. The UI says so (#32).

## Milestones

| Milestone | Due | Issues |
|---|---|---|
| M1: Setup and database | 2026-11-18 | #4–#10, #25 |
| M2: MVP, images in, statistics out | 2026-11-21 | #11–#17, #37–#40 |
| M3: Colour space and user test | 2026-11-25 | #18–#21, #27–#32, #36 |
| M4: Polish and presentation | 2026-12-09 | #33, #34 |
| Backlog | — | #35 |

## Frontend and backend boundary

The UI (#37, ported from the original Flask app) talks to the backend only through two ports:

- `AnalysisService` (`src/core/analysis/analysis-service.ts`): analyse, read by id, CSV downloads. A stub adapter returns marked fake data until the real adapter (#40) replaces it. Both must pass `analysis-service.contract.ts`.
- `ThemeStore` (`src/core/theme/theme-store.ts`): saved themes, kept in the browser.

## Ownership

Step 0 (#11, #12) is labelled `backend` and owned by the team; Claude does not change it without permission (Team scope in `CLAUDE.md`).

[UNDERSTANDING] Steps 1–6 and the results UI run in the browser, as #11 suggests for decoding, so they are labelled `frontend`. This is not yet confirmed by the team. Saving results, flags and policies (#13, #19 database part) belong to the backend and database owners.
