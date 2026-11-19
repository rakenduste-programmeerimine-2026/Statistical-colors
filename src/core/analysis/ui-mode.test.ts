import { describe, expect, it } from "vitest";
import type { PaletteCluster } from "./color-analysis";
import { darkModeFinding } from "./ui-mode";

let next = 0;
const cluster = (l: number, share: number, spreadDeltaE = 0.004): PaletteCluster => ({
  id: `c${next++}`,
  color: { l, c: 0.01, h: 260 },
  share,
  pixelCount: share * 100,
  memberCount: 3,
  spreadDeltaE,
  meta: { provenance: "measured", confidence: 1, method: "test", requires: "pixels" },
});

describe("darkModeFinding", () => {
  it("finds a dark dashboard: flat dark background with light text", () => {
    const bg = cluster(0.18, 62);
    const f = darkModeFinding([bg, cluster(0.24, 20), cluster(0.92, 5), cluster(0.7, 3)]);
    expect(f).toMatchObject({ kind: "ui.dark-mode", meta: { confidence: 0.6, caveats: ["needs-scene-data"] } });
    expect(f?.clusterIds?.[0]).toBe(bg.id);
    expect(f?.metrics?.find((m) => m.key === "contentShare")?.value).toBe(8);
  });

  it("finds nothing for a dark background without light content", () => {
    expect(darkModeFinding([cluster(0.15, 90), cluster(0.2, 10)])).toBeUndefined();
  });

  it("finds nothing for a noisy dark background (spread over 0.01)", () => {
    expect(darkModeFinding([cluster(0.18, 62, 0.015), cluster(0.92, 5)])).toBeUndefined();
  });

  it("finds nothing for a light page", () => {
    expect(darkModeFinding([cluster(0.99, 70), cluster(0.2, 6), cluster(0.55, 24)])).toBeUndefined();
  });
});
