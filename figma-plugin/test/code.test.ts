import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ImportMessage } from "../src/code.ts";
import { fakeFigma, type FakeNode } from "./fake-figma.ts";
import { sampleMeta } from "./scene.ts";

const message = (over: Partial<ImportMessage> = {}): ImportMessage => ({
  type: "import",
  meta: sampleMeta(),
  assets: { a0: new Uint8Array([1, 2]) },
  patches: {},
  shot: new Uint8Array([7, 7]),
  analysis: null,
  options: { preferSubstitute: false },
  ...over,
});

/** Imports code.ts against a fresh fake figma and starts it. */
async function startPlugin(opts: Parameters<typeof fakeFigma>[0] = {}) {
  const fake = fakeFigma(opts);
  vi.stubGlobal("figma", fake.figma);
  vi.stubGlobal("__html__", "<html></html>");
  vi.resetModules();
  const { start } = await import("../src/code.ts");
  start();
  return fake;
}
const byName = (root: FakeNode, name: string) => root.findAll((n) => n.name === name)[0];

afterEach(() => vi.unstubAllGlobals());

describe("import", () => {
  it("builds the scene as native layers and reports on it", async () => {
    // "Hello" measures exactly its captured width, as with a width-equal font.
    const { figma, page, done } = await startPlugin({ widths: { Hello: 40 } });
    figma.ui.onmessage?.(message() as unknown as Record<string, unknown>);
    const result = (await done()) as { ok: boolean; report: Record<string, unknown> };

    expect(result.ok).toBe(true);
    const root = page.children[0];
    expect(root.name).toBe("Capture · https://example.test/");
    const card = byName(root, "div.card");
    expect(card).toMatchObject({ type: "FRAME", x: 20, y: 20, width: 200, height: 100, topLeftRadius: 8, strokeWeight: 1, strokeAlign: "INSIDE", clipsContent: false });
    expect(card.effects).toEqual([expect.objectContaining({ type: "DROP_SHADOW", radius: 14 })]);
    // Arial is not installed here, so the run gets its width-equivalent open substitute.
    expect(byName(root, "Hello")).toMatchObject({ type: "TEXT", x: 10, y: 10, fontName: { family: "Arimo", style: "Regular" } });
    expect(byName(root, "shot.png (reference)")).toMatchObject({ visible: false, locked: true });
    expect(byName(root, "patch · input · input")).toMatchObject({ type: "RECTANGLE" });
    expect(JSON.parse(card.getPluginData("fs"))).toMatchObject({ id: "n1", kind: "frame", source: { tag: "div" } });

    expect(result.report).toMatchObject({
      layers: 7,
      pixels: { sizeMatch: true, brightnessWithin8Pct: 90 },
      analysisAttached: false,
      captureFlags: ["form-control"],
    });
    // "Nonexistent Sans" falls back to Inter, which is narrower here, so its width is pinned.
    expect(result.report.byStatus).toMatchObject({ substitute: 1, pinned: 1 });
    expect(byName(root, "Missing font")).toMatchObject({ fontName: { family: "Inter" } });
    expect(page.children.map((n) => n.name)).toEqual(["Capture · https://example.test/", "Import report"]);
  });

  it("pins a run's width with letter spacing when the font is wider or narrower", async () => {
    const { figma, page, done } = await startPlugin();
    figma.ui.onmessage?.(message() as unknown as Record<string, unknown>);
    const result = (await done()) as { report: { byStatus: Record<string, number> } };
    const hello = byName(page.children[0], "Hello");
    // 5 characters at 0.55 em of 16 px = 44 px; the capture says 40, so −0.8 px per character.
    expect((hello.letterSpacing as { value: number }).value).toBeCloseTo(-0.8, 9);
    expect(hello.width).toBeCloseTo(40, 9);
    expect(result.report.byStatus.pinned).toBe(2);
  });

  it.each([
    [40.5, "substitute"],
    [40.51, "pinned"],
  ])("keeps the font when a run's width is within 0.5 px, pins it beyond: captured %d px", async (captured, status) => {
    const meta = sampleMeta();
    const hello = meta.root.children?.[0].children?.[0];
    if (hello?.text) hello.text.width = captured;
    // "Hello" measures 40 px here.
    const { figma, done } = await startPlugin({ widths: { Hello: 40 } });
    figma.ui.onmessage?.(message({ meta }) as unknown as Record<string, unknown>);
    const result = (await done()) as { report: { fonts: Record<string, { widthOk: number }>; byStatus: Record<string, number> } };
    expect(result.report.byStatus[status]).toBeGreaterThanOrEqual(1);
    expect(result.report.fonts["Arial → Arimo Regular"].widthOk).toBe(status === "pinned" ? 0 : 1);
  });

  it("does not pin an empty run", async () => {
    const meta = sampleMeta();
    const hello = meta.root.children?.[0].children?.[0];
    if (hello?.text) Object.assign(hello.text, { characters: "", width: 30 });
    const { figma, page, done } = await startPlugin();
    figma.ui.onmessage?.(message({ meta }) as unknown as Record<string, unknown>);
    await done();
    const empty = page.children[0].findAll((n) => n.type === "TEXT" && n.characters === "")[0];
    expect((empty.letterSpacing as { value: number }).value).toBe(0);
  });

  it("attaches the colour analysis to the frame when there is one", async () => {
    const { figma, page, done } = await startPlugin();
    figma.ui.onmessage?.(message({ analysis: { palette: [{ hex: "#FFFFFF", count: 3 }] } }) as unknown as Record<string, unknown>);
    const result = (await done()) as { report: { analysisAttached: boolean } };
    expect(result.report.analysisAttached).toBe(true);
    expect(JSON.parse(page.children[0].getPluginData("fs-analysis"))).toEqual({ palette: [{ hex: "#FFFFFF", count: 3 }] });
  });

  it("asks the UI to crop a patch, and leaves a dashed placeholder without a screenshot", async () => {
    const { figma, page, sent, done } = await startPlugin();
    // The fake UI answers a crop with one byte; an empty answer means no screenshot.
    const post = figma.ui.postMessage.bind(figma.ui);
    figma.ui.postMessage = (m: Record<string, unknown>) => {
      if (m.type === "crop") {
        sent.push(m);
        setTimeout(() => figma.ui.onmessage?.({ reqId: m.reqId, bytes: new Uint8Array() }));
        return;
      }
      post(m);
    };
    figma.ui.onmessage?.(message({ shot: null }) as unknown as Record<string, unknown>);
    const result = (await done()) as { report: { pixels: unknown } };
    expect(sent.some((m) => m.type === "crop")).toBe(true);
    expect(byName(page.children[0], "missing · input · input")).toMatchObject({ dashPattern: [4, 4] });
    expect(result.report.pixels).toBeNull();
  });

  it("turns a node that cannot be built into a labelled patch", async () => {
    const { figma, page, done } = await startPlugin();
    figma.ui.onmessage?.(message({ assets: {} }) as unknown as Record<string, unknown>);
    const result = (await done()) as { report: { notes: string[] } };
    expect(result.report.notes).toContain("img: image bytes missing → patch");
    expect(byName(page.children[0], "patch · build-failed · img")).toBeDefined();
  });

  it("refuses metadata of another version", async () => {
    const { figma, done } = await startPlugin();
    figma.ui.onmessage?.(message({ meta: { ...sampleMeta(), version: 2 as 1 } }) as unknown as Record<string, unknown>);
    expect(await done()).toEqual({ type: "done", ok: false, error: "This file has no version-1 capture metadata." });
  });
});

describe("built plugin", () => {
  const root = resolve(__dirname, "..");
  beforeAll(() => {
    execFileSync(process.execPath, [resolve(root, "build.mjs")], { stdio: "pipe" });
  }, 60_000);

  it("is one classic script that Figma can run, with no module statements", async () => {
    const code = readFileSync(resolve(root, "dist/code.js"), "utf8");
    expect(code).not.toMatch(/^\s*(import|export)\s/m);
    const fake = fakeFigma({ widths: { Hello: 40 } });
    runInNewContext(code, { figma: fake.figma, __html__: "", setTimeout, console });
    fake.figma.ui.onmessage?.(message() as unknown as Record<string, unknown>);
    expect(await fake.done()).toMatchObject({ ok: true, report: { layers: 7 } });
  });

  it("inlines the UI script into one HTML file", () => {
    const html = readFileSync(resolve(root, "dist/ui.html"), "utf8");
    expect(html).not.toContain("/* UI_SCRIPT */");
    expect(html).toContain("function startUi()");
    expect(html).toContain("startUi();");
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });
});
