import { describe, expect, it } from "vitest";
import { labToLinearSrgb, labToSrgb, srgbToLab } from "../color/lab";
import { oklabToLinearSrgb, oklchToOklab, oklchToSrgb, srgbToOklab, srgb8ToLinear } from "../color/oklch";
import { basis, defaultCamera, GAMUT_CENTER, look, move, orbitCamera, orbitOf, project } from "./camera";
import { buildLattice, latticeFor } from "./lattice";
import { angularDistance, inHueWindow, sampleIndices, selectLattice } from "./select";
import { nearestPoint, snapColors } from "./snap";
import { CIELAB, OKLAB } from "./space";
import { clearFrame, makeFrame, pack, pickNearest, splatDiscs, splatSquares } from "./splat";

describe("colour conversions for the 3D view", () => {
  it("matches the CSS Color 4 CIELAB values for sRGB red, white and black", () => {
    const red = srgbToLab({ r: 255, g: 0, b: 0 });
    expect(red[0]).toBeCloseTo(54.29, 1);
    expect(red[1]).toBeCloseTo(80.8, 1);
    expect(red[2]).toBeCloseTo(69.89, 1);
    const white = srgbToLab({ r: 255, g: 255, b: 255 });
    expect(white[0]).toBeCloseTo(100, 3);
    // Bradford-adapted sRGB white lands 0.016 from the D50 axis.
    expect(Math.hypot(white[1], white[2])).toBeLessThan(0.02);
    expect(srgbToLab({ r: 0, g: 0, b: 0 })[0]).toBeCloseTo(0, 6);
  });

  it("round-trips 8-bit sRGB through CIELAB", () => {
    for (const c of [{ r: 3, g: 47, b: 41 }, { r: 200, g: 120, b: 9 }, { r: 128, g: 128, b: 128 }]) {
      const [L, a, b] = srgbToLab(c);
      expect(labToSrgb(L, a, b)).toEqual(c);
    }
  });

  it("gives the same linear sRGB from OKLab as the OKLCH path", () => {
    const o = { l: 0.6, c: 0.12, h: 200 };
    const [l, a, b] = oklchToOklab(o);
    const lin = oklabToLinearSrgb(l, a, b);
    const viaOklch = oklchToSrgb(o);
    const encode = (v: number) => Math.round(Math.max(0, Math.min(1, Math.max(0, v) ** (1 / 2.4) * 1.055 - 0.055)) * 255);
    expect(lin.map(encode)).toEqual([viaOklch.r, viaOklch.g, viaOklch.b]);
    // An 8-bit colour converts back to its own linear values.
    const [L, A, B] = srgbToOklab({ r: 10, g: 200, b: 90 });
    const back = oklabToLinearSrgb(L, A, B);
    expect(back[1]).toBeCloseTo(srgb8ToLinear(200), 6);
    expect(labToLinearSrgb(...srgbToLab({ r: 10, g: 200, b: 90 }))[1]).toBeCloseTo(srgb8ToLinear(200), 6);
  });
});

describe("perceptual lattice", () => {
  it("keeps the in-gamut points of an even OKLab grid of step 0.02 (experiment E10: 6,789)", () => {
    const lat = latticeFor(OKLAB);
    expect(lat.n).toBe(6789);
    expect(lat.dims).toEqual([51, 41, 41]);
    // Every point is inside sRGB and one step from its grid neighbours.
    for (let i = 0; i < lat.n; i += 97) {
      for (const v of OKLAB.toLinearSrgb(lat.l[i], lat.a[i], lat.b[i])) expect(v).toBeGreaterThanOrEqual(-1e-9);
      for (const v of [lat.l[i], lat.a[i] + 0.4, lat.b[i] + 0.4]) expect(Math.abs(v / 0.02 - Math.round(v / 0.02))).toBeLessThan(1e-4);
    }
  });

  it("uses an even ΔE*ab 4 grid in CIELAB (experiment E10: 13,000)", () => {
    expect(latticeFor(CIELAB).n).toBe(13000);
  });

  it("marks the grey axis as neutral and colours every point with its own sRGB", () => {
    const lat = latticeFor(OKLAB);
    const neutrals = Array.from(lat.hue).filter(Number.isNaN).length;
    expect(neutrals).toBe(51);
    const k = lat.cell[(50 * 41 + 20) * 41 + 20];
    expect([lat.rgb[3 * k], lat.rgb[3 * k + 1], lat.rgb[3 * k + 2]]).toEqual([255, 255, 255]);
  });

  it("is deterministic, including the random ranks", () => {
    const a = buildLattice({ ...OKLAB, step: 0.05 });
    const b = buildLattice({ ...OKLAB, step: 0.05 });
    expect(Array.from(a.rank)).toEqual(Array.from(b.rank));
    expect(new Set(a.rank).size).toBe(a.n);
  });
});

describe("hue and chroma selection (parity with the notebook's cell 19)", () => {
  it.each([
    [10, 350, 20],
    [350, 10, 20],
    [0, 180, 180],
    [90, 90, 0],
  ])("measures the hue distance from %i to %i as %i across 0/360", (x, y, d) => expect(angularDistance(x, y)).toBe(d));

  it("includes the window edge, selects every hue at width 360 and neutrals only when asked", () => {
    expect(inHueWindow(285, 270, 30, false)).toBe(true);
    expect(inHueWindow(285.01, 270, 30, false)).toBe(false);
    expect(inHueWindow(90, 270, 360, false)).toBe(true);
    expect(inHueWindow(NaN, 270, 360, false)).toBe(false);
    expect(inHueWindow(NaN, 270, 30, true)).toBe(true);
    expect(inHueWindow(270.4, 270, 1, false)).toBe(true);
    expect(inHueWindow(270.6, 270, 1, false)).toBe(false);
  });

  it("refuses a chroma minimum above the maximum, and accepts them equal", () => {
    const lat = latticeFor(OKLAB);
    const s = { hueCenter: 270, hueWidth: 30, chromaMin: 0.2, chromaMax: 0.1, includeNeutrals: false };
    expect(selectLattice(lat, s)).toBeNull();
    expect(selectLattice(lat, { ...s, chromaMin: 0.1, chromaMax: 0.1 })).not.toBeNull();
  });

  it("counts selected and neutral points and splits them into drawn sets", () => {
    const lat = latticeFor(OKLAB);
    const all = selectLattice(lat, { hueCenter: 0, hueWidth: 360, chromaMin: 0, chromaMax: 1, includeNeutrals: true })!;
    expect(all.selectedCount).toBe(lat.n);
    expect(all.neutralCount).toBe(51);
    const some = selectLattice(lat, { hueCenter: 270, hueWidth: 30, chromaMin: 0.1, chromaMax: 0.2, includeNeutrals: false })!;
    expect(some.foreground.length).toBe(some.selectedCount);
    expect(some.foreground.length + some.background.length).toBe(lat.n);
    for (const i of some.foreground) expect(lat.chroma[i]).toBeGreaterThanOrEqual(0.1);
  });

  it("caps a set at the lowest ranks, like the notebook's sampling", () => {
    const mask = new Uint8Array([1, 1, 1, 0, 1]);
    const rank = new Int32Array([4, 0, 3, 1, 2]);
    expect(Array.from(sampleIndices(mask, 1, rank, 2))).toEqual([1, 4]);
    expect(Array.from(sampleIndices(mask, 0, rank, 2))).toEqual([3]);
  });
});

describe("snapping image colours to the lattice", () => {
  it("snaps an interior colour to the grid point it rounds to", () => {
    const lat = latticeFor(OKLAB);
    const k = nearestPoint(lat, 0.501, 0.009, -0.011);
    expect([lat.l[k], lat.a[k], lat.b[k]].map((v) => Math.round(v * 100) / 100)).toEqual([0.5, 0.0, -0.02].map((v) => v + 0));
  });

  it("snaps every 8-bit corner and grey to an in-gamut point nearby, even at the gamut edge", () => {
    for (const space of [OKLAB, CIELAB]) {
      const lat = latticeFor(space);
      for (const c of [{ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }, { r: 0, g: 0, b: 255 }, { r: 255, g: 255, b: 0 }, { r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }, { r: 119, g: 119, b: 119 }]) {
        const [l, a, b] = space.toCoords(c);
        const k = nearestPoint(lat, l, a, b);
        expect(k).toBeGreaterThanOrEqual(0);
        // Experiment E10: at most about 1.3 steps (OKLab) and 2.1 steps (CIELAB) at the gamut edge.
        expect(Math.hypot(lat.l[k] - l, lat.a[k] - a, lat.b[k] - b)).toBeLessThan(space.step * 2.2);
      }
    }
  });

  it("sums the share and count of colours that land on the same point", () => {
    const lat = latticeFor(OKLAB);
    const snap = snapColors(lat, [
      { r: 200, g: 30, b: 30, percent: 10 },
      { r: 201, g: 30, b: 30, percent: 5 },
      { r: 20, g: 30, b: 200, percent: 1 },
    ]);
    expect(snap.occupied.length).toBe(2);
    expect(snap.maxShare).toBeCloseTo(15, 5);
    const big = snap.occupied.find((i) => snap.count[i] === 2)!;
    expect(snap.share[big]).toBeCloseTo(15, 5);
  });

  it("occupies nothing for no colours", () => {
    expect(snapColors(latticeFor(OKLAB), []).occupied.length).toBe(0);
  });
});

describe("camera", () => {
  it("looks at the target from the orbit distance", () => {
    const cam = orbitCamera(GAMUT_CENTER, 2, 0.3, -0.4);
    const p = project(cam, basis(cam), 200, 100, ...GAMUT_CENTER)!;
    expect(p.sx).toBeCloseTo(100, 6);
    expect(p.sy).toBeCloseTo(50, 6);
    expect(p.depth).toBeCloseTo(2, 6);
    const o = orbitOf(cam, GAMUT_CENTER);
    expect(o.distance).toBeCloseTo(2, 9);
    expect(o.yaw).toBeCloseTo(0.3, 9);
    expect(o.pitch).toBeCloseTo(-0.4, 9);
  });

  it("puts points behind the camera off screen, and up on the screen above", () => {
    const cam = orbitCamera([0, 0, 0], 1, 0, 0);
    const b = basis(cam);
    expect(project(cam, b, 100, 100, -2, 0, 0)).toBeNull();
    expect(project(cam, b, 100, 100, 0, 0, 0.1)!.sy).toBeLessThan(50);
  });

  it("moves forward along the view, strafes right, and keeps pitch under 90°", () => {
    const cam = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fov: 1 };
    expect(move(cam, 1, 0, 0).x).toBeCloseTo(1, 9);
    expect(move(cam, 0, 1, 0).y).toBeCloseTo(-1, 9);
    expect(move(cam, 0, 0, 1).z).toBeCloseTo(1, 9);
    expect(look(cam, 0, 10).pitch).toBeCloseTo((89 * Math.PI) / 180, 9);
  });

  it("starts with the whole gamut in view", () => {
    const cam = defaultCamera();
    const b = basis(cam);
    // The sRGB extremes in OKLab (black, white and the primaries), on the canvas's 4:3 shape.
    for (const c of [{ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }, { r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }, { r: 0, g: 0, b: 255 }, { r: 255, g: 255, b: 0 }, { r: 255, g: 0, b: 255 }]) {
      const [l, a, bb] = srgbToOklab(c);
      const p = project(cam, b, 400, 300, a, bb, l)!;
      expect(p.sx).toBeGreaterThan(0);
      expect(p.sx).toBeLessThan(400);
      expect(p.sy).toBeGreaterThan(0);
      expect(p.sy).toBeLessThan(300);
    }
  });
});

describe("default view per space (regression: the CIELAB solid was cut off)", () => {
  it.each([
    ["OKLab", OKLAB],
    ["CIELAB", CIELAB],
  ] as const)("keeps the sRGB extremes on a 4:3 canvas in %s", (_, space) => {
    const cam = defaultCamera(space.abLimit * space.scale);
    const b = basis(cam);
    for (const c of [{ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }, { r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }, { r: 0, g: 0, b: 255 }, { r: 255, g: 255, b: 0 }, { r: 255, g: 0, b: 255 }, { r: 0, g: 255, b: 255 }]) {
      const [l, a, bb] = space.toCoords(c);
      const p = project(cam, b, 400, 300, a * space.scale, bb * space.scale, l * space.scale)!;
      expect(p.sx).toBeGreaterThan(0);
      expect(p.sx).toBeLessThan(400);
      expect(p.sy).toBeGreaterThan(0);
      expect(p.sy).toBeLessThan(300);
    }
  });
});

describe("renderer", () => {
  const pts = { x: new Float32Array([0, 0]), y: new Float32Array([0, 0]), z: new Float32Array([0, 0.0001]) };
  const cam = orbitCamera([0, 0, 0], 1, 0, 0);

  it("keeps the nearer of two overlapping points", () => {
    const f = makeFrame(20, 20);
    clearFrame(f, pack(255, 255, 255));
    const near = pack(255, 0, 0);
    const far = pack(0, 0, 255);
    // Point 0 is 1 unit from the camera, point 1 is behind it at 1.5; drawing order must not matter.
    const p2 = { x: new Float32Array([0, 0.5]), y: new Float32Array([0, 0]), z: new Float32Array([0, 0]) };
    splatSquares(f, cam, p2, new Int32Array([1, 0]), (i) => (i === 0 ? near : far), 3);
    expect(f.pixels[10 * 20 + 10]).toBe(near);
    clearFrame(f, pack(255, 255, 255));
    splatSquares(f, cam, p2, new Int32Array([0, 1]), (i) => (i === 0 ? near : far), 3);
    expect(f.pixels[10 * 20 + 10]).toBe(near);
  });

  it("draws discs over the lattice with a contrasting ring, and picks the point under the pointer", () => {
    const f = makeFrame(40, 40);
    clearFrame(f, pack(255, 255, 255));
    splatSquares(f, cam, pts, new Int32Array([0]), () => pack(9, 9, 9), 2);
    splatDiscs(f, cam, pts, new Int32Array([1]), () => pack(0, 200, 0), () => 5, pack(0, 0, 0));
    expect(f.pixels[20 * 40 + 20]).toBe(pack(0, 200, 0));
    expect(pickNearest(cam, 40, 40, pts, new Int32Array([0, 1]), 21, 20, 6)).toBeGreaterThanOrEqual(0);
    expect(pickNearest(cam, 40, 40, pts, new Int32Array([0, 1]), 0, 0, 6)).toBe(-1);
  });

  it("packs pixels in the byte order ImageData uses", () => {
    const bytes = new Uint8ClampedArray(new Uint32Array([pack(1, 2, 3, 4)]).buffer);
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);
  });
});
