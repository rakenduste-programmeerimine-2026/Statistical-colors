import { vi } from "vitest";

/** Just the parts of `chrome` the extension uses, as spies. Install with vi.stubGlobal. */
export function fakeChrome({ debuggerGranted = true } = {}) {
  const listeners = new Set<(src: { tabId?: number }, method: string, params?: object) => void>();
  return {
    runtime: { getPlatformInfo: vi.fn(async () => ({ os: "win", arch: "x86-64" })) },
    permissions: { contains: vi.fn(async () => debuggerGranted), request: vi.fn(async () => true) },
    debugger: {
      attach: vi.fn(async () => {}),
      detach: vi.fn(async () => {}),
      sendCommand: vi.fn(async (_target: unknown, method: string) => (method === "Page.captureScreenshot" ? { data: "AAF/" } : {})),
      onEvent: {
        addListener: vi.fn((l: Parameters<typeof listeners.add>[0]) => void listeners.add(l)),
        removeListener: vi.fn((l: Parameters<typeof listeners.add>[0]) => void listeners.delete(l)),
      },
      /** Test helper: deliver a DevTools protocol event. */
      emit: (tabId: number, method: string, params?: object) => listeners.forEach((l) => l({ tabId }, method, params)),
    },
    scripting: { executeScript: vi.fn(async () => [{ result: "page result" }]) },
    tabs: { captureVisibleTab: vi.fn(async () => "data:image/png;base64,AAF/") },
    downloads: { download: vi.fn(async () => 1) },
  };
}
