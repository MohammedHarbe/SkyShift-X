/**
 * The persistent 3D layer. Mounted once by the Shell behind every route; the explorer HUD, the landing
 * page and Discovery Journeys all direct this same scene through the explorer store.
 *
 * Everything drawn here is an educational visualisation: distances are compressed, sizes exaggerated,
 * positions along orbits illustrative. See scale.ts.
 */
import { Canvas } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { useObjects } from '@/api';
import { useExplorerStore } from '@/stores/explorer';
import { LabelLayer } from './LabelLayer';
import { UniverseScene } from './UniverseScene';
import { detectWebgl } from './webgl';

const NO_OBJECTS: never[] = [];

export default function UniverseCanvas({ active }: { active: boolean }) {
  const [supported] = useState(detectWebgl);
  const setWebgl = useExplorerStore((s) => s.setWebgl);
  const quality = useExplorerStore((s) => s.quality);
  const objects = useObjects();

  useEffect(() => {
    setWebgl(supported ? 'ok' : 'unavailable');
  }, [supported, setWebgl]);

  // Without WebGL the Shell's CSS backdrop shows through and the explorer switches to its 2D orrery.
  if (!supported) return null;

  return (
    <div className="absolute inset-0 isolate" role="group" aria-label="3D view of the solar system. Not to scale. Object labels in the view are buttons; the object list offers the same choices.">
      <Canvas
        // Stop rendering entirely while an opaque view covers the canvas.
        frameloop={active ? 'always' : 'never'}
        dpr={quality === 'high' ? [1, 1.75] : [0.75, 1]}
        camera={{ fov: 45, near: 0.1, far: 9000, position: [98, 127, 160] }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          const el = gl.domElement;
          el.addEventListener('webglcontextlost', () => setWebgl('unavailable'));
          el.addEventListener('webglcontextrestored', () => setWebgl('ok'));
        }}
      >
        <UniverseScene objects={objects.data?.data ?? NO_OBJECTS} />
      </Canvas>
      <LabelLayer objects={objects.data?.data ?? NO_OBJECTS} />
    </div>
  );
}
