#!/usr/bin/env node
/**
 * SkyShift X — SIMULATED observation generator.
 *
 * Produces synthetic, deterministic "SPHEREx-like" cutouts so the frontend can be built before the
 * real data pipeline exists. NOTHING written by this script is a real observation.
 *
 * Output:
 *   public/mock-data/images/*.png            preview images (observations + difference images)
 *   src/mocks/fixtures/sim-manifest.json     metadata the mock API serves
 *
 * The structure mirrors real SPHEREx Level-2 spectral-image cutouts as described in the IRSA
 * tutorials (150x150 px cutouts, MJy/sr surface brightness, per-observation wavelength at the
 * cutout centre, observation timestamps), but every pixel value is invented.
 *
 * Run: pnpm gen:mock
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG_DIR = join(ROOT, 'public/mock-data/images');
const MANIFEST = join(ROOT, 'src/mocks/fixtures/sim-manifest.json');

const GENERATOR = { name: 'skyshift-sim', version: '0.1.0', seed: 20261113 };
const N = 150; // cutout is N x N pixels
const PIX_ARCSEC = 6.2; // approximate SPHEREx pixel scale
const UJY_PER_MJYSR = 23.5045 * PIX_ARCSEC * PIX_ARCSEC; // µJy in one pixel at 1 MJy/sr

/* ------------------------------ utilities ------------------------------ */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussian(rand) {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}
const round = (v, d = 4) => Number(v.toFixed(d));

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    Buffer.from(rgb.buffer, y * width * 3, width * 3).copy(raw, y * stride + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Add a Gaussian point source of total flux `fluxUjy` centred on (x, y) [pixel centres, y down]. */
function addSource(img, x, y, fluxUjy, sigma) {
  const amp = fluxUjy / UJY_PER_MJYSR / (2 * Math.PI * sigma * sigma);
  const r = Math.ceil(sigma * 4.5);
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  for (let j = y0 - r; j <= y0 + r; j++) {
    if (j < 0 || j >= N) continue;
    for (let i = x0 - r; i <= x0 + r; i++) {
      if (i < 0 || i >= N) continue;
      const d2 = (i - x) ** 2 + (j - y) ** 2;
      img[j * N + i] += amp * Math.exp(-d2 / (2 * sigma * sigma));
    }
  }
}

function median(arr) {
  const s = Float32Array.from(arr).sort();
  return s[Math.floor(s.length / 2)];
}

/** Pixel -> sky using the same simplified TAN approximation the frontend uses for its read-out. */
function pixelToSky(center, x, y) {
  const c = (N - 1) / 2;
  const scale = PIX_ARCSEC / 3600;
  const dec = center.decDeg - (y - c) * scale;
  const ra = center.raDeg - ((x - c) * scale) / Math.cos((center.decDeg * Math.PI) / 180);
  return { raDeg: round(((ra % 360) + 360) % 360, 6), decDeg: round(dec, 6), frame: 'ICRS' };
}

/* ------------------------------ simulation definition ------------------------------ */

const BANDS = {
  'SPHEREx-D2': { key: 'd2', sigma: 0.85, zodi: 0.34, resolvingPower: 41, lambda: [1.32, 1.35, 1.29] },
  'SPHEREx-D4': { key: 'd4', sigma: 1.0, zodi: 0.21, resolvingPower: 35, lambda: [3.05, 3.11, 2.98] },
};
const NOISE = 0.02; // MJy/sr per pixel, 1 sigma

const EPOCHS = [
  { key: 'e1', label: 'Epoch 1', observedAt: '2025-05-18T07:42:10Z', week: '2025W20' },
  { key: 'e2', label: 'Epoch 2', observedAt: '2025-05-27T19:15:44Z', week: '2025W22' },
  { key: 'e3', label: 'Epoch 3', observedAt: '2025-12-03T03:28:31Z', week: '2025W49' },
];

/**
 * Injected changing sources. `pos[e]` is [x, y] at epoch e (null = not present),
 * `flux[band]` is µJy per epoch. These are inventions used to exercise the interface.
 */
const REGIONS = [
  {
    id: 'field-a',
    name: 'Simulated Field A',
    center: { raDeg: 52.5, decDeg: 18.2, frame: 'ICRS' },
    stars: 280,
    seed: 11,
    injected: [
      {
        key: 'a-001',
        kind: 'moving-source',
        pos: [[58.4, 88.2], [66.3, 84.9], [112.4, 52.7]],
        flux: { 'SPHEREx-D2': [1300, 1270, 1340], 'SPHEREx-D4': [800, 830, 770] },
      },
      {
        key: 'a-002',
        kind: 'single-epoch-detection',
        pos: [[105.2, 40.7], null, null],
        flux: { 'SPHEREx-D2': [1900, 0, 0], 'SPHEREx-D4': [1350, 0, 0] },
      },
      {
        key: 'a-003',
        kind: 'brightness-change',
        pos: [[31.6, 119.3], [31.6, 119.3], [31.6, 119.3]],
        flux: { 'SPHEREx-D2': [2400, 3900, 2100], 'SPHEREx-D4': [1500, 2450, 1300] },
      },
      {
        key: 'a-004',
        kind: 'artifact',
        band: 'SPHEREx-D2',
        epoch: 1,
        pos: [null, [124, 96], null],
        flag: 'TRANSIENT',
      },
    ],
  },
  {
    id: 'field-b',
    name: 'Simulated Field B',
    center: { raDeg: 201.3, decDeg: -11.4, frame: 'ICRS' },
    stars: 230,
    seed: 29,
    injected: [
      {
        key: 'b-001',
        kind: 'brightness-change',
        pos: [[88.1, 61.4], [88.1, 61.4], [88.1, 61.4]],
        flux: { 'SPHEREx-D2': [5200, 4100, 6900], 'SPHEREx-D4': [3600, 2900, 4700] },
      },
      {
        key: 'b-002',
        kind: 'artifact',
        band: 'SPHEREx-D4',
        epoch: 2,
        pos: [null, null, [47, 108]],
        flag: 'PERSIST',
      },
    ],
  },
];

/* ------------------------------ rendering ------------------------------ */

function renderObservation(region, stars, bandId, e) {
  const band = BANDS[bandId];
  const rand = mulberry32(GENERATOR.seed + region.seed * 1000 + e * 37 + (bandId === 'SPHEREx-D4' ? 500 : 0));
  const img = new Float32Array(N * N);
  // Zodiacal background differs with epoch (viewing geometry) plus a gentle gradient.
  const zodi = band.zodi * (1 + 0.12 * (e - 1)) + 0.01 * gaussian(rand);
  const gx = 0.00012 * Math.sin(region.seed);
  const gy = 0.00012 * Math.cos(region.seed);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) img[j * N + i] = zodi + gx * (i - N / 2) + gy * (j - N / 2) + NOISE * gaussian(rand);
  // Sub-pixel registration error for this epoch: leaves realistic residuals around bright stars.
  const jx = 0.025 * gaussian(rand);
  const jy = 0.025 * gaussian(rand);
  for (const s of stars) addSource(img, s.x + jx, s.y + jy, s.flux[bandId], band.sigma);
  let flagged = Math.round(N * N * (0.008 + 0.006 * rand()));
  const flags = new Set(['HOT']);
  for (const inj of region.injected) {
    const p = inj.pos[e];
    if (!p) continue;
    if (inj.kind === 'artifact') {
      if (inj.band !== bandId) continue;
      img[p[1] * N + p[0]] += 1.6;
      img[p[1] * N + p[0] + 1] += 0.55;
      img[(p[1] + 1) * N + p[0]] += 0.3;
      flags.add(inj.flag);
      flagged += 3;
    } else {
      addSource(img, p[0] + jx, p[1] + jy, inj.flux[bandId][e], band.sigma);
    }
  }
  return { img, zodi, flaggedFraction: flagged / (N * N), flags: [...flags].sort(), jitter: Math.hypot(jx, jy) };
}

function toGrayPng(img, vmin, vmax) {
  const soft = 0.22;
  const norm = Math.asinh((vmax - vmin) / soft);
  const rgb = new Uint8Array(N * N * 3);
  for (let k = 0; k < N * N; k++) {
    const t = Math.max(0, Math.min(1, Math.asinh(Math.max(0, img[k] - vmin) / soft) / norm));
    const g = Math.round(255 * t);
    rgb[k * 3] = g;
    rgb[k * 3 + 1] = g;
    rgb[k * 3 + 2] = g;
  }
  return encodePng(N, N, rgb);
}

/** Diverging map: negative -> blue, zero -> near black, positive -> amber. */
function toDivergingPng(diff, vmax) {
  const rgb = new Uint8Array(N * N * 3);
  for (let k = 0; k < N * N; k++) {
    const t = Math.max(-1, Math.min(1, diff[k] / vmax));
    const a = Math.pow(Math.abs(t), 1.25);
    const base = [10, 13, 20];
    const hi = t >= 0 ? [255, 176, 64] : [70, 170, 255];
    for (let c = 0; c < 3; c++) rgb[k * 3 + c] = Math.round(base[c] + (hi[c] - base[c]) * a);
  }
  return encodePng(N, N, rgb);
}

/* ------------------------------ spectra ------------------------------ */

const SPECTRAL_BANDS = [
  { id: 'SPHEREx-D1', min: 0.75, max: 1.1 },
  { id: 'SPHEREx-D2', min: 1.1, max: 1.6 },
  { id: 'SPHEREx-D3', min: 1.6, max: 2.4 },
  { id: 'SPHEREx-D4', min: 2.4, max: 3.8 },
  { id: 'SPHEREx-D5', min: 3.8, max: 4.4 },
  { id: 'SPHEREx-D6', min: 4.4, max: 5.0 },
];
function channels() {
  const out = [];
  for (const b of SPECTRAL_BANDS) {
    const n = 17; // 6 x 17 = 102 channels, matching the 102 planes of a SPHEREx mosaic cube
    const step = Math.log(b.max / b.min) / n;
    for (let i = 0; i < n; i++) {
      const lo = b.min * Math.exp(step * i);
      const hi = b.min * Math.exp(step * (i + 1));
      out.push({ wavelength: (lo + hi) / 2, bandwidth: hi - lo, bandId: b.id });
    }
  }
  return out;
}
/** Blackbody F_nu shape (arbitrary normalisation), lambda in µm. */
function planckFnu(lambdaUm, tempK) {
  const x = 14387.8 / (lambdaUm * tempK);
  return 1 / lambdaUm ** 3 / (Math.exp(x) - 1);
}
const dip = (l, centre, width, depth) => 1 - depth * Math.exp(-((l - centre) ** 2) / (2 * width * width));

function makeSpectrum(seed, model, norm, noiseFn) {
  const rand = mulberry32(GENERATOR.seed + seed);
  const ref = model(1.3);
  const points = channels().map((c) => {
    const truth = (norm * model(c.wavelength)) / ref;
    const sigma = noiseFn(c.wavelength);
    const flagged = rand() < 0.035;
    return {
      wavelength: round(c.wavelength, 4),
      bandwidth: round(c.bandwidth, 4),
      flux: round(truth + sigma * gaussian(rand) * (flagged ? 2.5 : 1), 1),
      fluxUncertainty: round(sigma, 1),
      flagged,
      flags: flagged ? ['CONTAINS_BAD_PIXEL'] : [],
      bandId: c.bandId,
    };
  });
  const smooth = channels().map((c) => ({
    wavelength: round(c.wavelength, 4),
    flux: round((norm * model(c.wavelength)) / ref, 1),
  }));
  return { points, smooth };
}

/* ------------------------------ main ------------------------------ */

mkdirSync(IMG_DIR, { recursive: true });
mkdirSync(dirname(MANIFEST), { recursive: true });

const manifest = {
  notice: 'SIMULATED DATA. Generated by scripts/generate-mock-data.mjs. Not real SPHEREx observations.',
  generator: GENERATOR,
  image: { widthPx: N, heightPx: N, pixelScaleArcsec: PIX_ARCSEC, unit: 'MJy/sr' },
  epochs: EPOCHS.map((e) => ({ ...e, mjd: round(Date.parse(e.observedAt) / 86400000 + 40587, 5) })),
  regions: [],
  spectra: {},
};

for (const region of REGIONS) {
  const rand = mulberry32(GENERATOR.seed + region.seed);
  const stars = [];
  for (let s = 0; s < region.stars; s++) {
    const f2 = 110 * Math.pow(1 - rand(), -1 / 1.05); // power-law brightness distribution
    const flux2 = Math.min(f2, 30000);
    stars.push({
      x: rand() * (N - 1),
      y: rand() * (N - 1),
      flux: { 'SPHEREx-D2': flux2, 'SPHEREx-D4': flux2 * (0.3 + 0.55 * rand()) },
    });
  }

  const observations = [];
  const comparisons = [];
  for (const bandId of Object.keys(BANDS)) {
    const band = BANDS[bandId];
    const rendered = EPOCHS.map((_, e) => renderObservation(region, stars, bandId, e));
    rendered.forEach((r, e) => {
      const vmin = r.zodi - 3 * NOISE;
      const vmax = r.zodi + 1.4;
      const file = `${region.id}_${band.key}_${EPOCHS[e].key}.png`;
      writeFileSync(join(IMG_DIR, file), toGrayPng(r.img, vmin, vmax));
      const lambda = band.lambda[e];
      observations.push({
        id: `obs-${region.id}-${band.key}-${EPOCHS[e].key}`,
        epochIndex: e,
        bandId,
        file,
        centralWavelengthUm: lambda,
        bandwidthUm: round(lambda / band.resolvingPower, 4),
        backgroundMJySr: round(r.zodi, 4),
        vmin: round(vmin, 4),
        vmax: round(vmax, 4),
        flaggedPixelFraction: round(r.flaggedFraction, 5),
        flagsPresent: r.flags,
        fileName: `level2_${EPOCHS[e].week}_SIM_${String(101 + e * 57 + region.seed).padStart(4, '0')}_${band.key.toUpperCase()}_spx_sim-v0.fits`,
      });
    });
    for (const [a, b] of [[0, 1], [1, 2], [0, 2]]) {
      const diff = new Float32Array(N * N);
      for (let k = 0; k < N * N; k++) diff[k] = rendered[b].img[k] - rendered[a].img[k];
      const med = median(diff);
      for (let k = 0; k < N * N; k++) diff[k] -= med;
      const vmax = 0.3;
      const file = `${region.id}_${band.key}_diff_${EPOCHS[a].key}-${EPOCHS[b].key}.png`;
      writeFileSync(join(IMG_DIR, file), toDivergingPng(diff, vmax));
      comparisons.push({
        id: `cmp-${region.id}-${band.key}-${EPOCHS[a].key}-${EPOCHS[b].key}`,
        bandId,
        referenceEpochIndex: a,
        targetEpochIndex: b,
        file,
        vmax,
        noiseRms: round(NOISE * Math.SQRT2, 4),
        residualRmsPx: round(Math.hypot(rendered[a].jitter, rendered[b].jitter), 3),
      });
    }
  }

  manifest.regions.push({
    id: region.id,
    name: region.name,
    center: region.center,
    starCount: region.stars,
    observations,
    comparisons,
    injected: region.injected.map((inj) => ({
      key: inj.key,
      kind: inj.kind,
      band: inj.band ?? null,
      flag: inj.flag ?? null,
      epochs: inj.pos.map((p, e) =>
        p
          ? {
              xPx: p[0],
              yPx: p[1],
              position: pixelToSky(region.center, p[0], p[1]),
              fluxUjy: inj.flux ? Object.fromEntries(Object.entries(inj.flux).map(([k, v]) => [k, v[e]])) : null,
            }
          : null,
      ),
    })),
  });
}

// Simulated spectra (0.75–5.0 µm, 102 channels).
const reflected = (l) =>
  planckFnu(l, 5772) * (1 + 0.08 * (l - 1.3)) * dip(l, 1.52, 0.07, 0.14) * dip(l, 2.02, 0.09, 0.24) * dip(l, 3.05, 0.32, 0.62);
const sunlike = (l) => planckFnu(l, 5772);
const coolStar = (l) => planckFnu(l, 3400) * dip(l, 2.35, 0.08, 0.12) * dip(l, 4.6, 0.18, 0.18);

const specA1 = makeSpectrum(101, reflected, 1300, (l) => 38 + 9 * l);
manifest.spectra['a-001'] = {
  points: specA1.points,
  reference: makeSpectrum(102, sunlike, 1300, () => 0).smooth,
  injectedFeatures: [
    { wavelengthUm: 1.52, label: 'Injected absorption (water-ice-like)' },
    { wavelengthUm: 2.02, label: 'Injected absorption (water-ice-like)' },
    { wavelengthUm: 3.05, label: 'Injected broad absorption (water-ice-like)' },
  ],
};
const specA3 = makeSpectrum(103, coolStar, 2400, (l) => 45 + 10 * l);
manifest.spectra['a-003'] = {
  points: specA3.points,
  reference: makeSpectrum(104, (l) => planckFnu(l, 3400), 2400, () => 0).smooth,
  injectedFeatures: [
    { wavelengthUm: 2.35, label: 'Injected absorption (CO-like)' },
    { wavelengthUm: 4.6, label: 'Injected absorption (CO-like)' },
  ],
};

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
console.log(`Wrote ${manifest.regions.reduce((n, r) => n + r.observations.length + r.comparisons.length, 0)} PNGs and ${MANIFEST}`);
