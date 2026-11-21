import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { prng } from "@/adapters/simulated/random";
import { generateColorAnalysis } from "@/adapters/simulated/color-analysis";
import type { ColorAnalysis, Finding } from "@/core/analysis/color-analysis";
import { ColorAnalysisSection } from "./ColorAnalysisSection";
import { confidenceText, FindingsPanel } from "./FindingsPanel";
import { RampStrip } from "./StructureList";
import { StructureWheel } from "./StructureWheel";

const analysis = (): ColorAnalysis => generateColorAnalysis(prng(42));
const fillsAndStrokes = (root: Element) =>
  [...root.querySelectorAll("[fill], [stroke]")].flatMap((el) => [el.getAttribute("fill"), el.getAttribute("stroke")]).filter((v): v is string => !!v && v !== "none");

describe("StructureWheel", () => {
  it("describes the structure, its model, rotation and ΔE for screen readers", () => {
    const a = analysis();
    render(<StructureWheel structure={a.structures[0]} palette={a.palette} />);
    const wheel = screen.getByRole("img", { name: /Kolmikharmoonia/ });
    expect(wheel).toHaveAccessibleName(/3 punkti, leitud OKLCH mudelis, pööre \d+°\. Keskmine ΔE ideaalist [\d.]+, suurim [\d.]+\. Ratas: OKLCH, OKLCH mediaanheledusel L [\d.]+\. Heledusvahe tumedaimast kuni [\d.]+\./);
  });

  it("draws one empty ideal circle per point, sized by its ΔE, and one filled dot", () => {
    const a = analysis();
    const s = a.structures[0];
    render(<StructureWheel structure={s} palette={a.palette} />);
    const ideals = screen.getAllByTestId("ideal");
    expect(ideals).toHaveLength(s.points.length);
    expect(screen.getAllByTestId("actual")).toHaveLength(s.points.length);
    // A larger ΔE gives a larger circle.
    const radii = ideals.map((c) => Number(c.getAttribute("r")));
    const order = s.points.map((p) => p.deltaE);
    const [lo, hi] = [order.indexOf(Math.min(...order)), order.indexOf(Math.max(...order))];
    if (order[lo] !== order[hi]) expect(radii[hi]).toBeGreaterThan(radii[lo]);
    ideals.forEach((c) => expect(c).toHaveAttribute("fill", "none"));
    // Halfway between the page and the lightness ring's colour (P-034).
    ideals.forEach((c) => expect(c).toHaveClass("stroke-delta"));
    // Larger than any dot with its lightness ring, so a ΔE circle never hides inside a ring.
    const outer = screen.getAllByTestId("lightness").map((c) => Number(c.getAttribute("r")) + Number(c.getAttribute("stroke-width")) / 2);
    for (const r of radii) expect(r).toBeGreaterThan(Math.max(...outer));
    // Drawn after every dot and lightness ring, so nothing covers them.
    const marks = [...document.querySelectorAll("[data-testid]")].map((el) => el.getAttribute("data-testid"));
    expect(marks.indexOf("ideal")).toBeGreaterThan(Math.max(marks.lastIndexOf("actual"), marks.lastIndexOf("lightness")));
    screen.getAllByTestId("lightness").forEach((c) => expect(c).toHaveAttribute("stroke", "var(--color-ink)"));
  });

  it("uses only OKLCH and theme colours, never hex or rgb()", () => {
    const a = analysis();
    const { container } = render(<StructureWheel structure={a.structures[2]} palette={a.palette} />);
    for (const v of fillsAndStrokes(container.querySelector("svg")!)) expect(v).toMatch(/^(oklch\(|var\(--)/);
  });

  it("defaults to OKLCH, offers the other models and marks the structure's original wheel", async () => {
    const a = analysis();
    const hsl = a.structures.find((s) => s.model === "hsl")!;
    render(<StructureWheel structure={hsl} palette={a.palette} />);
    expect(screen.getByRole("button", { name: "OKLCH" })).toHaveAttribute("aria-pressed", "true");
    const original = screen.getByRole("button", { name: "HSL · algne ratas" });
    const before = screen.getAllByTestId("actual").map((c) => c.getAttribute("cx"));

    await userEvent.setup().click(original);

    expect(original).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img")).toHaveAccessibleName(/Ratas: HSL, OKLCH mediaanheledusel/);
    // The points move to the HSL wheel.
    expect(screen.getAllByTestId("actual").map((c) => c.getAttribute("cx"))).not.toEqual(before);
  });

  it("lists the points as a table: actual, ideal and ΔE", () => {
    const a = analysis();
    render(<StructureWheel structure={a.structures[0]} palette={a.palette} />);
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(1 + a.structures[0].points.length);
    expect(rows[1]).toHaveTextContent(/^oklch\(.*\)oklch\(.*\)\d\.\d{3}\d\.\d{3}\d\.\d{3}$/);
  });

  it("thickens the ring around each colour with its OKLCH lightness above the darkest, on every model's wheel", async () => {
    const a = analysis();
    const s = a.structures[0];
    render(<StructureWheel structure={s} palette={a.palette} />);
    const widths = () => screen.getAllByTestId("lightness").map((c) => Number(c.getAttribute("stroke-width")));
    const ls = s.points.map((p) => p.actual.l);
    const before = widths();
    // The darkest colour gets the 1 px hairline; lighter colours get thicker rings.
    expect(before[ls.indexOf(Math.min(...ls))]).toBe(1);
    expect(before[ls.indexOf(Math.max(...ls))]).toBeGreaterThan(1);
    await userEvent.setup().click(screen.getByRole("button", { name: "HSL" }));
    expect(widths()).toEqual(before);
  });

  it("draws every model's ring at the median OKLCH lightness of the colours", async () => {
    const a = analysis();
    const s = a.structures[0];
    const { container } = render(<StructureWheel structure={s} palette={a.palette} />);
    const ls = s.points.map((p) => p.actual.l).sort((x, y) => x - y);
    const median = (ls[1] * 100).toFixed(2);
    const ringLs = () => new Set([...container.querySelectorAll("svg > path")].map((el) => el.getAttribute("fill")!.match(/^oklch\(([\d.]+)%/)![1]));
    expect(ringLs()).toEqual(new Set([median]));
    await userEvent.setup().click(screen.getByRole("button", { name: "RYB (kunstniku ratas)" }));
    expect(ringLs()).toEqual(new Set([median]));
  });
});

describe("RampStrip", () => {
  it("shows each colour in OKLCH and the ΔE of every step", () => {
    const ramp = analysis().structures[1];
    render(<RampStrip structure={ramp} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(ramp.points.length);
    expect(screen.getAllByText(/^Δ \d\.\d{3}$/)).toHaveLength(ramp.points.length - 1);
    expect(screen.getByText(/Sihtsamm ΔE 0\.015/)).toBeInTheDocument();
  });
});

describe("FindingsPanel", () => {
  const finding = (over: Partial<Finding>): Finding => ({
    id: "x",
    kind: "ui.dark-mode",
    area: "ui",
    severity: "info",
    title: "server title",
    meta: { provenance: "measured", confidence: 0.72, method: "a rule", requires: "pixels" },
    ...over,
  });

  it("groups findings by area in a fixed order", () => {
    render(
      <FindingsPanel
        palette={[]}
        findings={[finding({ id: "a", area: "artefact", kind: "artefact.banding" }), finding({ id: "b", area: "ui" })]}
      />,
    );
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Kasutajaliides", "Digitaalsed artefaktid"]);
  });

  it("shows a known kind's label, severity as text, confidence, provenance and requirements", () => {
    render(<FindingsPanel palette={[]} findings={[finding({ severity: "warning", caveats: undefined } as Partial<Finding>)]} />);
    expect(screen.getByRole("heading", { name: "Tume režiim" })).toBeInTheDocument();
    // A measured value is called measured, never "100 %" (#90).
    expect(screen.getByText("Hoiatus · mõõdetud väärtus")).toBeInTheDocument();
    expect(screen.getByText(/mõõdetud · piisab pikslitest · a rule/)).toBeInTheDocument();
  });

  it("still renders an unknown kind with the server's title, its metrics and caveats", () => {
    render(
      <FindingsPanel
        palette={[]}
        findings={[
          finding({
            kind: "other.brand-new",
            area: "other",
            title: "Täiesti uus leid",
            metrics: [{ key: "k", label: "Mõõt", value: 3, min: 0, max: 10 }],
            meta: { provenance: "inferred", confidence: 0.5, method: "m", requires: "scene", caveats: ["needs-scene-data", "tagged-p3-read-as-srgb"] },
          }),
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Täiesti uus leid" })).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Mõõt" })).toHaveAttribute("value", "3");
    expect(screen.getByText(/loeti sRGB-na/)).toBeInTheDocument();
    expect(screen.getByText(/vajab ekraanipildi tööriista andmeid/)).toBeInTheDocument();
  });

  it("draws swatches and gradients in OKLCH and names them as text", () => {
    const c = { l: 0.5, c: 0.1, h: 30 };
    const { container } = render(
      <FindingsPanel palette={[]} findings={[finding({ swatches: [{ color: c, label: "taust" }], gradient: [{ color: c, at: 0 }, { color: { l: 0.9, c: 0, h: null }, at: 1 }] })]} />,
    );
    expect(screen.getByText("oklch(50.00% 0.10000 30.00)")).toBeInTheDocument();
    const styles = [...container.querySelectorAll<HTMLElement>("[style]")].map((e) => e.getAttribute("style") ?? "");
    expect(styles.join(" ")).not.toMatch(/rgb\(|#[0-9a-f]{3}/i);
  });
});

describe("ColorAnalysisSection", () => {
  it("says the analysis is simulated, lists the structures and switches between wheel and strip", async () => {
    render(<ColorAnalysisSection analysis={analysis()} />);
    expect(screen.getByRole("note")).toHaveTextContent("Näidisandmed");
    const list = screen.getByRole("list", { name: "Leitud struktuurid" });
    expect(within(list).getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("img", { name: /Kolmikharmoonia/ })).toBeInTheDocument();

    await userEvent.setup().click(within(list).getByRole("button", { name: /Sama heledus, võrdsed ΔE sammud/ }));

    expect(screen.queryByRole("img", { name: /Kolmikharmoonia/ })).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Sama heledus, võrdsed ΔE sammud" })).toBeInTheDocument();
  });

  it("shows the findings, including dark mode", () => {
    render(<ColorAnalysisSection analysis={analysis()} />);
    expect(screen.getByRole("heading", { name: "Tume režiim" })).toBeInTheDocument();
  });

  it("does not claim simulation for a computed analysis", () => {
    render(<ColorAnalysisSection analysis={{ ...analysis(), status: "computed" }} />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});

describe("confidenceText (#90: never '100 %')", () => {
  it.each([
    [0.49, "inferred", "kindlus: madal"],
    [0.5, "inferred", "kindlus: keskmine"],
    [0.79, "fitted", "kindlus: keskmine"],
    [0.8, "fitted", "kindlus: kõrge"],
    [1, "inferred", "kindlus: kõrge"],
    [1, "measured", "mõõdetud väärtus"],
  ] as const)("reads confidence %f (%s) as %s", (confidence, provenance, text) => {
    expect(confidenceText({ confidence, provenance })).toBe(text);
    expect(confidenceText({ confidence, provenance })).not.toMatch(/%/);
  });
});

describe("ColorAnalysisSection collapsing (#90)", () => {
  it("can be folded away, and keeps technical settings behind their own disclosure with readable names", () => {
    const { container } = render(<ColorAnalysisSection analysis={analysis()} />);
    const outer = container.querySelector("details");
    expect(outer).toHaveAttribute("open");
    expect(screen.getByText("Tehnilised üksikasjad: töötluse sammud ja seaded")).toBeInTheDocument();
    expect(screen.queryByText(/#32/)).not.toBeInTheDocument();
  });
});
