import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useExplorerStore } from '@/stores/explorer';
import { createSearchRegionMaterial } from '../materials';
import type { BodyModel } from '../model';
import { registerBody, registerLabel, type BodyEntry } from '../registry';
import { SEARCH_REGION_SCENE } from '../scale';
import { HIT_MATERIAL, selectHandlers } from './shared';

const { inner: INNER, outer: OUTER } = SEARCH_REGION_SCENE;
const LABEL_POSITION = new THREE.Vector3(Math.cos(3.95) * (INNER + OUTER) * 0.5, 6, Math.sin(3.95) * (INNER + OUTER) * 0.5);
/** Three overlapping sheets at different tilts suggest a thick, fuzzy volume rather than a thin ring. */
const SHEETS: [number, number][] = [
  [0, 0],
  [0.17, 0.06],
  [-0.12, -0.2],
];

/**
 * HYPOTHESIS VISUAL. A soft haze marking "somewhere far beyond the Kuiper Belt", where a proposed but
 * unobserved planet would have to be. It is not a measured position: there is deliberately no planet
 * sphere and no orbit line, because no orbit is known.
 */
export function SearchRegion({ model }: { model: BodyModel }) {
  const entry = useMemo<BodyEntry>(() => ({ id: model.id, position: new THREE.Vector3(), radius: OUTER, extent: OUTER }), [model.id]);
  useEffect(() => registerBody(entry), [entry]);
  useEffect(() => registerLabel({ id: model.id, position: LABEL_POSITION, lift: 0, maxDistance: 3000 }), [model.id]);

  const geometry = useMemo(() => new THREE.RingGeometry(INNER, OUTER, 160, 1), []);
  const material = useMemo(() => createSearchRegionMaterial(model.color, INNER, OUTER), [model.color]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ clock }, dt) => {
    const s = useExplorerStore.getState();
    const u = material.uniforms;
    u.uTime!.value = clock.elapsedTime;
    const goal = s.highlights.includes(model.id) ? 2.3 + 0.5 * Math.sin(clock.elapsedTime * 2.2) : s.selectedId === model.id ? 1.8 : 1;
    u.uIntensity!.value = THREE.MathUtils.lerp(u.uIntensity!.value as number, goal, Math.min(1, dt * 4));
  });

  const handlers = useMemo(() => selectHandlers(model.id, { yieldToBodies: true }), [model.id]);

  return (
    <group>
      {SHEETS.map(([rx, rz], i) => (
        <mesh key={i} geometry={geometry} material={material} rotation={[-Math.PI / 2 + rx, 0, rz]} renderOrder={-1} />
      ))}
      <mesh geometry={geometry} material={HIT_MATERIAL} rotation={[-Math.PI / 2, 0, 0]} {...handlers} />
    </group>
  );
}
