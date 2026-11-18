import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewTooLargeError, type DecodedImage } from "./decode";
import { PixelViewer } from "./PixelViewer";

const decodeImage = vi.fn<(blob: Blob) => Promise<DecodedImage>>();
vi.mock("./decode", async (actual) => ({
  ...(await actual<typeof import("./decode")>()),
  decodeImage: (blob: Blob) => decodeImage(blob),
}));

/** 512 × 40 like the demo palette; pixel (0, 0) is #032F29, pixel (1, 0) half transparent. */
function palette(): DecodedImage {
  const pixels = new Uint8ClampedArray(512 * 40 * 4).fill(255);
  pixels.set([3, 47, 41, 255], 0);
  pixels.set([10, 20, 30, 128], 4);
  return {
    width: 512,
    height: 40,
    source: document.createElement("canvas"),
    pixels,
  };
}

const zoom = () => screen.getByLabelText("Suurendus");
const file = new File(["bmp"], "palette.bmp", { type: "image/bmp" });

describe("PixelViewer", () => {
  beforeEach(() => {
    decodeImage.mockReset().mockResolvedValue(palette());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fits a picked file and shows its size", async () => {
    render(<PixelViewer source={file} name="palette.bmp" />);
    expect(await screen.findByText("512 × 40 px")).toBeInTheDocument();
    expect(decodeImage).toHaveBeenCalledWith(file);
    // The test viewport is 640 × 360, so 1× is the largest whole zoom that fits.
    expect(zoom()).toHaveTextContent("1×");
  });

  it("zooms with the buttons and the keyboard", async () => {
    render(<PixelViewer source={file} name="palette.bmp" />);
    await screen.findByText("512 × 40 px");
    const u = userEvent.setup();

    await u.click(screen.getByRole("button", { name: "Suurenda" }));
    expect(zoom()).toHaveTextContent("2×");
    await u.click(screen.getByRole("button", { name: "Vähenda" }));
    await u.click(screen.getByRole("button", { name: "Vähenda" }));
    expect(zoom()).toHaveTextContent("1/2");

    screen.getByRole("img").focus();
    await u.keyboard("+");
    await u.keyboard("+");
    expect(zoom()).toHaveTextContent("2×");
    await u.keyboard("0");
    expect(zoom()).toHaveTextContent("1×");
  });

  it("reads the exact stored value under the cursor", async () => {
    render(<PixelViewer source={file} name="palette.bmp" />);
    await screen.findByText("512 × 40 px");
    const canvas = screen.getByRole("img");
    const readout = screen.getByLabelText("Piksel kursori all");

    // Fitted at 1× and centred in 640 × 360: the image starts at (64, 160).
    fireEvent.pointerMove(canvas, { clientX: 64, clientY: 160 });
    expect(readout).toHaveTextContent("x 0, y 0 · #032F29 · rgb 3, 47, 41 · oklch(27.48% 0.04715 181.31)");
    expect(readout).not.toHaveTextContent(", a");

    fireEvent.pointerMove(canvas, { clientX: 65, clientY: 160 });
    expect(readout).toHaveTextContent("x 1, y 0 · #0A141E · rgb 10, 20, 30, a 128 · oklch(18.70% 0.02534 249.32 / 0.502)");

    fireEvent.pointerMove(canvas, { clientX: 63, clientY: 160 });
    expect(readout).toHaveTextContent("Liigu pildil, et näha pikslit.");
  });

  it("zooms with Ctrl + scroll and leaves plain scrolling to the page", async () => {
    render(<PixelViewer source={file} name="palette.bmp" />);
    await screen.findByText("512 × 40 px");
    const canvas = screen.getByRole("img");

    const plain = new WheelEvent("wheel", { deltaY: -100, cancelable: true });
    canvas.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
    expect(zoom()).toHaveTextContent("1×");

    act(() => void canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, ctrlKey: true, cancelable: true })));
    expect(zoom()).toHaveTextContent("2×");
  });

  it("keeps fitting while the canvas is resized, until the user zooms", async () => {
    let resize: (width: number, height: number) => void = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: (entries: unknown[]) => void) {
          resize = (inlineSize, blockSize) =>
            act(() => callback([{ devicePixelContentBoxSize: [{ inlineSize, blockSize }] }]));
        }
        observe() {}
        disconnect() {}
      },
    );
    render(<PixelViewer source={file} name="palette.bmp" />);
    await screen.findByText("512 × 40 px");

    resize(300, 100); // narrower than the image during layout
    expect(zoom()).toHaveTextContent("1/2");
    resize(1253, 450); // the real size: 512 × 2 fits
    expect(zoom()).toHaveTextContent("2×");

    await userEvent.setup().click(screen.getByRole("button", { name: "Suurenda" }));
    resize(1300, 450);
    expect(zoom()).toHaveTextContent("3×");
  });

  it("returns to 1× with the 1:1 button", async () => {
    render(<PixelViewer source={file} name="palette.bmp" />);
    await screen.findByText("512 × 40 px");
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Vähenda" }));
    expect(zoom()).toHaveTextContent("1/2");
    await u.click(screen.getByRole("button", { name: "1:1" }));
    expect(zoom()).toHaveTextContent("1×");
  });

  it("drops the old image and fits the new one when the source changes", async () => {
    const { rerender } = render(<PixelViewer source={file} name="palette.bmp" />);
    await screen.findByText("512 × 40 px");
    await userEvent.setup().click(screen.getByRole("button", { name: "Suurenda" }));
    expect(zoom()).toHaveTextContent("2×");

    decodeImage.mockResolvedValue({ ...palette(), width: 64, height: 64, pixels: new Uint8ClampedArray(64 * 64 * 4) });
    rerender(<PixelViewer source={new File(["b"], "small.bmp")} name="small.bmp" />);
    expect(screen.getByText("Avan pilti…")).toBeInTheDocument();
    expect(await screen.findByText("64 × 64 px")).toBeInTheDocument();
    // 64 × 5 = 320 fits in 640 × 360; 64 × 6 = 384 does not.
    expect(zoom()).toHaveTextContent("5×");
  });

  it("explains when the image is too large to preview", async () => {
    decodeImage.mockRejectedValue(new PreviewTooLargeError(8000, 8000));
    render(<PixelViewer source={file} name="huge.png" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("(8000 × 8000) on eelvaate jaoks liiga suur");
  });

  it("loads an image by URL", async () => {
    const blob = new Blob(["bmp"]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(blob));
    vi.stubGlobal("fetch", fetchMock);
    render(<PixelViewer source="/demo/palette.bmp" name="palette (1).bmp" />);

    expect(await screen.findByText("512 × 40 px")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/demo/palette.bmp");
  });

  it("says so when the browser cannot decode the file exactly", async () => {
    decodeImage.mockRejectedValue(new DOMException("unsupported", "InvalidStateError"));
    render(<PixelViewer source={file} name="scan.tiff" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("„scan.tiff” täpsete väärtustega avada");
    expect(screen.getByRole("button", { name: "Suurenda" })).toBeDisabled();
  });

  it("says so when the image URL is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));
    render(<PixelViewer source="/missing.bmp" name="missing.bmp" />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(decodeImage).not.toHaveBeenCalled();
  });
});
