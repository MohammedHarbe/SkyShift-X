/** Cinematic landing: the live 3D view is the hero; text and actions sit over it. */
import { useEffect } from 'react';
import { Link } from 'react-router';
import { config } from '@/config/env';
import { useExplorerStore } from '@/stores/explorer';
import { buttonClass, ChevronRightIcon, ClockIcon, GlobeIcon, SparkIcon } from '@/ui';

const PILLARS = [
  {
    icon: ClockIcon,
    title: 'See the sky change',
    text: 'Compare images of the same patch of sky from different dates. Blink them, subtract them, and watch what moves.',
    to: '/time',
    cta: 'Open the Time Explorer',
  },
  {
    icon: GlobeIcon,
    title: 'Travel the outer solar system',
    text: 'Fly from the Sun past Neptune and the Kuiper Belt to where a hidden planet has been proposed, but never seen.',
    to: '/explore/neptune',
    cta: 'Explore in 3D',
  },
  {
    icon: SparkIcon,
    title: 'Follow the evidence',
    text: 'Ask why a source moved and get a narrated investigation: images, spectra, uncertainty and what it would take to know.',
    to: '/journey/journey-moving-source',
    cta: 'Play the journey',
  },
];

export default function LandingView() {
  const setCinematic = useExplorerStore((s) => s.setCinematic);
  const flyTo = useExplorerStore((s) => s.flyTo);

  useEffect(() => {
    setCinematic(true);
    flyTo('neptune', { framing: 'wide', transition: 'cut' });
    return () => setCinematic(false);
  }, [setCinematic, flyTo]);

  return (
    <div className="pointer-events-auto scroll-area relative h-full">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-void/90 via-void/45 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-void via-void/60 to-transparent" />

      <div className="relative mx-auto flex min-h-full max-w-7xl flex-col justify-end px-5 pb-8 pt-10 sm:px-10 sm:pb-12">
        <div className="max-w-2xl">
          <p className="eyebrow animate-rise text-cyan">NASA Space Apps Challenge 2026 · Planet X and SPHEREx</p>
          <h1 className="display animate-rise mt-4 text-5xl leading-[1.02] text-ice [animation-delay:120ms] sm:text-7xl">
            Watch the infrared sky <span className="text-cyan">shift</span>.
          </h1>
          <p className="animate-rise mt-5 max-w-xl text-lg leading-relaxed text-mist [animation-delay:240ms]">
            NASA’s SPHEREx telescope images the whole sky again and again. SkyShift X lets anyone compare those views over time, spot what moved, and follow the evidence toward an answer.
          </p>
          <div className="animate-rise mt-8 flex flex-wrap items-center gap-3 [animation-delay:360ms]">
            <Link to="/explore/neptune" className={buttonClass('primary', 'lg')}>
              Start exploring
              <ChevronRightIcon size={16} />
            </Link>
            <Link to="/time" className={buttonClass('secondary', 'lg')}>
              Compare observations
            </Link>
          </div>
        </div>

        <ul className="animate-rise mt-12 grid gap-3 [animation-delay:480ms] md:grid-cols-3">
          {PILLARS.map((p) => (
            <li key={p.title}>
              <Link to={p.to} className="glass group flex h-full flex-col rounded-2xl p-5 transition-colors hover:border-cyan/50">
                <p.icon size={20} className="text-cyan" />
                <h2 className="mt-3 text-base font-medium text-ice">{p.title}</h2>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-mist">{p.text}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[13px] text-cyan">
                  {p.cta}
                  <ChevronRightIcon size={14} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-xs leading-relaxed text-dim">
          {config.apiMode === 'mock'
            ? 'Demonstration build: every observation, candidate and spectrum shown is simulated and labelled as such. No new planet has been found. '
            : 'Connected to the SkyShift X data service. '}
          The 3D view is illustrative and not to scale.{' '}
          <Link to="/mission" className="text-mist underline decoration-line-strong underline-offset-2 hover:text-ice">
            Mission, method and sources
          </Link>
        </p>
      </div>
    </div>
  );
}
