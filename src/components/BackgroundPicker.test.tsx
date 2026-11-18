import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { BackgroundPicker, backgroundCss, contrastInk } from "./BackgroundPicker";

describe("contrastInk", () => {
  // OKLCH lightness 0.6 is the turn (P-037 item 2).
  it.each([
    ["#000000", "oklch(0.97 0 0)"],
    ["#1e1e1e", "oklch(0.97 0 0)"],
    ["#808080", "oklch(0.97 0 0)"], // L 0.59987, just below the turn
    ["#818181", "oklch(0.18 0 0)"], // L 0.60325, just above
    ["#ffffff", "oklch(0.18 0 0)"],
  ])("puts readable text on %s", (hex, ink) => expect(contrastInk(hex)).toBe(ink));
});

describe("BackgroundPicker", () => {
  function Harness() {
    const [value, setValue] = useState<string | null>(null);
    return (
      <>
        <BackgroundPicker label="Taust" value={value} onChange={setValue} presets={[{ label: "vaikimisi", hex: null }, { label: "must", hex: "#000000" }]} defaultHex="#8a929c" defaultSwatch="bg-stage" />
        <div data-testid="view" style={value ? { background: backgroundCss(value) } : undefined} />
      </>
    );
  }

  it("applies a preset to its view only, as OKLCH, and goes back to the default", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const group = screen.getByRole("group", { name: "Taust" });
    expect(within(group).getByRole("button", { name: "vaikimisi" })).toHaveAttribute("aria-pressed", "true");

    await user.click(within(group).getByRole("button", { name: "must" }));
    // jsdom may rewrite the hex inside the colour function as rgb().
    expect(screen.getByTestId("view").getAttribute("style")).toMatch(/oklch\(from (#000000|rgb\(0, 0, 0\)) l c h\)/);
    expect(document.documentElement.style.getPropertyValue("--color-page")).toBe("");

    await user.click(within(group).getByRole("button", { name: "vaikimisi" }));
    // React leaves an empty style attribute behind; no background is set.
    expect(screen.getByTestId("view").style.background).toBe("");
  });

  it("takes any colour from the colour input, which shows the default until one is picked", () => {
    render(<Harness />);
    const input = screen.getByLabelText("muu");
    expect(input).toHaveValue("#8a929c");
    fireEvent.change(input, { target: { value: "#336699" } });
    expect(screen.getByTestId("view").getAttribute("style")).toMatch(/oklch\(from (#336699|rgb\(51, 102, 153\)) l c h\)/);
    expect(screen.getByRole("button", { name: "must" })).toHaveAttribute("aria-pressed", "false");
  });
});
