import { AnalysisFailedError, InvalidImageError, type AnalysisService } from "@/core/analysis/analysis-service";
import type { AnalysisOptions, ColorCount, CsvFile, CsvKind, ImageAnalysis } from "@/core/analysis/types";
import { pixelsCsv, summaryCsv } from "./stub-csv";

// PLACEHOLDER(#11, #12, #13, #39, #40): decoding, counting, saving and reading
// belong to the backend and database. This stub never reads the pixels: it generates a
// believable, deterministic result from the file name and size, and marks it
// `simulated` so the UI can say so.

const STORAGE_PREFIX = "stub-analysis:";
const MAX_SIDE = 96;
const MAX_UNIQUE = 300;

/** Small seeded PRNG (mulberry32), so the same file always gives the same fake result. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of a string. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Same idea as the original's `secure_filename(name)__token`. */
function makeId(fileName: string, random: () => number): string {
  const stem = fileName.replace(/\.[^.]*$/, "").replace(/[^A-Za-z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "") || "image";
  const token = Array.from({ length: 16 }, () => Math.floor(random() * 16).toString(16)).join("");
  return `${stem}__${token}`;
}

export function generateAnalysis(id: string, file: Pick<File, "name" | "size">, options: AnalysisOptions): ImageAnalysis {
  const random = prng(hash(`${file.name}:${file.size}:${options.includeAlpha}`));
  const width = 16 + Math.floor(random() * (MAX_SIDE - 15));
  const height = 16 + Math.floor(random() * (MAX_SIDE - 15));
  const totalPixels = width * height;
  const unique = 1 + Math.floor(random() * Math.min(totalPixels, MAX_UNIQUE));

  const seen = new Set<string>();
  const colors: ColorCount[] = [];
  while (colors.length < unique) {
    const c: ColorCount = {
      r: Math.floor(random() * 256),
      g: Math.floor(random() * 256),
      b: Math.floor(random() * 256),
      count: 1,
      percent: 0,
    };
    if (options.includeAlpha) c.a = random() < 0.8 ? 255 : Math.floor(random() * 256);
    const key = `${c.r},${c.g},${c.b},${c.a ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    colors.push(c);
  }

  // Every colour gets at least one pixel; the rest go out by skewed random weights.
  const weights = colors.map(() => random() ** 3);
  const sum = weights.reduce((a, b) => a + b, 0);
  let left = totalPixels - unique;
  colors.forEach((c, i) => {
    const extra = i === colors.length - 1 ? left : Math.min(left, Math.floor(((totalPixels - unique) * weights[i]) / sum));
    c.count += extra;
    left -= extra;
  });
  // Stable sort keeps first-seen order on ties, like Python's Counter.most_common().
  colors.sort((a, b) => b.count - a.count);
  for (const c of colors) c.percent = (c.count / totalPixels) * 100;

  return {
    id,
    fileName: file.name,
    width,
    height,
    totalPixels,
    uniqueColors: unique,
    includeAlpha: options.includeAlpha,
    topN: options.topN,
    colors,
    simulated: true,
  };
}

/** Stub adapter. Keeps results in memory and, when given, in sessionStorage so a reload still finds them. */
export class StubAnalysisService implements AnalysisService {
  private readonly results = new Map<string, ImageAnalysis>();

  constructor(
    private readonly storage?: Pick<Storage, "getItem" | "setItem">,
    private readonly random: () => number = Math.random,
  ) {}

  async analyze(file: File, options: AnalysisOptions): Promise<string> {
    if (file.size === 0) throw new InvalidImageError();
    try {
      const id = makeId(file.name, this.random);
      const analysis = generateAnalysis(id, file, options);
      this.results.set(id, analysis);
      this.storage?.setItem(STORAGE_PREFIX + id, JSON.stringify(analysis));
      return id;
    } catch (error) {
      throw new AnalysisFailedError(error instanceof Error ? error.message : String(error));
    }
  }

  async getAnalysis(id: string): Promise<ImageAnalysis | null> {
    const cached = this.results.get(id);
    if (cached) return cached;
    try {
      const raw = this.storage?.getItem(STORAGE_PREFIX + id);
      return raw ? (JSON.parse(raw) as ImageAnalysis) : null;
    } catch {
      return null;
    }
  }

  async getCsv(id: string, kind: CsvKind): Promise<CsvFile | null> {
    const analysis = await this.getAnalysis(id);
    if (!analysis) return null;
    const text = kind === "pixels" ? pixelsCsv(analysis) : summaryCsv(analysis);
    const suffix = kind === "pixels" ? "pixels" : "color_summary";
    return { fileName: `${id}_${suffix}.csv`, content: new Blob([text], { type: "text/csv;charset=utf-8" }) };
  }
}
