/**
 * Object labels as plain DOM, pinned to the 3D scene.
 *
 *  - `LabelLayer` (outside the canvas) renders one element per object.
 *  - `LabelProjector` (inside the canvas) projects each anchor to screen space every frame and
 *    writes the transform straight to the element, so labels never trigger React re-renders.
 *
 * Labels are a pointer convenience and are hidden from assistive technology; keyboard and
 * screen-reader users navigate with the object list in the explorer HUD.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { SolarSystemObject } from '@/contracts/v1';
import { cn } from '@/lib/cn';
import { useExplorerStore } from '@/stores/explorer';
import { cameraState, labelAnchors, labelElements } from './registry';

const SHADOW = '0 1px 6px rgb(0 0 0 / 0.95), 0 0 2px rgb(0 0 0 / 0.9)';

export function LabelLayer({ objects }: { objects: SolarSystemObject[] }) {
  const selectedId = useExplorerStore((s) => s.selectedId);
  const highlights = useExplorerStore((s) => s.highlights);
  const select = useExplorerStore((s) => s.select);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {objects.map((o) => {
        const emphasised = o.id === selectedId || highlights.includes(o.id);
        return (
          <div
            key={o.id}
            ref={(el) => {
              if (!el) return;
              labelElements.set(o.id, el);
              return () => {
                labelElements.delete(o.id);
              };
            }}
            className="absolute left-0 top-0 select-none whitespace-nowrap pb-1 text-center"
            style={{ opacity: 0, visibility: 'hidden', willChange: 'transform, opacity' }}
          >
            <button
              type="button"
              tabIndex={-1}
              onClick={() => select(o.id)}
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.16em] transition-colors',
                emphasised ? 'border-cyan/60 bg-ink/70 text-cyan' : 'border-transparent text-ice/85 hover:border-line-strong hover:bg-ink/60 hover:text-cyan',
              )}
              style={{ textShadow: SHADOW }}
            >
              {o.name}
            </button>
            {o.status === 'hypothetical' && (
              <div className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-amber" style={{ textShadow: SHADOW }}>
                Hypothetical · not observed
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function LabelProjector() {
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, size }) => {
    const { selectedId, highlights, cinematic } = useExplorerStore.getState();
    camera.updateMatrixWorld(); // the camera rig has just moved it; keep labels in step with this frame
    for (const [id, anchor] of labelAnchors) {
      const el = labelElements.get(id);
      if (!el) continue;
      v.copy(anchor.position);
      v.y += anchor.lift;
      const distance = camera.position.distanceTo(v);
      v.project(camera);

      let opacity = 0;
      const onScreen = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      if (onScreen) {
        if (id === selectedId || highlights.includes(id) || cameraState.targetId === id) opacity = 1;
        else if (!cinematic) opacity = THREE.MathUtils.clamp((anchor.maxDistance - distance) / (anchor.maxDistance * 0.15), 0, 1) * 0.9;
      }

      if (opacity < 0.02) {
        if (el.style.visibility !== 'hidden') {
          el.style.visibility = 'hidden';
          el.style.opacity = '0';
        }
        continue;
      }
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      el.style.visibility = 'visible';
      el.style.opacity = opacity.toFixed(2);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
      el.style.pointerEvents = opacity > 0.4 && !cinematic ? 'auto' : 'none';
    }
  });

  return null;
}
