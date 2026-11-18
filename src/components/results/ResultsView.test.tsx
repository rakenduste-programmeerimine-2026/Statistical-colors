import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageAnalysis } from "@/core/analysis/types";
import { renderWithServices, testServices } from "@/test/render";
import { ResultsView } from "./ResultsView";

const route = { id: "", query: "" };
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: route.id }),
  useSearchParams: () => new URLSearchParams(route.query),
}));

const saveFile = vi.fn();
vi.mock("./download", () => ({ saveFile: (...args: unknown[]) => saveFile(...args) }));
vi.mock("../preview/PixelViewer", () => ({
  PixelViewer: ({ source, name }: { source: string; name: string }) => (
    <p data-testid="preview">
      {name} {source}
    </p>
  ),
}));

const analysis: ImageAnalysis = {
  id: "palette__0123456789abcdef",
  fileName: "palette.png",
  width: 2,
  height: 2,
  totalPixels: 4,
  uniqueColors: 3,
  includeAlpha: false,
  topN: 2,
  colors: [
    { r: 255, g: 0, b: 0, count: 2, percent: 50 },
    { r: 0, g: 255, b: 0, count: 1, percent: 25 },
    { r: 0, g: 0, b: 255, count: 1, percent: 25 },
  ],
};

function servicesWith(stored: ImageAnalysis | null) {
  const services = testServices();
  vi.spyOn(services.analysis, "getAnalysis").mockResolvedValue(stored);
  return services;
}

describe("ResultsView", () => {
  beforeEach(() => {
    route.id = analysis.id;
    route.query = "";
    saveFile.mockReset();
  });

  it("shows the image summary like the original", async () => {
    renderWithServices(<ResultsView />, servicesWith(analysis));
    const summary = await screen.findByRole("region", { name: "Pildi andmed" });
    expect(summary).toHaveTextContent("palette.png");
    expect(summary).toHaveTextContent("Mõõdud: 2 × 2");
    expect(summary).toHaveTextContent("Piksleid kokku: 4");
    expect(summary).toHaveTextContent("Unikaalseid värve: 3");
    expect(summary).toHaveTextContent("Režiim: RGB");
  });

  it("shows the top N chosen on upload", async () => {
    renderWithServices(<ResultsView />, servicesWith(analysis));
    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(1 + 2);
    expect(rows[1]).toHaveTextContent("(255, 0, 0)#FF0000oklch(62.80% 0.25768 29.23)250.000000%");
  });

  it.each([
    ["3", 3],
    ["1", 1],
    ["0", 1],
    ["999", 3],
  ])("lets ?top_n=%s override it", async (query, expectedRows) => {
    route.query = `top_n=${query}`;
    renderWithServices(<ResultsView />, servicesWith(analysis));
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(1 + expectedRows);
  });

  it("shows RGBA columns in alpha mode", async () => {
    const rgba = { ...analysis, includeAlpha: true, colors: [{ r: 1, g: 2, b: 3, a: 4, count: 4, percent: 100 }] };
    renderWithServices(<ResultsView />, servicesWith(rgba));
    const table = await screen.findByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Hex + alfa" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "OKLCH" })).toBeInTheDocument();
    expect(table).toHaveTextContent("(1, 2, 3, 4)#010203 004oklch(8.23% 0.00804 240.75 / 0.016)4100.000000%");
  });

  it("warns when the data is simulated", async () => {
    renderWithServices(<ResultsView />, servicesWith({ ...analysis, simulated: true }));
    expect(await screen.findByRole("note")).toHaveTextContent("Näidisandmed");
  });

  it("does not warn for real data", async () => {
    renderWithServices(<ResultsView />, servicesWith(analysis));
    await screen.findByRole("table");
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("labels the colour picker study example and previews its image", async () => {
    renderWithServices(
      <ResultsView />,
      servicesWith({ ...analysis, fileName: "palette (1).bmp", example: true, imageUrl: "/demo/palette.bmp" }),
    );
    expect(await screen.findByRole("note")).toHaveTextContent("varasemast värvivalijate uuringust");
    expect(screen.getByTestId("preview")).toHaveTextContent("palette (1).bmp /demo/palette.bmp");
  });

  it("shows no preview when the image is not stored", async () => {
    renderWithServices(<ResultsView />, servicesWith(analysis));
    await screen.findByRole("table");
    expect(screen.queryByTestId("preview")).not.toBeInTheDocument();
  });

  it("says when the result is missing", async () => {
    renderWithServices(<ResultsView />, servicesWith(null));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tulemust ei leitud");
    expect(screen.getByRole("link", { name: "Töötle teine pilt" })).toHaveAttribute("href", "/");
  });

  it("says so when a CSV file cannot be found", async () => {
    const services = servicesWith(analysis);
    vi.spyOn(services.analysis, "getCsv").mockResolvedValue(null);
    renderWithServices(<ResultsView />, services);

    await userEvent.setup().click(await screen.findByRole("button", { name: "Laadi alla värvide kokkuvõtte CSV" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Faili ei leitud.");
    expect(saveFile).not.toHaveBeenCalled();
  });

  it("downloads both CSV files", async () => {
    const services = servicesWith(analysis);
    const csv = { fileName: "x.csv", content: new Blob(["a"]) };
    const getCsv = vi.spyOn(services.analysis, "getCsv").mockResolvedValue(csv);
    renderWithServices(<ResultsView />, services);
    const u = userEvent.setup();

    await u.click(await screen.findByRole("button", { name: "Laadi alla piksel-haaval CSV" }));
    await u.click(screen.getByRole("button", { name: "Laadi alla värvide kokkuvõtte CSV" }));

    expect(getCsv.mock.calls).toEqual([
      [analysis.id, "pixels"],
      [analysis.id, "summary"],
    ]);
    expect(saveFile).toHaveBeenCalledTimes(2);
  });
});
