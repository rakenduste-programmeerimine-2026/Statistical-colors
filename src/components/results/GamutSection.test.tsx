import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { simulateGamut } from "@/adapters/simulated/gamut";
import type { ColorCount } from "@/core/analysis/types";
import { latticeFor } from "@/core/gamut/lattice";
import { snapColors } from "@/core/gamut/snap";
import { OKLAB } from "@/core/gamut/space";
import { describePoint } from "./GamutCanvas";
import { GamutSection } from "./GamutSection";

const colors: ColorCount[] = [
  { r: 255, g: 255, b: 255, count: 50, percent: 50 },
  { r: 200, g: 30, b: 30, count: 30, percent: 30 },
  { r: 201, g: 30, b: 30, count: 20, percent: 20 },
];
const status = (term: string) => screen.getByText(term, { selector: "dt" }).nextElementSibling?.textContent;

describe("GamutSection", () => {
  it("shows the server's coverage, labelled when simulated", () => {
    render(<GamutSection colors={colors} coverage={simulateGamut(colors)} simulated />);
    // The terms carry their explanations for screen readers, so check the figures, not one sentence.
    expect(screen.getByRole("status")).toHaveTextContent("0.03 %");
    expect(screen.getByRole("status")).toHaveTextContent("(2 / 6789 OKLab");
    expect(screen.getByRole("button", { name: "just märgatav erinevus" })).toHaveAccessibleDescription(/JND/);
    expect(screen.getByRole("status")).toHaveTextContent("Näidisandmed");
  });

  it("says so when the server sent no coverage", () => {
    render(<GamutSection colors={colors} simulated={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("Katvust pole server veel saatnud.");
  });

  it("starts with the whole cloud selected, in OKLab (P-039 item 1)", () => {
    render(<GamutSection colors={colors} simulated={false} />);
    expect(status("Ruum")).toBe("OKLab (a, b, L)");
    expect(status("Võimalikke täppe")).toBe("6789");
    expect(status("Valitud täppe")).toBe("6789");
    expect(status("Neutraalseid täppe")).toBe("51");
    expect(status("Pildi värve")).toBe("3 → 2 täppi");
    expect(screen.getByText(/^Filtreeri/)).not.toHaveTextContent("näidatakse");
  });

  it("explains the big and small dots in a legend", () => {
    render(<GamutSection colors={colors} simulated={false} />);
    const legend = screen.getByRole("list", { name: "Legend" });
    expect(legend).toHaveTextContent("väike täpp: võimalik värv");
    expect(legend).toHaveTextContent("suur raamiga täpp: pildi värv");
    expect(legend).toHaveTextContent(/mida suurem, seda suurem osakaal/);
  });

  it("switches to CIELAB with the whole cloud, every one of its 13 000 dots selected", async () => {
    render(<GamutSection colors={colors} simulated={false} />);
    await userEvent.setup().click(screen.getByRole("radio", { name: "CIELAB (D50)" }));
    expect(status("Ruum")).toBe("CIELAB (D50) (a*, b*, L*)");
    // Estonian number format groups with a no-break space.
    expect(status("Võimalikke täppe")).toBe("13 000");
    expect(status("Valitud täppe")).toBe("13 000");
    expect(status("Võrgu samm")).toBe("ΔL* = Δa* = Δb* = 4");
  });

  it("filters by lightness and says how many dots it shows", () => {
    render(<GamutSection colors={colors} simulated={false} />);
    fireEvent.change(screen.getByRole("slider", { name: "Heledus kuni" }), { target: { value: "0.5" } });
    const shown = Number(status("Valitud täppe")?.replace(/D/g, ""));
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(6789);
    expect(screen.getByText(/^Filtreeri/)).toHaveTextContent(`näidatakse ${shown} täppi 6789-st`);
    fireEvent.click(screen.getByRole("button", { name: "Näita kõiki täppe" }));
    expect(status("Valitud täppe")).toBe("6789");
  });

  it("refuses a minimum above the maximum", () => {
    render(<GamutSection colors={colors} simulated={false} />);
    fireEvent.change(screen.getByRole("slider", { name: "Kroom vähemalt" }), { target: { value: "0.3" } });
    fireEvent.change(screen.getByRole("slider", { name: "Kroom kuni" }), { target: { value: "0.1" } });
    expect(screen.getByRole("alert")).toHaveTextContent("vähim väärtus peab olema suurimast väiksem");
    expect(status("Valitud täppe")).toBe("—");
  });

  it("keeps the notebook's hue window and neutrals filter", () => {
    render(<GamutSection colors={colors} simulated={false} />);
    fireEvent.change(screen.getByRole("slider", { name: "Tooni vahemik" }), { target: { value: "30" } });
    const narrow = Number(status("Valitud täppe")?.replace(/D/g, ""));
    expect(narrow).toBeLessThan(6789 - 51);
    fireEvent.click(screen.getByRole("checkbox", { name: /Kaasa hallid/ }));
    expect(Number(status("Valitud täppe")?.replace(/D/g, ""))).toBe(narrow - 51);
  });

  it("shows readable slider values with units and range ends", () => {
    render(<GamutSection colors={colors} simulated={false} />);
    expect(screen.getByRole("slider", { name: "Tooni vahemik" })).toHaveAttribute("aria-valuetext", "360°");
  });

  it("describes the view for screen readers, with or without the image's colours", async () => {
    render(<GamutSection colors={colors} coverage={simulateGamut(colors)} simulated />);
    const canvas = screen.getByRole("img", { name: /Värviruum 3D/ });
    expect(canvas).toHaveAccessibleName("Värviruum 3D: OKLab, 6789 võimalikku värvi. Pildi 3 värvi täidavad 2 punkti. Pilt katab 0.03 % sRGB gamutist.");
    expect(canvas).toHaveAttribute("tabindex", "0");
    await userEvent.setup().click(screen.getByRole("checkbox", { name: "Näita pildi värve" }));
    expect(canvas).toHaveAccessibleName("Värviruum 3D: OKLab, 6789 võimalikku värvi. Pilt katab 0.03 % sRGB gamutist.");
  });

  it("explains the camera keys for the chosen mode", async () => {
    render(<GamutSection colors={colors} simulated={false} />);
    expect(screen.getByText(/Tiirle: lohista pööramiseks/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("radio", { name: "Lenda" }));
    expect(screen.getByText(/Lenda: W A S D või nooled liigutavad, Q ja E alla ja üles/)).toBeInTheDocument();
  });
});

describe("describePoint", () => {
  it("prints L, a, b and hex like the notebook's hover, plus the image's share when occupied", () => {
    const lattice = latticeFor(OKLAB);
    const snapped = snapColors(lattice, colors);
    const white = snapped.occupied.find((i) => lattice.rgb[3 * i] === 255 && lattice.rgb[3 * i + 1] === 255)!;
    expect(describePoint(lattice, white, snapped)).toBe("L=1.000  a=0.000  b=0.000  #FFFFFF\nPildi värve: 1, osakaal 50.00 %");
    expect(describePoint(lattice, 0, null)).not.toMatch(/Pildi värve/);
  });
});
