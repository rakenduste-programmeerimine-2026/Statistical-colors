import { describe, expect, it, vi } from "vitest";
import { FIRST_DT, frameLoop, MAX_DT } from "./frame-loop";

/** A fake requestAnimationFrame with a manual clock. */
function fakeFrames() {
  let next = 1;
  const queue = new Map<number, (t: number) => void>();
  const raf = vi.fn((cb: (t: number) => void) => {
    queue.set(next, cb);
    return next++;
  });
  const caf = vi.fn((id: number) => void queue.delete(id));
  const tick = (t: number) => {
    const due = [...queue.values()];
    queue.clear();
    due.forEach((cb) => cb(t));
  };
  return { raf, caf, tick, queued: () => queue.size };
}

describe("frameLoop", () => {
  it("queues exactly one frame for any number of requests between frames", () => {
    const f = fakeFrames();
    const frame = vi.fn(() => false);
    const loop = frameLoop(frame, f.raf, f.caf);
    expect(loop.state()).toBe("idle");
    loop.request();
    loop.request();
    loop.request();
    expect(f.raf).toHaveBeenCalledTimes(1);
    expect(loop.state()).toBe("pending");
    f.tick(1000);
    expect(frame).toHaveBeenCalledTimes(1);
    expect(loop.state()).toBe("idle");
  });

  it("keeps running while the frame says so, with dt from the clock", () => {
    const f = fakeFrames();
    const dts: number[] = [];
    let frames = 3;
    const loop = frameLoop((dt) => (dts.push(dt), --frames > 0), f.raf, f.caf);
    loop.request();
    f.tick(1000);
    f.tick(1020);
    f.tick(1030);
    expect(dts[0]).toBe(FIRST_DT);
    expect(dts[1]).toBeCloseTo(0.02, 9);
    expect(dts[2]).toBeCloseTo(0.01, 9);
    expect(loop.state()).toBe("idle");
    expect(f.queued()).toBe(0);
  });

  it("clamps dt to 0–0.05 s", () => {
    const f = fakeFrames();
    const dts: number[] = [];
    let n = 0;
    const loop = frameLoop((dt) => (dts.push(dt), ++n < 3), f.raf, f.caf);
    loop.request();
    f.tick(0);
    f.tick(1000);
    f.tick(1000);
    expect(dts).toEqual([FIRST_DT, MAX_DT, 0]);
  });

  it("draws again after being disposed and requested (regression: the blank canvas)", () => {
    const f = fakeFrames();
    const frame = vi.fn(() => false);
    const loop = frameLoop(frame, f.raf, f.caf);
    loop.request();
    loop.dispose();
    expect(f.caf).toHaveBeenCalledWith(1);
    expect(loop.state()).toBe("idle");
    loop.request();
    f.tick(16);
    expect(frame).toHaveBeenCalledTimes(1);
  });

  it("does not cancel anything when disposed while idle", () => {
    const f = fakeFrames();
    frameLoop(() => false, f.raf, f.caf).dispose();
    expect(f.caf).not.toHaveBeenCalled();
  });

  it("never runs two loops: a request inside a running frame does not queue a second one", () => {
    const f = fakeFrames();
    const frame = vi.fn(() => {
      loop.request();
      return true;
    });
    const loop = frameLoop(frame, f.raf, f.caf);
    loop.request();
    f.tick(0);
    expect(f.queued()).toBe(1);
    f.tick(16);
    expect(f.queued()).toBe(1);
    expect(frame).toHaveBeenCalledTimes(2);
  });

  it("measures dt from the last frame when a request inside a frame stops it and starts again", () => {
    const f = fakeFrames();
    const dts: number[] = [];
    let n = 0;
    const loop = frameLoop((dt) => {
      dts.push(dt);
      if (++n === 1) loop.request();
      return false;
    }, f.raf, f.caf);
    loop.request();
    f.tick(100);
    f.tick(120);
    expect(dts[1]).toBeCloseTo(0.02, 9);
  });
});
