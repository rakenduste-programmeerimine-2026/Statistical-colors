import { formatHex } from "@/core/analysis/format";
import type { ImageAnalysis } from "@/core/analysis/types";

// PLACEHOLDER(#14, #38): CSV export belongs to the backend. These builders only
// reproduce the original Flask format so the download buttons work on stub data.

/** The original used Python's csv "excel" dialect: comma separated, CRLF line endings. */
const toCsv = (rows: (string | number)[][]) => rows.map((r) => r.join(",")).join("\r\n") + "\r\n";

/** Header `r,g,b,(a),count,percent,hex_rgb|hex_rgba`, most frequent first, percent with 10 decimals. */
export function summaryCsv(analysis: ImageAnalysis): string {
  const header = analysis.includeAlpha
    ? ["r", "g", "b", "a", "count", "percent", "hex_rgba"]
    : ["r", "g", "b", "count", "percent", "hex_rgb"];
  const rows = analysis.colors.map((c) => [
    c.r,
    c.g,
    c.b,
    ...(analysis.includeAlpha ? [c.a ?? 255] : []),
    c.count,
    c.percent.toFixed(10),
    formatHex(analysis.includeAlpha ? { ...c, a: c.a ?? 255 } : { r: c.r, g: c.g, b: c.b }),
  ]);
  return toCsv([header, ...rows]);
}

/**
 * Header `x,y,r,g,b,(a)`, one row per pixel, row by row. The stub has no real
 * pixels, so it lays the colours out in order of frequency.
 */
export function pixelsCsv(analysis: ImageAnalysis): string {
  const header = analysis.includeAlpha ? ["x", "y", "r", "g", "b", "a"] : ["x", "y", "r", "g", "b"];
  const rows: (string | number)[][] = [header];
  let i = 0;
  for (const c of analysis.colors) {
    for (let n = 0; n < c.count; n++, i++) {
      const x = i % analysis.width;
      const y = Math.floor(i / analysis.width);
      rows.push(analysis.includeAlpha ? [x, y, c.r, c.g, c.b, c.a ?? 255] : [x, y, c.r, c.g, c.b]);
    }
  }
  return toCsv(rows);
}
