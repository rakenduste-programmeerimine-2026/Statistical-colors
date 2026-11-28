/** The viewers whose background can be chosen (P-037, P-039 item 5). */
export type ViewerId = "pixel" | "gamut";

/**
 * Port: where a viewer's chosen background is remembered. The browser adapter
 * keeps it in localStorage; tests use memory.
 */
export interface ViewerPrefsStore {
  /** The saved background as `#rrggbb`, or null for the viewer's default. */
  background(viewer: ViewerId): string | null;
  setBackground(viewer: ViewerId, hex: string | null): void;
}

/**
 * CIE reference background for colour-difference evaluation: a uniform
 * neutral grey of CIE L* = 50 (CIE 116-1995, the reference conditions of
 * CIEDE2000). In sRGB that is #777777 (L* 50.04) (P-039 item 4).
 */
export const CIE_GREY = "#777777";

export const isHexColor = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
