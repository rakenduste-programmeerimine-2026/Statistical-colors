import { describe, expect, it, vi } from "vitest";
import { createRunner, folderName, type RunMessage } from "../src/background.ts";
import { fakeHost } from "./fake-host.ts";

const msg: RunMessage = { type: "run", tabId: 1, windowId: 2, ids: [], opts: { scale: 4 } };
const now = () => new Date("2026-11-17T12:30:05.123Z");

describe("folderName", () => {
  it("is one folder per second, safe for file names", () => {
    expect(folderName(now())).toBe("intent-capture-2026-11-17T12-30-05");
  });
});

describe("createRunner", () => {
  it("ignores other messages", () => {
    const respond = vi.fn();
    expect(createRunner(vi.fn())({ type: "other" }, respond)).toBeUndefined();
    expect(respond).not.toHaveBeenCalled();
  });

  it("starts a run and reports the saved files", async () => {
    const { host } = fakeHost();
    const makeHost = vi.fn(() => host);
    const tell = vi.fn();
    const respond = vi.fn();
    // The real decoder needs a canvas; the shot fails here, which still exercises reporting.
    await createRunner(tell, makeHost, now)(msg, respond);

    expect(respond).toHaveBeenCalledWith({ ok: true });
    expect(makeHost).toHaveBeenCalledWith(1, 2, "intent-capture-2026-11-17T12-30-05");
    expect(tell).toHaveBeenLastCalledWith(expect.objectContaining({ type: "done", folder: "intent-capture-2026-11-17T12-30-05" }));
  });

  it("refuses a second run while one is going, and accepts one after", async () => {
    const { host } = fakeHost();
    const runner = createRunner(vi.fn(), () => host, now);
    const first = runner(msg, vi.fn());
    const respond = vi.fn();
    runner(msg, respond);
    expect(respond).toHaveBeenCalledWith({ ok: false, error: "A capture is already running." });

    await first;
    const again = vi.fn();
    await runner(msg, again);
    expect(again).toHaveBeenCalledWith({ ok: true });
  });

  it("reports a failed run as done with the error", async () => {
    const tell = vi.fn();
    const failing = () => {
      throw new Error("tab closed");
    };
    await createRunner(tell, failing, now)(msg, vi.fn());
    expect(tell).toHaveBeenLastCalledWith({ type: "done", folder: "intent-capture-2026-11-17T12-30-05", files: [], errors: { run: "tab closed" } });
  });
});
