// The computed colour analysis (#55, P-031): built from the image's colour
// list. Steps not implemented yet are listed as such and leave their parts
// empty, which the contract allows (docs/api/color-analysis.md).
import type { ImageFormat } from "../image-format";
import type { ColorAnalysis, InputKind } from "./color-analysis";
import { computeGamutCoverage } from "./gamut-coverage";
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
      { step: "structures", status: "not-implemented" },
      { step: "contrast", status: "not-implemented" },
      { step: "roles", status: "not-implemented" },
      { step: "findings", status: "not-implemented" },
    ],
    palette,
    structures: [],
    findings: [],
    gamut: computeGamutCoverage(colors, uniqueColors),
  };
}
