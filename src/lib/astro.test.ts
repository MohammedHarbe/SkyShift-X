import { describe, expect, it } from 'vitest';
import { formatBaseline, formatCoord, formatDec, formatMeasurement, formatRa, formatUtc, pixelToSky } from './astro';

describe('astro formatting', () => {
  it('formats right ascension and declination in sexagesimal', () => {
    expect(formatRa(52.5)).toBe('03h 30m 00.0s');
    expect(formatRa(359.999999)).toBe('00h 00m 00.0s');
    expect(formatDec(18.2)).toBe('+18° 12′ 00″');
    expect(formatDec(-11.4)).toBe('−11° 24′ 00″');
    expect(formatCoord({ raDeg: 0, decDeg: 0, frame: 'ICRS' })).toContain('00h 00m 00.0s');
  });
  it('formats timestamps, baselines and measurements', () => {
    expect(formatUtc('2025-05-18T07:42:10Z')).toBe('2025-05-18 07:42 UTC');
    expect(formatBaseline(9.48)).toBe('9.5 days');
    expect(formatBaseline(198.8)).toBe('6.5 months');
    expect(formatMeasurement({ value: 53.1, uncertainty: 2, unit: 'arcsec' })).toBe('53.1 ± 2.0 arcsec');
    expect(formatMeasurement({ value: 1300, uncertainty: 62, unit: 'uJy' })).toBe('1300 ± 62 µJy');
  });
  it('maps preview pixels to sky coordinates (east is left, north is up)', () => {
    const wcs = { projection: 'TAN' as const, crpix: [74.5, 74.5] as [number, number], crval: [52.5, 18.2] as [number, number], cdeltDeg: [-6.2 / 3600, -6.2 / 3600] as [number, number], rotationDeg: 0 };
    const centre = pixelToSky(wcs, 74.5, 74.5);
    expect(centre.raDeg).toBeCloseTo(52.5, 6);
    expect(centre.decDeg).toBeCloseTo(18.2, 6);
    expect(pixelToSky(wcs, 0, 74.5).raDeg).toBeGreaterThan(52.5); // left = east = larger RA
    expect(pixelToSky(wcs, 74.5, 0).decDeg).toBeGreaterThan(18.2); // up = north
  });
});
