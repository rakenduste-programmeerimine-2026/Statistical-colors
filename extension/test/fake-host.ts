import { vi } from "vitest";
import type { Host } from "../src/core/host.ts";
import type { Codec } from "../src/core/pipeline.ts";
import type { PageInfo } from "../src/core/page-fns.ts";

export const PAGE: PageInfo = {
  dpr: 1,
  vw: 800,
  vh: 600,
  scrollX: 0,
  scrollY: 0,
  docW: 800,
  docH: 1200,
  url: "https://example.test/",
  ua: "test",
};

/**
 * A host that records every call. `page` answers pageInfo with PAGE, a
 * function named in `pageResults` with that value, and anything else with true.
 */
export function fakeHost(pageResults: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const saved = new Map<string, Blob>();
  const host = {
    attach: vi.fn(async () => void calls.push("attach")),
    detach: vi.fn(async () => void calls.push("detach")),
    cdp: vi.fn(async (method: string, params?: unknown): Promise<unknown> => {
      void params;
      calls.push(`cdp ${method}`);
      return {};
    }),
    cdpOnce: vi.fn(async (): Promise<unknown> => ({})),
    page: vi.fn(async (func: { name: string }, ...args: unknown[]): Promise<unknown> => {
      void args;
      calls.push(`page ${func.name}`);
      if (func.name in pageResults) return pageResults[func.name];
      return func.name === "pageInfo" ? PAGE : true;
    }),
    shot: vi.fn(async () => {
      calls.push("shot");
      return new Blob(["png"], { type: "image/png" });
    }),
    save: vi.fn(async (name: string, blob: Blob) => {
      calls.push(`save ${name}`);
      saved.set(name, blob);
    }),
  };
  return { host: host as unknown as Host & typeof host, calls, saved };
}

/** No canvas in jsdom: "decode" gives a fixed 4 × 2 image, "encode" a marker blob. */
export const fakeCodec: Codec = {
  decode: async () => ({ width: 4, height: 2, data: new Uint8ClampedArray(32) }) as ImageData,
  encode: async () => new Blob(["encoded"], { type: "image/png" }),
};

/** A codec whose decode hands out the given images in order; the last one repeats. */
export function queuedCodec(images: { width: number; height: number; data: Uint8ClampedArray }[]): Codec {
  let i = 0;
  return {
    decode: async () => images[Math.min(i++, images.length - 1)] as ImageData,
    encode: fakeCodec.encode,
  };
}
