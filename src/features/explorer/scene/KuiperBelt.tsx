import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createPointsMaterial } from '../materials';
import type { BodyModel } from '../model';
import { registerBody, registerLabel, simClock, type BodyEntry } from '../registry';
import { auToScene, DAYS_PER_YEAR, hash01, KUIPER_BELT_AU } from '../scale';
import { HIT_MATERIAL, selectHandlers } from './shared';

const INNER = auToScene(KUIPER_BELT_AU.inner);
const OUTER = auToScene(KUIPER_BELT_AU.outer);
const LABEL_POSITION = new THREE.Vector3(Math.cos(2.2) * (INNER + OUTER) * 0.5, 2.5, Math.sin(2.2) * (INNER + OUTER) * 0.5);
/** Orbital period (years) near the middle of the belt; the whole cloud turns at this rate. */
const BELT_PERIOD_YEARS = 270;

function beltGeometry(count: number): THREE.BufferGeometry {
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const bright = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const k = `kb${i}`;
    // Denser towards the middle of the belt, with a thin scatter beyond its outer edge.
    const t = (hash01(k, 1) + hash01(k, 2)) / 2;
    const au = hash01(k, 3) < 0.92 ? KUIPER_BELT_AU.inner + (KUIPER_BELT_AU.outer - KUIPER_BELT_AU.inner) * t : KUIPER_BELT_AU.outer + 14 * hash01(k, 4);
    const angle = hash01(k, 5) * Math.PI * 2;
    const inc = (hash01(k, 6) + hash01(k, 7) + hash01(k, 8) - 1.5) * 0.2; // roughly ±10°
    const r = auToScene(au);
    pos[i * 3] = Math.cos(angle) * r * Math.cos(inc);
    pos[i * 3 + 1] = r * Math.sin(inc);
    pos[i * 3 + 2] = Math.sin(angle) * r * Math.cos(inc);
    size[i] = 1.2 + 1.8 * hash01(k, 9);
    bright[i] = 0.25 + 0.75 * hash01(k, 10);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
  return g;
}

/**
 * The Kuiper Belt as an ILLUSTRATIVE cloud of points between ~30 and ~50 AU.
 * The dots are not catalogued objects; they only convey "a broad ring of small icy bodies".
 */
export function KuiperBelt({ model, count }: { model: BodyModel; count: number }) {
  const cloud = useRef<THREE.Points>(null);
  const entry = useMemo<BodyEntry>(() => ({ id: model.id, position: new THREE.Vector3(), radius: OUTER, extent: OUTER }), [model.id]);
  useEffect(() => registerBody(entry), [entry]);
  useEffect(() => registerLabel({ id: model.id, position: LABEL_POSITION, lift: 0, maxDistance: 560 }), [model.id]);

  const geometry = useMemo(() => beltGeometry(count), [count]);
  const material = useMemo(() => createPointsMaterial({ color: model.color, attenuate: true, opacity: 0.75 }), [model.color]);
  const hitGeometry = useMemo(() => new THREE.RingGeometry(INNER, OUTER, 96, 1), []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      hitGeometry.dispose();
    },
    [geometry, material, hitGeometry],
  );

  useFrame(({ gl }) => {
    material.uniforms.uPixelRatio!.value = gl.getPixelRatio();
    // Negative rotation about +Y matches the direction in which the planets travel.
    if (cloud.current) cloud.current.rotation.y = -(simClock.days / (BELT_PERIOD_YEARS * DAYS_PER_YEAR)) * Math.PI * 2;
  });

  const handlers = useMemo(() => selectHandlers(model.id, { yieldToBodies: true }), [model.id]);

  return (
    <group>
      <points ref={cloud} geometry={geometry} material={material} frustumCulled={false} />
      <mesh geometry={hitGeometry} material={HIT_MATERIAL} rotation={[-Math.PI / 2, 0, 0]} {...handlers} />
    </group>
  );
}
