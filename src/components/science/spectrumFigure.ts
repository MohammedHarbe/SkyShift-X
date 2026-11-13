/** Builds the Plotly figure for a spectrum. Pure, so it can be unit-tested without a browser. */
import type { Annotations, Config, Data, Layout, Shape } from 'plotly.js';
import type { EpistemicStatus, SpectrumDataset } from '@/contracts/v1';

export const COLORS = {
  ice: '#e8f4ff',
  mist: '#a3b8cf',
  dim: '#7488a0',
  cyan: '#7fe3ff',
  amber: '#ffb648',
  grid: 'rgba(150,200,240,0.08)',
  axis: 'rgba(150,200,240,0.28)',
};

/** "uJy" -> "µJy", "um" -> "µm". */
export const unitLabel = (u: string) => u.replace(/^u(?=Jy)/, 'µ').replace(/\bum\b/, 'µm');

const STATUS_WORD: Record<EpistemicStatus, string> = {
  established: 'established',
  observed: 'observed',
  'model-derived': 'model-derived',
  hypothesis: 'hypothesis',
  illustrative: 'illustrative',
  simulated: 'simulated',
};

export const shortBand = (bandId: string) => bandId.replace(/^SPHEREx-/, '');

export interface SpectrumFigureOptions {
  showComparison?: boolean;
  highlightRangeUm?: [number, number];
  compact?: boolean;
  /** Draw feature names along their marker lines. Turn off on narrow charts, where the list below the chart names them. */
  featureLabels?: boolean;
}

export interface BandSpan {
  bandId: string;
  min: number;
  max: number;
}

/** Wavelength span of each detector band, derived from the points the API supplied. */
export function bandSpans(dataset: SpectrumDataset): BandSpan[] {
  const spans: BandSpan[] = [];
  for (const p of dataset.points) {
    if (!p.bandId) continue;
    const half = (p.bandwidth ?? 0) / 2;
    const last = spans[spans.length - 1];
    if (last && last.bandId === p.bandId) {
      last.min = Math.min(last.min, p.wavelength - half);
      last.max = Math.max(last.max, p.wavelength + half);
    } else spans.push({ bandId: p.bandId, min: p.wavelength - half, max: p.wavelength + half });
  }
  return spans;
}

export function buildSpectrumFigure(dataset: SpectrumDataset, opts: SpectrumFigureOptions = {}): { data: Data[]; layout: Partial<Layout> } {
  const flux = unitLabel(dataset.fluxUnit);
  const wl = unitLabel(dataset.wavelengthUnit);
  const simulated = dataset.provenance.classification === 'simulated';

  const hover = (p: SpectrumDataset['points'][number]) =>
    [
      `<b>${p.wavelength.toFixed(3)} ${wl}</b>${p.bandwidth !== undefined ? `  (channel width ${p.bandwidth.toFixed(3)} ${wl})` : ''}`,
      `Flux ${p.flux.toFixed(0)}${p.fluxUncertainty !== undefined ? ` ± ${p.fluxUncertainty.toFixed(0)}` : ''} ${flux}${p.fluxUncertainty === undefined ? ' (no uncertainty supplied)' : ''}`,
      p.bandId ? `Band ${shortBand(p.bandId)}` : '',
      p.flagged ? `Flagged${p.flags.length ? `: ${p.flags.join(', ')}` : ''}` : '',
    ]
      .filter(Boolean)
      .join('<br>');

  const series = (flagged: boolean): Data => {
    const pts = dataset.points.filter((p) => p.flagged === flagged);
    const color = flagged ? COLORS.amber : COLORS.cyan;
    return {
      type: 'scatter',
      mode: 'markers',
      name: flagged ? 'Flagged points (use with caution)' : `${simulated ? 'Simulated flux' : 'Flux'} with 1σ uncertainty`,
      x: pts.map((p) => p.wavelength),
      y: pts.map((p) => p.flux),
      text: pts.map(hover),
      hovertemplate: '%{text}<extra></extra>',
      error_y: {
        type: 'data',
        array: pts.map((p) => p.fluxUncertainty ?? 0),
        visible: true,
        color: flagged ? 'rgba(255,182,72,0.6)' : 'rgba(127,227,255,0.5)',
        thickness: 1,
        width: 0,
      },
      marker: flagged
        ? { symbol: 'circle-open', color, size: opts.compact ? 6 : 7, line: { width: 1.5, color } }
        : { symbol: 'circle', color, size: opts.compact ? 4.5 : 5.5 },
    };
  };

  const data: Data[] = [series(false)];
  if (dataset.points.some((p) => p.flagged)) data.push(series(true));
  if (opts.showComparison)
    for (const s of dataset.comparisonSeries)
      data.push({
        type: 'scatter',
        mode: 'lines',
        name: `${s.label} (${STATUS_WORD[s.epistemicStatus]})`,
        x: s.points.map((p) => p.wavelength),
        y: s.points.map((p) => p.flux),
        line: { color: 'rgba(232,244,255,0.8)', width: 1.6, dash: 'dash' },
        hovertemplate: `${s.label}<br>%{x:.3f} ${wl}: %{y:.0f} ${flux}<extra></extra>`,
      });

  const shapes: Partial<Shape>[] = [];
  const annotations: Partial<Annotations>[] = [];

  const spans = bandSpans(dataset);
  spans.forEach((b, i) => {
    if (i > 0)
      shapes.push({ type: 'line', xref: 'x', yref: 'paper', x0: b.min, x1: b.min, y0: 0, y1: 1, line: { color: 'rgba(150,200,240,0.16)', width: 1, dash: 'dash' }, layer: 'below' });
    annotations.push({ xref: 'x', yref: 'paper', x: (b.min + b.max) / 2, y: 1, yanchor: 'bottom', showarrow: false, text: shortBand(b.bandId), font: { size: 10, color: COLORS.dim } });
  });

  if (opts.highlightRangeUm) {
    const [x0, x1] = opts.highlightRangeUm;
    shapes.push({ type: 'rect', xref: 'x', yref: 'paper', x0, x1, y0: 0, y1: 1, fillcolor: 'rgba(127,227,255,0.08)', line: { color: 'rgba(127,227,255,0.35)', width: 1 }, layer: 'below' });
  }

  for (const f of dataset.features) {
    shapes.push({ type: 'line', xref: 'x', yref: 'paper', x0: f.wavelengthUm, x1: f.wavelengthUm, y0: 0, y1: 1, line: { color: 'rgba(255,182,72,0.45)', width: 1, dash: 'dot' }, layer: 'below' });
    if (opts.featureLabels === false) continue;
    annotations.push({
      xref: 'x',
      yref: 'paper',
      x: f.wavelengthUm,
      y: 0.02,
      xanchor: 'right',
      yanchor: 'bottom',
      xshift: -2,
      textangle: '-90',
      showarrow: false,
      text: f.label,
      font: { size: opts.compact ? 9 : 10, color: 'rgba(255,182,72,0.85)' },
    });
  }

  const xs = dataset.points.map((p) => p.wavelength);
  const xmin = xs.length ? Math.min(...xs) : 0.75;
  const xmax = xs.length ? Math.max(...xs) : 5;
  const pad = (xmax - xmin) * 0.02;

  const layout: Partial<Layout> = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'Inter, ui-sans-serif, system-ui, sans-serif', color: COLORS.mist, size: opts.compact ? 11 : 12 },
    // Room above the plot for band labels and, when shown, the toolbar.
    margin: { l: 64, r: 14, t: opts.compact ? 24 : 46, b: opts.compact ? 40 : 46 },
    xaxis: {
      title: { text: `Wavelength (${wl})`, standoff: 8 },
      range: [xmin - pad, xmax + pad],
      gridcolor: COLORS.grid,
      linecolor: COLORS.axis,
      tickcolor: COLORS.axis,
      ticks: 'outside',
      zeroline: false,
      showline: true,
    },
    yaxis: {
      title: { text: `Flux density (${flux})`, standoff: 8 },
      gridcolor: COLORS.grid,
      linecolor: COLORS.axis,
      tickcolor: COLORS.axis,
      ticks: 'outside',
      zeroline: true,
      zerolinecolor: 'rgba(150,200,240,0.2)',
      showline: true,
    },
    showlegend: true,
    legend: { orientation: 'h', x: 0, y: opts.compact ? -0.24 : -0.2, yanchor: 'top', font: { size: 11, color: COLORS.mist }, bgcolor: 'rgba(0,0,0,0)' },
    hovermode: 'closest',
    hoverlabel: { bgcolor: '#0b1526', bordercolor: 'rgba(150,200,240,0.35)', font: { color: COLORS.ice, size: 12 }, align: 'left' },
    dragmode: 'zoom',
    shapes,
    annotations,
    modebar: { bgcolor: 'rgba(0,0,0,0)', color: COLORS.dim, activecolor: COLORS.cyan },
  };

  return { data, layout };
}

export function spectrumConfig(compact: boolean): Partial<Config> {
  return {
    displaylogo: false,
    responsive: true,
    scrollZoom: false,
    doubleClick: 'reset',
    displayModeBar: compact ? false : 'hover',
    modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toggleSpikelines', 'hoverClosestCartesian', 'hoverCompareCartesian'],
    toImageButtonOptions: { format: 'png', filename: 'skyshift-spectrum', scale: 2 },
  };
}
