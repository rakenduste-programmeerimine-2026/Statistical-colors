// Estonian labels for what the server sends (P-030). The registry of codes and
// kinds lives in docs/ontology/README.md; a code or kind missing here still
// renders with the server's own title.
import type { ColorModel } from "../color/models";
import type { CaveatCode, ColorStructure, Finding, OntologyArea, Provenance, Requires, Severity, StructureFamily } from "./color-analysis";

export const MODEL_LABELS: Record<ColorModel, string> = {
  oklch: "OKLCH",
  hsl: "HSL",
  hsv: "HSV",
  hwb: "HWB",
  ryb: "RYB (kunstniku ratas)",
};

export const FAMILY_LABELS: Record<StructureFamily, string> = {
  harmony: "Harmoonia",
  ramp: "Astmestik",
  gradient: "Üleminek",
  palette: "Paleti tüüp",
};

/** Structure codes (docs/ontology/02-structure-space.md). */
export const STRUCTURE_LABELS: Record<string, string> = {
  "harmony.complementary": "Vastandvärvid",
  "harmony.analogous": "Naabervärvid",
  "harmony.triadic": "Kolmikharmoonia",
  "harmony.split-complementary": "Lõhestatud vastandvärvid",
  "harmony.square": "Ruut",
  "harmony.rectangle": "Ristkülik",
  "harmony.isoluminant": "Sama heledusega harmoonia",
  "ramp.tonal": "Toonide astmestik",
  "ramp.iso-lightness-equal-step": "Sama heledus, võrdsed ΔE sammud",
  "ramp.hue-sweep": "Toonikaar",
  "ramp.chroma": "Küllastuse astmestik",
  "gradient.linear-oklab": "Üleminek OKLab-is",
  "gradient.linear-srgb": "Üleminek sRGB-s",
  "gradient.hsl": "Üleminek HSL-is",
  "palette.monochrome": "Ühevärviline",
  "palette.achromatic": "Akromaatne",
  "palette.neutral-plus-accent": "Neutraalne ja üks aktsentvärv",
  "palette.two-level-lightness": "Kahetasemeline heledus",
  "palette.equal-spacing": "Võrdsete vahedega värvid",
  "palette.full-wheel": "Kogu toonirattal laiali",
};

export const AREA_LABELS: Record<OntologyArea, string> = {
  palette: "Palett",
  structure: "Struktuurid",
  ui: "Kasutajaliides",
  lighting: "Valgus ja toonimine",
  artefact: "Digitaalsed artefaktid",
  accessibility: "Ligipääsetavus",
  tokens: "Tokenid ja rollid",
  figma: "Figma",
  input: "Sisend",
  other: "Muu",
};
/** Order of areas on the page. */
export const AREA_ORDER: OntologyArea[] = ["input", "ui", "structure", "palette", "lighting", "accessibility", "tokens", "figma", "artefact", "other"];

export const SEVERITY_LABELS: Record<Severity, string> = {
  info: "Teave",
  notice: "Tähelepanek",
  warning: "Hoiatus",
  problem: "Probleem",
};

export const PROVENANCE_LABELS: Record<Provenance, string> = {
  declared: "deklareeritud",
  measured: "mõõdetud",
  fitted: "sobitatud",
  inferred: "järeldatud",
  manual: "käsitsi",
};

export const REQUIRES_LABELS: Record<Requires, string> = {
  pixels: "piisab pikslitest",
  "pixels+layout": "pikslid ja paigutus",
  scene: "vajab ekraanipildi tööriista andmeid",
};

export const CAVEAT_LABELS: Record<CaveatCode, string> = {
  "consistent-not-proven": "Tulemus on sisendiga kooskõlas, kuid pole tõestatud originaal.",
  "jpeg-approximate": "JPEG muudab värve veidi; väärtused on ligikaudsed.",
  "decoder-dependent": "Eri dekooderid võivad anda veidi erinevaid piksleid.",
  "reposted-recompressed": "Pilt on ilmselt korduvalt pakitud.",
  "lighting-confound": "Valgus võib värve nihutada; objekti värv ja valguse värv võivad segi minna.",
  "low-chroma-hue-unstable": "Madala küllastusega värvi toon on ebakindel.",
  "small-share": "Värvi osakaal on väike.",
  "small-sample": "Andmeid on vähe.",
  "antialias-blend": "Servade silumine tekitab vahevärve.",
  "alpha-composited": "Läbipaistvus segab värve taustaga.",
  "tagged-p3-read-as-srgb": "Allikas oli märgitud Display P3; seda loeti sRGB-na, nii et värvid võivad originaalist erineda.",
  "needs-scene-data": "Kinnitamiseks on vaja ekraanipildi tööriista andmeid.",
};

/** Finding kinds (docs/ontology/README.md); unknown kinds use the server's title. */
export const FINDING_LABELS: Record<string, string> = {
  "ui.dark-mode": "Tume režiim",
  "ui.light-mode": "Hele režiim",
  "ui.light-dark-pair": "Heleda ja tumeda režiimi paar",
  "ui.state-layer": "Olekukiht (hõljumine, vajutus)",
  "ui.focus-ring": "Fookuse rõngas",
  "lighting.teal-orange": "Teal–oranž toonimine",
  "lighting.white-balance-cast": "Valge tasakaalu kõrvalekalle",
  "lighting.split-toning": "Jagatud toonimine",
  "lighting.duotone": "Kahetooniline",
  "lighting.sepia": "Seepia",
  "structure.hsl-constructed": "Ehitatud HSL-is, mitte OKLCH-s",
  "structure.ryb-constructed": "Ehitatud kunstniku RYB-rattal",
  "structure.ambiguous-nesting": "Mitu malli sobivad",
  "palette.dominant": "Domineeriv värv",
  "palette.full-wheel": "Värvid kogu toonirattal",
  "accessibility.contrast": "Teksti ja tausta kontrast",
  "accessibility.wcag-fail": "Kontrast alla WCAG piiri",
  "accessibility.cvd-confusable": "Värvipimedale segiaetavad värvid",
  "tokens.tonal-ladder": "Toonide astmestik (tokenid)",
  "tokens.role-guess": "Rolli oletus",
  "tokens.brand-drift": "Kõrvalekalle brändi värvidest",
  "figma.variable": "Figma muutuja",
  "figma.mode-pair": "Figma režiimide paar",
  "figma.blend-mode": "Figma segamisrežiim",
  "figma.image-adjust": "Figma pildi korrigeerimine",
  "input.p3-read-as-srgb": "Display P3 allikas loetud sRGB-na",
  "artefact.antialias-blend": "Servade silumise vahevärvid",
  "artefact.cleartype": "ClearType värvilised servad",
  "artefact.chroma-subsampling": "Värviinfo alamdiskreetimine",
  "artefact.jpeg-blocking": "JPEG plokid",
  "artefact.banding": "Triibulised üleminekud",
  "artefact.indexed-palette": "Indekseeritud palett",
};

export const structureLabel = (s: Pick<ColorStructure, "code" | "title">) => STRUCTURE_LABELS[s.code] ?? s.title;
export const findingLabel = (f: Pick<Finding, "kind" | "title">) => FINDING_LABELS[f.kind] ?? f.title;
