import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useExplorerStore } from '@/stores/explorer';
import { createAtmosphereMaterial, createPlanetMaterial, createRingMaterial } from '../materials';
import type { BodyModel } from '../model';
import { FRAME, registerBody, registerLabel, simClock, type BodyEntry } from '../registry';
import { auToScene, orbitPolyline, orbitPositionAt } from '../scale';
import { SelectionMarker } from './SelectionMarker';
import { HIT_MATERIAL, selectHandlers, UNIT_SPHERE, UNIT_SPHERE_LOW } from './shared';

const RING_INNER = 1.3;
const RING_OUTER = 2.3;
const RING_GEOMETRY = new THREE.RingGeometry(RING_INNER, RING_OUTER, 96, 1);

/** Strength of the atmospheric halo per visual style (0 = none). */
const ATMOSPHERE: Partial<Record<BodyModel['style'], number>> = { 'ice-giant': 0.85, 'gas-giant': 0.35 };

/** Thin line along the (compressed) orbit. Brightens when its body is selected. */
export function OrbitLine({ model }: { model: BodyModel }) {
  const selected = useExplorerStore((s) => s.selectedId === model.id || s.highlights.includes(model.id));
  const orbit = model.orbit;
  const geometry = useMemo(() => {
    if (!orbit) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(orbitPolyline(orbit, model.angles, orbit.eccentricity > 0.3 ? 720 : 256), 3));
    return g;
  }, [orbit, model.angles]);
  const material = useMemo(() => new THREE.LineBasicMaterial({ transparent: true, depthWrite: false }), []);
  useEffect(
    () => () => {
      geometry?.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const minor = model.kind !== 'planet';
  material.color.set(selected ? '#7fe3ff' : minor ? '#8a9cc4' : '#8fb4d9');
  material.opacity = selected ? 0.7 : minor ? 0.16 : 0.24;

  if (!geometry) return null;
  return <lineLoop geometry={geometry} material={material} frustumCulled={false} />;
}

/** A planet or dwarf planet: follows its Keplerian orbit, spins, and registers its position for the camera. */
export function PlanetBody({ model }: { model: BodyModel }) {
  const group = useRef<THREE.Group>(null);
  const globe = useRef<THREE.Mesh>(null);

  const entry = useMemo<BodyEntry>(() => {
    const position = new THREE.Vector3();
    if (model.orbit) orbitPositionAt(model.orbit, model.angles, simClock.days, position);
    // Ringed planets are framed by their rings, not just the globe.
    return { id: model.id, position, radius: model.rings ? model.radius * 1.55 : model.radius };
  }, [model]);
  useEffect(() => registerBody(entry), [entry]);
  // Hide labels of inner worlds when the camera is far out, where they would pile up on the Sun.
  const labelRange = model.orbit ? Math.max(auToScene(model.orbit.semiMajorAxisAu) * 9, 60) : 400;
  useEffect(
    () => registerLabel({ id: model.id, position: entry.position, lift: model.radius * 1.25 + 0.1, maxDistance: labelRange }),
    [entry, model.id, model.radius, labelRange],
  );

  const surface = useMemo(
    () => createPlanetMaterial({ color: model.color, accent: model.accent, style: model.style, seed: model.seed }),
    [model.color, model.accent, model.style, model.seed],
  );
  const haloStrength = model.id === 'earth' || model.id === 'venus' ? 0.5 : (ATMOSPHERE[model.style] ?? 0);
  const halo = useMemo(() => (haloStrength > 0 ? createAtmosphereMaterial(model.accent, haloStrength) : null), [haloStrength, model.accent]);
  const ring = useMemo(() => (model.rings ? createRingMaterial(model.accent, RING_INNER, RING_OUTER) : null), [model.rings, model.accent]);
  useEffect(
    () => () => {
      surface.dispose();
      halo?.dispose();
      ring?.dispose();
    },
    [surface, halo, ring],
  );

  useFrame((_, dt) => {
    if (model.orbit) orbitPositionAt(model.orbit, model.angles, simClock.days, entry.position);
    group.current?.position.copy(entry.position);
    if (globe.current) globe.current.rotation.y += Math.min(dt, 0.1) * model.spin;
  }, FRAME.bodies);

  const handlers = useMemo(() => selectHandlers(model.id), [model.id]);
  const r = model.radius;

  return (
    <group ref={group} position={entry.position}>
      <group rotation={[0, 0, model.tilt]}>
        <mesh ref={globe} geometry={UNIT_SPHERE} material={surface} scale={r} userData={{ bodyId: model.id }} />
        {ring && <mesh geometry={RING_GEOMETRY} material={ring} scale={r} rotation={[-Math.PI / 2, 0, 0]} />}
      </group>
      {halo && <mesh geometry={UNIT_SPHERE} material={halo} scale={r * 1.17} />}
      {/* Generous invisible click target so small, distant bodies remain selectable. */}
      <mesh geometry={UNIT_SPHERE_LOW} material={HIT_MATERIAL} scale={Math.max(r * 1.8, 0.75)} userData={{ bodyId: model.id }} {...handlers} />
      <SelectionMarker id={model.id} radius={model.rings ? r * RING_OUTER : r} position={entry.position} />
    </group>
  );
}
