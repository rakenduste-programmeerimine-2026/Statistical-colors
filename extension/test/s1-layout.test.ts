import { describe, expect, it } from "vitest";
import { readLayout, S1, STYLES, type DomSnapshot } from "../src/approaches/s1-layout.ts";
import { makeContext } from "../src/core/pipeline.ts";
import { fakeCodec, fakeHost, PAGE } from "./fake-host.ts";

// Strings: 0 "", 1 red, 2 transparent, 3 Arial, 4 16px, 5 400, 6 "Hello world", 7 white.
const strings = ["", "rgb(255, 0, 0)", "rgba(0, 0, 0, 0)", "Arial", "16px", "400", "Hello world", "rgb(255, 255, 255)"];
const style = (color: number, bg: number) => [color, bg, color, 3, 4, 5];

function snapshot(): DomSnapshot {
  return {
    strings,
    documents: [
      {
        layout: {
          nodeIndex: [0, 1, 2],
          // Document device px at DPR 2, page scrolled by (0, 100) CSS px.
          bounds: [
            [0, 200, 200, 40], // on screen: CSS (0, 0) 100 × 20
            [0, 0, 200, 40], // above the viewport after scrolling
            [20, 220, 0, 0], // no size
          ],
          styles: [style(1, 7), style(1, 2), style(1, 2)],
          text: [6, -1, -1],
          paintOrders: [3, 1, 2],
        },
        textBoxes: { layoutIndex: [0, 0], bounds: [[0, 200, 100, 40], [100, 200, 100, 40]], start: [0, 6], length: [5, 5] },
      },
    ],
  };
}
const info = { ...PAGE, dpr: 2, scrollY: 100 };

describe("readLayout", () => {
  it("keeps on-screen nodes in viewport CSS px, with their styles and paint order", () => {
    const { nodes } = readLayout(snapshot(), info);
    expect(nodes).toEqual([
      {
        x: 0,
        y: 0,
        w: 100,
        h: 20,
        paintOrder: 3,
        text: "Hello world",
        style: { color: "rgb(255, 0, 0)", "background-color": "rgb(255, 255, 255)", "border-top-color": "rgb(255, 0, 0)", "font-family": "Arial", "font-size": "16px", "font-weight": "400" },
      },
    ]);
    expect(Object.keys(nodes[0].style)).toEqual([...STYLES]);
  });

  it("collects declared colours, without transparent", () => {
    expect(readLayout(snapshot(), info).palette).toEqual(["rgb(255, 0, 0)", "rgb(255, 255, 255)"]);
  });

  it("cuts text fragments out of the node's text", () => {
    expect(readLayout(snapshot(), info).textBoxes.map((t) => t.text)).toEqual(["Hello", "world"]);
  });
});

describe("S1.run", () => {
  it("asks for the styles it reads and saves layout.json", async () => {
    const { host, saved } = fakeHost();
    host.cdp.mockResolvedValue(snapshot());
    const res = await S1.run(makeContext(host, {}, fakeCodec));
    expect(host.cdp).toHaveBeenCalledWith("DOMSnapshot.captureSnapshot", { computedStyles: [...STYLES], includePaintOrder: true });
    // The default page is DPR 1 and not scrolled, so the second node is on screen here.
    expect(res.report).toMatchObject({ mode: "layout-record", layoutNodes: 2, textBoxes: 2, declaredColours: 2 });
    expect(res.report?.paintRecordUnavailable).toContain("LayerTree");
    expect(JSON.parse(await saved.get("layout.json")!.text())).toMatchObject({ viewport: [800, 600], dpr: 1 });
  });
});
