// The capture runs in the service worker, because the popup closes as soon as it loses focus.
import type { Host } from "./core/host.ts";
import { run, type RunOptions } from "./core/pipeline.ts";
import { makeExtensionHost } from "./host-extension.ts";
import { REGISTRY } from "./registry.ts";

export interface RunMessage {
  type: "run";
  tabId: number;
  windowId: number;
  ids: string[];
  opts: Partial<RunOptions>;
}

export type StatusMessage =
  | { type: "progress"; text: string }
  | { type: "done"; folder: string; files: string[]; errors: Record<string, string> };

/** `intent-capture-2026-11-17T12-30-05`: one Downloads folder per capture. */
export const folderName = (now: Date) => `intent-capture-${now.toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;

type MakeHost = (tabId: number, windowId: number, folder: string) => Host;

/** Handles messages from the popup. Exported with injectable parts for tests. */
export function createRunner(
  tell: (msg: StatusMessage) => void,
  makeHost: MakeHost = makeExtensionHost,
  now: () => Date = () => new Date(),
) {
  let busy = false;
  return (msg: unknown, sendResponse: (r: { ok: boolean; error?: string }) => void): Promise<void> | undefined => {
    if ((msg as RunMessage | null)?.type !== "run") return;
    const m = msg as RunMessage;
    if (busy) {
      sendResponse({ ok: false, error: "A capture is already running." });
      return;
    }
    busy = true;
    sendResponse({ ok: true });
    const folder = folderName(now());
    return (async () => {
      try {
        const report = await run(makeHost(m.tabId, m.windowId, folder), m.ids, m.opts, (text) => tell({ type: "progress", text }), REGISTRY);
        tell({ type: "done", folder, files: report.files, errors: report.errors });
      } catch (e) {
        tell({ type: "done", folder, files: [], errors: { run: String((e as Error)?.message ?? e) } });
      } finally {
        busy = false;
      }
    })();
  };
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  const handle = createRunner((msg) => void chrome.runtime.sendMessage(msg).catch(() => {}));
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    handle(msg, sendResponse);
  });
}
