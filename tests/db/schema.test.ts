// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { IMAGE_FORMATS } from "@/lib/supabase/types";
import { actAsAdmin, createTestDb, insertImage, USER_A } from "./setup-db";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await actAsAdmin(db);
  await db.exec("delete from public.images");
});

describe("images table", () => {
  it("stores an image and computes total_pixels", async () => {
    const id = await insertImage(db, { width: 1920, height: 1080, uniqueColors: 500 });

    const { rows } = await db.query<{ total_pixels: number; color_space: string }>(
      "select total_pixels, color_space from public.images where id = $1",
      [id],
    );

    expect(Number(rows[0].total_pixels)).toBe(1920 * 1080);
    expect(rows[0].color_space).toBe("srgb");
  });

  it("gives images uploaded separately different batch ids by default", async () => {
    await insertImage(db);
    await insertImage(db);

    const { rows } = await db.query<{ n: number }>(
      "select count(distinct batch_id)::int as n from public.images",
    );
    expect(rows[0].n).toBe(2);
  });

  it.each([
    ["unknown format", { format: "psd" }],
    ["zero width", { width: 0 }],
    ["huge height", { height: 40000 }],
    ["empty file name", { fileName: "" }],
    ["more unique colours than pixels", { width: 2, height: 2, uniqueColors: 5 }],
  ])("rejects %s", async (_label, input) => {
    await expect(insertImage(db, input)).rejects.toThrow(/violates check constraint/);
  });

  it.each(IMAGE_FORMATS)("accepts every format the app knows: %s", async (format) => {
    await expect(insertImage(db, { format })).resolves.toEqual(expect.any(String));
  });

  it("requires an existing auth user as owner", async () => {
    await expect(
      insertImage(db, { owner: "00000000-0000-4000-8000-0000000000ff" }),
    ).rejects.toThrow(/foreign key/);
  });
});

describe("images.top_n", () => {
  async function insertWithTopN(topN: number | null) {
    const { rows } = await db.query<{ top_n: number }>(
      `insert into public.images (owner_id, file_name, format, width, height, unique_colors, top_n)
       values ($1, 'top.png', 'png', 2, 2, 1, $2) returning top_n`,
      [USER_A, topN],
    );
    return rows[0].top_n;
  }

  it("defaults to 5000 when the app does not send it", async () => {
    const id = await insertImage(db);
    const { rows } = await db.query<{ top_n: number }>(
      "select top_n from public.images where id = $1",
      [id],
    );
    expect(rows[0].top_n).toBe(5000);
  });

  it.each([1, 2, 4999, 5000])("accepts %i (inside 1–5000)", async (topN) => {
    await expect(insertWithTopN(topN)).resolves.toBe(topN);
  });

  it.each([0, -1, 5001])("rejects %i (outside 1–5000)", async (topN) => {
    await expect(insertWithTopN(topN)).rejects.toThrow(/images_top_n_range/);
  });

  it("rejects null", async () => {
    await expect(insertWithTopN(null)).rejects.toThrow(/null value in column "top_n"/);
  });
});

describe("image_colors table", () => {
  async function insertColor(
    imageId: string,
    color: { rank: number; r: number; g: number; b: number; a?: number | null; count?: number; percent?: number },
  ) {
    await db.query(
      `insert into public.image_colors (image_id, rank, r, g, b, a, pixel_count, percent)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [imageId, color.rank, color.r, color.g, color.b, color.a ?? null, color.count ?? 1, color.percent ?? 25],
    );
  }

  it("generates an upper-case #RRGGBB hex value", async () => {
    const imageId = await insertImage(db);
    await insertColor(imageId, { rank: 1, r: 255, g: 10, b: 0 });

    const { rows } = await db.query<{ hex: string }>(
      "select hex from public.image_colors where image_id = $1",
      [imageId],
    );
    expect(rows[0].hex).toBe("#FF0A00");
  });

  it("keeps percent exact to 10 decimal places", async () => {
    const imageId = await insertImage(db);
    await insertColor(imageId, { rank: 1, r: 1, g: 2, b: 3, percent: 33.3333333333 });

    const { rows } = await db.query<{ percent: string }>(
      "select percent::text from public.image_colors where image_id = $1",
      [imageId],
    );
    expect(rows[0].percent).toBe("33.3333333333");
  });

  it.each([
    ["channel above 255", { rank: 1, r: 256, g: 0, b: 0 }],
    ["negative channel", { rank: 1, r: 0, g: -1, b: 0 }],
    ["alpha above 255", { rank: 1, r: 0, g: 0, b: 0, a: 300 }],
    ["rank 0", { rank: 0, r: 0, g: 0, b: 0 }],
    ["zero pixel count", { rank: 1, r: 0, g: 0, b: 0, count: 0 }],
    ["percent over 100", { rank: 1, r: 0, g: 0, b: 0, percent: 100.5 }],
  ])("rejects %s", async (_label, color) => {
    const imageId = await insertImage(db);
    await expect(insertColor(imageId, color)).rejects.toThrow(/violates check constraint/);
  });

  it("does not allow the same colour twice for one image (also when alpha is null)", async () => {
    const imageId = await insertImage(db);
    await insertColor(imageId, { rank: 1, r: 1, g: 2, b: 3 });

    await expect(insertColor(imageId, { rank: 2, r: 1, g: 2, b: 3 })).rejects.toThrow(
      /image_colors_color_unique/,
    );
  });

  it("treats the same RGB with different alpha as different colours", async () => {
    const imageId = await insertImage(db);
    await insertColor(imageId, { rank: 1, r: 1, g: 2, b: 3, a: 255 });
    await expect(insertColor(imageId, { rank: 2, r: 1, g: 2, b: 3, a: 128 })).resolves.toBeUndefined();
  });

  it("deletes colours together with their image", async () => {
    const imageId = await insertImage(db);
    await insertColor(imageId, { rank: 1, r: 1, g: 2, b: 3 });

    await db.query("delete from public.images where id = $1", [imageId]);

    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from public.image_colors",
    );
    expect(rows[0].n).toBe(0);
  });

  it("deletes a user's images when the auth user is deleted", async () => {
    await insertImage(db, { owner: USER_A });
    await db.query("delete from auth.users where id = $1", [USER_A]);

    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.images");
    expect(rows[0].n).toBe(0);

    await db.query("insert into auth.users (id) values ($1)", [USER_A]);
  });
});
