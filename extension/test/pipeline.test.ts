import { describe, expect, it, vi } from "vitest";
import { makeContext, run, type Approach, type Combination, type Registry } from "../src/core/pipeline.ts";
import { fakeCodec, fakeHost, PAGE } from "./fake-host.ts";

const approach = (id: string, needsDebugger = false, result: Partial<Awaited<ReturnType<Approach["run"]>>> = {}): Approach => ({
  id,
  title: `Approach ${id}`,
  needsDebugger,
  run: vi.fn(async (ctx) => {
    await ctx.shot();
    return { report: { id }, ...result };
  }),
});
const combo = (id: string, needs: string[]): Combination => ({ id, what: `combines ${needs}`, needs, run: vi.fn(async () => ({ ok: true })) });

describe("run", () => {
  it("with no approaches saves the lossless shot and the report", async () => {
    const { host, saved } = fakeHost();
    const report = await run(host, [], { scale: 4 }, undefined, undefined, fakeCodec);

    expect([...saved.keys()]).toEqual(["shot.png", "report.json"]);
    expect(report).toMatchObject({ captureMethod: "tabs.captureVisibleTab", page: PAGE, shot: { pixelSize: [4, 2] }, errors: {} });
    expect(report.files).toEqual(["shot.png", "report.json"]);
    // The saved report lists the files written before it, as in the reference.
    expect(JSON.parse(await saved.get("report.json")!.text())).toMatchObject({ scale: 4, files: ["shot.png"] });
    expect(host.attach).not.toHaveBeenCalled();
  });

  it("takes the shared screenshot once, after the page settles", async () => {
    const { host, calls } = fakeHost();
    const registry: Registry = { approaches: [approach("A"), approach("B")], combinations: [] };
    await run(host, ["A", "B"], {}, undefined, registry, fakeCodec);
    expect(calls.filter((c) => c === "shot")).toHaveLength(1);
    expect(calls.indexOf("page settle")).toBeLessThan(calls.indexOf("shot"));
  });

  it("runs only the chosen approaches and reports progress", async () => {
    const { host } = fakeHost();
    const a = approach("A");
    const b = approach("B");
    const progress = vi.fn();
    const report = await run(host, ["B"], {}, progress, { approaches: [a, b], combinations: [] }, fakeCodec);
    expect(a.run).not.toHaveBeenCalled();
    expect(report.approaches.B).toMatchObject({ id: "B", ms: expect.any(Number) });
    expect(progress).toHaveBeenCalledWith("B · Approach B");
  });

  it("pings the host before every approach and combination", async () => {
    const { host } = fakeHost();
    const ping = vi.fn(async () => {});
    const registry = { approaches: [approach("A"), approach("B")], combinations: [combo("A+B", ["A", "B"])] };
    await run(Object.assign(host, { ping }), ["A", "B"], {}, undefined, registry, fakeCodec);
    expect(ping).toHaveBeenCalledTimes(3);
  });

  it("records a failing approach and carries on", async () => {
    const { host } = fakeHost();
    const bad: Approach = { id: "X", title: "Bad", needsDebugger: false, run: async () => Promise.reject(new Error("boom")) };
    const report = await run(host, ["X", "A"], {}, undefined, { approaches: [bad, approach("A")], combinations: [] }, fakeCodec);
    expect(report.errors).toEqual({ X: "boom" });
    expect(report.approaches.A).toBeDefined();
  });

  it("runs a combination only when all its inputs exist", async () => {
    const { host } = fakeHost();
    const ready = combo("A+B", ["A", "B"]);
    const missing = combo("A+C", ["A", "C"]);
    const registry = { approaches: [approach("A"), approach("B"), approach("C")], combinations: [ready, missing] };
    const report = await run(host, ["A", "B"], {}, undefined, registry, fakeCodec);
    expect(report.combinations["A+B"]).toMatchObject({ what: "combines A,B", ok: true });
    expect(missing.run).not.toHaveBeenCalled();
  });

  it("with a debugger approach, pins the viewport, captures through CDP and always detaches", async () => {
    const { host, calls } = fakeHost();
    const bad: Approach = { id: "K", title: "Hi-res", needsDebugger: true, run: async () => Promise.reject(new Error("no")) };
    const report = await run(host, ["K"], {}, undefined, { approaches: [bad], combinations: [] }, fakeCodec);

    expect(report.captureMethod).toBe("Page.captureScreenshot");
    expect(host.cdp).toHaveBeenCalledWith("Emulation.setDeviceMetricsOverride", { width: 800, height: 600, deviceScaleFactor: 0, mobile: false });
    expect(calls.indexOf("attach")).toBeLessThan(calls.indexOf("shot"));
    expect(calls.slice(-3)).toEqual(["cdp Emulation.clearDeviceMetricsOverride", "detach", "save report.json"]);
  });

  it("detaches even when the screenshot fails", async () => {
    const { host } = fakeHost();
    host.shot.mockRejectedValueOnce(new Error("capture failed"));
    await expect(run(host, ["K"], {}, undefined, { approaches: [approach("K", true)], combinations: [] }, fakeCodec)).rejects.toThrow("capture failed");
    expect(host.detach).toHaveBeenCalled();
  });
});

describe("context.save", () => {
  it.each([
    ["scene.svg", "<svg/>", "image/svg+xml"],
    ["fit.json", "{}", "application/json"],
    ["notes.txt", "hi", "text/plain"],
  ])("gives %s the right type", async (name, text, type) => {
    const { host, saved } = fakeHost();
    await makeContext(host, {}, fakeCodec).save(name, text);
    expect(saved.get(name)?.type).toBe(type);
  });

  it("encodes images and decodes base64 payloads", async () => {
    const { host, saved } = fakeHost();
    const ctx = makeContext(host, {}, fakeCodec);
    await ctx.save("img.png", { width: 1, height: 1, data: new Uint8ClampedArray(4) });
    await ctx.save("page.pdf", { base64: "JVBERg==", type: "application/pdf" });
    expect(await saved.get("img.png")!.text()).toBe("encoded");
    expect(await saved.get("page.pdf")!.text()).toBe("%PDF");
    expect(ctx.files).toEqual(["img.png", "page.pdf"]);
  });
});
