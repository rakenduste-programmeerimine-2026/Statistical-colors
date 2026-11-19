import { AnalysisFailedError, InvalidImageError, type AnalysisService } from "@/core/analysis/analysis-service";
import type { AnalysisOptions, CsvFile, CsvKind, ImageAnalysis } from "@/core/analysis/types";
import { browserPixelDecoder } from "@/core/browser-pixel-decoder";
import { countColors } from "@/core/count-colors";
import { decodeImage, ExactDecodingUnsupportedError, type DecodedImage, type PixelDecoder } from "@/core/decode-image";
import { buildPixelsCsv } from "@/core/pixels-csv";
import { buildSummaryCsv } from "@/core/summary-csv";
import { computeColorAnalysis } from "@/core/analysis/compute-color-analysis";
import { assignClusterIds } from "@/core/analysis/palette-clusters";
import { getAnalysis, getSummaryCsv, saveAnalysis, type AnalysisClient } from "./analysis-repository";
import { REPORT_MAX_BYTES } from "./analysis-rows";

interface KeptPixels {
  id: string;
  image: DecodedImage;
  includeAlpha: boolean;
}

/**
 * The real analysis adapter (#40): decodes and counts in the browser, then
 * stores the result in Supabase and reads it back from there.
 */
export class SupabaseAnalysisService implements AnalysisService {
  // PLACEHOLDER(#38): the pixel CSV is built from the pixels of the latest
  // analysis only, kept in memory. Any other id (an older analysis, or after
  // a reload) gets null until the pixel CSV is stored.
  private kept: KeptPixels | null = null;
  private client: AnalysisClient | undefined;

  constructor(
    /** Called on first use, so no client is created while rendering on the server. */
    private readonly createClient: () => AnalysisClient,
    private readonly decoder: PixelDecoder = browserPixelDecoder,
    private readonly pause?: () => Promise<void>,
  ) {}

  private supabase(): AnalysisClient {
    return (this.client ??= this.createClient());
  }

  async analyze(file: File, options: AnalysisOptions): Promise<string> {
    // Let go of the previous image before decoding the next one.
    this.kept = null;
    let image: DecodedImage;
    try {
      image = await decodeImage(file, this.decoder);
    } catch (error) {
      // The file is fine, but this browser cannot read it exactly.
      if (error instanceof ExactDecodingUnsupportedError) throw new AnalysisFailedError(error.message);
      throw new InvalidImageError();
    }
    try {
      const { includeAlpha, topN } = options;
      const { uniqueColors, colors } = countColors(image.pixels, image.width, image.height, includeAlpha);
      const id = await saveAnalysis(this.supabase(), {
        fileName: file.name,
        format: image.format,
        width: image.width,
        height: image.height,
        includeAlpha,
        topN,
        uniqueColors,
        colors,
        summaryCsv: buildSummaryCsv(colors, includeAlpha, REPORT_MAX_BYTES) ?? undefined,
      });
      this.kept = { id, image, includeAlpha };
      return id;
    } catch (error) {
      throw new AnalysisFailedError(error instanceof Error ? error.message : String(error));
    }
  }

  async getAnalysis(id: string): Promise<ImageAnalysis | null> {
    const analysis = await getAnalysis(this.supabase(), id);
    if (!analysis) return null;
    const colorAnalysis = computeColorAnalysis(analysis.colors, analysis.uniqueColors, analysis.format);
    const colors = assignClusterIds(analysis.colors, colorAnalysis.palette);
    // Clusters are computed; artefact chances are not sent yet (#29, #63).
    return { ...analysis, colors, rowDataStatus: "computed", colorAnalysis };
  }

  async getCsv(id: string, kind: CsvKind): Promise<CsvFile | null> {
    if (kind === "summary") {
      const content = await getSummaryCsv(this.supabase(), id);
      return content && { fileName: `${id}_color_summary.csv`, content };
    }
    if (this.kept?.id !== id) return null;
    const { image, includeAlpha } = this.kept;
    const content = await buildPixelsCsv(image.pixels, image.width, image.height, includeAlpha, this.pause);
    return { fileName: `${id}_pixels.csv`, content };
  }
}
