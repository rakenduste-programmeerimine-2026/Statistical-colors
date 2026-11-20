import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import {
  getAnalysis,
  getSummaryCsv,
  saveAnalysis,
  type AnalysisClient,
} from "@/adapters/supabase/analysis-repository";
import type { NewAnalysis } from "@/adapters/supabase/analysis-rows";
import type { Database } from "@/lib/supabase/database.types";

// Runs only against LOCAL Supabase (`npx supabase start`): the hosted project
// is production (README "Deploy"). Values come from .env.local.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: the suite is skipped below
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\/?$/.test(url) && key !== "";

if (!isLocal) {
  console.warn(
    "Skipping Supabase integration tests: NEXT_PUBLIC_SUPABASE_URL is not a local Supabase " +
      "(run `npx supabase start` and put its values in .env.local).",
  );
}

const newClient = (): AnalysisClient =>
  createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// 853 × 853 pixels, 1205 colours whose counts add up to every pixel.
const WIDTH = 853;
const TOTAL = WIDTH * WIDTH;
const counts = Array.from({ length: 1205 }, (_, i) => 1205 - i);
counts[0] += TOTAL - counts.reduce((s, c) => s + c, 0);
const colors = counts.map((count, i) => ({
  r: i % 256,
  g: Math.floor(i / 256),
  b: 9,
  count,
  percent: (count / TOTAL) * 100,
}));

const analysis = (over: Partial<NewAnalysis> = {}): NewAnalysis => ({
  fileName: "integration.png",
  format: "png",
  width: WIDTH,
  height: WIDTH,
  includeAlpha: false,
  topN: 25,
  uniqueColors: colors.length,
  colors,
  // Untyped on purpose: the repository must upload it as text/csv.
  summaryCsv: new Blob(["r,g,b,count,percent,hex_rgb\r\n"]),
  ...over,
});

describe.skipIf(!isLocal)("analysis repository against local Supabase", () => {
  // Two anonymous users for the whole run (sign-ins are rate limited per IP).
  const owner = newClient();
  const stranger = newClient();
  const saved: string[] = [];

  afterAll(async () => {
    for (const id of saved) {
      const { data } = await owner.from("images").select("summary_csv_path").eq("id", id).maybeSingle();
      if (data?.summary_csv_path) await owner.storage.from("reports").remove([data.summary_csv_path]);
      await owner.from("images").delete().eq("id", id);
    }
    await owner.auth.signOut();
    await stranger.auth.signOut();
  });

  it("saves an analysis and reads it back, colours in order", async () => {
    const id = await saveAnalysis(owner, analysis());
    saved.push(id);

    const a = await getAnalysis(owner, id);
    expect(a).toMatchObject({ id, fileName: "integration.png", topN: 25, totalPixels: TOTAL });
    // More than one page (max_rows 1000) and more than top_n.
    expect(a?.colors).toHaveLength(1205);
    expect(a?.colors.map((c) => c.count)).toEqual(counts);
    expect(a?.colors[0]).toEqual({ r: 0, g: 0, b: 9, count: counts[0], percent: expect.closeTo(colors[0].percent, 9) });

    const csv = await getSummaryCsv(owner, id);
    expect(await csv?.text()).toBe("r,g,b,count,percent,hex_rgb\r\n");
  });

  it("hides the analysis from another anonymous user", async () => {
    const id = saved[0];
    expect(id).toBeDefined();

    const { data, error } = await stranger.auth.signInAnonymously();
    expect(error).toBeNull();
    expect(data.user?.id).toBeDefined();

    expect(await getAnalysis(stranger, id)).toBeNull();
    expect(await getSummaryCsv(stranger, id)).toBeNull();
    // Control: the owner still sees it, so the nulls above come from RLS.
    expect(await getAnalysis(owner, id)).not.toBeNull();
  });

  it("removes the image and the CSV when the colours cannot be saved", async () => {
    const { count: before } = await owner.from("images").select("id", { count: "exact", head: true });
    // The same colour twice breaks image_colors_color_unique.
    const duplicate = [colors[0], { ...colors[0], count: 1 }];
    await expect(saveAnalysis(owner, analysis({ colors: duplicate, uniqueColors: 2 }))).rejects.toThrow(
      "Saving the colours failed",
    );

    const { count: after } = await owner.from("images").select("id", { count: "exact", head: true });
    expect(after).toBe(before);
    const { data: userData } = await owner.auth.getUser();
    const { data: files } = await owner.storage.from("reports").list(userData.user?.id);
    const ids = new Set(saved);
    expect((files ?? []).filter((f) => !ids.has(f.name.replace(/\.csv$/, "")))).toEqual([]);
  });
});
