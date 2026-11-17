// Adapter: the Host port on Chrome extension APIs.
import type { Host } from "./core/host.ts";
import { blobToDataUrl, dataUrlToBlob } from "./core/img.ts";

/** Chrome allows about two captureVisibleTab calls per second. */
export const CAPTURE_GAP_MS = 600;

type Waiter = (method: string, params: unknown) => void;

export function makeExtensionHost(tabId: number, windowId: number, folder: string): Host {
  let attached = false;
  let lastCapture = -Infinity;
  const waiters = new Set<Waiter>();
  const onEvent = (src: chrome.debugger.Debuggee, method: string, params?: object) => {
    if (src.tabId === tabId) for (const w of [...waiters]) w(method, params);
  };

  const host: Host = {
    async attach() {
      // Optional permission (P-023 item 6): the popup asks for it when a debugger approach is chosen.
      if (!(await chrome.permissions.contains({ permissions: ["debugger"] }))) {
        throw new Error("The debugger permission was not granted.");
      }
      await chrome.debugger.attach({ tabId }, "1.3");
      chrome.debugger.onEvent.addListener(onEvent);
      attached = true;
    },
    async detach() {
      if (!attached) return;
      chrome.debugger.onEvent.removeListener(onEvent);
      attached = false;
      await chrome.debugger.detach({ tabId }).catch(() => {});
    },
    cdp: <T>(method: string, params: Record<string, unknown> = {}) =>
      chrome.debugger.sendCommand({ tabId }, method, params) as Promise<T>,
    cdpOnce: <T>(event: string, pred: (params: T) => boolean = () => true, timeout = 8000) =>
      new Promise<T>((resolve, reject) => {
        const w: Waiter = (method, params) => {
          if (method !== event || !pred(params as T)) return;
          waiters.delete(w);
          clearTimeout(timer);
          resolve(params as T);
        };
        const timer = setTimeout(() => {
          waiters.delete(w);
          reject(new Error(`No ${event} within ${timeout} ms`));
        }, timeout);
        waiters.add(w);
      }),
    async page(func, ...args) {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        func: func as (...a: unknown[]) => unknown,
        // executeScript cannot send undefined.
        args: args.map((a) => (a === undefined ? null : a)),
      });
      return res?.result as never;
    },
    // A run uses a single capture route, so all its outputs are compared against the same kind of shot.
    async shot() {
      if (attached) {
        const { data } = await host.cdp<{ data: string }>("Page.captureScreenshot", { format: "png" });
        return dataUrlToBlob(`data:image/png;base64,${data}`);
      }
      const wait = lastCapture + CAPTURE_GAP_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastCapture = Date.now();
      return dataUrlToBlob(await chrome.tabs.captureVisibleTab(windowId, { format: "png" }));
    },
    async save(name, blob) {
      await chrome.downloads.download({
        url: await blobToDataUrl(blob),
        filename: `${folder}/${name}`,
        conflictAction: "uniquify",
        saveAs: false,
      });
    },
  };
  return host;
}
