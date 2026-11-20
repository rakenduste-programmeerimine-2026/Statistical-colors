import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { generateColorAnalysis } from "@/adapters/simulated/color-analysis";
import { prng } from "@/adapters/simulated/random";
import type { ColorCount, ImageAnalysis } from "@/core/analysis/types";
import { ColorTableSection } from "./ColorTableSection";

const colorAnalysis = generateColorAnalysis(prng(1));
const [c0, c1] = colorAnalysis.palette.map((p) => p.id);
const row = (r: number, percent: number, chance: number, clusterId: string): ColorCount => ({
  r,
  g: 0,
  b: 0,
  count: 1,
  percent,
  artefacts: [{ kind: "artefact.antialias-blend", chance }],
  clusterId,
});

// Two share bands (≈ 30 % and ≈ 0.02 %), two clusters, likely and clean artefacts.
const analysis = (over: Partial<ImageAnalysis> = {}): ImageAnalysis => ({
  id: "x",
  fileName: "x.png",
  width: 1,
  height: 1,
  totalPixels: 1,
  uniqueColors: 5,
  includeAlpha: false,
  topN: 2,
  colors: [row(1, 40, 0.1, c0), row(2, 30, 0.6, c1), row(3, 0.03, 0.9, c0), row(4, 0.02, 0.2, c1), row(5, 0.01, 0.5, c0)],
  rowDataStatus: "simulated",
  colorAnalysis,
  ...over,
});
const bodyRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

describe("ColorTableSection", () => {
  it("shows each colour's most likely artefact with its chance, and says the values are simulated", () => {
    render(<ColorTableSection analysis={analysis()} topN={2} />);
    expect(screen.getByRole("columnheader", { name: "Segupiksel / artefakt" })).toBeInTheDocument();
    expect(bodyRows()[0]).toHaveTextContent("10 %Servade silumise vahevärvid");
    expect(screen.getByRole("meter", { name: "Servade silumise vahevärvid: 60 %" })).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Näidisandmed");
  });

  it("names the rows it lists, not the requested count, when there are fewer colours (regression #90)", () => {
    render(<ColorTableSection analysis={analysis({ uniqueColors: 5 })} topN={5000} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("5 sagedasemat värvi");
    expect(screen.getByText(/tabelis on kõik 5 värvi/)).toBeInTheDocument();
  });

  it("names the requested count when it is smaller than the number of colours", () => {
    render(<ColorTableSection analysis={analysis({ uniqueColors: 5 })} topN={2} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("2 sagedasemat värvi");
    expect(screen.getByText(/tabelis on 2 sagedasemat 5-st/)).toBeInTheDocument();
  });

  it("offers share bands with counts and filters over every colour, beyond the top N", async () => {
    render(<ColorTableSection analysis={analysis()} topN={2} />);
    const bands = within(screen.getByRole("group", { name: "Osakaalu klass" })).getAllByRole("button");
    expect(bands.map((b) => b.textContent)).toEqual(["kõik", "30–40 % · 2 värvi", "0.010–0.030 % · 3 värvi"]);

    await userEvent.setup().click(bands[2]);

    // These colours are not in the top 2, but the filter still finds them.
    expect(bodyRows().map((r) => r.textContent?.slice(0, 11))).toEqual(["(3, 0, 0)#0", "(4, 0, 0)#0"]);
    expect(screen.getByRole("status")).toHaveTextContent("3 värvi 5-st vastab filtrile; tabelis on 2 sagedasemat.");
  });

  it("filters by cluster and by artefact, combined, and says when nothing matches", async () => {
    const user = userEvent.setup();
    render(<ColorTableSection analysis={analysis()} topN={5} />);
    const clusters = within(screen.getByRole("group", { name: "Värviklaster" })).getAllByRole("button");
    expect(clusters).toHaveLength(3);
    await user.click(clusters[1]);
    expect(bodyRows()).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "tõenäoline (≥ 50 %)" }));
    // c0 rows with chance ≥ 0.5: 0.9 and exactly 0.5.
    expect(bodyRows()).toHaveLength(2);

    await user.click(within(screen.getByRole("group", { name: "Osakaalu klass" })).getAllByRole("button")[1]);
    expect(screen.getByRole("status")).toHaveTextContent("Ükski värv ei vasta filtrile.");

    await user.click(within(screen.getByRole("group", { name: "Osakaalu klass" })).getByRole("button", { name: "kõik" }));
    expect(bodyRows()).toHaveLength(2);
  });

  it("hides the cluster and artefact filters and the note when the server sent no such data", () => {
    const plain = analysis({ rowDataStatus: undefined, colors: analysis().colors.map(({ r, g, b, count, percent }) => ({ r, g, b, count, percent })) });
    render(<ColorTableSection analysis={plain} topN={5} />);
    expect(screen.queryByRole("group", { name: "Värviklaster" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Segupiksel või artefakt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(bodyRows()[0]).toHaveTextContent(/—$/);
  });
});
