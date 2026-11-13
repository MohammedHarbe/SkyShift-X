/** Geometry, materials and pointer helpers shared by scene components. */
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useExplorerStore } from '@/stores/explorer';

export const UNIT_SPHERE = new THREE.SphereGeometry(1, 48, 32);
export const UNIT_SPHERE_LOW = new THREE.SphereGeometry(1, 12, 8);

/** Invisible but raycastable: used for generous click targets around small bodies. */
export const HIT_MATERIAL = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

/** True when the pointer is over the mesh of an individual body (which should win over diffuse regions). */
export function hitsBody(e: ThreeEvent<MouseEvent>): boolean {
  return e.intersections.some((i) => typeof i.object.userData.bodyId === 'string');
}

/** Pointer handlers that select an object on click. Ignored while a journey or the landing page directs the camera. */
export function selectHandlers(id: string, opts: { yieldToBodies?: boolean } = {}) {
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      const s = useExplorerStore.getState();
      if (s.cinematic || e.delta > 6) return; // a drag, not a click
      if (opts.yieldToBodies && hitsBody(e)) return;
      e.stopPropagation();
      s.select(id);
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      if (useExplorerStore.getState().cinematic) return;
      if (!opts.yieldToBodies) e.stopPropagation();
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      document.body.style.cursor = '';
    },
  };
}
