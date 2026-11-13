/** Small, display-only astronomy helpers. No detection or measurement logic lives in the frontend. */
import type { LinearWcs, SkyCoord } from '@/contracts/v1';

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** Right ascension in degrees -> "03h 30m 00.0s". */
export function formatRa(raDeg: number): string {
  const totalSec = (((raDeg % 360) + 360) % 360) * 240; // 24h * 3600s / 360deg
  const tenths = Math.round(totalSec * 10);
  const h = Math.floor(tenths / 36000) % 24;
  const m = Math.floor((tenths % 36000) / 600);
  const s = (tenths % 600) / 10;
  return `${pad(h)}h ${pad(m)}m ${s.toFixed(1).padStart(4, '0')}s`;
}

/** Declination in degrees -> "+18° 12′ 00″". */
export function formatDec(decDeg: number): string {
  const sign = decDeg < 0 ? '−' : '+';
  const totalArcsec = Math.round(Math.abs(decDeg) * 3600);
  const d = Math.floor(totalArcsec / 3600);
  const m = Math.floor((totalArcsec % 3600) / 60);
  const s = totalArcsec % 60;
  return `${sign}${pad(d)}° ${pad(m)}′ ${pad(s)}″`;
}

export function formatCoord(c: SkyCoord): string {
  return `${formatRa(c.raDeg)}  ${formatDec(c.decDeg)}`;
}

export function formatDeg(v: number, digits = 5): string {
  return `${v.toFixed(digits)}°`;
}

/** ISO timestamp -> "2025-05-18 07:42 UTC". */
export function formatUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** ISO timestamp -> "18 May 2025". */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatBaseline(days: number): string {
  const a = Math.abs(days);
  if (a < 1) return `${(a * 24).toFixed(1)} hours`;
  if (a < 60) return `${a.toFixed(1)} days`;
  return `${(a / 30.44).toFixed(1)} months`;
}

/**
 * Preview-pixel -> sky position using the simplified WCS the API supplies with each preview.
 * Good enough for a cursor read-out on small cutouts; authoritative astrometry lives in the FITS file.
 */
export function pixelToSky(wcs: LinearWcs, x: number, y: number): SkyCoord {
  const dx = x - wcs.crpix[0];
  const dy = y - wcs.crpix[1];
  const rot = (wcs.rotationDeg * Math.PI) / 180;
  const ex = (dx * Math.cos(rot) - dy * Math.sin(rot)) * wcs.cdeltDeg[0];
  const ny = (dx * Math.sin(rot) + dy * Math.cos(rot)) * wcs.cdeltDeg[1];
  const dec = wcs.crval[1] + ny;
  const ra = wcs.crval[0] + ex / Math.cos((wcs.crval[1] * Math.PI) / 180);
  return { raDeg: ((ra % 360) + 360) % 360, decDeg: Math.max(-90, Math.min(90, dec)), frame: 'ICRS' };
}

/** Format a measurement like "53.1 ± 2.0 arcsec". */
export function formatMeasurement(m: { value: number; uncertainty?: number; unit: string }, digits?: number): string {
  const d = digits ?? (Math.abs(m.value) >= 100 ? 0 : Math.abs(m.value) >= 10 ? 1 : Math.abs(m.value) >= 1 ? 2 : 3);
  const unit = m.unit.replace(/^u(?=Jy)/, 'µ').replace(/\bum\b/, 'µm');
  return m.uncertainty !== undefined ? `${m.value.toFixed(d)} ± ${m.uncertainty.toFixed(d)} ${unit}` : `${m.value.toFixed(d)} ${unit}`;
}
