import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { setNameIndexForTests } from "@/components/ColorName";

// Colour names load lazily in the app; tests show none unless a test provides an index.
setNameIndexForTests(null);

afterEach(() => {
  cleanup();
  setNameIndexForTests(null);
});

// jsdom lacks these browser APIs; Radix Select calls the first three when it opens.
if (typeof window !== "undefined") {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  // jsdom has no canvas 2D; the pixel preview skips drawing without it.
  HTMLCanvasElement.prototype.getContext = () => null;
}
