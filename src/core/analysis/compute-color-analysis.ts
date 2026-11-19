// The computed colour analysis (#55, P-031): built from the image's colour
// list. Steps not implemented yet are listed as such and leave their parts
// empty, which the contract allows (docs/api/color-analysis.md).
import type { ImageFormat } from "../image-format";
import type { ColorAnalysis, InputKind } from "./color-analysis";
import { CONTRAST_MAX_CLUSTERS, CONTRAST_MIN_SHARE, contrastFinding, contrastPairs } from "./contrast";
import { computeGamutCoverage } from "./gamut-coverage";
import { fitHarmonies, HARMONY_C0, HARMONY_MAX_ERR, HARMONY_MIN_COVERAGE, HARMONY_MIN_SCORE } from "./harmonies";
import { CONTENT_MIN_DELTA_L, CONTENT_MIN_SHARE, DARK_MAX_L, DARK_MAX_SPREAD, DARK_MIN_SHARE, darkModeFinding } from "./ui-mode";
import { CLUSTER_TAU, clusterColors, filterShares, MAX_CLUSTERED, SHARE_FLOOR, SHARE_Z_MIN } from "./palette-clusters";
import type { ColorCount } from "./types";

/** PNG, GIF and BMP decode exactly; JPEG is lossy; WebP can be either. */
export function inputKindFor(format: ImageFormat | undefined): InputKind {
  if (format === "png" || format === "gif" || format === "bmp") return "png-lossless";
  if (format === "jpeg") return "jpeg-lossy";
  return "unknown";
}

export function computeColorAnalysis(colors: readonly ColorCount[], uniqueColors: number, format?: ImageFormat): ColorAnalysis {
  const { kept, removedShare } = filterShares(colors);
  const palette = clusterColors(kept);
  const contrast = contrastPairs(palette);
  const findings = [contrastFinding(contrast, palette), darkModeFinding(palette)].filter((f) => f !== undefined);
  return {
    schemaVersion: 1,
    status: "computed",
    inputKind: inputKindFor(format),
    // Every image is decoded as 8-bit sRGB (P-031 item 6).
    sourceProfile: "srgb",
    pipeline: [
      { step: "blend-snap", status: "not-implemented" },
      { step: "share-filter", status: "done", params: { floorPercent: SHARE_FLOOR, z: SHARE_Z_MIN }, removedShare },
      { step: "convert", status: "done" },
      kept.length
        ? { step: "cluster", status: "done", params: { tau: CLUSTER_TAU, linkage: "complete", maxColors: MAX_CLUSTERED } }
        : { step: "cluster", status: "skipped" },
      { step: "structures", status: "done", params: { c0: HARMONY_C0, maxErr: HARMONY_MAX_ERR, minCoverage: HARMONY_MIN_COVERAGE, minScore: HARMONY_MIN_SCORE } },
      contrast.length
        ? { step: "contrast", status: "done", params: { maxClusters: CONTRAST_MAX_CLUSTERS, minSharePercent: CONTRAST_MIN_SHARE } }
        : { step: "contrast", status: "skipped" },
      { step: "roles", status: "not-implemented" },
      {
        step: "findings",
        status: "done",
        params: { darkMinShare: DARK_MIN_SHARE, darkMaxL: DARK_MAX_L, darkMaxSpread: DARK_MAX_SPREAD, contentMinDeltaL: CONTENT_MIN_DELTA_L, contentMinShare: CONTENT_MIN_SHARE },
      },
    ],
    palette,
    structures: fitHarmonies(palette),
    contrast,
    findings,
    gamut: computeGamutCoverage(colors, uniqueColors),
  };
}
