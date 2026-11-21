import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithServices } from "@/test/render";
import Home from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("Home page", () => {
  it("shows the app name as the main heading", () => {
    renderWithServices(<Home />);

    expect(screen.getByRole("heading", { level: 1, name: "Värvi tükeldaja" })).toBeInTheDocument();
  });

  it("has the upload form; the theme picker moved to the layout's right-edge widget (#91)", () => {
    renderWithServices(<Home />);

    expect(screen.getByRole("region", { name: "Pildi üleslaadimine" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Teema" })).not.toBeInTheDocument();
  });
});
