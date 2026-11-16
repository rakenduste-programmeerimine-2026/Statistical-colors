// Hand-written helpers on top of the generated database.types.ts
// (kept separate so `npm run db:types` does not overwrite them).
//
// The generator cannot see two things, so they are narrowed here:
// - generated columns (images.total_pixels, image_colors.hex) are never null
//   and cannot be inserted
// - column privileges: after insert only images.summary_csv_path and
//   image_colors.user_flagged / user_note may be updated
//   (see supabase/migrations/*_images_row_level_security.sql)
import type { Tables, TablesInsert } from "./database.types";

export type { Database, Tables, TablesInsert, TablesUpdate } from "./database.types";

export type ImageRow = Tables<"images"> & { total_pixels: number };
export type ImageInsert = Omit<TablesInsert<"images">, "total_pixels">;
export type ImageUpdate = Pick<TablesInsert<"images">, "summary_csv_path">;

export type ImageColorRow = Tables<"image_colors"> & { hex: string };
export type ImageColorInsert = Omit<TablesInsert<"image_colors">, "hex">;
export type ImageColorUpdate = Pick<
  TablesInsert<"image_colors">,
  "user_flagged" | "user_note"
>;

/** Formats accepted by the images.format check constraint. */
export const IMAGE_FORMATS = ["png", "jpeg", "bmp", "gif", "webp", "tiff"] as const;
export type ImageFormat = (typeof IMAGE_FORMATS)[number];
