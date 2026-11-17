import { describe, expect, it, vi } from "vitest";
import { doneStatus, singleChoice, startCapture, type StartApi } from "../src/popup-logic.ts";

function api(overrides: Partial<StartApi> = {}) {
  return {
    activeTab: vi.fn(async () => ({ id: 5, windowId: 9 })),
    send: vi.fn(async () => ({ ok: true })),
    ...overrides,
  };
}

describe("startCapture", () => {
  it("hands the run to the service worker without asking for any permission", async () => {
    const a = api();
    await expect(startCapture(a, ["S2", "K1"], { scale: 4 })).resolves.toEqual({ ok: true });
    expect(a.send).toHaveBeenCalledWith({ type: "run", tabId: 5, windowId: 9, ids: ["S2", "K1"], opts: { scale: 4 } });
  });

  it.each([
    ["no tab", undefined],
    ["a tab without an id", { windowId: 1 }],
  ])("reports %s", async (_, tab) => {
    await expect(startCapture(api({ activeTab: vi.fn(async () => tab) }), [], {})).resolves.toEqual({ ok: false, error: "No active tab." });
  });

  it.each([
    ["the service worker's reason", { ok: false, error: "A capture is already running." }, "A capture is already running."],
    ["a generic message without a reply", undefined, "Could not start."],
  ])("passes on %s when the start is refused", async (_, reply, error) => {
    await expect(startCapture(api({ send: vi.fn(async () => reply) }), [], {})).resolves.toEqual({ ok: false, error });
  });
});

describe("doneStatus", () => {
  it("lists the problems; an error only when nothing was saved", () => {
    expect(doneStatus({ type: "done", folder: "f", files: ["shot.png"], errors: {} })).toEqual({ text: "1 files saved to Downloads/f", isError: false });
    expect(doneStatus({ type: "done", folder: "f", files: ["shot.png"], errors: { K1: "no" } })).toEqual({
      text: "1 files saved to Downloads/f\nProblems:\nK1: no",
      isError: false,
    });
    expect(doneStatus({ type: "done", folder: "f", files: [], errors: { run: "tab closed" } }).isError).toBe(true);
  });
});

describe("singleChoice", () => {
  it("clears the other boxes when one is ticked, and allows none", () => {
    const group = document.createElement("div");
    group.innerHTML = '<input type="checkbox" value="a" checked><input type="checkbox" value="b">';
    document.body.append(group);
    singleChoice(group);
    const [a, b] = group.querySelectorAll("input");
    b.click();
    expect([a.checked, b.checked]).toEqual([false, true]);
    b.click();
    expect([a.checked, b.checked]).toEqual([false, false]);
    group.remove();
  });
});
