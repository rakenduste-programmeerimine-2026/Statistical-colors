import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as S2Module from "../src/approaches/s2-scene.ts";
import { S2, SUBSTITUTES } from "../src/approaches/s2-scene.ts";
import { makeContext } from "../src/core/pipeline.ts";
import { embedMeta, forCheck, readMeta, walkNodes, type SceneMeta, type SceneNode } from "../src/core/scene.ts";
import { compiled, fromSource } from "./compiled.ts";
import { fakeHost, queuedCodec } from "./fake-host.ts";

const meta = (extra: Partial<SceneMeta> = {}): SceneMeta => ({
  version: 1,
  viewport: [10, 10],
  dpr: 1,
  url: "https://example.test/",
  shot: "shot.png",
  fonts: [],
  root: { id: "n0", kind: "frame", name: "html", box: [0, 0, 10, 10], children: [] },
  assets: {},
  unsupported: [],
  ...extra,
});
const svg = '<svg xmlns="http://www.w3.org/2000/svg"><defs></defs><text textLength="5" lengthAdjust="spacing">a</text></svg>';

describe("scene metadata", () => {
  it("embeds and reads back metadata, escaping what would break the XML", () => {
    const m = meta({ url: "https://example.test/?a=<b>&c=</metadata>" });
    const out = embedMeta(svg, m);
    expect(out).toContain('<metadata id="fs-scene">');
    expect(out).not.toContain("<b>");
    expect(readMeta(out)).toEqual(m);
  });

  it("replaces metadata that is already there", () => {
    const once = embedMeta(svg, meta({ dpr: 1 }));
    const twice = embedMeta(once, meta({ dpr: 2 }));
    expect(twice.match(/<metadata/g)).toHaveLength(1);
    expect(readMeta(twice)?.dpr).toBe(2);
  });

  it("returns null when an SVG has no metadata", () => {
    expect(readMeta(svg)).toBeNull();
  });

  it("strips metadata and width pinning for pixel checks", () => {
    expect(forCheck(embedMeta(svg, meta()))).toBe('<svg xmlns="http://www.w3.org/2000/svg"><defs></defs><text>a</text></svg>');
  });

  it("walks nodes depth first with their parents", () => {
    const leaf: SceneNode = { id: "c", kind: "text", name: "c", box: [0, 0, 1, 1] };
    const mid: SceneNode = { id: "b", kind: "frame", name: "b", box: [0, 0, 1, 1], children: [leaf] };
    const root: SceneNode = { id: "a", kind: "frame", name: "a", box: [0, 0, 1, 1], children: [mid] };
    const seen: string[] = [];
    walkNodes(root, (n, p) => seen.push(`${n.id}<${p?.id ?? "-"}`));
    expect(seen).toEqual(["a<-", "b<a", "c<b"]);
  });

  it("maps common proprietary fonts to width-equivalent open ones", () => {
    expect(SUBSTITUTES).toMatchObject({ arial: "Arimo", "times new roman": "Tinos", "courier new": "Cousine", georgia: "Gelasio" });
  });
});

describe("domToSvg in a page", () => {
  const { domToSvg } = compiled<typeof S2Module>("../src/approaches/s2-scene.ts");
  const rectOf = (el: Element | null) => {
    const [x, y, w, h] = (el?.getAttribute("data-box") ?? "0,0,0,0").split(",").map(Number);
    return { x, y, left: x, top: y, width: w, height: h, right: x + w, bottom: y + h };
  };

  beforeEach(() => {
    // jsdom lays nothing out and has no canvas: give elements fixed boxes and text a fixed width.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      return rectOf(this) as DOMRect;
    });
    Range.prototype.getClientRects = function (this: Range) {
      return [rectOf(this.startContainer.parentElement)] as unknown as DOMRectList;
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "",
      measureText: (s: string) => ({ width: s.length * 8, fontBoundingBoxAscent: 12, fontBoundingBoxDescent: 4 }),
    } as unknown as CanvasRenderingContext2D);
    document.body.innerHTML =
      '<div data-box="10,20,100,50" style="background-color: rgb(255, 0, 0)">' +
      '<span data-box="10,20,40,16" style="color: rgb(0, 0, 255); font-family: Arial, sans-serif">Hello</span></div>';
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("runs from its source text alone and draws boxes and text", async () => {
    const scene = await fromSource(domToSvg)(null, { arial: "Arimo" });
    expect(scene.svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="\d+" height="\d+"/);
    expect(scene.svg).toContain('<path d="M10 20h100v50h-100z" fill="rgb(255, 0, 0)"/>');
    expect(scene.svg).toMatch(/<text x="10" y="32" [^>]*fill="rgb\(0, 0, 255\)"[^>]*textLength="40"[^>]*>Hello<\/text>/);
    expect(scene.texts).toEqual([expect.objectContaining({ text: "Hello", x: 10, y: 20, w: 40, h: 16, baseline: 32, color: "rgb(0, 0, 255)" })]);
    expect(scene.palette).toEqual(expect.arrayContaining(["rgb(255, 0, 0)", "rgb(0, 0, 255)"]));
  });

  it("builds the metadata tree with fills, text and the font substitute", async () => {
    const scene = await fromSource(domToSvg)(null, { arial: "Arimo" });
    const nodes: SceneNode[] = [];
    walkNodes(scene.meta.root, (n) => nodes.push(n));
    const div = nodes.find((n) => n.source?.tag === "div");
    expect(div?.style?.fills).toEqual([{ type: "solid", color: [255, 0, 0, 1] }]);
    const text = nodes.find((n) => n.kind === "text");
    // The test canvas measures every font alike, so Arial counts as missing and the generic family is used.
    expect(text?.text).toMatchObject({ characters: "Hello", usedFamily: "sans-serif", size: expect.any(Number), fill: [0, 0, 255, 1] });
    expect(scene.meta.root.style?.clip).toBe(true);
  });

  it("leaves out elements matching the ignore selector", async () => {
    document.querySelector("div")?.setAttribute("class", "feedback-button");
    const scene = await fromSource(domToSvg)(".feedback-button", {});
    expect(scene.svg).not.toContain("rgb(255, 0, 0)");
    expect(scene.texts).toEqual([]);
  });
});

describe("S2.run", () => {
  it("embeds the metadata, saves the scene and scores it against the shot", async () => {
    const scene = { svg: svg, meta: meta(), unsupported: [], palette: ["rgb(0, 0, 0)"], texts: [], counts: { textRuns: 0, boxes: 0 } };
    const { host, saved } = fakeHost({ domToSvg: scene, rasteriseSvg: "data:image/png;base64,AAAA" });
    const img = { width: 1, height: 1, data: new Uint8ClampedArray([1, 2, 3, 255]) };
    const res = await S2.run(makeContext(host, { env: null }, queuedCodec([img])));

    expect(readMeta(await saved.get("scene.svg")!.text())).toMatchObject({ version: 1, env: null });
    expect(res.report).toMatchObject({ vsShot: { exactPct: 100 }, declaredColours: 1, metadataNodes: { frame: 1 } });
    expect(saved.has("scene-vs-shot.png")).toBe(true);
    expect(host.page).toHaveBeenCalledWith(expect.objectContaining({ name: "rasteriseSvg" }), expect.not.stringContaining("fs-scene"), 1);
  });
});
