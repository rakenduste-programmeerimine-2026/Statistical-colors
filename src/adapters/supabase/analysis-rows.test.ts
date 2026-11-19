import { describe, expect, it } from "vitest";
import type { ColorCount } from "@/core/analysis/types";
import type { Tables } from "@/lib/supabase/types";
import {
  isAnalysisId,
  reportPath,
  STORED_COLORS_MAX,
  toColorRows,
  toImageAnalysis,
  toImageInsert,
  type NewAnalysis,
} from "./analysis-rows";

const IMAGE_ID = "0b6c6f1e-3f5a-4c1e-9d3a-6f0e2b7c9a11";

const colors = (n: number, withAlpha = false): ColorCount[] =>
  Array.from({ length: n }, (_, i) => ({
    r: i % 256,
    g: Math.floor(i / 256) % 256,
    b: 7,
    ...(withAlpha ? { a: 200 } : {}),
    count: n - i,
    percent: 0.5,
  }));

const input = (over: Partial<NewAnalysis> = {}): NewAnalysis => ({
  fileName: "palette.bmp",
  format: "bmp",
  width: 4,
  height: 3,
  includeAlpha: false,
  topN: 10,
  uniqueColors: 2,
  colors: colors(2),
  ...over,
});

describe("isAnalysisId", () => {
  it.each([
    ["a lower-case UUID", IMAGE_ID, true],
    ["an upper-case UUID", IMAGE_ID.toUpperCase(), true],
    ["a stub id", "missing__0000000000000000", false],
    ["an empty string", "", false],
    ["a UUID with extra characters", `${IMAGE_ID}x`, false],
    ["a UUID one character short", IMAGE_ID.slice(0, -1), false],
    ["a UUID with a non-hex character", `g${IMAGE_ID.slice(1)}`, false],
  ])("%s → %s", (_label, id, expected) => {
    expect(isAnalysisId(id)).toBe(expected);
  });
});

it("puts the CSV in the owner's folder", () => {
  expect(reportPath("user-1", IMAGE_ID)).toBe(`user-1/${IMAGE_ID}.csv`);
});

it("maps the analysis to an images row", () => {
  expect(toImageInsert(input({ includeAlpha: true, topN: 5000 }))).toEqual({
    file_name: "palette.bmp",
    format: "bmp",
    width: 4,
    height: 3,
    unique_colors: 2,
    include_alpha: true,
    top_n: 5000,
  });
});

describe("toColorRows", () => {
  it.each([
    [0, 0],
    [1, 1],
    [STORED_COLORS_MAX, STORED_COLORS_MAX],
    [STORED_COLORS_MAX + 1, STORED_COLORS_MAX],
  ])("%i colours give %i rows", (n, rows) => {
    expect(toColorRows(IMAGE_ID, { colors: colors(n), includeAlpha: false })).toHaveLength(rows);
  });

  it("ranks the colours from 1 in the given order", () => {
    const rows = toColorRows(IMAGE_ID, { colors: colors(3), includeAlpha: false });
    expect(rows.map((r) => [r.rank, r.r, r.pixel_count])).toEqual([
      [1, 0, 3],
      [2, 1, 2],
      [3, 2, 1],
    ]);
    expect(rows.every((r) => r.image_id === IMAGE_ID)).toBe(true);
  });

  it("drops alpha when the analysis has none, even if a colour carries it", () => {
    const [row] = toColorRows(IMAGE_ID, { colors: colors(1, true), includeAlpha: false });
    expect(row.a).toBeNull();
  });

  it("keeps alpha when the analysis includes it", () => {
    const [row] = toColorRows(IMAGE_ID, { colors: colors(1, true), includeAlpha: true });
    expect(row.a).toBe(200);
  });
});

describe("toImageAnalysis", () => {
  const image = (over: Partial<Tables<"images">> = {}): Tables<"images"> => ({
    id: IMAGE_ID,
    owner_id: "user-1",
    batch_id: "batch",
    file_name: "palette.bmp",
    format: "bmp",
    width: 4,
    height: 3,
    total_pixels: 12,
    unique_colors: 2,
    include_alpha: false,
    top_n: 10,
    color_space: "srgb",
    summary_csv_path: null,
    created_at: "2026-11-18T00:00:00Z",
    ...over,
  });
  const row = (rank: number, over: Partial<Tables<"image_colors">> = {}): Tables<"image_colors"> => ({
    image_id: IMAGE_ID,
    rank,
    r: rank,
    g: 0,
    b: 0,
    a: null,
    hex: null,
    pixel_count: 13 - rank,
    percent: 50,
    user_flagged: false,
    user_note: null,
    ...over,
  });

  it("maps the image fields", () => {
    const a = toImageAnalysis(image(), []);
    expect(a).toEqual({
      id: IMAGE_ID,
      fileName: "palette.bmp",
      width: 4,
      height: 3,
      totalPixels: 12,
      uniqueColors: 2,
      includeAlpha: false,
      format: "bmp",
      topN: 10,
      colors: [],
    });
  });

  it("leaves out a stored format the app cannot decode", () => {
    expect(toImageAnalysis(image({ format: "tiff" }), [])).not.toHaveProperty("format");
  });

  it("orders the colours by rank", () => {
    const a = toImageAnalysis(image(), [row(2), row(1)]);
    expect(a.colors.map((c) => c.r)).toEqual([1, 2]);
  });

  it("leaves alpha out unless the analysis includes it", () => {
    expect(toImageAnalysis(image(), [row(1, { a: 9 })]).colors[0]).not.toHaveProperty("a");
    expect(toImageAnalysis(image({ include_alpha: true }), [row(1, { a: 9 })]).colors[0].a).toBe(9);
  });

  it("turns numeric and bigint values sent as strings into numbers", () => {
    const loose = { pixel_count: "12", percent: "33.3333333333" } as unknown as Partial<Tables<"image_colors">>;
    const [c] = toImageAnalysis(image(), [row(1, loose)]).colors;
    expect(c.count).toBe(12);
    expect(c.percent).toBeCloseTo(33.3333333333, 10);
  });

  it("falls back to width × height when total_pixels is missing", () => {
    expect(toImageAnalysis(image({ total_pixels: null }), []).totalPixels).toBe(12);
  });
});
