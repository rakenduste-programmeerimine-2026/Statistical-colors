import type { SceneMeta, SceneNode } from "../../extension/src/core/scene.ts";

const text = (id: string, characters: string, box: SceneNode["box"], usedFamily = "Arial"): SceneNode => ({
  id,
  kind: "text",
  name: characters,
  box,
  text: {
    characters,
    usedFamily,
    substitute: null,
    requested: [usedFamily],
    weight: 400,
    italic: false,
    size: 16,
    lineHeight: box[3],
    letterSpacing: 0,
    decoration: "none",
    fill: [0, 0, 0, 1],
    baseline: box[1] + 14,
    width: box[2],
  },
});

/** A small capture: a page frame with a card (fill, radii, shadow, border), text, a vector, an image and a patch. */
export function sampleMeta(): SceneMeta {
  return {
    version: 1,
    viewport: [400, 300],
    dpr: 1,
    url: "https://example.test/",
    shot: "shot.png",
    fonts: [],
    assets: { a0: "data:image/png;base64,AAAA" },
    unsupported: [{ why: "form-control", x: 20, y: 200, w: 13, h: 13 }],
    root: {
      id: "n0",
      kind: "frame",
      name: "html",
      box: [0, 0, 400, 300],
      style: { fills: [{ type: "solid", color: [255, 255, 255, 1] }], clip: true },
      children: [
        {
          id: "n1",
          kind: "frame",
          name: "div.card",
          box: [20, 20, 200, 100],
          source: { tag: "div", classes: ["card"] },
          style: {
            fills: [{ type: "solid", color: [240, 240, 255, 1] }],
            radii: [8, 8, 8, 8],
            effects: [{ type: "drop-shadow", x: 0, y: 4, blur: 14, spread: 0, color: [0, 0, 0, 0.25] }],
            strokes: { weights: [1, 1, 1, 1], colors: [[200, 200, 200, 1], [200, 200, 200, 1], [200, 200, 200, 1], [200, 200, 200, 1]], uniform: true },
          },
          children: [text("n2", "Hello", [30, 30, 40, 19])],
        },
        { id: "n3", kind: "vector", name: "svg", box: [240, 20, 24, 24], vector: { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"></svg>' } },
        { id: "n4", kind: "image", name: "img", box: [240, 60, 50, 50], image: { asset: "a0", backing: [50, 50] } },
        { id: "n5", kind: "patch", name: "input", box: [20, 200, 13, 13], patch: { reason: "input" } },
        text("n6", "Missing font", [20, 240, 120, 19], "Nonexistent Sans"),
      ],
    },
  };
}
