/** Limits carried over from the original Flask app (app/config.py). */
export const MAX_UPLOAD_MB = 25;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/**
 * Extensions the upload form accepts. The original also allowed TIFF, but
 * browsers cannot decode it (see #11), so it is left out.
 */
export const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "bmp", "gif", "webp"] as const;

export const TOP_N_MIN = 1;
export const TOP_N_MAX = 5000;
export const TOP_N_DEFAULT = 5000;
export const INCLUDE_ALPHA_DEFAULT = false;

export type UploadError = "no-file" | "type-not-allowed" | "too-large";

function extensionOf(fileName: string): string | null {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 && dot < fileName.length - 1 ? fileName.slice(dot + 1).toLowerCase() : null;
}

/** Checks a picked file before it is sent for analysis. Returns null when it is fine. */
export function validateUpload(file: Pick<File, "name" | "size"> | null | undefined): UploadError | null {
  if (!file || file.name === "") return "no-file";
  const ext = extensionOf(file.name);
  if (!ext || !(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) return "type-not-allowed";
  if (file.size > MAX_UPLOAD_BYTES) return "too-large";
  return null;
}

/**
 * Parses a top-N value and clamps it to 1–5000. Like Python's `int()` in the
 * original, only whole numbers parse; anything else gives the fallback.
 */
export function clampTopN(value: unknown, fallback: number = TOP_N_DEFAULT): number {
  let n: number;
  if (typeof value === "number") n = value;
  else if (typeof value === "string" && /^\s*[+-]?\d+\s*$/.test(value)) n = Number(value);
  else return fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(TOP_N_MIN, Math.min(TOP_N_MAX, Math.trunc(n)));
}
