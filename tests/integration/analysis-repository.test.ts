import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import {
  getAnalysis,
  getSummaryCsv,
  saveAnalysis,
  type AnalysisClient,
} from "@/adapters/supabase/analysis-repository";
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

  const colors = Array.from({ length: 1205 }, (_, i) => ({
    r: i % 256,
    g: Math.floor(i / 256),
    b: 9,
    count: 1205 - i,
    percent: ((1205 - i) / 727_215) * 100,
  }));

  it("saves an analysis and reads it back, colours in order", async () => {
    const id = await saveAnalysis(owner, {
      fileName: "integration.png",
      format: "png",
      width: 853,
      height: 853,
      includeAlpha: false,
      topN: 25,
      uniqueColors: colors.length,
      colors,
      summaryCsv: new Blob(["r,g,b,count,percent,hex_rgb\r\n"], { type: "text/csv" }),
    });
    saved.push(id);

    const a = await getAnalysis(owner, id);
    expect(a).toMatchObject({ id, fileName: "integration.png", topN: 25, totalPixels: 853 * 853 });
    // More than one page (max_rows 1000) and more than top_n.
    expect(a?.colors).toHaveLength(1205);
    expect(a?.colors[0]).toEqual({ r: 0, g: 0, b: 9, count: 1205, percent: expect.closeTo(colors[0].percent, 9) });

    const csv = await getSummaryCsv(owner, id);
    expect(await csv?.text()).toBe("r,g,b,count,percent,hex_rgb\r\n");
  });

  it("hides the analysis from another anonymous user", async () => {
    const id = saved[0];
    await stranger.auth.signInAnonymously();
    expect(await getAnalysis(stranger, id)).toBeNull();
    expect(await getSummaryCsv(stranger, id)).toBeNull();
  });
});
