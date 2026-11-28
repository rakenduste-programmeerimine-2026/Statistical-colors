# 02 Antialias blend score (`src/core/analysis/blends.ts`)

## Model

- **Ends:** the ≤ 20 most frequent colours with share ≥ 1 %.
- **Candidates:** colours with share < 1 %.
- **Score:** for each pair of ends A, B, the candidate c is projected onto segment AB in 8-bit sRGB:
  - t = ((c − A)·(B − A)) / |B − A|²;
  - d = |c − A − t(B − A)|.

  If 0.1 ≤ t ≤ 0.9 and d ≤ 6, the score is 1 − d/12; otherwise 0. The colour's score is the best over all pairs, rounded to 0.001.
- **Classification:** a colour is a blend when its score is ≥ 0.5. Blends are set aside before clustering.
- **Complexity:** O(n · 190) for n colours and 20 ends.

## Checks

- [LOCAL RUN: lean `blend_score_gap`, definitional: it restates the formula] Scaled to integers (score·12 = 12 − d for d ≤ 6, else 0), the score is 0 or at least 6, that is, ≥ 50 %. **It never lies strictly between 0 and 50 %**: a yes/no flag with a bonus, not a graded probability.
- [UNDERSTANDING] The score looks only at the colour list, never at where the pixels are. So it flags a real flat swatch that lies between two common colours, and misses blends whose ends are under 1 %. The theorem says nothing about whether the score detects antialiasing; only labelled test images can.
- [UNDERSTANDING] A colour exactly between two frequent colours scores 100 %. The user test read that as "100 % kindel". Since #90 the page says "Segupiksli sarnasus" and explains it (P-039 item 2).

## Improvement (#95)

- **Change:** score = 1 − d/12 for d ≤ 12 (graded), else 0.
  - [LOCAL RUN: lean `graded_hits_every_level`] every level 0–12 occurs.
  - [LOCAL RUN: lean `graded_monotone`] it falls with distance.
  - [LOCAL RUN: lean `graded_agrees_near`] it equals today's score when d ≤ 6.

  These three restate the new formula. So "likely" (≥ 0.5) and the colours set aside are unchanged.
- **Redesign proposed (#95):** use pixel neighbours. A pixel counts as a blend when it sits between pixels of its two end colours along an edge. This needs the pixel grid, so it belongs in the backend count step.
- **Wording:** rename the field or document it as a similarity.
- [LOCAL RUN: property test] In the local build, d = 0, 6, 9, 12 and 13 give 1, 0.5, 0.25, 0 and 0.
