// A free camera for the 3D colour-space view (P-035): orbit around the gamut
// centre, or fly through open space. World axes: x = a, y = b, z = lightness,
// with lightness scaled to 0–1 in both spaces.

export interface Camera {
  x: number;
  y: number;
  z: number;
  /** Radians: yaw around the lightness axis, pitch up from the a–b plane. */
  yaw: number;
  pitch: number;
  /** Vertical field of view, radians. */
  fov: number;
}

export interface Basis {
  forward: [number, number, number];
  right: [number, number, number];
  up: [number, number, number];
}

export const GAMUT_CENTER: [number, number, number] = [0, 0, 0.5];
const MAX_PITCH = (89 * Math.PI) / 180;
const NEAR = 0.01;

export function basis(cam: Pick<Camera, "yaw" | "pitch">): Basis {
  const cp = Math.cos(cam.pitch);
  const forward: [number, number, number] = [cp * Math.cos(cam.yaw), cp * Math.sin(cam.yaw), Math.sin(cam.pitch)];
  // right = forward × world up (0, 0, 1), normalised; never zero because pitch stays under 90°.
  const rl = Math.hypot(forward[1], forward[0]);
  const right: [number, number, number] = [forward[1] / rl, -forward[0] / rl, 0];
  const up: [number, number, number] = [
    right[1] * forward[2] - right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1] - right[1] * forward[0],
  ];
  return { forward, right, up };
}

/** The camera that looks at `target` from `distance` away, at the given yaw and pitch. */
export function orbitCamera(target: [number, number, number], distance: number, yaw: number, pitch: number, fov = (50 * Math.PI) / 180): Camera {
  const p = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));
  const { forward } = basis({ yaw, pitch: p });
  return { x: target[0] - forward[0] * distance, y: target[1] - forward[1] * distance, z: target[2] - forward[2] * distance, yaw, pitch: p, fov };
}

/**
 * The default view: a three-quarter view of the whole gamut. `halfWidth` is the
 * a, b extent in world units (0.4 for OKLab, 1.28 for CIELAB), so the wider
 * CIELAB solid is seen from farther away.
 */
export const defaultCamera = (halfWidth = 0.4) => orbitCamera(GAMUT_CENTER, 0.95 + 1.3 * halfWidth, (-135 * Math.PI) / 180, (-22 * Math.PI) / 180);

/** Turns the camera on the spot (fly mode): mouse drag or keys. */
export function look(cam: Camera, dYaw: number, dPitch: number): Camera {
  return { ...cam, yaw: cam.yaw + dYaw, pitch: Math.max(-MAX_PITCH, Math.min(MAX_PITCH, cam.pitch + dPitch)) };
}

/** Moves the camera along its own axes: forward, right and world up. */
export function move(cam: Camera, forward: number, right: number, up: number): Camera {
  const b = basis(cam);
  return {
    ...cam,
    x: cam.x + b.forward[0] * forward + b.right[0] * right,
    y: cam.y + b.forward[1] * forward + b.right[1] * right,
    z: cam.z + b.forward[2] * forward + b.right[2] * right + up,
  };
}

export interface Projected {
  sx: number;
  sy: number;
  /** Distance along the view direction; larger is farther. */
  depth: number;
}

/** Projects a world point to the screen, or null when it is behind the camera. */
export function project(cam: Camera, b: Basis, width: number, height: number, x: number, y: number, z: number): Projected | null {
  const dx = x - cam.x;
  const dy = y - cam.y;
  const dz = z - cam.z;
  const depth = dx * b.forward[0] + dy * b.forward[1] + dz * b.forward[2];
  if (depth <= NEAR) return null;
  const xc = dx * b.right[0] + dy * b.right[1] + dz * b.right[2];
  const yc = dx * b.up[0] + dy * b.up[1] + dz * b.up[2];
  const f = height / 2 / Math.tan(cam.fov / 2);
  return { sx: width / 2 + (xc * f) / depth, sy: height / 2 - (yc * f) / depth, depth };
}

/** The orbit parameters of a camera that looks at `target`: distance, yaw and pitch. */
export function orbitOf(cam: Camera, target: [number, number, number]) {
  const dx = target[0] - cam.x;
  const dy = target[1] - cam.y;
  const dz = target[2] - cam.z;
  const distance = Math.hypot(dx, dy, dz);
  return { distance, yaw: Math.atan2(dy, dx), pitch: Math.asin(dz / (distance || 1)) };
}
