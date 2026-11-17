import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAPTURE_GAP_MS, makeExtensionHost } from "../src/host-extension.ts";
import { fakeChrome } from "./fake-chrome.ts";

let chrome: ReturnType<typeof fakeChrome>;
const host = () => makeExtensionHost(7, 3, "intent-capture-x");

beforeEach(() => {
  chrome = fakeChrome();
  vi.stubGlobal("chrome", chrome);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("makeExtensionHost", () => {
  it("attaches, sends commands to its tab and detaches", async () => {
    const h = host();
    await h.attach();
    await h.cdp("Page.enable", { a: 1 });
    await h.detach();
    await h.detach(); // a second detach does nothing
    expect(chrome.debugger.attach).toHaveBeenCalledWith({ tabId: 7 }, "1.3");
    expect(chrome.debugger.sendCommand).toHaveBeenCalledWith({ tabId: 7 }, "Page.enable", { a: 1 });
    expect(chrome.debugger.detach).toHaveBeenCalledTimes(1);
  });

  it("waits for a matching DevTools event from its own tab", async () => {
    const h = host();
    await h.attach();
    const waiting = h.cdpOnce<{ n: number }>("Page.loadEventFired", (p) => p.n === 2);
    chrome.debugger.emit(8, "Page.loadEventFired", { n: 2 }); // other tab
    chrome.debugger.emit(7, "Page.loadEventFired", { n: 1 }); // predicate fails
    chrome.debugger.emit(7, "Page.loadEventFired", { n: 2 });
    await expect(waiting).resolves.toEqual({ n: 2 });
  });

  it("gives up on an event after the timeout", async () => {
    vi.useFakeTimers();
    const waiting = host().cdpOnce("Never", undefined, 100);
    vi.advanceTimersByTime(100);
    await expect(waiting).rejects.toThrow("No Never within 100 ms");
  });

  it("runs page functions with undefined arguments sent as null", async () => {
    const fn = (a: unknown, b: unknown) => [a, b];
    await expect(host().page(fn, 1, undefined)).resolves.toBe("page result");
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 7 }, func: fn, args: [1, null] });
  });

  it("captures with captureVisibleTab when not attached, at most once per gap", async () => {
    vi.useFakeTimers();
    const h = host();
    const first = await h.shot();
    expect(first.type).toBe("image/png");
    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(3, { format: "png" });

    const second = h.shot();
    await vi.advanceTimersByTimeAsync(CAPTURE_GAP_MS - 1);
    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await second;
    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledTimes(2);
  });

  it("captures through CDP when attached", async () => {
    const h = host();
    await h.attach();
    const png = await h.shot();
    expect(new Uint8Array(await png.arrayBuffer())).toEqual(new Uint8Array([0, 1, 127]));
    expect(chrome.tabs.captureVisibleTab).not.toHaveBeenCalled();
  });

  it("pings Chrome to keep the service worker alive", async () => {
    await host().ping?.();
    expect(chrome.runtime.getPlatformInfo).toHaveBeenCalled();
  });

  it("saves into the capture folder without asking", async () => {
    await host().save("shot.png", new Blob(["x"], { type: "image/png" }));
    expect(chrome.downloads.download).toHaveBeenCalledWith({
      url: "data:image/png;base64,eA==",
      filename: "intent-capture-x/shot.png",
      conflictAction: "uniquify",
      saveAs: false,
    });
  });
});
