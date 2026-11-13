import { OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import type { SolarSystemObject } from '@/contracts/v1';
import { useExplorerStore } from '@/stores/explorer';
import { CameraRig } from './CameraRig';
import { LabelProjector } from './LabelLayer';
import { toBodyModel } from './model';
import { FRAME, simClock } from './registry';
import { KuiperBelt } from './scene/KuiperBelt';
import { OrbitLine, PlanetBody } from './scene/PlanetBody';
import { SearchRegion } from './scene/SearchRegion';
import { Spherex } from './scene/Spherex';
import { Starfield } from './scene/Starfield';
import { Sun } from './scene/Sun';

/** Advances simulated time. Kept outside React state: it changes every frame. */
function SimClock() {
  useFrame((_, dt) => {
    const { simRunning, simSpeed } = useExplorerStore.getState();
    if (simRunning) simClock.days += Math.min(dt, 0.1) * simSpeed;
  }, FRAME.clock);
  return null;
}

/** Particle budgets per quality tier. */
const BUDGET = {
  high: { stars: 4500, belt: 7000 },
  low: { stars: 2000, belt: 2800 },
} as const;

export function UniverseScene({ objects }: { objects: SolarSystemObject[] }) {
  const models = useMemo(() => objects.map(toBodyModel), [objects]);
  const quality = useExplorerStore((s) => s.quality);
  const setQuality = useExplorerStore((s) => s.setQuality);
  const budget = BUDGET[quality];

  return (
    <>
      <SimClock />
      <ambientLight intensity={0.35} />
      <Starfield count={budget.stars} />
      {models.map((m) => {
        switch (m.style) {
          case 'sun':
            return <Sun key={m.id} model={m} />;
          case 'belt':
            return <KuiperBelt key={m.id} model={m} count={budget.belt} />;
          case 'search-region':
            return <SearchRegion key={m.id} model={m} />;
          case 'spacecraft':
            return <Spherex key={m.id} model={m} />;
          default:
            // Bodies without a confirmed orbit are never given one here.
            return m.orbit ? (
              <group key={m.id}>
                <OrbitLine model={m} />
                <PlanetBody model={m} />
              </group>
            ) : null;
        }
      })}
      <CameraRig />
      <LabelProjector />
      <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.08} rotateSpeed={0.55} zoomSpeed={0.8} />
      {/* Adaptive quality: if the device cannot hold ~30 fps, drop to the light tier and stay there. */}
      <PerformanceMonitor bounds={() => [30, 60]} onDecline={() => setQuality('low')} />
    </>
  );
}
