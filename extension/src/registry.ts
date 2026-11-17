import { D1 } from "./approaches/d1-matte.ts";
import { D2 } from "./approaches/d2-snap.ts";
import { F1 } from "./approaches/f1-fit.ts";
import { K1 } from "./approaches/k1-hires.ts";
import { S1 } from "./approaches/s1-layout.ts";
import { S2 } from "./approaches/s2-scene.ts";
import { S3 } from "./approaches/s3-pdf.ts";
import { COMBINATIONS } from "./core/combos.ts";
import type { Registry } from "./core/pipeline.ts";

/**
 * The recovery approaches and combination steps the extension offers (#45).
 * Order matters only for sharing: native-scale shots first, re-scaling last.
 */
export const REGISTRY: Registry = { approaches: [S2, D1, S1, K1, S3, D2, F1], combinations: COMBINATIONS };

/** One-line hints for the popup. */
export const HINTS: Record<string, string> = {
  S2: "editable vectors and text",
  D1: "3 extra shots",
  D2: "declared colours only",
  F1: "canvas content; slow",
  K1: "zoomed raster",
  S1: "browser's layout record",
  S3: "",
};

/** The popup's quick choices. */
export const PRESETS: [label: string, ids: string[]][] = [
  ["No debugger", ["S2", "D1", "D2", "F1"]],
  ["All seven", ["S2", "D1", "S1", "K1", "S3", "D2", "F1"]],
  ["None", []],
];
