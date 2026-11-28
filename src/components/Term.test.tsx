import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { GLOSSARY } from "@/core/glossary";
import { Term } from "./Term";

describe("Term", () => {
  it("explains the term to screen readers at all times", () => {
    render(<Term k="deltaE">ΔE</Term>);
    expect(screen.getByRole("button", { name: "ΔE" })).toHaveAccessibleDescription(GLOSSARY.deltaE);
  });

  it("shows the explanation on keyboard focus and hides it with Escape", async () => {
    const user = userEvent.setup();
    render(<Term k="chroma">kroom</Term>);
    const tip = screen.getByRole("tooltip", { hidden: true });
    expect(tip).toHaveClass("sr-only");
    await user.tab();
    expect(tip).not.toHaveClass("sr-only");
    await user.keyboard("{Escape}");
    expect(tip).toHaveClass("sr-only");
  });

  it("toggles on tap, for touch screens", () => {
    render(<Term k="gamut">gamut</Term>);
    const button = screen.getByRole("button", { name: "gamut" });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("has an explanation for every glossary entry", () => {
    for (const text of Object.values(GLOSSARY)) expect(text.length).toBeGreaterThan(20);
  });
});
