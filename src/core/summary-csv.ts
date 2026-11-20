import { formatHex } from "@/core/analysis/format";
import type { ColorCount } from "@/core/analysis/types";

/** MIME type the reports bucket allows (supabase/migrations, allowed_mime_types). */
export const SUMMARY_CSV_TYPE = "text/csv";

/** Rows joined into one string at a time; the strings become Blob parts. */
export const SUMMARY_CSV_CHUNK_ROWS = 4096;

/** The original used Python's csv "excel" dialect: comma separated, CRLF line endings. */
const EOL = "\r\n";

function row(c: ColorCount, includeAlpha: boolean): string {
  if (!includeAlpha) {
    return `${c.r},${c.g},${c.b},${c.count},${c.percent.toFixed(10)},${formatHex({ r: c.r, g: c.g, b: c.b })}`;
  }
  const a = c.a ?? 255;
  return `${c.r},${c.g},${c.b},${a},${c.count},${c.percent.toFixed(10)},${formatHex({ r: c.r, g: c.g, b: c.b, a })}`;
}

/**
 * Summary CSV of every colour given, in the given order (#14). Header
 * `r,g,b,count,percent,hex_rgb` or `r,g,b,a,count,percent,hex_rgba`, percent
 * with 10 decimals. Built in chunks of SUMMARY_CSV_CHUNK_ROWS rows so a
 * million colours never become one huge string.
 *
 * @param maxBytes optional size limit (e.g. REPORT_MAX_BYTES). The output is
 *   ASCII, so string length equals bytes.
 * @returns the CSV, or null as soon as it would exceed maxBytes
 */
export function buildSummaryCsv(
  colors: readonly ColorCount[],
  includeAlpha: boolean,
  maxBytes = Infinity,
): Blob | null {
  const header = (includeAlpha ? "r,g,b,a,count,percent,hex_rgba" : "r,g,b,count,percent,hex_rgb") + EOL;
  let bytes = header.length;
  if (bytes > maxBytes) return null;
  const parts: string[] = [header];
  for (let start = 0; start < colors.length; start += SUMMARY_CSV_CHUNK_ROWS) {
    const end = Math.min(start + SUMMARY_CSV_CHUNK_ROWS, colors.length);
    const rows: string[] = [];
    for (let i = start; i < end; i++) {
      const line = row(colors[i], includeAlpha) + EOL;
      bytes += line.length;
      if (bytes > maxBytes) return null;
      rows.push(line);
    }
    parts.push(rows.join(""));
  }
  return new Blob(parts, { type: SUMMARY_CSV_TYPE });
}
