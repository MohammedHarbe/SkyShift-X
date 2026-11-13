/**
 * 2D fallback for devices without WebGL: a top-down, clickable map of the same objects.
 * Uses a logarithmic distance scale so everything from Mercury to the distant search region fits.
 * Like the 3D view it is a schematic, not a chart of real positions.
 */
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Vector3 } from 'three';
import type { SolarSystemObject } from '@/contracts/v1';
import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { useExplorerStore } from '@/stores/explorer';
import { simClock } from './registry';
import { AU_SCALE, KUIPER_BELT_AU, orbitAngles, orbitPolyline, orbitPositionAt } from './scale';

/** Heliocentric distance (AU) -> map units. Log scale: Mercury ≈ 4, Neptune ≈ 46, 700 AU ≈ 89. */
const mapRadius = (au: number) => 14 * Math.log(1 + au / 1.2);
/** Undo the 3D scene's square-root compression to get back to AU. */
const sceneToAu = (r: number) => (r / AU_SCALE) ** 2;

/** Illustrative radial extent of the search-region band on the map (it corresponds to "hundreds of AU"). */
const REGION_AU = { inner: 300, outer: 700 };

function toMap(v: Vector3): [number, number] {
  const r = Math.hypot(v.x, v.z);
  if (r < 1e-6) return [0, 0];
  const m = mapRadius(sceneToAu(Math.hypot(v.x, v.y, v.z)));
  return [(v.x / r) * m, (v.z / r) * m];
}

export function Orrery2D({ objects, selectedId, onSelect }: { objects: SolarSystemObject[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const reducedMotion = useReducedMotion();
  const [, setTick] = useState(0);

  // No render loop exists without WebGL, so advance the shared simulation clock here.
  useEffect(() => {
    if (reducedMotion) return;
    const stepMs = 250;
    const t = window.setInterval(() => {
      const { simRunning, simSpeed } = useExplorerStore.getState();
      if (!simRunning) return;
      simClock.days += (stepMs / 1000) * simSpeed;
      setTick((n) => n + 1);
    }, stepMs);
    return () => window.clearInterval(t);
  }, [reducedMotion]);

  const orbits = useMemo(
    () =>
      objects
        .filter((o) => o.orbit)
        .map((o) => {
          const pts = orbitPolyline(o.orbit!, orbitAngles(o.id), 180);
          const v = new Vector3();
          let d = '';
          for (let i = 0; i < pts.length; i += 3) {
            const [x, y] = toMap(v.set(pts[i]!, pts[i + 1]!, pts[i + 2]!));
            d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
          }
          return { id: o.id, d: d + 'Z' };
        }),
    [objects],
  );

  const v = new Vector3();
  const positions = new Map<string, [number, number]>();
  for (const o of objects) {
    if (o.kind === 'star') positions.set(o.id, [0, 0]);
    else if (o.orbit) positions.set(o.id, toMap(orbitPositionAt(o.orbit, orbitAngles(o.id), simClock.days, v)));
  }
  for (const o of objects) {
    const parent = o.parentId ? positions.get(o.parentId) : undefined;
    if (parent && !positions.has(o.id)) positions.set(o.id, [parent[0] + 3.2, parent[1] - 3.2]);
  }

  const key = (id: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(id);
    }
  };
  const belt = objects.find((o) => o.kind === 'belt');
  const region = objects.find((o) => o.visual.style === 'search-region');
  const beltR = (mapRadius(KUIPER_BELT_AU.inner) + mapRadius(KUIPER_BELT_AU.outer)) / 2;
  const beltW = mapRadius(KUIPER_BELT_AU.outer) - mapRadius(KUIPER_BELT_AU.inner);
  const regionR = (mapRadius(REGION_AU.inner) + mapRadius(REGION_AU.outer)) / 2;
  const regionW = mapRadius(REGION_AU.outer) - mapRadius(REGION_AU.inner);

  return (
    <svg viewBox="-100 -100 200 200" className="h-full w-full" role="group" aria-label="2D map of the solar system. Not to scale; distances use a logarithmic scale.">
      <defs>
        <pattern id="orrery-hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
          <line x1="0" y1="0" x2="0" y2="3" stroke="#7fe3ff" strokeWidth="0.5" opacity="0.5" />
        </pattern>
        <radialGradient id="orrery-sun">
          <stop offset="0" stopColor="#ffe9c2" />
          <stop offset="0.45" stopColor="#ffb354" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ff9d3c" stopOpacity="0" />
        </radialGradient>
      </defs>

      {region && (
        <g
          role="button"
          tabIndex={0}
          aria-label={`${region.name} (hypothetical, not observed)`}
          aria-pressed={selectedId === region.id}
          onClick={() => onSelect(region.id)}
          onKeyDown={key(region.id)}
          className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-cyan"
        >
          <circle r={regionR} fill="none" stroke="url(#orrery-hatch)" strokeWidth={regionW} opacity={selectedId === region.id ? 0.55 : 0.3} />
          <circle r={regionR} fill="none" stroke="transparent" strokeWidth={regionW} />
          <text x="0" y={-regionR - 0.4} textAnchor="middle" fontSize="3" fill="#ffb648" style={{ letterSpacing: '0.12em' }}>
            PLANET NINE SEARCH REGION · HYPOTHETICAL
          </text>
        </g>
      )}

      {belt && (
        <g
          role="button"
          tabIndex={0}
          aria-label={belt.name}
          aria-pressed={selectedId === belt.id}
          onClick={() => onSelect(belt.id)}
          onKeyDown={key(belt.id)}
          className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-cyan"
        >
          <circle r={beltR} fill="none" stroke={belt.visual.color} strokeWidth={beltW} strokeDasharray="0.35 1.1" opacity={selectedId === belt.id ? 0.75 : 0.4} />
          <circle r={beltR} fill="none" stroke="transparent" strokeWidth={beltW} />
          <text x="0" y={beltR + beltW / 2 + 3.6} textAnchor="middle" fontSize="2.8" fill="#a3b8cf" style={{ letterSpacing: '0.12em' }}>
            KUIPER BELT
          </text>
        </g>
      )}

      {orbits.map((o) => (
        <path key={o.id} d={o.d} fill="none" stroke={selectedId === o.id ? '#7fe3ff' : '#8fb4d9'} strokeWidth={selectedId === o.id ? 0.4 : 0.22} opacity={selectedId === o.id ? 0.9 : 0.35} />
      ))}

      <circle r="9" fill="url(#orrery-sun)" />

      {objects.map((o) => {
        const p = positions.get(o.id);
        if (!p) return null;
        const selected = selectedId === o.id;
        const size = o.kind === 'star' ? 3 : o.kind === 'planet' ? 1.5 : 1;
        return (
          <g
            key={o.id}
            role="button"
            tabIndex={0}
            aria-label={o.name}
            aria-pressed={selected}
            transform={`translate(${p[0].toFixed(2)} ${p[1].toFixed(2)})`}
            onClick={() => onSelect(o.id)}
            onKeyDown={key(o.id)}
            className="group cursor-pointer outline-none"
          >
            <circle r="4" fill="transparent" />
            {o.kind === 'spacecraft' ? (
              <path d="M0 -1.5 1.3 0 0 1.5 -1.3 0Z" fill={o.visual.color} />
            ) : (
              <circle r={size} fill={o.visual.color} />
            )}
            <circle r={size + 1.3} fill="none" stroke="#7fe3ff" strokeWidth="0.35" className={cn('opacity-0 group-focus-visible:opacity-100', selected && 'opacity-100')} />
            <text y={-size - 1.6} textAnchor="middle" fontSize="2.6" fill={selected ? '#7fe3ff' : '#e8f4ff'} opacity={selected ? 1 : 0.8} style={{ letterSpacing: '0.1em' }}>
              {o.name.toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
