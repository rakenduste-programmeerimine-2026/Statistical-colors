import type { AnalysisService } from "@/core/analysis/analysis-service";
import type { CsvKind, ImageAnalysis } from "@/core/analysis/types";
import { generateColorAnalysis } from "../simulated/color-analysis";
import { simulateColorRows } from "../simulated/color-rows";
import { hash, prng } from "../simulated/random";

/**
 * The built-in example: `palette (1).bmp` and the results the original Python
 * app computed for it in the earlier colour picker study (P-020). Real data,
 * labelled as an example, and independent of the backend. `palette-analysis.json`
 * was generated once from the original app's JSON and summary CSV (P-021 item 6).
 */
export const DEMO_ID = "demo";

const CSV_URLS: Record<CsvKind, string> = {
  pixels: "/demo/palette_pixels.csv",
  summary: "/demo/palette_summary.csv",
};
const CSV_NAMES: Record<CsvKind, string> = {
  pixels: `${DEMO_ID}_pixels.csv`,
  summary: `${DEMO_ID}_color_summary.csv`,
};

async function loadDemo(): Promise<ImageAnalysis> {
  const data = await import("./palette-analysis.json");
  const analysis = structuredClone(data.default) as ImageAnalysis;
  // The study's colours are real; the colour analysis is simulated and labelled so (P-031 item 10).
  // PLACEHOLDER(#55): replace with the server's analysis of the demo image once it exists.
  const colorAnalysis = generateColorAnalysis(prng(hash(`${DEMO_ID}:color`)));
  // PLACEHOLDER(#69): the per-colour artefact chance and cluster are simulated too; the counts stay real (P-033 item 1).
  const colors = simulateColorRows(analysis.colors, colorAnalysis, prng(hash(`${DEMO_ID}:rows`)));
  return { ...analysis, colors, rowDataStatus: "simulated", colorAnalysis };
}

/** Wraps any analysis service so the id `demo` serves the example. Real ids never equal it. */
export function withDemo(
  inner: AnalysisService,
  fetchFile: typeof fetch = (...args) => fetch(...args),
): AnalysisService {
  return {
    analyze: (file, options) => inner.analyze(file, options),
    getAnalysis: (id) => (id === DEMO_ID ? loadDemo() : inner.getAnalysis(id)),
    async getCsv(id, kind) {
      if (id !== DEMO_ID) return inner.getCsv(id, kind);
      try {
        const response = await fetchFile(CSV_URLS[kind]);
        if (!response.ok) return null;
        return { fileName: CSV_NAMES[kind], content: await response.blob() };
      } catch {
        return null;
      }
    },
  };
}
