import type { AnalysisClient } from "@/adapters/supabase/analysis-repository";

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { message: string } | null };
type Op = "select" | "insert" | "update" | "delete";

/** A table, storage call or sign-in that should fail, e.g. "images:insert" or "storage:upload". */
export type FailingCall = `${"images" | "image_colors"}:${Op}` | "storage:upload" | "storage:download" | "auth:signIn";

/**
 * Just enough of a Supabase client, kept in memory, for the calls the
 * analysis repository makes: rows written can be read back, so whole
 * save-then-read flows run without a database. RLS is not modelled; there is
 * one anonymous user. Use the integration tests for real database behaviour.
 */
export function memorySupabase(fail: readonly FailingCall[] = []) {
  const tables: Record<string, Row[]> = { images: [], image_colors: [] };
  const files = new Map<string, Blob>();
  let userId: string | null = null;
  const error = (call: FailingCall) => (fail.includes(call) ? { message: `${call} failed` } : null);

  function from(table: string) {
    let op: Op = "select";
    let payload: Row | Row[] = [];
    const tests: ((row: Row) => boolean)[] = [];
    let sortBy: string | null = null;
    const matches = (row: Row) => tests.every((t) => t(row));

    const run = (): Result => {
      const failed = error(`${table}:${op}` as FailingCall);
      if (failed) return { data: null, error: failed };
      const rows = tables[table];
      if (op === "insert") {
        const added = (Array.isArray(payload) ? payload : [payload]).map((p) =>
          table === "images" ? { id: crypto.randomUUID(), owner_id: userId, summary_csv_path: null, total_pixels: null, ...p } : p,
        );
        rows.push(...added);
        return { data: added, error: null };
      }
      if (op === "update") {
        rows.filter(matches).forEach((row) => Object.assign(row, payload));
        return { data: null, error: null };
      }
      if (op === "delete") {
        tables[table] = rows.filter((row) => !matches(row));
        if (table === "images") tables.image_colors = tables.image_colors.filter((c) => tables.images.some((i) => i.id === c.image_id));
        return { data: null, error: null };
      }
      return { data: rows.filter(matches).map((row) => ({ ...row })), error: null };
    };
    const first = (): Result => {
      const result = run();
      return result.error ? result : { data: (result.data as Row[])[0] ?? null, error: null };
    };

    const builder = {
      insert: (p: Row | Row[]) => ((op = "insert"), (payload = p), builder),
      update: (p: Row) => ((op = "update"), (payload = p), builder),
      delete: () => ((op = "delete"), builder),
      select: () => builder,
      eq: (c: string, v: unknown) => (tests.push((row) => row[c] === v), builder),
      gte: (c: string, v: number) => (tests.push((row) => (row[c] as number) >= v), builder),
      lte: (c: string, v: number) => (tests.push((row) => (row[c] as number) <= v), builder),
      order: (c: string) => ((sortBy = c), builder),
      single: async () => first(),
      maybeSingle: async () => first(),
      then: (ok: (r: Result) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve().then(sorted).then(ok, ko),
    };
    const sorted = (): Result => {
      const result = run();
      const key = sortBy;
      if (key && Array.isArray(result.data)) (result.data as Row[]).sort((a, b) => (a[key] as number) - (b[key] as number));
      return result;
    };
    return builder;
  }

  const auth = {
    getSession: async () => ({ data: { session: userId ? { user: { id: userId } } : null }, error: null }),
    getClaims: async () => ({ data: userId ? { claims: { sub: userId } } : null, error: null }),
    signInAnonymously: async () => {
      const failed = error("auth:signIn");
      if (failed) return { data: { user: null }, error: failed };
      userId ??= crypto.randomUUID();
      return { data: { user: { id: userId } }, error: null };
    },
  };

  const bucket = {
    upload: async (path: string, body: Blob) => {
      const failed = error("storage:upload");
      if (!failed) files.set(path, body);
      return { data: failed ? null : { path }, error: failed };
    },
    remove: async (paths: string[]) => (paths.forEach((p) => files.delete(p)), { data: null, error: null }),
    download: async (path: string) => {
      const failed = error("storage:download") ?? (files.has(path) ? null : { message: "Object not found", status: 404 });
      return { data: failed ? null : files.get(path)!, error: failed };
    },
  };

  const client = { auth, from, storage: { from: () => bucket } } as unknown as AnalysisClient;
  return { client, tables, files };
}
