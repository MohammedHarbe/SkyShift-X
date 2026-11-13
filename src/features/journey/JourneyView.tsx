/**
 * Discovery Journey player view: stage (3D or panel visual), captions, transport controls,
 * transcript and per-scene evidence. All playback logic lives in StoryPlayer; this file only renders.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useJourney } from '@/api';
import type { Journey, Scene } from '@/contracts/v1';
import { cn } from '@/lib/cn';
import { useExplorerStore } from '@/stores/explorer';
import {
  Badge,
  Button,
  buttonClass,
  CloseIcon,
  EpistemicBadge,
  ExternalLink,
  IconButton,
  InfoIcon,
  LayersIcon,
  MuteIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  QueryBoundary,
  ReplayIcon,
  Segmented,
  TranscriptIcon,
  VolumeIcon,
} from '@/ui';
import { formatMeasurement } from '@/lib/astro';
import { splitIntoChunks } from '@/narration';
import { PLAYBACK_RATES, type PlayerState, type StoryPlayer } from './player/StoryPlayer';
import { SceneVisual, stageOf } from './scenes/registry';
import { usePlayerState, useStoryPlayer } from './useStoryPlayer';

export default function JourneyView() {
  const { journeyId } = useParams();
  const journey = useJourney(journeyId);
  const setCinematic = useExplorerStore((s) => s.setCinematic);
  const setHighlights = useExplorerStore((s) => s.setHighlights);

  // While a journey is open it directs the 3D camera.
  useEffect(() => {
    setCinematic(true);
    return () => {
      setCinematic(false);
      setHighlights([]);
    };
  }, [setCinematic, setHighlights]);

  return (
    <div className="pointer-events-auto relative h-full">
      {(journey.isPending || journey.isError) && (
        <div className="flex h-full items-center justify-center bg-void/80 px-6">
          <div className="w-full max-w-md">
            <QueryBoundary query={journey} loadingLabel="Opening journey…">
              {() => null}
            </QueryBoundary>
            {journey.isError && (
              <Link to="/explore" className={buttonClass('secondary', 'sm', 'mt-4')}>
                Back to the explorer
              </Link>
            )}
          </div>
        </div>
      )}
      {journey.data && <JourneyPlayer key={journey.data.data.id} journey={journey.data.data} />}
    </div>
  );
}

function JourneyPlayer({ journey }: { journey: Journey }) {
  const player = useStoryPlayer(journey);
  if (!player) return null;
  return <PlayerSurface player={player} journey={journey} />;
}

type SidePanel = 'transcript' | 'evidence' | null;

function PlayerSurface({ player, journey }: { player: StoryPlayer; journey: Journey }) {
  const state = usePlayerState(player);
  const navigate = useNavigate();
  const location = useLocation();
  const asked = (location.state as { question?: string } | null)?.question;
  const [side, setSide] = useState<SidePanel>(null);
  const current = player.segments[state.index]!;
  const stage = stageOf(current.segment.visual);
  const idle = state.status === 'idle';

  const close = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(journey.context.regionId ? `/time?region=${journey.context.regionId}` : '/explore');
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  // Keyboard transport: Space/K play-pause, arrows step, M mute, Esc close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        if (t && /^(BUTTON|A)$/.test(t.tagName) && e.key === ' ') return; // let focused buttons handle Space
        e.preventDefault();
        player.toggle();
      } else if (e.key === 'ArrowRight') player.next();
      else if (e.key === 'ArrowLeft') player.previous();
      else if (e.key.toLowerCase() === 'm') player.setMuted(!player.getState().muted);
      else if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player]);

  const claimCount = current.scene.claims.length;

  return (
    <div className="relative flex h-full flex-col">
      {/* Scrim: opaque behind panel scenes, cinematic letterbox over 3D scenes. */}
      <div aria-hidden className={cn('absolute inset-0 bg-void/88 backdrop-blur-md transition-opacity duration-700', stage === 'panel' ? 'opacity-100' : 'opacity-0')} />
      <div aria-hidden className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-void/90 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-void via-void/80 to-transparent" />

      <header className="relative z-10 flex items-start gap-3 px-4 pt-4 sm:px-6 [@media(max-height:760px)]:pt-2">
        <div className="min-w-0 flex-1">
          <div className="eyebrow flex flex-wrap items-center gap-x-2">
            <span>Discovery Journey</span>
            <span aria-hidden>·</span>
            <span>
              Scene {state.sceneIndex + 1} of {journey.scenes.length}
            </span>
          </div>
          <h1 className="mt-0.5 truncate text-lg font-medium text-ice sm:text-xl">{current.scene.title}</h1>
          <p className="truncate text-[13px] text-mist">{journey.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <IconButton label="Transcript" active={side === 'transcript'} onClick={() => setSide(side === 'transcript' ? null : 'transcript')}>
            <TranscriptIcon />
          </IconButton>
          <IconButton label={`Evidence and sources for this scene (${claimCount} claims)`} active={side === 'evidence'} onClick={() => setSide(side === 'evidence' ? null : 'evidence')}>
            <LayersIcon />
          </IconButton>
          <IconButton label="Close journey" onClick={close}>
            <CloseIcon />
          </IconButton>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1">
        <section aria-label="Scene visual" className="min-h-0 min-w-0 flex-1">
          {stage === 'canvas' ? (
            <SceneVisual key={current.segment.id} cue={current.segment.visual} journey={journey} />
          ) : (
            <div className="flex h-full items-center justify-center px-3 py-3 sm:px-6">
              <div key={current.segment.id} className="glass animate-fade scroll-area max-h-full w-full max-w-5xl rounded-3xl p-4 sm:p-6">
                <SceneVisual cue={current.segment.visual} journey={journey} />
              </div>
            </div>
          )}
        </section>
        {side && (
          <aside
            aria-label={side === 'transcript' ? 'Transcript' : 'Evidence and sources'}
            className="glass absolute inset-x-3 bottom-0 top-0 z-20 flex flex-col rounded-2xl sm:inset-x-auto sm:right-4 sm:w-[400px] lg:static lg:my-3 lg:mr-4 lg:shrink-0"
          >
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <Segmented<'transcript' | 'evidence'>
                label="Side panel"
                size="sm"
                value={side}
                onChange={setSide}
                options={[
                  { value: 'transcript', label: 'Transcript' },
                  { value: 'evidence', label: 'Evidence & sources' },
                ]}
              />
              <IconButton size="sm" label="Close panel" onClick={() => setSide(null)}>
                <CloseIcon size={14} />
              </IconButton>
            </div>
            <div className="scroll-area min-h-0 flex-1 px-4 py-4">
              {side === 'transcript' ? <Transcript player={player} journey={journey} state={state} /> : <Evidence scene={current.scene} journey={journey} />}
            </div>
          </aside>
        )}
      </div>

      <footer className="relative z-10 px-4 pb-4 sm:px-6">
        <Captions state={state} narration={current.segment.narration} />
        {state.narration.notice && (
          <p role="status" className="mx-auto mb-2 flex max-w-3xl items-center justify-center gap-2 text-center text-xs text-amber">
            <InfoIcon size={14} className="shrink-0" />
            {state.narration.notice}
          </p>
        )}
        <Controls player={player} state={state} journey={journey} />
      </footer>

      {idle && <StartCard journey={journey} state={state} asked={asked} onBegin={(muted) => player.begin({ muted })} onClose={close} />}
    </div>
  );
}

/* ---------- Captions ---------- */

function Captions({ state, narration }: { state: PlayerState; narration: string }) {
  const chunk = state.chunk;
  let spoken = '';
  // Before narration starts (or while stepping through paused), show the segment's opening sentence.
  let rest = chunk?.text ?? splitIntoChunks(narration)[0]?.text ?? narration;
  if (chunk && state.wordAt !== null) {
    const rel = Math.max(0, state.wordAt - chunk.start);
    const wordEnd = chunk.text.slice(rel).search(/\s/);
    const cut = wordEnd === -1 ? chunk.text.length : rel + wordEnd;
    spoken = chunk.text.slice(0, cut);
    rest = chunk.text.slice(cut);
  }
  return (
    <div className="mx-auto mb-3 max-w-3xl text-center">
      <p
        className={cn(
          'text-balance text-[17px] leading-relaxed [text-shadow:0_1px_10px_rgb(0_0_0_/_0.95)] sm:text-xl [@media(max-height:760px)]:text-base',
          chunk ? 'text-ice' : 'text-mist',
        )}
        data-testid="captions"
      >
        {spoken && <span className="text-ice">{spoken}</span>}
        <span className={spoken ? 'text-mist/80' : undefined}>{rest}</span>
      </p>
      {/* One announcement per sentence, and only when there is no voice to hear. */}
      <p className="sr-only" aria-live={state.narration.mode === 'captions' ? 'polite' : 'off'}>
        {chunk?.text ?? ''}
      </p>
    </div>
  );
}

/* ---------- Controls ---------- */

function Controls({ player, state, journey }: { player: StoryPlayer; state: PlayerState; journey: Journey }) {
  const playing = state.status === 'playing';
  const ended = state.status === 'ended';
  const rateIndex = Math.max(0, PLAYBACK_RATES.indexOf(state.rate as (typeof PLAYBACK_RATES)[number]));
  const nextRate = PLAYBACK_RATES[(rateIndex + 1) % PLAYBACK_RATES.length]!;
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <IconButton label="Replay this scene" onClick={() => player.replayScene()}>
          <ReplayIcon />
        </IconButton>
        <IconButton label="Previous" onClick={() => player.previous()} disabled={state.index === 0}>
          <PrevIcon />
        </IconButton>
        <button
          type="button"
          onClick={() => player.toggle()}
          aria-label={playing ? 'Pause' : ended ? 'Play again from the start' : 'Play'}
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-cyan text-void shadow-[0_0_36px_-6px_rgb(127_227_255_/_0.7)] transition-colors hover:bg-white"
        >
          {playing ? <PauseIcon size={22} /> : ended ? <ReplayIcon size={22} /> : <PlayIcon size={22} />}
        </button>
        <IconButton label="Next" onClick={() => player.next()} disabled={state.index >= player.segments.length - 1}>
          <NextIcon />
        </IconButton>
        <IconButton label={state.muted ? 'Turn sound on' : 'Mute (captions continue)'} active={state.muted} onClick={() => player.setMuted(!state.muted)}>
          {state.muted ? <MuteIcon /> : <VolumeIcon />}
        </IconButton>
        <button
          type="button"
          onClick={() => player.setRate(nextRate)}
          aria-label={`Playback speed ${state.rate}×. Change to ${nextRate}×`}
          className="num h-10 min-w-[3.25rem] rounded-full border border-line bg-white/[0.03] px-3 text-[13px] text-mist transition-colors hover:border-line-strong hover:text-ice"
        >
          {state.rate}×
        </button>
      </div>
      <nav aria-label="Scenes" className="flex max-w-full flex-wrap items-center justify-center gap-1.5">
        {journey.scenes.map((scene, i) => (
          <button
            key={scene.id}
            type="button"
            onClick={() => player.goTo(i)}
            aria-label={`Scene ${i + 1}: ${scene.title}`}
            aria-current={i === state.sceneIndex ? 'step' : undefined}
            title={scene.title}
            className="group flex h-5 items-center px-0.5"
          >
            <span className={cn('block h-1 rounded-full transition-all duration-300', i === state.sceneIndex ? 'w-8 bg-cyan' : i < state.sceneIndex ? 'w-4 bg-cyan/45 group-hover:bg-cyan/70' : 'w-4 bg-white/20 group-hover:bg-white/45')} />
          </button>
        ))}
      </nav>
      <p className="text-[11px] text-dim [@media(max-height:760px)]:hidden" aria-live="polite">
        {ended ? 'Journey complete.' : state.narration.mode === 'voice' ? 'Voice narration with captions' : 'Captions only'}
        <span className="hidden sm:inline"> · Space play/pause · ← → step · M mute</span>
      </p>
    </div>
  );
}

/* ---------- Start card ---------- */

function StartCard({ journey, state, asked, onBegin, onClose }: { journey: Journey; state: PlayerState; asked?: string; onBegin: (muted: boolean) => void; onClose: () => void }) {
  const voice = state.narration.voiceAvailable;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-void/55 px-4 backdrop-blur-[3px]">
      <div role="dialog" aria-modal="false" aria-labelledby="journey-title" className="glass animate-rise scroll-area max-h-full w-full max-w-xl rounded-3xl p-6 sm:p-8">
        <div className="eyebrow">Discovery Journey</div>
        {asked && (
          <p className="mt-2 text-sm text-mist">
            You asked: <span className="text-ice">“{asked}”</span>
          </p>
        )}
        <h2 id="journey-title" className="display mt-2 text-3xl leading-tight sm:text-4xl">
          {journey.title}
        </h2>
        <p className="mt-2 text-mist">{journey.subtitle}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge>About {journey.estimatedMinutes} min</Badge>
          <Badge>{journey.scenes.length} scenes</Badge>
          <Badge tone={journey.generation.mode === 'generated' ? 'cyan' : 'amber'}>{journey.generation.mode === 'generated' ? 'AI-generated' : 'Prepared demo'}</Badge>
        </div>
        <p className="mt-4 rounded-xl border border-line bg-black/30 px-3.5 py-3 text-[13px] leading-relaxed text-mist">{journey.generation.disclosure}</p>
        <p className="mt-3 text-[13px] text-dim">
          {voice === false
            ? state.narration.notice
            : 'Narration uses the voice built into your browser, which varies by device and may need a network connection. Captions are always shown.'}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="primary" size="lg" onClick={() => onBegin(false)} autoFocus>
            <PlayIcon size={16} />
            Begin journey
          </Button>
          <Button variant="secondary" size="lg" onClick={() => onBegin(true)}>
            Begin without sound
          </Button>
          <Button variant="ghost" size="lg" onClick={onClose}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Transcript ---------- */

function Transcript({ player, journey, state }: { player: StoryPlayer; journey: Journey; state: PlayerState }) {
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [state.index]);
  return (
    <ol className="space-y-5">
      {journey.scenes.map((scene, si) => (
        <li key={scene.id}>
          <h3 className="eyebrow mb-1.5">
            {si + 1}. {scene.title}
          </h3>
          <div className="space-y-1">
            {scene.segments.map((seg, gi) => {
              const active = si === state.sceneIndex && gi === state.segmentIndex;
              return (
                <button
                  key={seg.id}
                  ref={active ? activeRef : undefined}
                  type="button"
                  onClick={() => player.goTo(si, gi)}
                  aria-current={active ? 'true' : undefined}
                  className={cn('block w-full rounded-lg border-l-2 px-3 py-2 text-left text-sm leading-relaxed transition-colors', active ? 'border-cyan bg-cyan/[0.08] text-ice' : 'border-transparent text-mist hover:bg-white/[0.04] hover:text-ice')}
                >
                  {seg.narration}
                </button>
              );
            })}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Evidence & sources ---------- */

function Evidence({ scene, journey }: { scene: Scene; journey: Journey }) {
  const evidence = useMemo(() => new Map(journey.evidence.map((e) => [e.id, e])), [journey]);
  const sources = useMemo(() => new Map(journey.sources.map((s) => [s.id, s])), [journey]);
  return (
    <div className="space-y-5 text-sm">
      <section>
        <h3 className="eyebrow mb-2">Claims in this scene</h3>
        {scene.claims.length === 0 && <p className="text-mist">This scene makes no new claims.</p>}
        <ul className="space-y-3">
          {scene.claims.map((claim) => (
            <li key={claim.id} className="rounded-xl border border-line bg-black/25 p-3">
              <EpistemicBadge status={claim.epistemicStatus} />
              <p className="mt-1.5 leading-snug text-ice">{claim.text}</p>
              {claim.evidenceIds.map((id) => {
                const ev = evidence.get(id);
                if (!ev) return null;
                return (
                  <div key={id} className="mt-2 border-l border-line-strong pl-3 text-[13px]">
                    <div className="flex flex-wrap items-center gap-2 text-mist">
                      <span className="font-medium text-ice">{ev.title}</span>
                      <EpistemicBadge status={ev.epistemicStatus} />
                    </div>
                    <p className="mt-0.5 text-mist">{ev.summary}</p>
                    {ev.values.length > 0 && (
                      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-[12px]">
                        {ev.values.map((v) => (
                          <div key={v.label} className="contents">
                            <dt className="text-dim">{v.label}</dt>
                            <dd className="num text-right text-ice">{formatMeasurement(v.measurement)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                );
              })}
              {claim.sourceIds.length > 0 && (
                <p className="mt-2 text-[12px] text-dim">
                  Source:{' '}
                  {claim.sourceIds.map((id, i) => {
                    const s = sources.get(id);
                    return s ? (
                      <span key={id}>
                        {i > 0 && '; '}
                        <ExternalLink href={s.url}>{s.title}</ExternalLink>
                      </span>
                    ) : null;
                  })}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
      {scene.limitations.length > 0 && (
        <section>
          <h3 className="eyebrow mb-2">Limitations and uncertainty</h3>
          <ul className="list-disc space-y-1 pl-5 text-mist">
            {scene.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3 className="eyebrow mb-2">Sources for this journey</h3>
        <ul className="space-y-2 text-[13px]">
          {journey.sources.map((s) => (
            <li key={s.id}>
              <ExternalLink href={s.url}>{s.title}</ExternalLink>
              <span className="block text-dim">
                {[s.authors, s.publisher, s.year].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
