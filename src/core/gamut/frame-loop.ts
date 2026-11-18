// One explicit animation loop for the 3D view (P-037 refactor, approved by the
// user; docs/automata/gamut-view.md). It replaces two implicit loops (the
// redraw scheduler and the held-key loop) whose loose variables let a stale
// frame id stop all drawing and let two loops run at once.
//
// States: idle, or pending with the id of the queued frame and the time of the
// last frame. `request` queues one frame when idle and is ignored when pending.
// When the frame fires, `frame(dt)` runs; it returns true to keep running.
// `dispose` cancels from any state and returns to idle.

type LoopState = { kind: "idle" } | { kind: "pending"; id: number; last: number | null };

/** Seconds assumed for the first frame, and the most one frame may count. */
export const FIRST_DT = 0.016;
export const MAX_DT = 0.05;

export interface FrameLoop {
  request(): void;
  dispose(): void;
  /** For tests and documentation: the current state's kind. */
  state(): LoopState["kind"];
}

export function frameLoop(
  frame: (dt: number) => boolean,
  raf: (cb: (t: number) => void) => number,
  caf: (id: number) => void,
): FrameLoop {
  let s: LoopState = { kind: "idle" };
  const fire = (t: number) => {
    const last = s.kind === "pending" ? s.last : null;
    const dt = last === null ? FIRST_DT : Math.min(MAX_DT, Math.max(0, (t - last) / 1000));
    s = { kind: "idle" };
    // A request made inside `frame` queues the next frame itself; keep only one.
    const keepGoing = frame(dt);
    // `frame` may have called `request`, so read the state again.
    const after = s as LoopState;
    if (after.kind === "pending") s = { ...after, last: t };
    else if (keepGoing) s = { kind: "pending", id: raf(fire), last: t };
  };
  return {
    request() {
      if (s.kind === "idle") s = { kind: "pending", id: raf(fire), last: null };
    },
    dispose() {
      if (s.kind === "pending") caf(s.id);
      s = { kind: "idle" };
    },
    state: () => s.kind,
  };
}
