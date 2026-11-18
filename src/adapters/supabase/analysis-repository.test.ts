import { describe, expect, it, vi } from "vitest";
import type { ColorCount } from "@/core/analysis/types";
import { getAnalysis, getSummaryCsv, saveAnalysis, type AnalysisClient } from "./analysis-repository";
import { REPORT_MAX_BYTES, STORED_COLORS_MAX, type NewAnalysis } from "./analysis-rows";

const IMAGE_ID = "0b6c6f1e-3f5a-4c1e-9d3a-6f0e2b7c9a11";

type Result = { data?: unknown; error: { message: string } | null };
interface Call {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  payload?: unknown;
  filters: [string, unknown][];
}
interface Builder extends PromiseLike<Result> {
  insert(payload: unknown): Builder;
  update(payload: unknown): Builder;
  delete(): Builder;
  select(columns?: string): Builder;
  eq(column: string, value: unknown): Builder;
  gte(column: string, value: number): Builder;
  lte(column: string, value: number): Builder;
  order(column: string): Builder;
  single(): Promise<Result>;
  maybeSingle(): Promise<Result>;
}

/** Just enough of the Supabase client to record what the repository does. */
function fakeSupabase(
  o: {
    session?: string;
    insertImage?: Result;
    insertColors?: Result;
    update?: Result;
    upload?: Result;
    image?: Result;
    colorsError?: Result["error"];
    download?: Result;
  } = {},
) {
  const calls: Call[] = [];
  const storage: { op: string; arg: unknown }[] = [];

  const filter = (call: Call, name: string) => call.filters.find(([c]) => c === name)?.[1] as number;
  const resolve = (call: Call): Result => {
    const key = `${call.table}:${call.op}`;
    if (key === "images:insert") return o.insertImage ?? { data: { id: IMAGE_ID }, error: null };
    if (key === "image_colors:insert") return o.insertColors ?? { error: null };
    if (key === "images:update") return o.update ?? { error: null };
    if (key === "images:delete") return { error: null };
    if (key === "images:select") return o.image ?? { data: null, error: null };
    if (key === "image_colors:select") {
      if (o.colorsError) return { data: null, error: o.colorsError };
      const lo = filter(call, "rank>=");
      const hi = filter(call, "rank<=");
      const data = Array.from({ length: hi - lo + 1 }, (_, i) => ({
        rank: lo + i, r: 0, g: 0, b: 0, a: null, pixel_count: 1, percent: 0.04,
      }));
      return { data, error: null };
    }
    throw new Error(`unexpected ${key}`);
  };

  const from = (table: string): Builder => {
    const call: Call = { table, op: "select", filters: [] };
    calls.push(call);
    const b: Builder = {
      insert: (p) => ((call.op = "insert"), (call.payload = p), b),
      update: (p) => ((call.op = "update"), (call.payload = p), b),
      delete: () => ((call.op = "delete"), b),
      select: () => b,
      eq: (c, v) => (call.filters.push([c, v]), b),
      gte: (c, v) => (call.filters.push([`${c}>=`, v]), b),
      lte: (c, v) => (call.filters.push([`${c}<=`, v]), b),
      order: () => b,
      single: async () => resolve(call),
      maybeSingle: async () => resolve(call),
      then: (ok, fail) => Promise.resolve(resolve(call)).then(ok, fail),
    };
    return b;
  };

  const auth = {
    getClaims: vi.fn(async () => ({ data: o.session ? { claims: { sub: o.session } } : null, error: null })),
    signInAnonymously: vi.fn(async () => ({ data: { user: { id: "anon-1" } }, error: null })),
  };
  const bucket = {
    upload: async (path: string) => (storage.push({ op: "upload", arg: path }), o.upload ?? { error: null }),
    remove: async (paths: string[]) => (storage.push({ op: "remove", arg: paths }), { error: null }),
    download: async (path: string) => (
      storage.push({ op: "download", arg: path }), o.download ?? { data: new Blob(["r,g,b"]), error: null }
    ),
  };
  const client = { auth, from, storage: { from: () => bucket } } as unknown as AnalysisClient;
  const ops = () => calls.map((c) => `${c.table}:${c.op}`);
  return { client, calls, storage, auth, ops };
}

const colors = (n: number): ColorCount[] =>
  Array.from({ length: n }, (_, i) => ({ r: i % 256, g: 0, b: 0, count: n - i, percent: 1 }));

const analysis = (over: Partial<NewAnalysis> = {}): NewAnalysis => ({
  fileName: "a.png",
  format: "png",
  width: 2,
  height: 2,
  includeAlpha: false,
  topN: 10,
  uniqueColors: 2,
  colors: colors(2),
  summaryCsv: new Blob(["r,g,b,count,percent,hex_rgb\r\n"]),
  ...over,
});

describe("saveAnalysis", () => {
  it("signs in, saves image and colours, uploads the CSV and records its path", async () => {
    const f = fakeSupabase();
    await expect(saveAnalysis(f.client, analysis())).resolves.toBe(IMAGE_ID);

    expect(f.auth.signInAnonymously).toHaveBeenCalledOnce();
    expect(f.ops()).toEqual(["images:insert", "image_colors:insert", "images:update"]);
    expect(f.storage).toEqual([{ op: "upload", arg: `anon-1/${IMAGE_ID}.csv` }]);
    expect(f.calls[2].payload).toEqual({ summary_csv_path: `anon-1/${IMAGE_ID}.csv` });
  });

  it("reuses an existing session", async () => {
    const f = fakeSupabase({ session: "user-7" });
    await saveAnalysis(f.client, analysis());
    expect(f.auth.signInAnonymously).not.toHaveBeenCalled();
    expect(f.storage[0].arg).toBe(`user-7/${IMAGE_ID}.csv`);
  });

  it("inserts at most 5000 colours in one request", async () => {
    const f = fakeSupabase();
    await saveAnalysis(f.client, analysis({ colors: colors(STORED_COLORS_MAX + 1), summaryCsv: undefined }));
    const inserts = f.calls.filter((c) => c.table === "image_colors");
    expect(inserts.map((c) => (c.payload as unknown[]).length)).toEqual([STORED_COLORS_MAX]);
  });

  it("sends no colour request when there are no colours", async () => {
    const f = fakeSupabase();
    await saveAnalysis(f.client, analysis({ colors: [], summaryCsv: undefined }));
    expect(f.ops()).toEqual(["images:insert"]);
  });

  it.each([
    ["no CSV", undefined, false],
    ["a CSV of exactly 50 MB", { size: REPORT_MAX_BYTES } as Blob, true],
    ["a CSV over 50 MB", { size: REPORT_MAX_BYTES + 1 } as Blob, false],
  ])("with %s, uploads it: %s", async (_label, summaryCsv, uploaded) => {
    const f = fakeSupabase();
    await expect(saveAnalysis(f.client, analysis({ summaryCsv }))).resolves.toBe(IMAGE_ID);
    expect(f.storage.some((s) => s.op === "upload")).toBe(uploaded);
    expect(f.ops().includes("images:update")).toBe(uploaded);
  });

  it("throws when the image cannot be saved", async () => {
    const f = fakeSupabase({ insertImage: { data: null, error: { message: "check violation" } } });
    await expect(saveAnalysis(f.client, analysis())).rejects.toThrow("Saving the image failed: check violation");
    expect(f.ops()).toEqual(["images:insert"]);
    expect(f.storage).toEqual([]);
  });

  it("removes the uploaded CSV and the image when the colours cannot be saved", async () => {
    const f = fakeSupabase({ insertColors: { error: { message: "boom" } } });
    await expect(saveAnalysis(f.client, analysis())).rejects.toThrow("Saving the colours failed: boom");
    expect(f.storage.map((s) => s.op)).toEqual(["upload", "remove"]);
    expect(f.ops()).toEqual(["images:insert", "image_colors:insert", "images:delete"]);
    expect(f.calls[2].filters).toEqual([["id", IMAGE_ID]]);
  });

  it("removes only the image when the colours fail and there is no CSV", async () => {
    const f = fakeSupabase({ insertColors: { error: { message: "boom" } } });
    await expect(saveAnalysis(f.client, analysis({ summaryCsv: undefined }))).rejects.toThrow("boom");
    expect(f.storage).toEqual([]);
    expect(f.ops().at(-1)).toBe("images:delete");
  });

  it("removes the image but no object when the upload fails", async () => {
    const f = fakeSupabase({ upload: { error: { message: "too large" } } });
    await expect(saveAnalysis(f.client, analysis())).rejects.toThrow("Uploading the CSV failed: too large");
    expect(f.storage.map((s) => s.op)).toEqual(["upload"]);
    expect(f.ops().at(-1)).toBe("images:delete");
  });

  it("removes the CSV and the image when its path cannot be recorded", async () => {
    const f = fakeSupabase({ update: { error: { message: "denied" } } });
    await expect(saveAnalysis(f.client, analysis())).rejects.toThrow("Saving the CSV path failed: denied");
    expect(f.storage.map((s) => s.op)).toEqual(["upload", "remove"]);
    expect(f.ops().at(-1)).toBe("images:delete");
  });
});

describe("getAnalysis", () => {
  const image = (uniqueColors: number) => ({
    data: {
      id: IMAGE_ID,
      file_name: "a.png",
      width: 100,
      height: 100,
      total_pixels: 10_000,
      unique_colors: uniqueColors,
      include_alpha: false,
      top_n: 10,
    },
    error: null,
  });
  const pages = (f: ReturnType<typeof fakeSupabase>) =>
    f.calls.filter((c) => c.table === "image_colors").map((c) => c.filters.slice(1).map(([, v]) => v));

  it.each(["missing__0000000000000000", ""])("returns null for the id %j without a query", async (id) => {
    const f = fakeSupabase({ session: "user-1" });
    expect(await getAnalysis(f.client, id)).toBeNull();
    expect(f.calls).toEqual([]);
  });

  it("returns null without a session and does not sign in", async () => {
    const f = fakeSupabase();
    expect(await getAnalysis(f.client, IMAGE_ID)).toBeNull();
    expect(f.auth.signInAnonymously).not.toHaveBeenCalled();
    expect(f.calls).toEqual([]);
  });

  it("returns null for an unknown id (or another user's, hidden by RLS)", async () => {
    const f = fakeSupabase({ session: "user-1" });
    expect(await getAnalysis(f.client, IMAGE_ID)).toBeNull();
  });

  it.each([
    [0, []],
    [1, [[1, 1]]],
    [1000, [[1, 1000]]],
    [1001, [[1, 1000], [1001, 1001]]],
    [2003, [[1, 1000], [1001, 2000], [2001, 2003]]],
    [9000, [[1, 1000], [1001, 2000], [2001, 3000], [3001, 4000], [4001, 5000]]],
  ])("with %i unique colours reads the rank pages %j", async (uniqueColors, expected) => {
    const f = fakeSupabase({ session: "user-1", image: image(uniqueColors) });
    const a = await getAnalysis(f.client, IMAGE_ID);
    expect(pages(f)).toEqual(expected);
    expect(a?.colors).toHaveLength(Math.min(uniqueColors, STORED_COLORS_MAX));
    expect(a?.colors.map((_, i) => i)).toEqual([...Array(a?.colors.length).keys()]);
  });

  it("throws when reading the image fails", async () => {
    const f = fakeSupabase({ session: "user-1", image: { data: null, error: { message: "timeout" } } });
    await expect(getAnalysis(f.client, IMAGE_ID)).rejects.toThrow("Reading the analysis failed: timeout");
  });

  it("throws when reading the colours fails", async () => {
    const f = fakeSupabase({ session: "user-1", image: image(5), colorsError: { message: "timeout" } });
    await expect(getAnalysis(f.client, IMAGE_ID)).rejects.toThrow("Reading the colours failed: timeout");
  });
});

describe("getSummaryCsv", () => {
  it("returns null for an id that is not a UUID", async () => {
    const f = fakeSupabase({ session: "user-1" });
    expect(await getSummaryCsv(f.client, "missing__0000000000000000")).toBeNull();
  });

  it("returns null when no CSV was stored", async () => {
    const f = fakeSupabase({ session: "user-1", image: { data: { summary_csv_path: null }, error: null } });
    expect(await getSummaryCsv(f.client, IMAGE_ID)).toBeNull();
    expect(f.storage).toEqual([]);
  });

  it("downloads the stored CSV", async () => {
    const path = `user-1/${IMAGE_ID}.csv`;
    const f = fakeSupabase({ session: "user-1", image: { data: { summary_csv_path: path }, error: null } });
    const csv = await getSummaryCsv(f.client, IMAGE_ID);
    expect(await csv?.text()).toBe("r,g,b");
    expect(f.storage).toEqual([{ op: "download", arg: path }]);
  });

  it("returns null when the file is gone", async () => {
    const f = fakeSupabase({
      session: "user-1",
      image: { data: { summary_csv_path: "x/y.csv" }, error: null },
      download: { data: null, error: { message: "Object not found" } },
    });
    expect(await getSummaryCsv(f.client, IMAGE_ID)).toBeNull();
  });
});
