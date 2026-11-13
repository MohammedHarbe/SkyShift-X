/** Turns API objects into what the scene needs to draw them. Pure data, no three.js objects. */
import type { Orbit, SolarSystemObject } from '@/contracts/v1';
import { bodyRadius, hash01, orbitAngles, type OrbitAngles } from './scale';

export type VisualStyle = SolarSystemObject['visual']['style'];

export interface BodyModel {
  id: string;
  name: string;
  kind: SolarSystemObject['kind'];
  hypothetical: boolean;
  style: VisualStyle;
  color: string;
  accent: string;
  rings: boolean;
  radius: number;
  orbit?: Orbit;
  angles: OrbitAngles;
  parentId?: string;
  /** Axial tilt (rad) and spin rate (rad per real second): cosmetic only. */
  tilt: number;
  spin: number;
  seed: number;
}

/** Well-known axial tilts (degrees) used purely for looks; everything else gets a small default. */
const TILT_DEG: Record<string, number> = { earth: 23.4, mars: 25.2, jupiter: 3.1, saturn: 26.7, uranus: 97.8, neptune: 28.3 };

/** Lighten (amount > 0) or darken (amount < 0) a #rrggbb colour. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(v)));
  });
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function toBodyModel(o: SolarSystemObject): BodyModel {
  const radius = o.kind === 'spacecraft' ? 0.34 : bodyRadius(o.meanRadiusKm);
  return {
    id: o.id,
    name: o.name,
    kind: o.kind,
    hypothetical: o.status === 'hypothetical',
    style: o.visual.style,
    color: o.visual.color,
    accent: o.visual.accentColor ?? shade(o.visual.color, o.visual.style === 'gas-giant' ? -0.35 : 0.3),
    rings: o.visual.rings,
    radius,
    orbit: o.orbit,
    angles: orbitAngles(o.id),
    parentId: o.parentId,
    tilt: ((TILT_DEG[o.id] ?? 6) * Math.PI) / 180,
    spin: 0.05 + hash01(o.id, 7) * 0.08,
    seed: hash01(o.id, 9) * 40,
  };
}

/** Navigator / legend grouping. */
export type ObjectGroup = 'planets' | 'outer' | 'mission' | 'hypothesis';

export const GROUP_LABEL: Record<ObjectGroup, string> = {
  planets: 'Sun & planets',
  outer: 'Outer solar system',
  mission: 'Mission',
  hypothesis: 'Hypothesis',
};

export function groupOf(o: Pick<SolarSystemObject, 'kind' | 'status'>): ObjectGroup {
  if (o.status === 'hypothetical') return 'hypothesis';
  if (o.kind === 'spacecraft') return 'mission';
  if (o.kind === 'star' || o.kind === 'planet') return 'planets';
  return 'outer';
}

const KIND_LABEL: Record<SolarSystemObject['kind'], string> = {
  star: 'Star',
  planet: 'Planet',
  'dwarf-planet': 'Dwarf planet',
  moon: 'Moon',
  belt: 'Region of the solar system',
  spacecraft: 'Space telescope',
  region: 'Region',
};

export function kindLabel(o: Pick<SolarSystemObject, 'kind' | 'status'>): string {
  return o.status === 'hypothetical' ? 'Hypothesis · not observed' : KIND_LABEL[o.kind];
}
