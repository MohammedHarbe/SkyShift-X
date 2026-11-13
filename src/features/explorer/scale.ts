/**
 * Not-to-scale mapping for the 3D explorer, plus the small amount of orbital maths it needs.
 *
 * The solar system cannot be drawn to scale on one screen (Neptune is ~30 AU out, Sedna's orbit
 * reaches ~900 AU, while planets are thousands of times smaller than their orbits). So:
 *   - heliocentric distance is compressed:   r_scene = AU_SCALE * sqrt(r_AU)
 *   - body sizes are exaggerated:            radius  = SIZE_SCALE * (R / R_earth)^0.4
 * The same compression is applied to orbit lines, so bodies sit exactly on their drawn orbits.
 * Positions along orbits are illustrative (arbitrary starting phases), not an ephemeris.
 */
import { Vector3 } from 'three';
import type { Orbit } from '@/contracts/v1';

export const AU_SCALE = 10;
export const SIZE_SCALE = 0.42;
export const EARTH_RADIUS_KM = 6371;
export const DAYS_PER_YEAR = 365.25;

/** Heliocentric distance in AU -> scene units. */
export const auToScene = (au: number): number => AU_SCALE * Math.sqrt(Math.max(au, 0));

/** Mean radius in km -> rendered radius in scene units. */
export const bodyRadius = (meanRadiusKm: number | undefined, fallback = 0.26): number =>
  meanRadiusKm ? SIZE_SCALE * Math.pow(meanRadiusKm / EARTH_RADIUS_KM, 0.4) : fallback;

/** Deterministic pseudo-random number in [0, 1) from a string, so the scene is identical on every load. */
export function hash01(text: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * Orientation of an orbit and where the body starts on it. The API contract deliberately carries only
 * size, shape, tilt and period, so these three angles are ILLUSTRATIVE and derived from the object id.
 */
export interface OrbitAngles {
  /** Argument of perihelion (rad). */
  omega: number;
  /** Longitude of the ascending node (rad). */
  node: number;
  /** Mean anomaly at simulation time zero (rad). */
  m0: number;
}

export function orbitAngles(id: string): OrbitAngles {
  return {
    omega: hash01(id, 1) * Math.PI * 2,
    node: hash01(id, 2) * Math.PI * 2,
    m0: hash01(id, 3) * Math.PI * 2,
  };
}

/** Solve Kepler's equation E - e·sin(E) = M for the eccentric anomaly E (Newton-Raphson). */
export function solveKepler(meanAnomaly: number, e: number): number {
  const twoPi = Math.PI * 2;
  let m = meanAnomaly % twoPi;
  if (m > Math.PI) m -= twoPi;
  if (m < -Math.PI) m += twoPi;
  let E = e < 0.8 ? m + e * Math.sin(m) : Math.PI * Math.sign(m || 1);
  for (let i = 0; i < 12; i++) {
    const d = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-7) break;
  }
  return E;
}

/**
 * Scene position for a given eccentric anomaly. Ecliptic plane = scene XZ plane, +Y = ecliptic north.
 * Steps: position in the orbital plane -> rotate by argument of perihelion -> tilt by inclination
 * -> rotate by the node -> compress the radial distance.
 */
export function orbitPointAtE(orbit: Orbit, angles: OrbitAngles, E: number, out: Vector3): Vector3 {
  const { semiMajorAxisAu: a, eccentricity: e } = orbit;
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const r = Math.hypot(xp, yp);
  const theta = Math.atan2(yp, xp) + angles.omega;
  const inc = (orbit.inclinationDeg * Math.PI) / 180;
  const x1 = Math.cos(theta);
  const z1 = Math.sin(theta) * Math.cos(inc);
  const y1 = Math.sin(theta) * Math.sin(inc);
  const cosN = Math.cos(angles.node);
  const sinN = Math.sin(angles.node);
  const s = auToScene(r);
  return out.set((x1 * cosN - z1 * sinN) * s, y1 * s, (x1 * sinN + z1 * cosN) * s);
}

/** Scene position at simulation time `days`. */
export function orbitPositionAt(orbit: Orbit, angles: OrbitAngles, days: number, out: Vector3): Vector3 {
  const meanAnomaly = angles.m0 + (2 * Math.PI * days) / (orbit.periodYears * DAYS_PER_YEAR);
  return orbitPointAtE(orbit, angles, solveKepler(meanAnomaly, orbit.eccentricity), out);
}

/** Closed polyline along the (compressed) orbit, as a flat xyz array. */
export function orbitPolyline(orbit: Orbit, angles: OrbitAngles, segments: number): Float32Array {
  const pts = new Float32Array(segments * 3);
  const v = new Vector3();
  for (let i = 0; i < segments; i++) {
    orbitPointAtE(orbit, angles, (i / segments) * Math.PI * 2, v);
    pts[i * 3] = v.x;
    pts[i * 3 + 1] = v.y;
    pts[i * 3 + 2] = v.z;
  }
  return pts;
}

/** Illustrative extents (AU) of the two diffuse structures. */
export const KUIPER_BELT_AU = { inner: 30, outer: 50 } as const;
/**
 * Where the Planet Nine *search region* haze is drawn. This is NOT a predicted orbit or position:
 * it only says "far beyond the Kuiper Belt, hundreds of AU out". Chosen for legibility.
 */
export const SEARCH_REGION_SCENE = { inner: 165, outer: 270 } as const;
