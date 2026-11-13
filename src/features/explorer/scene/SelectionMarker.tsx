import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useExplorerStore } from '@/stores/explorer';

/** Unit circle in the XY plane, drawn as a hairline so it stays thin at any zoom. */
const CIRCLE = new THREE.BufferGeometry().setFromPoints(
  Array.from({ length: 128 }, (_, i) => {
    const a = (i / 128) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
  }),
);

/**
 * Hairline camera-facing circle around the selected (or highlighted) body. It never shrinks below a
 * fraction of the camera distance, so even a tiny world stays findable from far away.
 */
export function SelectionMarker({ id, radius, position }: { id: string; radius: number; position: THREE.Vector3 }) {
  const loop = useRef<THREE.LineLoop>(null);
  const material = useRef<THREE.LineBasicMaterial>(null);

  useFrame(({ camera, clock }) => {
    const m = loop.current;
    if (!m) return;
    const s = useExplorerStore.getState();
    const selected = s.selectedId === id;
    const highlighted = s.highlights.includes(id);
    m.visible = selected || highlighted;
    if (!m.visible) return;
    m.quaternion.copy(camera.quaternion);
    const near = radius * 1.35;
    const far = camera.position.distanceTo(position) * 0.017;
    const pulse = highlighted ? 1 + 0.07 * Math.sin(clock.elapsedTime * 3) : 1;
    m.scale.setScalar(Math.max(near, far) * pulse);
    // Prominent when the body is a speck; just a hint once it fills a good part of the view.
    if (material.current) material.current.opacity = highlighted ? 0.95 : far > near ? 0.85 : 0.4;
  });

  return (
    <lineLoop ref={loop} geometry={CIRCLE} visible={false} renderOrder={5} frustumCulled={false}>
      <lineBasicMaterial ref={material} color="#7fe3ff" transparent opacity={0.6} depthTest={false} depthWrite={false} toneMapped={false} />
    </lineLoop>
  );
}
