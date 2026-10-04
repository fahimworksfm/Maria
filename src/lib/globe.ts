// Spherical geometry for the Together globe. Pure functions, no map library, so
// they can be tested on their own.

export type LngLat = [number, number];

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

type Vec3 = [number, number, number];

const toVec = ([lng, lat]: LngLat): Vec3 => {
  const la = toRad(lat);
  const lo = toRad(lng);
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
};

const toLngLat = ([x, y, z]: Vec3): LngLat => [toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.hypot(x, y)))];

/** Angle between two points on the sphere, in degrees (0–180). */
export function angularDistanceDeg(a: LngLat, b: LngLat): number {
  const [ax, ay, az] = toVec(a);
  const [bx, by, bz] = toVec(b);
  // Clamped because floating point can nudge the dot product past ±1.
  const dot = Math.min(1, Math.max(-1, ax * bx + ay * by + az * bz));
  return toDeg(Math.acos(dot));
}

/**
 * Points along the great circle from `a` to `b` — the path a plane would fly,
 * which on a globe is the line that reads as "the distance between us".
 *
 * Longitudes are unwrapped so consecutive points never jump by ~360°, which
 * would otherwise draw a stripe across the whole map at the antimeridian.
 * Returns [] when an arc would be meaningless: the same spot, or antipodal
 * points where the path is undefined.
 */
export function greatCircleArc(a: LngLat, b: LngLat, steps = 96): LngLat[] {
  const omegaDeg = angularDistanceDeg(a, b);
  if (omegaDeg < 0.05 || omegaDeg > 179.9) return [];

  const omega = toRad(omegaDeg);
  const sinOmega = Math.sin(omega);
  const [ax, ay, az] = toVec(a);
  const [bx, by, bz] = toVec(b);

  const out: LngLat[] = [];
  let prevLng: number | null = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ca = Math.sin((1 - t) * omega) / sinOmega;
    const cb = Math.sin(t * omega) / sinOmega;
    const v: Vec3 = [ca * ax + cb * bx, ca * ay + cb * by, ca * az + cb * bz];
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    let [lng, lat] = toLngLat([v[0] / len, v[1] / len, v[2] / len]);
    if (prevLng !== null) {
      while (lng - prevLng > 180) lng -= 360;
      while (lng - prevLng < -180) lng += 360;
    }
    prevLng = lng;
    out.push([lng, lat]);
  }
  return out;
}

/** The point halfway along the great circle — what the globe centres on. */
export function greatCircleMidpoint(a: LngLat, b: LngLat): LngLat {
  const [ax, ay, az] = toVec(a);
  const [bx, by, bz] = toVec(b);
  const v: Vec3 = [ax + bx, ay + by, az + bz];
  const len = Math.hypot(v[0], v[1], v[2]);
  // Antipodal points have no midpoint; any point on the bisector is equally
  // valid, so fall back to the first.
  if (len < 1e-9) return a;
  return toLngLat([v[0] / len, v[1] / len, v[2] / len]);
}
