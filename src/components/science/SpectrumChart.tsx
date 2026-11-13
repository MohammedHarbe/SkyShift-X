/**
 * Interactive spectrum: flux against wavelength with units, 1-sigma error bars, quality flags,
 * optional comparison curves, zoom and tooltips. Plotly is loaded on demand as its own chunk.
 * A data table is always available as a non-visual alternative.
 */
import type * as PlotlyNamespace from 'plotly.js';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { SpectrumDataset } from '@/contracts/v1';
import { cn } from '@/lib/cn';
import { useUiStore } from '@/stores/ui';
import { ClassificationBadge, EpistemicBadge, ErrorState, LoadingState } from '@/ui';
import { buildSpectrumFigure, shortBand, spectrumConfig, unitLabel } from './spectrumFigure';

export interface SpectrumChartProps {
  dataset: SpectrumDataset;
  showComparison?: boolean;
  highlightRangeUm?: [number, number];
  height?: number;
  compact?: boolean;
  className?: string;
}

type PlotlyApi = typeof PlotlyNamespace;

let plotlyPromise: Promise<PlotlyApi> | null = null;
function loadPlotly(): Promise<PlotlyApi> {
  plotlyPromise ??= import('plotly.js-basic-dist-min')
    .then((m) => ((m as { default?: PlotlyApi }).default ?? (m as unknown as PlotlyApi)))
    .catch((e) => {
      plotlyPromise = null; // allow a retry
      throw e;
    });
  return plotlyPromise;
}

export function SpectrumChart({ dataset, showComparison = false, highlightRangeUm, height, compact = false, className }: SpectrumChartProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const api = useRef<PlotlyApi | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [showTable, setShowTable] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const tableId = useId();
  const audience = useUiStore((s) => s.audience);

  const h = height ?? (compact ? 260 : 340);
  const hl0 = highlightRangeUm?.[0];
  const hl1 = highlightRangeUm?.[1];
  const figure = useMemo(
    () =>
      buildSpectrumFigure(dataset, {
        showComparison,
        compact,
        featureLabels: !narrow,
        highlightRangeUm: hl0 !== undefined && hl1 !== undefined ? [hl0, hl1] : undefined,
      }),
    [dataset, showComparison, compact, narrow, hl0, hl1],
  );

  useEffect(() => {
    let cancelled = false;
    loadPlotly()
      .then((Plotly) => {
        const el = plotRef.current;
        if (cancelled || !el) return;
        api.current = Plotly;
        return Plotly.react(el, figure.data, { ...figure.layout, height: h }, spectrumConfig(compact));
      })
      .then(() => {
        if (!cancelled) setStatus('ready');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.error('[spectrum] chart failed to render', e);
        setError(e);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [figure, h, compact, attempt]);

  // Follow container size changes (panels opening, orientation changes), then release the plot on unmount.
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const onResize = () => {
      setNarrow(el.clientWidth < 460);
      api.current?.Plots.resize(el);
    };
    setNarrow(el.clientWidth < 460);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      api.current?.purge(el);
    };
  }, []);

  const resetZoom = () => {
    const el = plotRef.current;
    if (el && api.current) void api.current.relayout(el, { 'xaxis.autorange': true, 'yaxis.autorange': true });
  };

  const wl = unitLabel(dataset.wavelengthUnit);
  const flux = unitLabel(dataset.fluxUnit);
  const flaggedCount = dataset.points.filter((p) => p.flagged).length;

  return (
    <div className={cn('w-full min-w-0', className)}>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h3 className={cn('min-w-0 font-medium text-ice', compact ? 'text-sm' : 'text-[15px]')}>{dataset.title}</h3>
        <ClassificationBadge classification={dataset.provenance.classification} />
      </div>
      {!compact && <p className="mb-2 text-[13px] text-mist">{dataset.description}</p>}

      <div className="relative rounded-xl border border-line bg-black/30">
        <div
          ref={plotRef}
          role="img"
          aria-label={`${dataset.title}: ${dataset.points.length} points from ${dataset.points[0]?.wavelength.toFixed(2) ?? '?'} to ${dataset.points[dataset.points.length - 1]?.wavelength.toFixed(2) ?? '?'} ${wl}, flux in ${flux} with 1-sigma error bars. ${flaggedCount} flagged. Use the data table for exact values.`}
          className={cn('w-full', status === 'error' && 'hidden')}
          style={{ minHeight: h }}
        />
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <LoadingState label="Loading chart…" />
          </div>
        )}
        {status === 'error' && (
          <div className="p-3">
            <ErrorState
              error={error}
              onRetry={() => {
                setStatus('loading');
                setAttempt((a) => a + 1);
              }}
            />
            <p className="mt-2 text-xs text-mist">The chart could not be drawn. The measurements are still available in the data table below.</p>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-dim">
        <button
          type="button"
          aria-expanded={showTable}
          aria-controls={tableId}
          onClick={() => setShowTable((v) => !v)}
          className="rounded-full border border-line px-3 py-1 text-mist transition-colors hover:border-line-strong hover:text-ice"
        >
          {showTable ? 'Hide data table' : 'Show data table'}
        </button>
        {status === 'ready' && (
          <button type="button" onClick={resetZoom} className="rounded-full border border-line px-3 py-1 text-mist transition-colors hover:border-line-strong hover:text-ice">
            Reset zoom
          </button>
        )}
        {status === 'ready' && !compact && <span>Drag across the chart to zoom · hover a point for its values</span>}
        {flaggedCount > 0 && (
          <span>
            <span className="text-amber">{flaggedCount} flagged</span> of {dataset.points.length} points
          </span>
        )}
      </div>

      {dataset.features.length > 0 && (
        <div className="mt-2 text-xs text-mist">
          <span className="text-dim">Marked wavelengths (dotted lines): </span>
          <ul className="mt-1 space-y-1">
            {dataset.features.map((f, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="num text-ice">{f.wavelengthUm.toFixed(2)} {wl}</span>
                <span>{f.label}</span>
                <EpistemicBadge status={f.epistemicStatus} />
                {!compact && f.note && <span className="text-dim">{f.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!compact && audience === 'research' && (
        <p className="mt-2 text-xs text-dim">
          Extraction: <span className="text-mist">{dataset.extraction.method}</span>
          {dataset.extraction.apertureRadiusPx !== undefined && <> · aperture radius <span className="num text-mist">{dataset.extraction.apertureRadiusPx} px</span></>}
          {dataset.extraction.backgroundAnnulusPx && (
            <>
              {' '}
              · background annulus <span className="num text-mist">{dataset.extraction.backgroundAnnulusPx[0]}–{dataset.extraction.backgroundAnnulusPx[1]} px</span>
            </>
          )}
          {dataset.extraction.notes && <> · {dataset.extraction.notes}</>}
        </p>
      )}

      {showTable && (
        <div id={tableId} className="scroll-area mt-2 max-h-64 rounded-xl border border-line" tabIndex={0} role="region" aria-label={`Data table for ${dataset.title}`}>
          <table className="num w-full border-collapse text-right text-xs">
            <caption className="sr-only">
              {dataset.title}: flux in {flux} at each wavelength in {wl}
            </caption>
            <thead className="sticky top-0 bg-navy text-mist">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-medium">Wavelength ({wl})</th>
                <th scope="col" className="px-3 py-1.5 font-medium">Width ({wl})</th>
                <th scope="col" className="px-3 py-1.5 font-medium">Flux ({flux})</th>
                <th scope="col" className="px-3 py-1.5 font-medium">1σ ({flux})</th>
                <th scope="col" className="px-3 py-1.5 font-medium">Band</th>
                <th scope="col" className="px-3 py-1.5 text-left font-medium">Flags</th>
              </tr>
            </thead>
            <tbody>
              {dataset.points.map((p, i) => (
                <tr key={i} className={cn('border-t border-line', p.flagged ? 'text-amber' : 'text-ice')}>
                  <td className="px-3 py-1">{p.wavelength.toFixed(4)}</td>
                  <td className="px-3 py-1">{p.bandwidth !== undefined ? p.bandwidth.toFixed(4) : '—'}</td>
                  <td className="px-3 py-1">{p.flux.toFixed(1)}</td>
                  <td className="px-3 py-1">{p.fluxUncertainty !== undefined ? p.fluxUncertainty.toFixed(1) : '—'}</td>
                  <td className="px-3 py-1">{p.bandId ? shortBand(p.bandId) : '—'}</td>
                  <td className="px-3 py-1 text-left font-sans">{p.flagged ? p.flags.join(', ') || 'flagged' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
