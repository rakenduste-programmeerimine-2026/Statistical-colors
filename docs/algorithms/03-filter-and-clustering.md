# 03 Share filter and clustering

## Current model (`palette-clusters.ts`, `compute-color-analysis.ts:44-45`)

1. **Share filter** on the non-blend colours. A colour is dropped when its share is < 0.05 % or its z-score on log10(share) is < −2 (population standard deviation).
2. **Clustering** of the **first 300** kept colours by count:
   - agglomerative **complete linkage** in OKLab;
   - it merges the closest pair while that distance ≤ τ = 0.02;
   - the distance matrix is updated with the Lance–Williams max rule.
   - Cost: O(n³) time and O(n²) memory with n ≤ 300.
3. **Cluster output:** a share-weighted OKLab centre, the summed share, the diameter (`spreadDeltaE`), and its most frequent member (for contrast).

## Checks

- [AUDIT: lean `merge_tight`, `singleton_tight`] Complete linkage only merges when every cross pair is within τ, so every cluster's diameter stays ≤ τ.
- [AUDIT: lean `lance_williams`] The max update gives exactly the complete-link distance of the merged cluster. The code is correct here.
- [AUDIT: lean `current_order_drops_heavy_cluster`] Filtering single colours **before** clustering can drop a whole cluster whose members are each under the floor but whose total reaches it. Example: two shades of 6 pixels, floor 10, one cluster of 12.
  - [AUDIT: comparison] On a photo-like image, 59 % of the pixels are filtered and the palette describes 24 % of the image.
  - [UNDERSTANDING] In a 12-megapixel photo a colour needs at least 6,000 pixels of one exact RGB value to survive the 0.05 % floor. Most shades of a photo never do.
- [AUDIT: lean `cap_leak`, `cap_leak_strict`] Colours past the 300 cap are in no cluster and in no removed share, so palette + removed + blend falls short of the stored total by exactly their share.
  - [AUDIT: comparison] 3.45 % on the photo-like image, 6.44 % on a dark UI.

## Improvement (#93, #94), as built and tested locally

1. **Cluster first:** run complete linkage on the first 300 colours, as now.
2. **Every colour past the cap joins** the nearest cluster it is within τ of, in full (so the cluster stays tight, by `merge_tight`), or starts its own cluster. Finding candidates:
   - a grid over the clusters' first members (cell τ);
   - triangle-inequality bounds against the farthest member from that seed: accept when distance + radius ≤ τ, skip when distance − radius > τ;
   - otherwise a full scan that stops as soon as the cluster cannot win.
3. **Filter clusters, not colours:** drop a cluster whose summed share is < 0.05 % or whose z on log10(cluster share) is < −2.
   - [AUDIT: lean `proposed_order_keeps_heavy_clusters`, `proposed_order_kept_are_heavy`] It keeps exactly the clusters that reach the floor.
   - [AUDIT: lean `proposed_order_accounts`, `cap_fixed`] Every share is accounted for.

[AUDIT: property test] Over 15 random inputs of 50–3000 colours:
- the shares account to 100 %;
- every cluster's diameter is ≤ τ;
- every kept cluster is ≥ 0.05 %.

[AUDIT: comparison] On the photo-like image the palette now describes 86.3 % instead of 24.0 %, at about 130 ms instead of 31 ms. Five iterations were needed (see README).
