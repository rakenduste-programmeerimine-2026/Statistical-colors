// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, actAsAdmin, actAsAnon, createTestDb, USER_A, USER_B } from "./setup-db";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await actAsAdmin(db);
  await db.exec("delete from storage.objects");
});

async function upload(name: string) {
  await db.query("insert into storage.objects (bucket_id, name) values ('reports', $1)", [name]);
}

async function visibleReports(): Promise<string[]> {
  const { rows } = await db.query<{ name: string }>(
    "select name from storage.objects where bucket_id = 'reports' order by name",
  );
  return rows.map((r) => r.name);
}

describe("reports bucket", () => {
  it("is private, CSV-only and limited to 50 MB", async () => {
    const { rows } = await db.query<{
      public: boolean;
      file_size_limit: number;
      allowed_mime_types: string[];
    }>("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'reports'");

    expect(rows[0].public).toBe(false);
    expect(Number(rows[0].file_size_limit)).toBe(50 * 1024 * 1024);
    expect(rows[0].allowed_mime_types).toEqual(["text/csv"]);
  });

  it("a user can upload into their own folder", async () => {
    await actAs(db, USER_A);
    await upload(`${USER_A}/image-1.csv`);
    expect(await visibleReports()).toEqual([`${USER_A}/image-1.csv`]);
  });

  it("a user cannot upload into someone else's folder", async () => {
    await actAs(db, USER_B);
    await expect(upload(`${USER_A}/evil.csv`)).rejects.toThrow(/row-level security/);
  });

  it("a user cannot upload to the bucket root", async () => {
    await actAs(db, USER_A);
    await expect(upload("no-folder.csv")).rejects.toThrow(/row-level security/);
  });

  it("users only see their own reports", async () => {
    await actAs(db, USER_A);
    await upload(`${USER_A}/a.csv`);
    await actAs(db, USER_B);
    await upload(`${USER_B}/b.csv`);

    expect(await visibleReports()).toEqual([`${USER_B}/b.csv`]);
    await actAs(db, USER_A);
    expect(await visibleReports()).toEqual([`${USER_A}/a.csv`]);
  });

  it("a visitor without a session sees no reports", async () => {
    await actAs(db, USER_A);
    await upload(`${USER_A}/a.csv`);

    await actAsAnon(db);
    expect(await visibleReports()).toEqual([]);
  });
});
