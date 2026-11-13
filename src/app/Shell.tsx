/**
 * Application shell: one persistent 3D canvas with route content layered above it.
 * The canvas keeps running (and keeps its camera) across landing, explorer and journeys;
 * it is paused and hidden under opaque tool views such as the Time Explorer.
 */
import { Component, lazy, Suspense, type ReactNode } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router';
import { cn } from '@/lib/cn';
import { buttonClass, LoadingState } from '@/ui';
import { TopBar } from './TopBar';

const UniverseCanvas = lazy(() => import('@/features/explorer/UniverseCanvas'));
const LandingView = lazy(() => import('@/features/landing/LandingView'));
const ExplorerView = lazy(() => import('@/features/explorer/ExplorerView'));
const TimeExplorerView = lazy(() => import('@/features/time-explorer/TimeExplorerView'));
const JourneyView = lazy(() => import('@/features/journey/JourneyView'));
const MissionView = lazy(() => import('@/features/mission/MissionView'));

export type Section = 'landing' | 'explore' | 'time' | 'journey' | 'mission' | 'other';

export function sectionOf(pathname: string): Section {
  if (pathname === '/' || pathname === '') return 'landing';
  if (pathname.startsWith('/explore')) return 'explore';
  if (pathname.startsWith('/time')) return 'time';
  if (pathname.startsWith('/journey')) return 'journey';
  if (pathname.startsWith('/mission')) return 'mission';
  return 'other';
}

/** If the 3D layer crashes, the rest of the app keeps working. */
class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[canvas] 3D layer failed', error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function NotFound() {
  return (
    <div className="pointer-events-auto flex h-full items-center justify-center bg-void/80 px-6">
      <div className="text-center">
        <div className="eyebrow">404</div>
        <h1 className="display mt-2 text-3xl">This part of the sky is empty</h1>
        <Link to="/explore" className={buttonClass('primary', 'md', 'mt-6')}>
          Back to the explorer
        </Link>
      </div>
    </div>
  );
}

export function Shell() {
  const { pathname } = useLocation();
  const section = sectionOf(pathname);
  const canvasActive = section === 'landing' || section === 'explore' || section === 'journey';

  return (
    <div className="relative h-full w-full overflow-hidden bg-void">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-cyan focus:px-4 focus:py-2 focus:text-sm focus:text-void">
        Skip to content
      </a>

      {/* Deep-space backdrop that is visible even before (or without) WebGL. */}
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_10%,#0d1b33_0%,#050a14_45%,#02040a_100%)]" />

      {/* On the landing page the 3D layer is shifted up and to the right so the planet clears the headline and cards.
          This moves the box (left/top) rather than using a CSS transform: the canvas measures its own
          on-screen size, and a transform would make it render at the wrong resolution. */}
      <div
        className={cn(
          'absolute h-full w-full transition-[opacity,left,top] duration-[1200ms] ease-[var(--ease-cinematic)]',
          canvasActive ? 'opacity-100' : 'pointer-events-none opacity-0',
          section === 'landing' ? 'left-0 top-0 lg:left-[26%] lg:top-[-14%]' : 'left-0 top-0',
        )}
        aria-hidden={!canvasActive}
      >
        <CanvasBoundary>
          <Suspense fallback={null}>
            <UniverseCanvas active={canvasActive} />
          </Suspense>
        </CanvasBoundary>
      </div>

      <TopBar section={section} />

      {/* Route layer. pointer-events-none so the 3D canvas stays interactive; views opt their panels back in. */}
      <main id="main" className="pointer-events-none absolute inset-0 pt-14">
        <Suspense fallback={<div className="flex h-full items-center justify-center"><LoadingState /></div>}>
          <Routes>
            <Route path="/" element={<LandingView />} />
            <Route path="/explore" element={<ExplorerView />} />
            <Route path="/explore/:objectId" element={<ExplorerView />} />
            <Route path="/time" element={<TimeExplorerView />} />
            <Route path="/journey/:journeyId" element={<JourneyView />} />
            <Route path="/mission" element={<MissionView />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
