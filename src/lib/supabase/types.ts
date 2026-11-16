// Hand-written helpers on top of the generated database.types.ts
// (kept separate so `npm run db:types` does not overwrite them).
import type { Database } from "./database.types";

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];

export type ImageRow = Tables<"images">;
export type ImageColorRow = Tables<"image_colors">;

/** Formats accepted by the images.format check constraint. */
export const IMAGE_FORMATS = ["png", "jpeg", "bmp", "gif", "webp", "tiff"] as const;
export type ImageFormat = (typeof IMAGE_FORMATS)[number];
