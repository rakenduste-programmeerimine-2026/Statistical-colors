import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImageAnalysis } from "@/core/analysis/types";
import { ensureAnonymousSession } from "@/lib/supabase/anonymous-session";
import type { Database } from "@/lib/supabase/database.types";
import {
  isAnalysisId,
  REPORT_MAX_BYTES,
  REPORTS_BUCKET,
  reportPath,
  STORED_COLORS_MAX,
  toColorRows,
  toImageAnalysis,
  toImageInsert,
  type NewAnalysis,
} from "./analysis-rows";

/**
 * Saving and reading analyses in Supabase (#13, #39). Runs in the browser
 * with the client from src/lib/supabase/client.ts; RLS limits every query to
 * the signed-in (anonymous) user. The real AnalysisService adapter (#40)
 * builds on these functions.
 */

export type AnalysisClient = SupabaseClient<Database>;

/** PostgREST returns at most this many rows per request (supabase/config.toml max_rows). */
const PAGE_SIZE = 1000;

/** Only what the results page needs; hex is rebuilt from r, g, b. */
const COLOR_COLUMNS = "rank,r,g,b,a,pixel_count,percent";

/** Reads need no network check of the session: RLS enforces access on the server. */
async function hasSession(supabase: AnalysisClient): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return data.session !== null;
}

/** Storage answers "not found" for a missing object (400 or 404, depending on the version). */
function isNotFound(error: unknown): boolean {
  const e = error as { status?: number; statusCode?: string };
  return e.status === 400 || e.status === 404 || e.statusCode === "404";
}

/**
 * Stores an analysis: the image row, its top 5000 colours and the summary CSV.
 * Signs in anonymously first if needed. If any step fails, the partial data
 * is removed again and the error is rethrown.
 *
 * @returns the new analysis id (UUID)
 */
export async function saveAnalysis(
  supabase: AnalysisClient,
  input: NewAnalysis,
): Promise<string> {
  const ownerId = await ensureAnonymousSession(supabase);
  // A CSV above the bucket limit would fail the upload; keep the analysis without it.
  const csv = input.summaryCsv && input.summaryCsv.size <= REPORT_MAX_BYTES ? input.summaryCsv : null;

  const { data: image, error } = await supabase
    .from("images")
    .insert(toImageInsert(input))
    .select("id")
    .single();
  if (error || !image) {
    throw new Error(`Saving the image failed: ${error?.message ?? "no row returned"}`);
  }

  const path = csv ? reportPath(ownerId, image.id) : null;
  let uploaded = false;
  try {
    const rows = toColorRows(image.id, input);
    // Up to 5000 rows in one request: one statement, so all or nothing.
    // The colours and the CSV upload run in parallel; allSettled so that an
    // upload that succeeded is known (and removed) even if the insert throws.
    const [colorsResult, uploadResult] = await Promise.allSettled([
      rows.length > 0 ? supabase.from("image_colors").insert(rows) : { error: null },
      path && csv
        ? supabase.storage
            .from(REPORTS_BUCKET)
            // A Blob is sent as multipart form data with its own type, so the
            // type must be exactly what the bucket allows (text/csv).
            .upload(path, new Blob([csv], { type: "text/csv" }), { upsert: false })
        : { error: null },
    ]);
    uploaded = path !== null && uploadResult.status === "fulfilled" && !uploadResult.value.error;
    if (colorsResult.status === "rejected") throw colorsResult.reason;
    if (colorsResult.value.error) throw new Error(`Saving the colours failed: ${colorsResult.value.error.message}`);
    if (uploadResult.status === "rejected") throw uploadResult.reason;
    if (uploadResult.value.error) throw new Error(`Uploading the CSV failed: ${uploadResult.value.error.message}`);

    if (path) {
      const { error: updateError } = await supabase
        .from("images")
        .update({ summary_csv_path: path })
        .eq("id", image.id);
      if (updateError) throw new Error(`Saving the CSV path failed: ${updateError.message}`);
    }

    return image.id;
  } catch (cause) {
    // Best effort, and never hide the original error. The colour rows go
    // with the image (on delete cascade).
    if (uploaded && path) {
      try {
        await supabase.storage.from(REPORTS_BUCKET).remove([path]);
      } catch {
        // an orphaned CSV is harmless: only its owner can read it
      }
    }
    try {
      await supabase.from("images").delete().eq("id", image.id);
    } catch {
      // nothing more to do offline
    }
    throw cause;
  }
}

/**
 * A stored analysis with up to 5000 colours, most frequent first, or null
 * for an unknown id, another user's id (RLS) or when there is no session.
 */
export async function getAnalysis(
  supabase: AnalysisClient,
  id: string,
): Promise<ImageAnalysis | null> {
  if (!isAnalysisId(id) || !(await hasSession(supabase))) return null;

  const { data: image, error } = await supabase
    .from("images")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Reading the analysis failed: ${error.message}`);
  if (!image) return null;

  // All pages at once; the row count is known from unique_colors.
  const stored = Math.min(STORED_COLORS_MAX, image.unique_colors);
  const pages = [];
  for (let lo = 1; lo <= stored; lo += PAGE_SIZE) {
    pages.push(
      supabase
        .from("image_colors")
        .select(COLOR_COLUMNS)
        .eq("image_id", id)
        .gte("rank", lo)
        .lte("rank", Math.min(lo + PAGE_SIZE - 1, stored))
        .order("rank"),
    );
  }
  const results = await Promise.all(pages);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(`Reading the colours failed: ${failed.error.message}`);
  const colors = results.flatMap((r) => r.data ?? []);

  return toImageAnalysis(image, colors);
}

/**
 * The summary CSV of every colour, or null when the id is unknown, there is no
 * session, or no CSV was stored (e.g. it was over the 50 MB limit).
 */
export async function getSummaryCsv(
  supabase: AnalysisClient,
  id: string,
): Promise<Blob | null> {
  if (!isAnalysisId(id) || !(await hasSession(supabase))) return null;

  const { data: image, error } = await supabase
    .from("images")
    .select("summary_csv_path")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Reading the analysis failed: ${error.message}`);
  if (!image?.summary_csv_path) return null;

  const { data: csv, error: downloadError } = await supabase.storage
    .from(REPORTS_BUCKET)
    .download(image.summary_csv_path);
  if (downloadError) {
    if (isNotFound(downloadError)) return null;
    throw new Error(`Downloading the CSV failed: ${downloadError.message}`);
  }
  return csv;
}
