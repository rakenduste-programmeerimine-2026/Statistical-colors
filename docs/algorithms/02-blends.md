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

- [AUDIT: lean `blend_score_gap`] Scaled to integers (score·12 = 12 − d for d ≤ 6, else 0), the score is 0 or at least 6, that is, ≥ 50 %. **It never lies strictly between 0 and 50 %**: a yes/no flag with a bonus, not a graded probability.
- [UNDERSTANDING] A colour exactly between two frequent colours scores 100 %. The user test read that as "100 % kindel". Since #90 the page says "Segupiksli sarnasus" and explains it (P-039 item 2).

## Improvement (#95)

- **Change:** score = 1 − d/12 for d ≤ 12 (graded), else 0.
  - [AUDIT: lean `graded_hits_every_level`] every level 0–12 occurs.
  - [AUDIT: lean `graded_monotone`] it falls with distance.
  - [AUDIT: lean `graded_agrees_near`] it equals today's score when d ≤ 6.

  So "likely" (≥ 0.5) and the colours set aside are unchanged.
- **Wording:** rename the field or document it as a similarity.
- [AUDIT: property test] In the local build, d = 0, 6, 9, 12 and 13 give 1, 0.5, 0.25, 0 and 0.
