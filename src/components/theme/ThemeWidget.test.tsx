import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithServices } from "@/test/render";
import { ThemeWidget } from "./ThemeWidget";

describe("ThemeWidget (#91)", () => {
  it("is a fixed tab on the right edge that opens the picker and closes with Escape", async () => {
    const user = userEvent.setup();
    renderWithServices(<ThemeWidget />);
    expect(screen.getByRole("complementary", { name: "Teema" })).toHaveClass("fixed", "right-0");
    const tab = screen.getByRole("button", { name: "Teema" });
    expect(tab).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("textbox", { name: "Taust" })).not.toBeInTheDocument();

    await user.click(tab);
    expect(screen.getByRole("button", { name: "Sulge teema" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("textbox", { name: "Taust" })).toBeVisible();

    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Teema" })).toHaveAttribute("aria-expanded", "false");
  });
});

describe("ThemeWidget loading (P-040 item 2)", () => {
  it("does not mount the picker, and so loads no colour names, while closed", () => {
    renderWithServices(<ThemeWidget />);
    expect(screen.queryByRole("button", { name: "Salvesta teema" })).not.toBeInTheDocument();
  });

  it("stays open when Escape was already handled inside it", async () => {
    const user = userEvent.setup();
    renderWithServices(<ThemeWidget />);
    await user.click(screen.getByRole("button", { name: "Teema" }));
    const handled = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    handled.preventDefault();
    window.dispatchEvent(handled);
    expect(await screen.findByRole("button", { name: "Sulge teema" })).toHaveAttribute("aria-expanded", "true");
  });
});
