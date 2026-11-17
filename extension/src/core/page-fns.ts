// Functions that run INSIDE the inspected page (through Host.page). Chrome
// sends each one as source text, so each must be self-contained: no imports,
// no closures over module scope, no compiler helpers (target ES2022).
// `page-fns.test.ts` runs them from their source text to check this.

export interface PageInfo {
  dpr: number;
  vw: number;
  vh: number;
  scrollX: number;
  scrollY: number;
  docW: number;
  docH: number;
  url: string;
  ua: string;
}

export function pageInfo(): PageInfo {
  const d = document.documentElement;
  return {
    dpr: devicePixelRatio,
    vw: innerWidth,
    vh: innerHeight,
    scrollX: Math.round(scrollX),
    scrollY: Math.round(scrollY),
    docW: Math.max(d.scrollWidth, innerWidth),
    docH: Math.max(d.scrollHeight, innerHeight),
    url: location.href,
    ua: navigator.userAgent,
  };
}

/** Waits for web fonts and two frames, so the screenshot shows a finished layout. */
export async function settle(): Promise<true> {
  try {
    await document.fonts.ready;
  } catch {
    // No font loading API: nothing to wait for.
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return true;
}

/** x, y, width, height of up to 4000 elements, flattened, rounded to quarter pixels. */
export function boxes(): number[] {
  const out: number[] = [];
  const all = document.querySelectorAll("body *");
  for (let i = 0; i < all.length && i < 4000; i++) {
    const r = all[i].getBoundingClientRect();
    out.push(Math.round(r.x * 4) / 4, Math.round(r.y * 4) / 4, Math.round(r.width * 4) / 4, Math.round(r.height * 4) / 4);
  }
  return out;
}

export function injectStyle(id: string, css: string): true {
  let s = document.getElementById(id);
  if (!s) {
    s = document.createElement("style");
    s.id = id;
    document.documentElement.appendChild(s);
  }
  s.textContent = css;
  return true;
}

export function removeStyle(id: string): true {
  document.getElementById(id)?.remove();
  return true;
}

export interface SoftRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  pad: number;
  why: string;
}

/** Declared colours of visible elements, and the regions where other colours are legitimate. */
export function readPalette(): { colours: string[]; soft: SoftRegion[] } {
  const colours = new Set<string>();
  const soft: SoftRegion[] = [];
  const add = (c: string) => {
    if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent" && c !== "none") colours.add(c);
  };
  const vw = innerWidth;
  const vh = innerHeight;
  for (const el of document.querySelectorAll("html, body, body *")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh) continue;
    add(cs.color);
    add(cs.backgroundColor);
    add(cs.webkitTextFillColor);
    for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
      if (parseFloat(cs[`border${side}Width`]) > 0) add(cs[`border${side}Color`]);
    }
    if (el instanceof SVGElement) {
      add(cs.fill);
      add(cs.stroke);
    }
    const tag = el.localName;
    let why: string | null = null;
    let pad = 0;
    if (tag === "img" || tag === "canvas" || tag === "video" || tag === "iframe") why = tag;
    else if (cs.backgroundImage !== "none") why = "background-image";
    else if (+cs.opacity < 1) why = "opacity";
    if (cs.boxShadow !== "none") {
      why = why || "box-shadow";
      pad = 24;
    }
    if (why) soft.push({ x: r.x, y: r.y, w: r.width, h: r.height, pad, why });
  }
  return { colours: [...colours], soft };
}

export interface RasterTarget {
  tag: string;
  x: number;
  y: number;
  w: number;
  h: number;
  backing: [number, number] | null;
}

/** Visible canvases of at least 4 × 4 CSS px. */
export function listRasterTargets(): RasterTarget[] {
  const out: RasterTarget[] = [];
  for (const el of document.querySelectorAll("canvas")) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight) continue;
    out.push({ tag: el.localName, x: r.x, y: r.y, w: r.width, h: r.height, backing: [el.width, el.height] });
  }
  return out;
}

/** Font family names in use, stopping after about a dozen. */
export function fontFamilies(): string[] {
  const seen = new Set<string>();
  for (const el of document.querySelectorAll("body, body *")) {
    for (const f of getComputedStyle(el).fontFamily.split(",")) seen.add(f.trim().replace(/^["']|["']$/g, ""));
    if (seen.size > 12) break;
  }
  return [...seen];
}
