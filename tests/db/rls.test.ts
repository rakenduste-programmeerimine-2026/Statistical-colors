// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  actAs,
  actAsAdmin,
  actAsAnon,
  createTestDb,
  insertImage,
  USER_A,
  USER_B,
} from "./setup-db";

let db: PGlite;
let imageOfA: string;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await actAsAdmin(db);
  await db.exec("delete from public.images");
  imageOfA = await insertImage(db, { owner: USER_A, fileName: "a.png", format: "png" });
  await db.query(
    `insert into public.image_colors (image_id, rank, r, g, b, pixel_count, percent)
     values ($1, 1, 10, 20, 30, 3, 75), ($1, 2, 0, 0, 0, 1, 25)`,
    [imageOfA],
  );
});

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await db.query<{ n: number }>(sql, params);
  return rows[0].n;
}

describe("images RLS", () => {
  it("owner sees their own images", async () => {
    await actAs(db, USER_A);
    expect(await count("select count(*)::int as n from public.images")).toBe(1);
  });

  it("another user sees nothing", async () => {
    await actAs(db, USER_B);
    expect(await count("select count(*)::int as n from public.images")).toBe(0);
  });

  it("visitor without a session has no access at all", async () => {
    await actAsAnon(db);
    await expect(db.query("select * from public.images")).rejects.toThrow(/permission denied/);
  });

  it("owner_id defaults to the signed-in user", async () => {
    await actAs(db, USER_B);
    const { rows } = await db.query<{ owner_id: string }>(
      `insert into public.images (file_name, format, width, height, unique_colors)
       values ('b.bmp', 'bmp', 1, 1, 1) returning owner_id`,
    );
    expect(rows[0].owner_id).toBe(USER_B);
  });

  it("a user cannot insert an image on behalf of someone else", async () => {
    await actAs(db, USER_B);
    await expect(
      db.query(
        `insert into public.images (owner_id, file_name, format, width, height, unique_colors)
         values ($1, 'x.png', 'png', 1, 1, 1)`,
        [USER_A],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("another user cannot delete the owner's image", async () => {
    await actAs(db, USER_B);
    await db.query("delete from public.images where id = $1", [imageOfA]);

    await actAsAdmin(db);
    expect(await count("select count(*)::int as n from public.images where id = $1", [imageOfA])).toBe(1);
  });

  it("owner can set the CSV path", async () => {
    await actAs(db, USER_A);
    await db.query("update public.images set summary_csv_path = $1 where id = $2", [
      `${USER_A}/${imageOfA}.csv`,
      imageOfA,
    ]);

    const { rows } = await db.query<{ summary_csv_path: string }>(
      "select summary_csv_path from public.images where id = $1",
      [imageOfA],
    );
    expect(rows[0].summary_csv_path).toBe(`${USER_A}/${imageOfA}.csv`);
  });

  it.each([
    ["owner_id", USER_B],
    ["unique_colors", 1],
    ["file_name", "renamed.png"],
  ])("owner cannot change %s after insert", async (column, value) => {
    await actAs(db, USER_A);
    await expect(
      db.query(`update public.images set ${column} = $1 where id = $2`, [value, imageOfA]),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("image_colors RLS", () => {
  it("owner sees the colours of their image", async () => {
    await actAs(db, USER_A);
    expect(await count("select count(*)::int as n from public.image_colors")).toBe(2);
  });

  it("another user sees no colours", async () => {
    await actAs(db, USER_B);
    expect(await count("select count(*)::int as n from public.image_colors")).toBe(0);
  });

  it("another user cannot add colours to the owner's image", async () => {
    await actAs(db, USER_B);
    await expect(
      db.query(
        `insert into public.image_colors (image_id, rank, r, g, b, pixel_count, percent)
         values ($1, 3, 1, 1, 1, 1, 1)`,
        [imageOfA],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("owner can flag a colour and add a note", async () => {
    await actAs(db, USER_A);
    await db.query(
      "update public.image_colors set user_flagged = true, user_note = $1 where image_id = $2 and rank = 1",
      ["Tegelikult #0A141F", imageOfA],
    );

    const { rows } = await db.query<{ user_flagged: boolean; user_note: string }>(
      "select user_flagged, user_note from public.image_colors where image_id = $1 and rank = 1",
      [imageOfA],
    );
    expect(rows[0]).toEqual({ user_flagged: true, user_note: "Tegelikult #0A141F" });
  });

  it("another user cannot flag the owner's colours", async () => {
    await actAs(db, USER_B);
    await db.query(
      "update public.image_colors set user_flagged = true where image_id = $1",
      [imageOfA],
    );

    await actAsAdmin(db);
    expect(
      await count("select count(*)::int as n from public.image_colors where user_flagged"),
    ).toBe(0);
  });

  it.each(["pixel_count", "percent", "r"])(
    "owner cannot change the measured value %s",
    async (column) => {
      await actAs(db, USER_A);
      await expect(
        db.query(`update public.image_colors set ${column} = 1 where image_id = $1`, [imageOfA]),
      ).rejects.toThrow(/permission denied/);
    },
  );
});
