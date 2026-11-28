import { describe, expect, it } from "vitest";
import { getAnalysis, getSummaryCsv, saveAnalysis } from "@/adapters/supabase/analysis-repository";
import type { NewAnalysis } from "@/adapters/supabase/analysis-rows";
import { memorySupabase } from "./memory-supabase";

const input: NewAnalysis = {
  fileName: "a.png",
  format: "png",
  width: 3,
  height: 1,
  includeAlpha: false,
  topN: 10,
  uniqueColors: 2,
  colors: [
    { r: 1, g: 2, b: 3, count: 2, percent: 200 / 3 },
    { r: 4, g: 5, b: 6, count: 1, percent: 100 / 3 },
  ],
  summaryCsv: new Blob(["r,g,b,count,percent,hex_rgb\r\n"]),
};

describe("memorySupabase", () => {
  it("reads back what the repository saved", async () => {
    const { client, files } = memorySupabase();
    const id = await saveAnalysis(client, input);

    const analysis = await getAnalysis(client, id);
    expect(analysis).toMatchObject({ id, fileName: "a.png", width: 3, height: 1, totalPixels: 3, uniqueColors: 2 });
    expect(analysis!.colors.map((c) => c.count)).toEqual([2, 1]);
    expect(await (await getSummaryCsv(client, id))!.text()).toBe("r,g,b,count,percent,hex_rgb\r\n");
    expect(files.size).toBe(1);
  });

  it("returns null for an unknown id", async () => {
    const { client } = memorySupabase();
    await saveAnalysis(client, input);
    expect(await getAnalysis(client, crypto.randomUUID())).toBeNull();
  });

  it("fails the chosen call and leaves nothing behind", async () => {
    const { client, tables, files } = memorySupabase(["image_colors:insert"]);
    await expect(saveAnalysis(client, input)).rejects.toThrow("image_colors:insert failed");
    expect(tables.images).toEqual([]);
    expect(files.size).toBe(0);
  });
});
