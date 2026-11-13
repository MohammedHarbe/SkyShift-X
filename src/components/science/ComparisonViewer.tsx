/**
 * Shows two aligned observations of the same sky as supplied by the API:
 * side by side, blinking, or as their difference image. Candidate positions are optional overlays.
 *
 * Display only. Alignment, subtraction and detection all happen in the backend.
 *
 * Sizing: panes are squares that fill the available width up to `--viewer-max`
 * (set it from a parent, e.g. className="[--viewer-max:20rem]", to fit a fixed stage).
 */
import { useEffect, useState } from 'react';
import type { Comparison, Observation } from '@/contracts/v1';
import { formatDate, formatDec, formatDeg, formatRa, formatUtc, pixelToSky } from '@/lib/astro';
import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { IconButton, PauseIcon, PlayIcon, Segmented, ZoomInIcon, ZoomOutIcon } from '@/ui';
import { INITIAL_VIEW, linkMarkers, markersForPane, zoomBy, type ViewState } from './geometry';
import { ImageFrame } from './ImageFrame';

export type ComparisonMode = 'side-by-side' | 'blink' | 'difference';

export interface ComparisonViewerProps {
  comparison: Comparison;
  mode: ComparisonMode;
  showMarkers?: boolean;
  selectedCandidateId?: string;
  onSelectCandidate?: (candidateId: string) => void;
  /** Tighter chrome without zoom or read-out, for use inside journey scenes. */
  compact?: boolean;
  className?: string;
}

const BLINK_SPEEDS = [
  { value: 'slow', label: 'Slow', ms: 1600 },
  { value: 'medium', label: 'Medium', ms: 900 },
  { value: 'fast', label: 'Fast', ms: 450 },
] as const;
type BlinkSpeed = (typeof BLINK_SPEEDS)[number]['value'];

const wavelength = (o: Observation) => `${o.centralWavelengthUm.toFixed(2)} µm`;

function EpochTag({ tag, active = true }: { tag: 'A' | 'B'; active?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
        active ? 'bg-cyan text-void' : 'border border-line-strong text-dim',
      )}
    >
      {tag}
    </span>
  );
}

function EpochCaption({ tag, observation, compact }: { tag: 'A' | 'B'; observation: Observation; compact?: boolean }) {
  return (
    <figcaption className={cn('mt-2 flex items-center gap-2 text-mist', compact ? 'text-xs' : 'text-[13px]')}>
      <EpochTag tag={tag} />
      <span className="min-w-0">
        <span className="font-medium text-ice">{observation.epochLabel}</span>
        <span className="mx-1.5 text-dim">·</span>
        <time dateTime={observation.observedAt}>{compact ? formatDate(observation.observedAt) : formatUtc(observation.observedAt)}</time>
        <span className="mx-1.5 text-dim">·</span>
        <span className="num">{wavelength(observation)}</span>
      </span>
    </figcaption>
  );
}

/** Colour scale of the difference image, built from the display parameters the API reports. */
function DifferenceLegend({ comparison, compact }: { comparison: Comparison; compact?: boolean }) {
  const { display, definition, noiseRms } = comparison.difference;
  const fmt = (v: number) => (v > 0 ? `+${v}` : `${v}`.replace('-', '−'));
  return (
    <div className={cn('text-mist', compact ? 'text-[11px]' : 'text-xs')}>
      <div
        role="img"
        aria-label={`Colour scale from ${display.vmin} to ${display.vmax} ${display.unit}: blue is fainter or gone, black is unchanged, amber is brighter or newly appeared`}
        className="h-2.5 w-full rounded-full border border-line"
        style={{ background: 'linear-gradient(90deg, rgb(70 170 255), rgb(26 55 86) 30%, rgb(10 13 20) 50%, rgb(92 62 30) 70%, rgb(255 176 64))' }}
      />
      <div className="num mt-1 flex justify-between">
        <span>{fmt(display.vmin)}</span>
        <span>0</span>
        <span>
          {fmt(display.vmax)} {display.unit}
        </span>
      </div>
      <div className="mt-0.5 flex justify-between gap-3">
        <span>Fainter or gone</span>
        <span className="text-dim">Unchanged</span>
        <span>Brighter or appeared</span>
      </div>
      {!compact && (
        <p className="mt-2 text-dim">
          Shown: <span className="text-mist">{definition}</span>
          {noiseRms !== undefined && (
            <>
              {' '}
              · noise <span className="num text-mist">{noiseRms} {display.unit}</span> RMS
            </>
          )}{' '}
          · {display.stretch} scale
        </p>
      )}
    </div>
  );
}

export function ComparisonViewer({ comparison, mode, showMarkers = false, selectedCandidateId, onSelectCandidate, compact = false, className }: ComparisonViewerProps) {
  const { reference, target, difference } = comparison;
  const reducedMotion = useReducedMotion();

  // Zoom and pan are shared by all panes and kept while switching epochs of the same field.
  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const [viewRegion, setViewRegion] = useState(comparison.regionId);
  if (viewRegion !== comparison.regionId) {
    setViewRegion(comparison.regionId);
    setView(INITIAL_VIEW);
  }

  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [showing, setShowing] = useState<'a' | 'b'>('a');
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<BlinkSpeed>('medium');
  const autoBlink = mode === 'blink' && playing && !reducedMotion;

  useEffect(() => {
    if (!autoBlink) return;
    const ms = BLINK_SPEEDS.find((s) => s.value === speed)!.ms;
    const id = window.setInterval(() => setShowing((s) => (s === 'a' ? 'b' : 'a')), ms);
    return () => window.clearInterval(id);
  }, [autoBlink, speed]);

  const markers = showMarkers ? comparison.markers : [];
  const links = linkMarkers(markers);
  const { width, height } = reference.image;
  const frameCommon = {
    width,
    height,
    selectedCandidateId,
    onSelectCandidate,
    view,
    compact,
    onViewChange: compact ? undefined : setView,
    onHoverPixel: compact ? undefined : setHover,
  };
  const single = cn('mx-auto w-full', compact ? 'max-w-[var(--viewer-max,22rem)]' : 'max-w-[var(--viewer-max,40rem)]');
  const sky = hover ? pixelToSky(reference.wcs, hover.x, hover.y) : null;
  const inImage = hover && hover.x >= -0.5 && hover.y >= -0.5 && hover.x <= width - 0.5 && hover.y <= height - 0.5;

  return (
    <div className={cn('@container flex w-full min-w-0 flex-col', compact ? 'gap-2' : 'gap-3', className)}>
      {mode === 'side-by-side' && (
        <div className={cn('mx-auto grid w-full grid-cols-1 @md:grid-cols-2', compact ? 'max-w-[calc(var(--viewer-max,26rem)*2_+_0.75rem)] gap-3' : 'max-w-[calc(var(--viewer-max,40rem)*2_+_1rem)] gap-4')}>
          <figure className="m-0 min-w-0">
            <ImageFrame
              {...frameCommon}
              label={`Earlier image, ${reference.epochLabel}`}
              layers={[{ key: reference.id, image: reference.image, visible: true }]}
              classification={reference.provenance.classification}
              markers={markersForPane(markers, 'reference')}
            />
            <EpochCaption tag="A" observation={reference} compact={compact} />
          </figure>
          <figure className="m-0 min-w-0">
            <ImageFrame
              {...frameCommon}
              label={`Later image, ${target.epochLabel}`}
              layers={[{ key: target.id, image: target.image, visible: true }]}
              classification={target.provenance.classification}
              markers={markersForPane(markers, 'target')}
              links={links}
            />
            <EpochCaption tag="B" observation={target} compact={compact} />
          </figure>
        </div>
      )}

      {mode === 'blink' && (
        <figure className={cn('m-0', single)}>
          <ImageFrame
            {...frameCommon}
            label={`Blink comparison, showing ${showing === 'a' ? reference.epochLabel : target.epochLabel}`}
            layers={[
              { key: reference.id, image: reference.image, visible: showing === 'a' },
              { key: target.id, image: target.image, visible: showing === 'b' },
            ]}
            classification={(showing === 'a' ? reference : target).provenance.classification}
            markers={markersForPane(markers, 'both')}
            links={links}
            corner={
              <span className="flex items-center gap-1 rounded-full bg-black/75 px-1.5 py-1 backdrop-blur-sm">
                <EpochTag tag="A" active={showing === 'a'} />
                <EpochTag tag="B" active={showing === 'b'} />
              </span>
            }
          />
          <div className={cn('mt-2 flex flex-wrap items-center gap-x-3 gap-y-2', compact ? 'text-xs' : 'text-[13px]')}>
            <div className="flex min-w-[13rem] flex-1 items-center gap-2 text-mist">
              <EpochTag tag={showing === 'a' ? 'A' : 'B'} />
              <span className="min-w-0">
                <span className="font-medium text-ice">{(showing === 'a' ? reference : target).epochLabel}</span>
                <span className="mx-1.5 text-dim">·</span>
                {formatDate((showing === 'a' ? reference : target).observedAt)}
                <span className="mx-1.5 text-dim">·</span>
                <span className="num">{wavelength(showing === 'a' ? reference : target)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!reducedMotion && (
                <IconButton size="sm" label={playing ? 'Pause blinking' : 'Resume blinking'} onClick={() => setPlaying((p) => !p)}>
                  {playing ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
                </IconButton>
              )}
              <button
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setShowing((s) => (s === 'a' ? 'b' : 'a'));
                }}
                className="h-8 rounded-full border border-line bg-white/[0.03] px-3 text-xs font-medium text-mist transition-colors hover:border-line-strong hover:text-ice"
              >
                Show {showing === 'a' ? 'B' : 'A'}
              </button>
              {!compact && !reducedMotion && (
                <Segmented<BlinkSpeed> label="Blink speed" size="sm" value={speed} onChange={setSpeed} options={BLINK_SPEEDS.map((s) => ({ value: s.value, label: s.label }))} />
              )}
            </div>
          </div>
          {reducedMotion && <p className="mt-1 text-xs text-dim">Automatic blinking is off because your system asks for reduced motion. Use the button to switch images.</p>}
        </figure>
      )}

      {mode === 'difference' && (
        <figure className={cn('m-0', single)}>
          <ImageFrame
            {...frameCommon}
            label={`Difference image, ${target.epochLabel} minus ${reference.epochLabel}`}
            layers={[{ key: `${comparison.id}-diff`, image: difference.image, visible: true }]}
            classification={difference.provenance.classification}
            markers={markersForPane(markers, 'both')}
            links={links}
          />
          <figcaption className={cn('mt-2 flex items-center gap-2 text-mist', compact ? 'text-xs' : 'text-[13px]')}>
            <span className="flex items-center gap-1">
              <EpochTag tag="B" />
              <span aria-hidden="true">−</span>
              <EpochTag tag="A" />
            </span>
            <span>
              <span className="font-medium text-ice">
                {target.epochLabel} minus {reference.epochLabel}
              </span>
              <span className="mx-1.5 text-dim">·</span>
              <span className="num">{wavelength(target)}</span>
            </span>
          </figcaption>
          <div className="mt-2">
            <DifferenceLegend comparison={comparison} compact={compact} />
          </div>
        </figure>
      )}

      {!compact && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
          <div className="flex items-center gap-1.5">
            <IconButton size="sm" label="Zoom out" disabled={view.zoom <= 1} onClick={() => setView((v) => zoomBy(v, 1 / 1.5))}>
              <ZoomOutIcon size={15} />
            </IconButton>
            <IconButton size="sm" label="Zoom in" disabled={view.zoom >= 8} onClick={() => setView((v) => zoomBy(v, 1.5))}>
              <ZoomInIcon size={15} />
            </IconButton>
            <button
              type="button"
              onClick={() => setView(INITIAL_VIEW)}
              disabled={view.zoom === 1}
              className="h-8 rounded-full px-2.5 text-xs text-mist hover:text-ice disabled:opacity-40"
            >
              Fit
            </button>
            <span className="num text-xs text-dim" aria-live="polite">
              {view.zoom.toFixed(view.zoom % 1 ? 1 : 0)}×
            </span>
          </div>
          <div className="num min-w-0 flex-1 text-right text-xs text-mist" aria-hidden={!inImage}>
            {inImage && sky ? (
              <>
                <span className="text-dim">RA</span> {formatRa(sky.raDeg)} <span className="text-dim">({formatDeg(sky.raDeg, 4)})</span>
                <span className="mx-2 text-dim">·</span>
                <span className="text-dim">Dec</span> {formatDec(sky.decDeg)} <span className="text-dim">({formatDeg(sky.decDeg, 4)})</span>
                <span className="mx-2 text-dim">·</span>
                <span className="text-dim">px</span> {Math.round(hover.x)}, {Math.round(hover.y)}
              </>
            ) : (
              <span className="font-sans text-dim">Point at the image for coordinates · Ctrl + scroll to zoom</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
