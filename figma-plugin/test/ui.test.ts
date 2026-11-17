import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startUi } from "../src/ui.ts";
import { sampleMeta } from "./scene.ts";

/** The UI's markup, without its script. */
const markup = readFileSync(resolve(__dirname, "../ui.html"), "utf8").replace(/<script>[\s\S]*<\/script>/, "");
const svgFile = (json: string, name = "scene-final.svg") => new File([`<svg><metadata id="fs-scene">${json}</metadata></svg>`], name);
const $ = (id: string) => document.getElementById(id) as HTMLElement & HTMLButtonElement & HTMLInputElement;

let posted: Record<string, unknown>[];
/** Drops files on the drop area and waits for them to be read. */
async function drop(...files: File[]) {
  const e = new Event("drop") as Event & { dataTransfer: { files: File[] } };
  e.dataTransfer = { files };
  $("drop").dispatchEvent(e);
  await vi.waitFor(() => expect($("files").textContent).not.toBe(""));
  await new Promise((r) => setTimeout(r, 0));
}
/** Sends a message from the main thread to the UI. */
const fromMain = (pluginMessage: Record<string, unknown>) => window.onmessage?.(new MessageEvent("message", { data: { pluginMessage } }));

beforeEach(() => {
  document.body.innerHTML = markup;
  posted = [];
  vi.spyOn(window.parent, "postMessage").mockImplementation((m: unknown) => void posted.push((m as { pluginMessage: Record<string, unknown> }).pluginMessage));
  startUi();
});
afterEach(() => vi.restoreAllMocks());

describe("plugin UI", () => {
  it("waits for a scene before Import can be pressed", () => {
    expect($("go").disabled).toBe(true);
    expect($("log").textContent).toBe("Waiting for files.");
  });

  it("loads a scene with metadata and enables Import", async () => {
    await drop(svgFile(JSON.stringify(sampleMeta())));
    expect($("go").disabled).toBe(false);
    expect($("log").textContent).toBe("Ready: 7 nodes, viewport 400 × 300.");
    expect($("files").textContent).toContain("Scene: scene-final.svg");
    expect($("files").textContent).toContain("Screenshot: missing");
  });

  it("says why an SVG cannot be used, and shows file names as text", async () => {
    await drop(new File(["<svg/>"], "<b>odd</b>.svg"));
    expect($("log").textContent).toBe("<b>odd</b>.svg has no capture metadata. Capture again with the current extension.");
    expect($("log").className).toBe("err");
    expect($("go").disabled).toBe(true);
    expect($("files").querySelector("b")).toBeNull();
  });

  it("posts the import with the metadata, the option and no analysis yet", async () => {
    await drop(svgFile(JSON.stringify({ ...sampleMeta(), assets: {} })));
    $("preferSub").checked = true;
    $("go").click();
    await vi.waitFor(() => expect(posted.some((m) => m.type === "import")).toBe(true));
    const msg = posted.find((m) => m.type === "import") as Record<string, unknown>;
    expect(msg).toMatchObject({ analysis: null, options: { preferSubstitute: true }, shot: null, meta: { version: 1, assets: {} } });
  });

  it("keeps Import disabled while an import runs, even when a file is dropped, until done", async () => {
    await drop(svgFile(JSON.stringify({ ...sampleMeta(), assets: {} })));
    $("go").click();
    await vi.waitFor(() => expect(posted.some((m) => m.type === "import")).toBe(true));
    expect($("go").disabled).toBe(true);
    await drop(svgFile(JSON.stringify(sampleMeta()), "other.svg"));
    expect($("go").disabled).toBe(true);
    fromMain({ type: "done", ok: true, report: { layers: 7 } });
    expect($("go").disabled).toBe(false);
    expect($("log").textContent).toContain('"layers": 7');
  });

  it("ends the import with a message when preparing it fails", async () => {
    await drop(svgFile(JSON.stringify({ ...sampleMeta(), assets: {} })));
    // Fails while the import message is being assembled, before anything is posted.
    vi.spyOn(HTMLInputElement.prototype, "checked", "get").mockImplementation(() => {
      throw new Error("boom");
    });
    $("go").click();
    await vi.waitFor(() => expect($("log").className).toBe("err"));
    expect($("log").textContent).toMatch(/^Could not prepare the import:/);
    expect($("log").textContent).toBe("Could not prepare the import: boom");
    expect(posted.some((m) => m.type === "import")).toBe(false);
    vi.restoreAllMocks();
    expect($("go").disabled).toBe(false);
  });

  it("answers the main thread's requests: log, crop and verify without a screenshot", async () => {
    fromMain({ type: "log", text: "Building layers…" });
    expect($("log").textContent).toBe("Building layers…");
    fromMain({ type: "crop", reqId: 4, box: [0, 0, 10, 10] });
    fromMain({ type: "verify", reqId: 5, bytes: new Uint8Array() });
    await vi.waitFor(() => expect(posted).toHaveLength(2));
    expect(posted).toEqual(
      expect.arrayContaining([
        { reqId: 4, bytes: new Uint8Array() },
        { reqId: 5, sizeMatch: false, within8Pct: null, within48Pct: null },
      ]),
    );
  });

  it("shows a failed import as an error", () => {
    fromMain({ type: "done", ok: false, error: "no usable font" });
    expect($("log").textContent).toBe("Import failed: no usable font");
    expect($("log").className).toBe("err");
  });
});
