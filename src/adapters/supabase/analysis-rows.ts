import type { ColorCount, ImageAnalysis } from "@/core/analysis/types";
import { TOP_N_MAX } from "@/core/analysis/upload-rules";
import type { ImageFormat } from "@/core/image-format";
import type { ImageColorInsert, ImageInsert, Tables } from "@/lib/supabase/types";

/**
 * Pure mapping between the app's analysis types and the database rows
 * (supabase/migrations). No I/O, so it is unit tested on its own.
 */

/** Colours stored per image in image_colors, most frequent first (#80). */
export const STORED_COLORS_MAX = TOP_N_MAX;

/** Private Storage bucket for the full colour CSV (#8). */
export const REPORTS_BUCKET = "reports";

/** File size limit of the reports bucket (50 MB). Larger CSVs are not stored. */
export const REPORT_MAX_BYTES = 50 * 1024 * 1024;

/** What the analysis pipeline hands over for saving. */
export interface NewAnalysis {
  fileName: string;
  format: ImageFormat;
  width: number;
  height: number;
  includeAlpha: boolean;
  /** Top N chosen on upload (1–5000). Only the default display count. */
  topN: number;
  uniqueColors: number;
  /** Every unique colour, most frequent first (countColors). The first 5000 are stored. */
  colors: readonly ColorCount[];
  /** Summary CSV of every colour (#14). Skipped when larger than REPORT_MAX_BYTES. */
  summaryCsv?: Blob;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stored analyses have UUID ids. Anything else (e.g. stub ids) is unknown. */
export function isAnalysisId(id: string): boolean {
  return UUID.test(id);
}

/** Storage path of an image's CSV: the owner's folder, required by the bucket policies. */
export function reportPath(ownerId: string, imageId: string): string {
  return `${ownerId}/${imageId}.csv`;
}

export function toImageInsert(input: NewAnalysis): ImageInsert {
  return {
    file_name: input.fileName,
    format: input.format,
    width: input.width,
    height: input.height,
    unique_colors: input.uniqueColors,
    include_alpha: input.includeAlpha,
    top_n: input.topN,
  };
}

/** The first STORED_COLORS_MAX colours as rows, rank 1 = most frequent. */
export function toColorRows(
  imageId: string,
  input: Pick<NewAnalysis, "colors" | "includeAlpha">,
): ImageColorInsert[] {
  return input.colors.slice(0, STORED_COLORS_MAX).map((c, i) => ({
    image_id: imageId,
    rank: i + 1,
    r: c.r,
    g: c.g,
    b: c.b,
    a: input.includeAlpha ? (c.a ?? null) : null,
    pixel_count: c.count,
    percent: c.percent,
  }));
}

/**
 * A stored image and its colour rows (any order) as the results page needs
 * them. Holds at most 5000 colours; the full list is the summary CSV (#69, #73).
 */
/** The colour columns getAnalysis reads. */
export type StoredColor = Pick<
  Tables<"image_colors">,
  "rank" | "r" | "g" | "b" | "a" | "pixel_count" | "percent"
>;

export function toImageAnalysis(
  image: Tables<"images">,
  colors: readonly StoredColor[],
): ImageAnalysis {
  return {
    id: image.id,
    fileName: image.file_name,
    width: image.width,
    height: image.height,
    totalPixels: Number(image.total_pixels ?? image.width * image.height),
    uniqueColors: image.unique_colors,
    includeAlpha: image.include_alpha,
    topN: image.top_n,
    colors: [...colors]
      .sort((x, y) => x.rank - y.rank)
      .map((c) => ({
        r: c.r,
        g: c.g,
        b: c.b,
        ...(image.include_alpha && c.a !== null ? { a: c.a } : {}),
        count: Number(c.pixel_count),
        percent: Number(c.percent),
      })),
  };
}
