// The two spaces the 3D view can show (P-035): OKLab, like the rest of the
// project, and CIELAB D50, like the notebook's cell 19. Both are close to
// perceptually uniform, so a cubic grid with one step on every axis spreads
// the lattice points evenly by perceived difference.
import { labToLinearSrgb, srgbToLab } from "../color/lab";
import { oklabToLinearSrgb, srgbToOklab, type Rgb8, type Vec3 } from "../color/oklch";

export type GamutSpaceId = "oklab" | "cielab";

export interface GamutSpace {
  id: GamutSpaceId;
  label: string;
  /** Axis names: lightness, a, b. */
  axes: [string, string, string];
  /** Lattice step, the same on every axis. */
  step: number;
  /** Lightness runs 0–lMax; a and b run ±abLimit. */
  lMax: number;
  abLimit: number;
  /** World units per space unit, so both spaces draw with lightness 0–1. */
  scale: number;
  /** Chroma slider range and the notebook's default selection. */
  chromaMax: number;
  chromaStep: number;
  defaultChroma: [number, number];
  /** Digits to print coordinates with. */
  digits: number;
  toCoords(rgb: Rgb8): Vec3;
  toLinearSrgb(l: number, a: number, b: number): Vec3;
}

export const OKLAB: GamutSpace = {
  id: "oklab",
  label: "OKLab",
  axes: ["L", "a", "b"],
  // About one just-noticeable difference; the server's coverage cells (P-036).
  step: 0.02,
  lMax: 1,
  abLimit: 0.4,
  scale: 1,
  chromaMax: 0.4,
  chromaStep: 0.005,
  defaultChroma: [0.1, 0.2],
  digits: 3,
  toCoords: srgbToOklab,
  toLinearSrgb: oklabToLinearSrgb,
};

export const CIELAB: GamutSpace = {
  id: "cielab",
  label: "CIELAB (D50)",
  axes: ["L*", "a*", "b*"],
  // Uniform ΔE*ab 4 on every axis; the notebook's ΔL 2 / Δab 4 is not even (P-036).
  step: 4,
  lMax: 100,
  abLimit: 128,
  scale: 0.01,
  chromaMax: 160,
  chromaStep: 1,
  defaultChroma: [40, 80],
  digits: 1,
  toCoords: srgbToLab,
  toLinearSrgb: labToLinearSrgb,
};

export const SPACES: Record<GamutSpaceId, GamutSpace> = { oklab: OKLAB, cielab: CIELAB };
