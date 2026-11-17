import type { AnalysisOptions, CsvFile, CsvKind, ImageAnalysis } from "./types";

/**
 * Port: everything the UI needs from the analysis backend.
 *
 * Decoding (#11), colour counting (#12), saving (#13), reading (#39) and
 * CSV export (#14, #38) are owned by the backend and database. Until they exist, the UI runs on a
 * stub adapter. The real adapter (#40) must pass the same contract tests
 * (`analysis-service.contract.ts`).
 */
export interface AnalysisService {
  /**
   * Analyses one image and stores the result.
   * @returns the id of the stored analysis.
   * @throws InvalidImageError if the file is not a readable image.
   * @throws AnalysisFailedError for any other failure.
   */
  analyze(file: File, options: AnalysisOptions): Promise<string>;

  /** A stored analysis, or null if the id is unknown. */
  getAnalysis(id: string): Promise<ImageAnalysis | null>;

  /** The pixel-by-pixel or colour summary CSV, or null if the id is unknown. */
  getCsv(id: string, kind: CsvKind): Promise<CsvFile | null>;
}

export class InvalidImageError extends Error {
  constructor() {
    super("The file is not a valid image.");
    this.name = "InvalidImageError";
  }
}

export class AnalysisFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisFailedError";
  }
}
