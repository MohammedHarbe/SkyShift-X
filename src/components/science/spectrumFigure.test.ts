import { describe, expect, it } from 'vitest';
import { SpectrumDataset } from '@/contracts/v1';
import { bandSpans, buildSpectrumFigure, unitLabel } from './spectrumFigure';

const dataset = SpectrumDataset.parse({
  id: 'ds',
  kind: 'spectrum',
  title: 'Test spectrum',
  description: 'd',
  target: { name: 'T' },
  wavelengthUnit: 'um',
  fluxUnit: 'uJy',
  points: [
    { wavelength: 1.0, bandwidth: 0.02, flux: 100, fluxUncertainty: 10, bandId: 'SPHEREx-D1' },
    { wavelength: 1.05, bandwidth: 0.02, flux: 90, fluxUncertainty: 11, flagged: true, flags: ['CONTAINS_BAD_PIXEL'], bandId: 'SPHEREx-D1' },
    { wavelength: 1.2, bandwidth: 0.03, flux: 80, bandId: 'SPHEREx-D2' },
  ],
  extraction: { method: 'aperture' },
  comparisonSeries: [{ id: 'ref', label: 'Reference', description: 'r', epistemicStatus: 'illustrative', points: [{ wavelength: 1, flux: 95 }] }],
  features: [{ wavelengthUm: 1.1, label: 'Injected feature', epistemicStatus: 'simulated' }],
  provenance: { classification: 'simulated', origin: 'test' },
});

type Trace = { name: string; x: number[]; y: number[]; text?: string[]; error_y?: { array: number[] }; mode: string };

describe('spectrum figure', () => {
  it('labels units on both axes', () => {
    const { layout } = buildSpectrumFigure(dataset);
    expect(unitLabel('uJy')).toBe('µJy');
    expect((layout.xaxis!.title as { text: string }).text).toBe('Wavelength (µm)');
    expect((layout.yaxis!.title as { text: string }).text).toBe('Flux density (µJy)');
  });

  it('separates flagged points and carries 1-sigma error bars', () => {
    const traces = buildSpectrumFigure(dataset).data as unknown as Trace[];
    expect(traces).toHaveLength(2);
    expect(traces[0]!.name).toContain('Simulated flux');
    expect(traces[0]!.x).toEqual([1.0, 1.2]);
    expect(traces[0]!.error_y!.array).toEqual([10, 0]);
    expect(traces[0]!.text![1]).toContain('no uncertainty supplied');
    expect(traces[1]!.name).toContain('Flagged');
    expect(traces[1]!.x).toEqual([1.05]);
    expect(traces[1]!.text![0]).toContain('CONTAINS_BAD_PIXEL');
  });

  it('overlays comparison series only on request, labelled with their status', () => {
    expect(buildSpectrumFigure(dataset).data).toHaveLength(2);
    const traces = buildSpectrumFigure(dataset, { showComparison: true }).data as unknown as Trace[];
    expect(traces).toHaveLength(3);
    expect(traces[2]!.mode).toBe('lines');
    expect(traces[2]!.name).toBe('Reference (illustrative)');
  });

  it('marks detector bands, injected features and the highlighted range', () => {
    expect(bandSpans(dataset).map((b) => b.bandId)).toEqual(['SPHEREx-D1', 'SPHEREx-D2']);
    const base = buildSpectrumFigure(dataset).layout;
    const withRange = buildSpectrumFigure(dataset, { highlightRangeUm: [1.0, 1.1] }).layout;
    expect(withRange.shapes!.length).toBe(base.shapes!.length + 1);
    expect(base.annotations!.map((a) => a.text)).toEqual(expect.arrayContaining(['D1', 'D2', 'Injected feature']));
  });
});
