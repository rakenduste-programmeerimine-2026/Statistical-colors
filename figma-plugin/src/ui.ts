// Intent Capture Import, UI iframe. Reads the dropped files, decodes and crops
// images, compares Figma's export with the screenshot, and talks to the main
// thread (code.ts) through postMessage.
import type { SceneMeta, SceneNode } from "../../extension/src/core/scene.ts";
import { compareBrightness, countNodes, readSceneMeta } from "./logic.ts";

type Msg = Record<string, unknown> & { type?: string; reqId?: number };

export function startUi() {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  type Loaded = { meta: SceneMeta | null; shot: ImageBitmap | null };
  const state: Loaded & { shotBytes: Uint8Array | null; names: { svg?: string; shot?: string }; importing: Loaded | null } = {
    meta: null,
    shotBytes: null,
    shot: null,
    names: {},
    // The files an import started with: a file dropped meanwhile must not change them.
    importing: null,
  };
  const say = (text: string, err = false) => {
    $("log").textContent = text;
    $("log").className = err ? "err" : "";
  };
  const post = (pluginMessage: Msg) => parent.postMessage({ pluginMessage }, "*");

  function showFiles() {
    const files = $("files");
    files.textContent = "";
    const line = (label: string, value: string | undefined, missing: string) => {
      const div = document.createElement("div");
      div.textContent = `${label}: ${value ?? missing}`;
      files.append(div);
    };
    line("Scene", state.names.svg, "missing");
    line("Screenshot", state.names.shot, "missing (patches and the pixel check are skipped)");
    $<HTMLButtonElement>("go").disabled = !state.meta || state.importing !== null;
  }

  async function take(files: FileList | File[]) {
    for (const f of files) {
      if (/\.svg$/i.test(f.name)) {
        const res = readSceneMeta(await f.text());
        if ("error" in res) {
          say(`${f.name} ${res.error}`, true);
          continue;
        }
        state.meta = res.meta;
        state.names.svg = f.name;
      } else if (/\.png$/i.test(f.name)) {
        state.shotBytes = new Uint8Array(await f.arrayBuffer());
        state.shot = await createImageBitmap(new Blob([state.shotBytes.slice()], { type: "image/png" }));
        state.names.shot = f.name;
      }
    }
    showFiles();
    if (state.meta) say(`Ready: ${countNodes(state.meta.root)} nodes, viewport ${state.meta.viewport.join(" × ")}.`);
  }

  const toPng = (canvas: HTMLCanvasElement) =>
    new Promise<Uint8Array>((res) => canvas.toBlob(async (b) => res(new Uint8Array(b ? await b.arrayBuffer() : new ArrayBuffer(0))), "image/png"));

  // A CSS-pixel rectangle cut out of the screenshot of the running import (or the loaded one).
  async function crop(box: SceneNode["box"], from: Loaded = state.importing ?? state) {
    if (!from.shot || !from.meta) return null;
    const d = from.meta.dpr || 1;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(box[2] * d));
    c.height = Math.max(1, Math.round(box[3] * d));
    c.getContext("2d")?.drawImage(from.shot, -Math.round(box[0] * d), -Math.round(box[1] * d));
    return toPng(c);
  }

  // Figma takes PNG, JPEG and GIF bytes; anything else is redrawn as PNG.
  async function assetBytes(url: string) {
    const blob = await (await fetch(url)).blob();
    if (/png|jpe?g|gif/.test(blob.type)) return new Uint8Array(await blob.arrayBuffer());
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || 64;
    c.height = img.naturalHeight || 64;
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return toPng(c);
  }

  function pixelsOf(bitmap: ImageBitmap) {
    const c = document.createElement("canvas");
    c.width = bitmap.width;
    c.height = bitmap.height;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) throw new Error("Canvas 2D is not available.");
    g.drawImage(bitmap, 0, 0);
    return g.getImageData(0, 0, c.width, c.height);
  }

  const drop = $("drop");
  drop.ondragover = (e) => {
    e.preventDefault();
    drop.classList.add("over");
  };
  drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    if (e.dataTransfer) void take(e.dataTransfer.files);
  };
  $("pick").onclick = (e) => {
    e.preventDefault();
    $("input").click();
  };
  $<HTMLInputElement>("input").onchange = () => {
    const files = $<HTMLInputElement>("input").files;
    if (files) void take(files);
  };

  $("go").onclick = async () => {
    const meta = state.meta;
    if (!meta || state.importing) return;
    state.importing = { meta, shot: state.shot };
    showFiles();
    say("Preparing images…");
    try {
    const assets: Record<string, Uint8Array> = {};
    const patches: Record<string, Uint8Array> = {};
    for (const [k, url] of Object.entries(meta.assets ?? {})) {
      try {
        assets[k] = await assetBytes(url);
      } catch {
        // The node becomes a patch in the main thread.
      }
    }
    // A patch may carry its own sharper k× bitmap; otherwise it is cut from the screenshot.
    const walk = async (n: SceneNode) => {
      if (n.kind === "patch") {
        const own = typeof n.patch?.asset === "string" ? assets[n.patch.asset] : undefined;
        const bytes = own ?? (await crop(n.box));
        if (bytes) patches[n.id] = bytes;
      }
      for (const c of n.children ?? []) await walk(c);
    };
    await walk(meta.root);
    // Image bytes travel separately from the metadata.
    post({
      type: "import",
      meta: { ...meta, assets: {} },
      assets,
      patches,
      shot: state.shotBytes,
      // PLACEHOLDER(#48): read the stored colour analysis for this capture from the backend.
      analysis: null,
      options: { preferSubstitute: $<HTMLInputElement>("preferSub").checked },
    });
    } catch (e) {
      // Nothing reached the main thread, so no "done" will come: end the import here.
      state.importing = null;
      showFiles();
      say(`Could not prepare the import: ${(e as Error)?.message ?? e}`, true);
    }
  };

  onmessage = async (e: MessageEvent) => {
    const msg = (e.data as { pluginMessage?: Msg }).pluginMessage;
    if (!msg) return;
    const reply = (extra: Msg) => post({ reqId: msg.reqId, ...extra });
    if (msg.type === "log") say(String(msg.text));
    else if (msg.type === "crop") reply({ bytes: (await crop(msg.box as SceneNode["box"])) ?? new Uint8Array() });
    else if (msg.type === "verify") {
      const shot = (state.importing ?? state).shot;
      if (!shot) return reply({ sizeMatch: false, within8Pct: null, within48Pct: null });
      const exported = await createImageBitmap(new Blob([(msg.bytes as Uint8Array).slice()], { type: "image/png" }));
      reply(compareBrightness(pixelsOf(exported), pixelsOf(shot)));
    } else if (msg.type === "done") {
      state.importing = null;
      showFiles();
      say(msg.ok ? JSON.stringify(msg.report, null, 1) : `Import failed: ${String(msg.error)}`, !msg.ok);
    }
  };
}
