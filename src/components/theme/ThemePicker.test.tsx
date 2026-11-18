import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { addTheme, DEFAULT_THEME_STATE } from "@/core/theme/theme";
import { renderWithServices, testServices } from "@/test/render";
import { ThemePicker } from "./ThemePicker";

const pageVar = (name: string) => document.documentElement.style.getPropertyValue(name);

describe("ThemePicker", () => {
  it("previews a typed hex colour on the page as OKLCH", async () => {
    renderWithServices(<ThemePicker />);
    const bg = screen.getByRole("textbox", { name: "Taust" });
    const u = userEvent.setup();

    await u.clear(bg);
    await u.type(bg, "00fbff");

    expect(screen.getByLabelText("Taust: värvivalija")).toHaveValue("#00fbff");
    expect(pageVar("--theme-bg")).toBe("oklch(from #00fbff l c h)");
  });

  it("keeps a half-typed value without changing the colour", async () => {
    renderWithServices(<ThemePicker />);
    const text = screen.getByRole("textbox", { name: "Tekst" });
    const u = userEvent.setup();

    await u.clear(text);
    await u.type(text, "#12");

    expect(text).toHaveValue("#12");
    expect(screen.getByLabelText("Tekst: värvivalija")).toHaveValue("#111111");
  });

  it("puts the last valid colour back when a half-typed value loses focus", async () => {
    renderWithServices(<ThemePicker />);
    const text = screen.getByRole("textbox", { name: "Tekst" });
    const u = userEvent.setup();

    await u.clear(text);
    await u.type(text, "#12");
    await u.tab();

    expect(text).toHaveValue("#111111");
  });

  it("describes each field with its colour in OKLCH, following committed colours only", async () => {
    renderWithServices(<ThemePicker />);
    const bg = screen.getByRole("textbox", { name: "Taust" });
    expect(bg).toHaveAccessibleDescription("OKLCH: oklch(100.00% 0 none)");
    const u = userEvent.setup();

    await u.clear(bg);
    await u.type(bg, "#ff");
    // Half-typed: the colour and its description stay as they were.
    expect(bg).toHaveAccessibleDescription("OKLCH: oklch(100.00% 0 none)");
    await u.type(bg, "0000");
    expect(bg).toHaveAccessibleDescription("OKLCH: oklch(62.80% 0.25768 29.23)");
  });

  it("caps the hex field at 7 characters", async () => {
    renderWithServices(<ThemePicker />);
    const bg = screen.getByRole("textbox", { name: "Taust" });
    const u = userEvent.setup();

    await u.clear(bg);
    await u.type(bg, "#abcdef0");

    expect(bg).toHaveValue("#abcdef");
  });

  it("updates the hex field and the page from the colour picker", () => {
    renderWithServices(<ThemePicker />);

    fireEvent.input(screen.getByLabelText("Taust: värvivalija"), { target: { value: "#ff0000" } });

    expect(screen.getByRole("textbox", { name: "Taust" })).toHaveValue("#ff0000");
    expect(pageVar("--theme-bg")).toBe("oklch(from #ff0000 l c h)");
  });

  it("saves a theme to the store and makes it current", async () => {
    const services = testServices();
    renderWithServices(<ThemePicker />, services);
    const u = userEvent.setup();

    const bg = screen.getByRole("textbox", { name: "Taust" });
    await u.clear(bg);
    await u.type(bg, "#000000");
    const text = screen.getByRole("textbox", { name: "Tekst" });
    await u.clear(text);
    await u.type(text, "#ffffff");
    await u.click(screen.getByRole("button", { name: "Salvesta teema" }));

    await waitFor(async () => {
      const saved = await services.themes.load();
      expect(saved.currentId).toBe("#000000_#ffffff");
      expect(saved.themes).toHaveLength(2);
    });
  });

  it("loads saved themes and switches to one picked from the list", async () => {
    const services = testServices();
    await services.themes.save(addTheme(DEFAULT_THEME_STATE, "#000000", "#ffffff"));
    renderWithServices(<ThemePicker />, services);
    const u = userEvent.setup();

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Taust" })).toHaveValue("#000000"));

    await u.click(screen.getByRole("combobox", { name: "Salvestatud teemad" }));
    await u.click(await screen.findByRole("option", { name: "#ffffff / #111111" }));

    expect(screen.getByRole("textbox", { name: "Taust" })).toHaveValue("#ffffff");
    expect(pageVar("--theme-text")).toBe("oklch(from #111111 l c h)");
    await waitFor(async () => expect((await services.themes.load()).currentId).toBe("default"));
  });
});
