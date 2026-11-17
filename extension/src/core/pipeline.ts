// Runs any subset of the recovery approaches against one host, sharing a single
// lossless screenshot, then every combination step whose inputs exist.
// The approaches and combinations themselves arrive in #45; with none chosen,
// a run saves the lossless shot and report.json.
import type { Host } from "./host.ts";
import { dataUrlToBlob, decode as decodePng, encode as encodePng, type Pixels } from "./img.ts";
import { pageInfo, settle, type PageInfo } from "./page-fns.ts";

/** OS and browser of the machine that rendered the page; chosen in the popup. */
export interface Env {
  os: string | null;
  browser: string | null;
  browserVersion: string | null;
  arch: string | null;
  osSource: "detected" | "user" | "unknown";
  browserSource: "detected" | "user" | "unknown";
}

export interface RunOptions {
  /** Zoom for k× outputs. */
  scale: number;
  env?: Env | null;
  /** S1: skip the paint record and read the layout record. */
  forceLayoutRecord?: boolean;
  /** S2: elements matching this selector are left out of the scene. */
  ignoreSelector?: string | null;
  /** S2: extra font substitutes, lower-case family → open family. */
  substitutes?: Record<string, string>;
}

/** What an approach returns. Each approach has its own type alias with more fields. */
export type ApproachResult = {
  report?: Record<string, unknown>;
  [key: string]: unknown;
};

/**
 * The registry's view of an approach. An approach may take a second, optional
 * options argument (D2 does, for the combination steps).
 */
export interface Approach {
  id: string;
  title: string;
  needsDebugger: boolean;
  run(ctx: Context): Promise<ApproachResult>;
}

export interface Combination {
  id: string;
  what: string;
  /** Approach ids whose outputs this step needs. */
  needs: string[];
  run(ctx: Context): Promise<Record<string, unknown>>;
}

export interface Codec {
  decode(src: Blob): Promise<ImageData>;
  encode(img: Pixels): Promise<Blob>;
}

export type SaveData = Blob | Pixels | string | { base64: string; type: string };

export interface Context {
  host: Host;
  opts: RunOptions;
  /** Outputs of the approaches that ran, by id. */
  out: Record<string, ApproachResult>;
  files: string[];
  baseMetrics?: Record<string, unknown>;
  once<T>(key: string, fn: () => Promise<T>): Promise<T>;
  info(): Promise<PageInfo>;
  takeShot(): Promise<ImageData>;
  /** Decodes a PNG (Blob or data URL) with the run's codec. */
  decode(src: Blob | string): Promise<ImageData>;
  /** Encodes pixels as PNG with the run's codec. */
  encode(img: Pixels): Promise<Blob>;
  /** The shared lossless screenshot, taken once and saved as shot.png. */
  shot(): Promise<ImageData>;
  save(name: string, data: SaveData): Promise<void>;
}

const MIME: Record<string, string> = { svg: "image/svg+xml", json: "application/json" };

export function makeContext(host: Host, opts: Partial<RunOptions> = {}, codec: Codec = { decode: decodePng, encode: encodePng }): Context {
  const cache = new Map<string, Promise<unknown>>();
  const ctx: Context = {
    host,
    opts: { scale: 4, ...opts },
    out: {},
    files: [],
    once<T>(key: string, fn: () => Promise<T>) {
      if (!cache.has(key)) cache.set(key, fn());
      return cache.get(key) as Promise<T>;
    },
    info: () => ctx.once("info", () => host.page(pageInfo)),
    takeShot: async () => codec.decode(await host.shot()),
    decode: (src) => codec.decode(typeof src === "string" ? dataUrlToBlob(src) : src),
    encode: (img) => codec.encode(img),
    shot: () =>
      ctx.once("shot", async () => {
        await host.page(settle);
        const img = await ctx.takeShot();
        await ctx.save("shot.png", img);
        return img;
      }),
    async save(name, data) {
      let blob: Blob;
      if (typeof data === "string") blob = new Blob([data], { type: MIME[name.split(".").pop() ?? ""] ?? "text/plain" });
      else if (data instanceof Blob) blob = data;
      else if ("base64" in data) blob = await (await fetch(`data:${data.type};base64,${data.base64}`)).blob();
      else blob = await codec.encode(data);
      await host.save(name, blob);
      ctx.files.push(name);
    },
  };
  return ctx;
}

export interface Report {
  started: string;
  env: Env | null;
  scale: number;
  page?: PageInfo;
  captureMethod?: "Page.captureScreenshot" | "tabs.captureVisibleTab";
  shot?: { pixelSize: [number, number] };
  approaches: Record<string, Record<string, unknown>>;
  combinations: Record<string, Record<string, unknown>>;
  errors: Record<string, string>;
  files: string[];
}

export interface Registry {
  approaches: Approach[];
  combinations: Combination[];
}

const message = (e: unknown) => String((e as Error)?.message ?? e);

/** The typed output of an approach that ran (the caller names the type it expects). */
export const outOf = <T extends ApproachResult>(ctx: Context, id: string) => ctx.out[id] as T;

export async function run(
  host: Host,
  ids: string[],
  opts: Partial<RunOptions> = {},
  onProgress: (text: string) => void = () => {},
  registry: Registry = { approaches: [], combinations: [] },
  codec?: Codec,
): Promise<Report> {
  const ctx = makeContext(host, opts, codec);
  const chosen = registry.approaches.filter((a) => ids.includes(a.id));
  const report: Report = {
    started: new Date().toISOString(),
    env: opts.env ?? null,
    scale: ctx.opts.scale,
    approaches: {},
    combinations: {},
    errors: {},
    files: [],
  };
  const needDebugger = chosen.some((a) => a.needsDebugger);
  if (needDebugger) {
    // Chrome's debugging bar takes height from the page once attached; keeping
    // the pre-attach viewport size means the capture matches what the user saw.
    const pre = await ctx.info();
    await host.attach();
    ctx.baseMetrics = { width: pre.vw, height: pre.vh, deviceScaleFactor: 0, mobile: false };
    await host.cdp("Emulation.setDeviceMetricsOverride", ctx.baseMetrics);
    await host.page(settle);
  }
  try {
    report.page = await ctx.info();
    report.captureMethod = needDebugger ? "Page.captureScreenshot" : "tabs.captureVisibleTab";
    const shot = await ctx.shot();
    report.shot = { pixelSize: [shot.width, shot.height] };
    for (const a of chosen) {
      await host.ping?.();
      onProgress(`${a.id} · ${a.title}`);
      const t = performance.now();
      try {
        ctx.out[a.id] = await a.run(ctx);
        report.approaches[a.id] = { ...ctx.out[a.id].report, ms: Math.round(performance.now() - t) };
      } catch (e) {
        report.errors[a.id] = message(e);
      }
    }
    for (const c of registry.combinations) {
      if (!c.needs.every((id) => ctx.out[id])) continue;
      await host.ping?.();
      onProgress(c.id);
      const t = performance.now();
      try {
        report.combinations[c.id] = { what: c.what, ...(await c.run(ctx)), ms: Math.round(performance.now() - t) };
      } catch (e) {
        report.errors[c.id] = message(e);
      }
    }
  } finally {
    if (needDebugger) {
      await host.cdp("Emulation.clearDeviceMetricsOverride").catch(() => {});
      await host.detach();
    }
  }
  // Shared list, as in the reference: the saved report lists the other files,
  // and the returned report also lists report.json.
  report.files = ctx.files;
  await ctx.save("report.json", JSON.stringify(report, null, 1));
  return report;
}
