// The colour analysis the server sends with each stored analysis (P-030, P-031).
// The server computes all of it; the frontend only displays it. Contract for
// the backend: docs/api/color-analysis.md. Ontology: docs/ontology/.
// Everything is 8-bit sRGB; every colour the UI shows is OKLCH (P-031 items 2, 6).
import type { ColorModel } from "../color/models";
import type { Oklch } from "../color/oklch";

// ---- meta information shared by everything the server reports ----------------

/** Where a value came from. */
export type Provenance = "declared" | "measured" | "fitted" | "inferred" | "manual";
/** What the server needed to find it: pixels alone, pixels with layout, or scene data from the screenshot tools. */
export type Requires = "pixels" | "pixels+layout" | "scene";
export type InputKind = "design-file" | "source-code" | "scene-capture" | "png-lossless" | "jpeg-lossy" | "reposted" | "unknown";

export type CaveatCode =
  | "consistent-not-proven"
  | "jpeg-approximate"
  | "decoder-dependent"
  | "reposted-recompressed"
  | "lighting-confound"
  | "low-chroma-hue-unstable"
  | "small-share"
  | "small-sample"
  | "antialias-blend"
  | "alpha-composited"
  | "tagged-p3-read-as-srgb"
  | "needs-scene-data";

export interface Evidence {
  label?: string;
  color?: Oklch;
  /** Share of pixels, 0–100. */
  share?: number;
  value?: number;
  unit?: string;
  region?: { x: number; y: number; width: number; height: number };
  clusterId?: string;
}

export interface Meta {
  provenance: Provenance;
  /** 0–1. */
  confidence: number;
  /** The method and its parameters in words, e.g. "template fit, 0.5° rotation steps, λ 2". */
  method: string;
  methodVersion?: string;
  requires: Requires;
  evidence?: Evidence[];
  caveats?: CaveatCode[];
  /** Ontology anchors, e.g. "ontology/03-harmonies#triadic". */
  references?: string[];
}

// ---- palette -----------------------------------------------------------------------

export type TokenRole = "primary" | "secondary" | "tertiary" | "surface" | "on-surface" | "outline" | "error" | "success" | "warning" | "accent" | "neutral";

export interface PaletteCluster {
  id: string;
  /** Share-weighted centre in OKLab, given as OKLCH. */
  color: Oklch;
  /** Share of all pixels, 0–100. */
  share: number;
  pixelCount: number;
  /** How many unique colours were merged into this cluster. */
  memberCount: number;
  /** Largest ΔE_OK between any two members (complete linkage keeps it ≤ τ). */
  spreadDeltaE: number;
  role?: TokenRole;
  /** An 8-bit sRGB member, for exports only. */
  representativeRgb?: { r: number; g: number; b: number; a?: number };
  meta: Meta;
}

// ---- structures: harmonies, ramps, gradients, palette types (docs/ontology/02) --------

/** How one OKLCH axis behaves across the structure's points. */
export type AxisLaw = "const" | "arith" | "geom" | "sym" | "mono" | "two-level" | "free";
/** How the points lie in OKLab. */
export type PathLaw = "collinear" | "arc" | "equal-step" | "srgb-interpolated" | "hsl-interpolated" | "none";
export type StructureFamily = "harmony" | "ramp" | "gradient" | "palette";

export interface StructurePoint {
  clusterId: string;
  /** Where the point would be in the ideal OKLCH structure. */
  ideal: Oklch;
  /** Where it is (the cluster centre). */
  actual: Oklch;
  /** ΔE_OK between actual and ideal, sent per point (P-031 item 4). */
  deltaE: number;
  /** For harmonies, the index of the template offset the point belongs to. */
  spoke?: number;
}

export interface ColorStructure {
  id: string;
  /** Registry code, e.g. "harmony.triadic", "ramp.iso-lightness-equal-step" (docs/ontology/README.md). */
  code: string;
  family: StructureFamily;
  /** Estonian title from the server, used when the UI has no label for the code. */
  title: string;
  /** The colour model the structure was found in; "oklch" unless it was built in another model. */
  model: ColorModel;
  laws: { l: AxisLaw; c: AxisLaw; h: AxisLaw; path?: PathLaw };
  /** Harmonies: template offsets in degrees and optional sector widths (Matsuda forms). */
  template?: { offsets: number[]; widths?: number[] };
  /** Harmonies: template rotation on the model's hue wheel, degrees. */
  rotation?: number;
  points: StructurePoint[];
  /** Ramps with equal steps: the target ΔE and each consecutive step. */
  step?: { target: number; deltaEs: number[] };
  /** Share of the chromatic pixels the structure explains, 0–1. */
  coverage: number;
  /** 0–1, higher is a better and simpler explanation. */
  score: number;
  /** Share-weighted mean hue error in degrees (harmonies) or mean ΔE (others). */
  residual: number;
  /** Ids of structures this one is part of, e.g. complementary inside square. */
  nestedIn?: string[];
  meta: Meta;
}

// ---- contrast and tokens ---------------------------------------------------------------

export interface ContrastPair {
  fgClusterId: string;
  bgClusterId: string;
  /** WCAG 2 contrast ratio, 1–21. */
  ratio: number;
  passes: { aaText: boolean; aaLargeText: boolean; aaNonText: boolean; aaaText: boolean };
  /** Lowest ratio within the JPEG error margin, for lossy inputs. */
  worstCaseRatio?: number;
  meta: Meta;
}

export interface TonalLadder {
  system: "tailwind" | "material-tones" | "radix" | "open-color" | "custom";
  hue: number | null;
  steps: { name: string; color: Oklch; clusterId?: string; missing?: boolean }[];
  meta: Meta;
}

export interface DesignToken {
  /** DTCG path, e.g. "color.primary.500". */
  name: string;
  color: Oklch;
  role?: TokenRole;
  clusterId?: string;
  aliasOf?: string;
  meta: Meta;
}

export interface TokenSet {
  tokens: DesignToken[];
  ladders: TonalLadder[];
}

// ---- Figma colour features (docs/ontology/09-figma-and-tokens.md) ------------------------

export type FigmaBlendMode =
  | "PASS_THROUGH" | "NORMAL" | "DARKEN" | "MULTIPLY" | "LINEAR_BURN" | "COLOR_BURN" | "LIGHTEN" | "SCREEN" | "LINEAR_DODGE"
  | "COLOR_DODGE" | "OVERLAY" | "SOFT_LIGHT" | "HARD_LIGHT" | "DIFFERENCE" | "EXCLUSION" | "HUE" | "SATURATION" | "COLOR" | "LUMINOSITY";
// Checked against @figma/plugin-typings 1.142.0 (Paint and Effect unions).
export type FigmaPaintType = "SOLID" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "GRADIENT_ANGULAR" | "GRADIENT_DIAMOND" | "IMAGE" | "VIDEO" | "PATTERN" | "SHADER";
export type FigmaEffectType = "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR" | "NOISE" | "TEXTURE" | "GLASS" | "SHADER";
export type FigmaImageFilter = "exposure" | "contrast" | "saturation" | "temperature" | "tint" | "highlights" | "shadows";
export type FigmaVariableScope = "ALL_SCOPES" | "ALL_FILLS" | "FRAME_FILL" | "SHAPE_FILL" | "TEXT_FILL" | "STROKE_COLOR" | "EFFECT_COLOR";

export interface FigmaPaint {
  type: FigmaPaintType;
  usage: "fill" | "stroke" | "text" | "effect";
  color?: Oklch;
  stops?: { color: Oklch; position: number; boundVariable?: string }[];
  opacity: number;
  visible: boolean;
  blendMode: FigmaBlendMode;
  imageFilters?: Partial<Record<FigmaImageFilter, number>>;
  boundVariable?: string;
  /** How many layers use this paint. */
  count: number;
  meta: Meta;
}

export interface FigmaVariable {
  id: string;
  name: string;
  valuesByMode: Record<string, Oklch | { aliasOf: string }>;
  scopes: FigmaVariableScope[];
  codeSyntax?: Partial<Record<"WEB" | "ANDROID" | "iOS", string>>;
  hiddenFromPublishing?: boolean;
  meta: Meta;
}

export interface FigmaColorFeatures {
  /** Only sRGB is analysed; a P3 document is read as sRGB and flagged (P-031 item 6). */
  documentColorProfile: "srgb" | "display-p3" | "legacy" | "unknown";
  paints: FigmaPaint[];
  effects: {
    type: FigmaEffectType;
    color?: Oklch;
    offset?: { x: number; y: number };
    radius?: number;
    spread?: number;
    /** Blurs: a progressive blur fades between two radii. */
    progressive?: boolean;
    blendMode?: FigmaBlendMode;
    meta: Meta;
  }[];
  strokes: { color: Oklch; weight: number | { top: number; right: number; bottom: number; left: number }; align: "INSIDE" | "OUTSIDE" | "CENTER"; meta: Meta }[];
  variables: { id: string; name: string; modes: { id: string; name: string }[]; defaultModeId: string; variables: FigmaVariable[] }[];
  styles: { paint: { id: string; name: string; paints: number[] }[]; effect: { id: string; name: string; effects: number[] }[] };
  /** Per feature key (docs/ontology/09): how it is known. */
  coverage: Record<string, "declared" | "inferred" | "not-detectable" | "not-implemented">;
}

// ---- gamut coverage: how much of sRGB the image's colours fill (P-035, P-036) ----------------

export interface GamutCoverage {
  /** The cells are a cubic OKLab grid; a cell is in the gamut when its centre is in sRGB. */
  space: "oklab";
  /** Cell size in ΔE_OK (0.02, about one just-noticeable difference). */
  cellDeltaE: number;
  /** In-gamut cells that at least one image colour snaps to, and all in-gamut cells. */
  occupiedCells: number;
  totalCells: number;
  /** occupiedCells / totalCells, 0–1. */
  coverage: number;
  meta: Meta;
}

// ---- findings: everything else the ontology describes ------------------------------------

export type OntologyArea =
  | "palette" | "structure" | "ui" | "lighting" | "artefact" | "accessibility" | "tokens" | "figma" | "input" | "other";
export type Severity = "info" | "notice" | "warning" | "problem";

export interface Finding {
  id: string;
  /** Registry kind, e.g. "ui.dark-mode", "lighting.teal-orange". Unknown kinds still render. */
  kind: string;
  area: OntologyArea;
  severity: Severity;
  /** Estonian title from the server, used when the UI has no label for the kind. */
  title: string;
  detail?: string;
  metrics?: { key: string; label: string; value: number; unit?: string; min?: number; max?: number }[];
  swatches?: { color: Oklch; label?: string; share?: number }[];
  gradient?: { color: Oklch; at: number }[];
  clusterIds?: string[];
  structureIds?: string[];
  meta: Meta;
}

// ---- the whole analysis --------------------------------------------------------------------

export interface PipelineStep {
  step: "blend-snap" | "share-filter" | "convert" | "cluster" | "structures" | "contrast" | "roles" | "findings";
  status: "done" | "skipped" | "not-implemented";
  params?: Record<string, number | string | boolean>;
  /** Share of pixels the step set aside, 0–100. */
  removedShare?: number;
}

export interface ColorAnalysis {
  schemaVersion: 1;
  /** "simulated" comes from the frontend stub; "computed" from the server. */
  status: "computed" | "simulated";
  inputKind: InputKind;
  /** The source's colour profile; anything other than sRGB is read as sRGB and flagged. */
  sourceProfile: "srgb" | "untagged" | "display-p3" | "other";
  pipeline: PipelineStep[];
  palette: PaletteCluster[];
  structures: ColorStructure[];
  contrast?: ContrastPair[];
  tokens?: TokenSet;
  figma?: FigmaColorFeatures;
  /** How much of the sRGB gamut the image's colours occupy (P-035). */
  gamut?: GamutCoverage;
  findings: Finding[];
}
