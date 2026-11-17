// A stand-in for the Figma plugin API, enough to run the import. It catches
// code-path errors and checks the maths; it says nothing about how Figma
// itself renders (a real run in Figma is part of done for #46).

export type FakeNode = {
  type: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: FakeNode[];
  parent: FakeNode | null;
  visible: boolean;
  locked: boolean;
  fills: unknown[];
  [key: string]: unknown;
  resize(w: number, h: number): void;
  appendChild(c: FakeNode): void;
  insertChild(i: number, c: FakeNode): void;
  setPluginData(k: string, v: string): void;
  getPluginData(k: string): string;
  findAll(fn: (n: FakeNode) => boolean): FakeNode[];
  readonly absoluteTransform: [[number, number, number], [number, number, number]];
  exportAsync(): Promise<Uint8Array>;
};

/** Fonts Figma has in this fake, by family. */
export const FONTS: Record<string, string[]> = {
  Inter: ["Regular", "Medium", "Semi Bold", "Bold", "Italic", "Bold Italic"],
  Arimo: ["Regular", "Bold", "Italic", "Bold Italic"],
  Roboto: ["Regular", "Bold"],
};

/** Position on the page: the sum of offsets up to the page. */
function absolute(node: FakeNode): [[number, number, number], [number, number, number]] {
  let x = 0;
  let y = 0;
  for (let p: FakeNode | null = node; p && p.type !== "PAGE"; p = p.parent) {
    x += p.x;
    y += p.y;
  }
  return [
    [1, 0, x],
    [0, 1, y],
  ];
}

export function fakeFigma({ fonts = FONTS, widths = {} as Record<string, number> } = {}) {
  const data = new WeakMap<FakeNode, Record<string, string>>();
  const base = (type: string): FakeNode => {
    const n: FakeNode = {
      type,
      name: "",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      children: [],
      parent: null,
      visible: true,
      locked: false,
      fills: [],
      resize(w, h) {
        this.width = w;
        this.height = h;
      },
      appendChild(c) {
        c.parent = this;
        this.children.push(c);
      },
      insertChild(i, c) {
        c.parent = this;
        this.children.splice(i, 0, c);
      },
      setPluginData(k, v) {
        data.set(this, { ...data.get(this), [k]: v });
      },
      getPluginData(k) {
        return data.get(this)?.[k] ?? "";
      },
      findAll(fn) {
        const out: FakeNode[] = [];
        const walk = (x: FakeNode) =>
          x.children.forEach((c) => {
            if (fn(c)) out.push(c);
            walk(c);
          });
        walk(this);
        return out;
      },
      get absoluteTransform() {
        return absolute(this);
      },
      async exportAsync() {
        return new Uint8Array([1, 2, 3]);
      },
    };
    return n;
  };
  // Text width: the captured width for strings listed in `widths` (a width-equal
  // font), otherwise 0.55 em per character; letter spacing adds per character.
  const text = (): FakeNode => {
    const n = base("TEXT");
    let chars = "";
    let spacing = 0;
    let size = 16;
    const measure = () => {
      n.width = (widths[chars] ?? chars.length * size * 0.55) + spacing * chars.length;
      n.height = size * 1.2;
    };
    Object.defineProperty(n, "characters", {
      get: () => chars,
      set: (v: string) => {
        if (!n.fontName) throw new Error("font not set");
        chars = v;
        measure();
      },
    });
    Object.defineProperty(n, "letterSpacing", {
      get: () => ({ unit: "PIXELS", value: spacing }),
      set: (v: { value: number }) => {
        spacing = v.value;
        measure();
      },
    });
    Object.defineProperty(n, "fontSize", {
      get: () => size,
      set: (v: number) => {
        size = v;
        measure();
      },
    });
    return n;
  };
  const page = base("PAGE");
  const sent: Record<string, unknown>[] = [];
  const figma = {
    showUI: () => {},
    notify: () => {},
    ui: {
      onmessage: null as null | ((m: Record<string, unknown>) => void),
      postMessage(m: Record<string, unknown>) {
        sent.push(m);
        const reply = (extra: Record<string, unknown>) => setTimeout(() => figma.ui.onmessage?.({ reqId: m.reqId, ...extra }));
        if (m.type === "crop") reply({ bytes: new Uint8Array([9]) });
        if (m.type === "verify") reply({ sizeMatch: true, within8Pct: 90, within48Pct: 99 });
      },
    },
    currentPage: page as FakeNode & { selection?: unknown },
    viewport: { center: { x: 0, y: 0 }, scrollAndZoomIntoView: () => {} },
    listAvailableFontsAsync: async () => Object.entries(fonts).flatMap(([family, styles]) => styles.map((style) => ({ fontName: { family, style } }))),
    loadFontAsync: async (f: { family: string; style: string }) => {
      if (!fonts[f.family]?.includes(f.style)) throw new Error(`font not available: ${f.family} ${f.style}`);
    },
    createFrame: () => base("FRAME"),
    createRectangle: () => base("RECTANGLE"),
    createText: text,
    createImage: (bytes: Uint8Array) => {
      if (!bytes?.length) throw new Error("empty image");
      return { hash: `h${bytes.length}` };
    },
    createNodeFromSvg: (s: string) => {
      if (!/^<svg/.test(s)) throw new Error("bad svg");
      const n = base("FRAME");
      n.width = Number(s.match(/width="([\d.]+)"/)?.[1]);
      n.height = Number(s.match(/height="([\d.]+)"/)?.[1]);
      return n;
    },
  };
  /** Waits for the import to finish and returns its "done" message. */
  const done = async () => {
    for (let i = 0; i < 200; i++) {
      const msg = sent.find((m) => m.type === "done");
      if (msg) return msg;
      await new Promise((r) => setTimeout(r, 0));
    }
    throw new Error("the import did not finish");
  };
  return { figma, page, sent, done };
}
