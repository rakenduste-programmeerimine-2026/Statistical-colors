/**
 * Port: everything the capture pipeline needs from its environment. The
 * extension implements it with Chrome APIs (`host-extension.ts`); tests use a
 * fake. The same approach code runs on either.
 */
export interface Host {
  /** Attaches the DevTools protocol. Only for approaches that need it (P-027). */
  attach(): Promise<void>;
  detach(): Promise<void>;
  /** Sends one DevTools protocol command. Only while attached. */
  cdp<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  /** Resolves with the first matching DevTools protocol event, or rejects after `timeout` ms. */
  cdpOnce<T = unknown>(event: string, pred?: (params: T) => boolean, timeout?: number): Promise<T>;
  /**
   * Runs `func` inside the inspected page and returns its result. The function
   * is sent as source text, so it must be self-contained: no imports, no closures.
   */
  page<A extends unknown[], R>(func: (...args: A) => R, ...args: A): Promise<Awaited<R>>;
  /** A lossless PNG of the visible tab. */
  shot(): Promise<Blob>;
  /** Saves one output file of this capture. */
  save(name: string, blob: Blob): Promise<void>;
  /**
   * A cheap call that tells the environment the run is still going. Chrome stops
   * an extension service worker after 30 idle seconds (P-025 item 5).
   */
  ping?(): Promise<void>;
}
