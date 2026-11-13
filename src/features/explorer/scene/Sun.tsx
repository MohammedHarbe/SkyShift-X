import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createGlowTexture, createSunMaterial } from '../materials';
import type { BodyModel } from '../model';
import { registerBody, registerLabel, type BodyEntry } from '../registry';
import { SelectionMarker } from './SelectionMarker';
import { selectHandlers, UNIT_SPHERE } from './shared';

export function Sun({ model }: { model: BodyModel }) {
  const entry = useMemo<BodyEntry>(() => ({ id: model.id, position: new THREE.Vector3(), radius: model.radius }), [model.id, model.radius]);
  useEffect(() => registerBody(entry), [entry]);
  useEffect(() => registerLabel({ id: model.id, position: entry.position, lift: model.radius * 1.3, maxDistance: 3000 }), [entry, model.id, model.radius]);

  const material = useMemo(() => createSunMaterial(model.color, model.accent), [model.color, model.accent]);
  const glow = useMemo(() => createGlowTexture(), []);
  useEffect(
    () => () => {
      material.dispose();
      glow.dispose();
    },
    [material, glow],
  );

  useFrame(({ clock }) => {
    material.uniforms.uTime!.value = clock.elapsedTime;
  });

  const handlers = useMemo(() => selectHandlers(model.id), [model.id]);
  const r = model.radius;

  return (
    <group>
      {/* Lights only affect the standard-material spacecraft; planets are lit in their own shader. */}
      <pointLight intensity={2.6} decay={0} color="#fff4e2" />
      <mesh geometry={UNIT_SPHERE} material={material} scale={r} userData={{ bodyId: model.id }} {...handlers} />
      <sprite scale={[r * 7.5, r * 7.5, 1]}>
        <spriteMaterial map={glow} color={model.color} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
      <sprite scale={[r * 24, r * 24, 1]}>
        <spriteMaterial map={glow} color={model.accent} transparent opacity={0.13} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
      <SelectionMarker id={model.id} radius={r} position={entry.position} />
    </group>
  );
}
