# 01 Counting, top N and share bands

## Colour counting (`src/core/count-colors.ts`)

- **Input:** RGBA pixels (W × H), and whether alpha counts.
- **Output:**
  - `totalPixels = W·H`;
  - `uniqueColors`;
  - the colours with their counts, sorted by count descending. Ties keep first-appearance order, like Python's `Counter.most_common`.
- **Complexity:** O(P) with a Map keyed by an integer colour, plus O(U log U) for the stable sort.
- **Invariants:**
  - [UNDERSTANDING] Σ counts = W·H. Each pixel adds 1 to exactly one key.
  - The order is non-increasing in count.

  Both can be modelled in Lean core (`Fin 256` channels, `List.mergeSort`). They are covered by the teammates' 7 tests and are not proven here.
- **Shares:** `percent = count / totalPixels · 100`. They are stored as `numeric(13,10)`, so the database rounds them to 10 decimals [UNDERSTANDING: harmless].

## Top N

- The database stores at most 5000 colours whatever topN is (`STORED_COLORS_MAX`). The page shows `min(topN, uniqueColors)` rows (#90).
- [UNDERSTANDING] With more than 5000 unique colours, every step below sees only the top 5000. Shares then add up to less than 100 %. The gamut coverage marks itself a lower bound.

## Share bands (`src/core/analysis/share-bands.ts`, frontend)

- **Input:** the shares.
- **Output:** bands, each a contiguous run of the shares sorted descending. The list is cut at gaps of at least half a decade in log10(share), at most 6 bands. With no such gap it falls back to decade bands.
- **Invariant:** [LOCAL RUN: lean `pieces_flatten`, `pieces_total`] whatever the cuts, the bands put back together are the sorted list, with the same total. So every colour is in exactly one band. Tests also check that `bandOf` finds exactly one band for each share.
