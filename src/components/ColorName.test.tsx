import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildNameIndex } from "@/core/color/names";
import { ColorName, setNameIndexForTests } from "./ColorName";

const index = buildNameIndex([
  { name: "Pure Red", hex: "#ff0000" },
  { name: "Night", hex: "#000000" },
  { name: "Snow", hex: "#ffffff" },
]);

describe("ColorName", () => {
  it("shows nothing until the name list has loaded", () => {
    const { container } = render(<ColorName color={{ r: 250, g: 5, b: 5 }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the nearest name, marked approximate, once loaded", () => {
    render(<ColorName color={{ r: 250, g: 5, b: 5 }} />);
    act(() => setNameIndexForTests(index));
    expect(screen.getByText("≈ Pure Red")).toBeInTheDocument();
  });

  it("names OKLCH colours too", () => {
    setNameIndexForTests(index);
    render(<ColorName color={{ l: 0.99, c: 0, h: null }} />);
    expect(screen.getByText("≈ Snow")).toBeInTheDocument();
  });

  it("loads the list lazily through its loader, once", async () => {
    let calls = 0;
    setNameIndexForTests(null, async () => {
      calls++;
      return index;
    });
    render(
      <>
        <ColorName color={{ r: 0, g: 0, b: 0 }} />
        <ColorName color={{ r: 1, g: 1, b: 1 }} />
      </>,
    );
    expect(await screen.findAllByText("≈ Night")).toHaveLength(2);
    expect(calls).toBeGreaterThanOrEqual(1);
  });
});
