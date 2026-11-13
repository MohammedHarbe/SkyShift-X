import { z } from 'zod';
import { DownloadLink, ImageRef, Provenance, SkyCoord } from './common';

export const Band = z
  .object({
    id: z.string().describe('IRSA energy_bandpassname, e.g. "SPHEREx-D2"'),
    label: z.string(),
    wavelengthMinUm: z.number().positive(),
    wavelengthMaxUm: z.number().positive(),
    resolvingPower: z.number().positive().optional(),
  })
  .describe('A SPHEREx detector band (six detectors cover 0.75–5.0 µm).');
export type Band = z.infer<typeof Band>;

export const ImageDisplay = z
  .object({
    stretch: z.enum(['linear', 'asinh', 'log']),
    vmin: z.number(),
    vmax: z.number(),
    unit: z.string().describe('Unit of the underlying pixel values, e.g. "MJy/sr"'),
    colormap: z.enum(['grayscale', 'diverging']).default('grayscale'),
  })
  .describe('How the backend mapped pixel values to the preview image, so the UI can draw a faithful scale bar.');
export type ImageDisplay = z.infer<typeof ImageDisplay>;

export const LinearWcs = z
  .object({
    projection: z.literal('TAN'),
    crpix: z.tuple([z.number(), z.number()]).describe('Reference pixel (x, y), 0-based, pixel centres'),
    crval: z.tuple([z.number(), z.number()]).describe('RA, Dec at the reference pixel (deg)'),
    cdeltDeg: z.tuple([z.number(), z.number()]).describe('Degrees per pixel along x (negative = east left) and y'),
    rotationDeg: z.number().default(0),
  })
  .describe(
    'Simplified WCS of the PREVIEW image, sufficient for a cursor read-out over small cutouts. ' +
      'Authoritative astrometry stays in the FITS file.',
  );
export type LinearWcs = z.infer<typeof LinearWcs>;

export const SkyRegion = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    center: SkyCoord,
    sizeDeg: z.object({ width: z.number().positive(), height: z.number().positive() }),
    bands: z.array(Band).min(1),
    observationCount: z.number().int().nonnegative(),
    epochRange: z.object({ start: z.iso.datetime(), end: z.iso.datetime() }),
    candidateCount: z.number().int().nonnegative(),
    provenance: Provenance,
  })
  .describe('A patch of sky for which the backend has time-resolved observations.');
export type SkyRegion = z.infer<typeof SkyRegion>;

export const Observation = z
  .object({
    id: z.string(),
    regionId: z.string(),
    epochLabel: z.string().describe('Short human label, e.g. "Epoch 1"'),
    observedAt: z.iso.datetime().describe('Start of exposure, UTC (IRSA time_bounds_lower)'),
    mjd: z.number().describe('Modified Julian Date of observedAt'),
    bandId: z.string(),
    centralWavelengthUm: z.number().positive().describe('Wavelength at the cutout centre'),
    bandwidthUm: z.number().positive(),
    center: SkyCoord,
    sizeDeg: z.object({ width: z.number().positive(), height: z.number().positive() }),
    pixelScaleArcsec: z.number().positive(),
    image: ImageRef,
    display: ImageDisplay,
    wcs: LinearWcs,
    product: z.object({
      level: z.string().describe('e.g. "Level 2 spectral image cutout"'),
      collection: z.string().describe('IRSA collection, e.g. "spherex_dr1"; "simulated" for mock data'),
      processingVersion: z.string().describe('FITS primary-header VERSION'),
      fileName: z.string().optional(),
      extensions: z.array(z.string()).describe('HDUs available, e.g. IMAGE, FLAGS, VARIANCE, ZODI, EPSF, WCS-WAVE'),
    }),
    quality: z.object({
      flaggedPixelFraction: z.number().min(0).max(1),
      flagsPresent: z.array(z.string()),
      notes: z.string().optional(),
    }),
    provenance: Provenance,
    downloads: z.array(DownloadLink).default([]),
  })
  .describe('One image of a region at one time and wavelength (a spectral-image cutout).');
export type Observation = z.infer<typeof Observation>;

export const ComparisonRequest = z
  .object({
    referenceObservationId: z.string(),
    targetObservationId: z.string(),
  })
  .describe('Ask the backend to align two observations and compute target − reference.');
export type ComparisonRequest = z.infer<typeof ComparisonRequest>;

export const ComparisonMarker = z.object({
  candidateId: z.string(),
  label: z.string(),
  role: z.enum(['reference-position', 'target-position', 'static-position']),
  xPx: z.number().describe('Pixel x in the aligned frame (0-based, origin top-left of the preview)'),
  yPx: z.number(),
  radiusPx: z.number().positive(),
  position: SkyCoord,
});
export type ComparisonMarker = z.infer<typeof ComparisonMarker>;

export const Comparison = z
  .object({
    id: z.string(),
    regionId: z.string(),
    bandId: z.string(),
    reference: Observation,
    target: Observation,
    timeBaselineDays: z.number(),
    alignment: z.object({
      status: z.enum(['aligned', 'approximate']),
      method: z.string(),
      residualRmsPx: z.number().nonnegative().optional(),
    }),
    difference: z.object({
      image: ImageRef,
      definition: z.string().describe('e.g. "target − reference"'),
      display: ImageDisplay,
      noiseRms: z.number().nonnegative().optional(),
      provenance: Provenance,
    }),
    markers: z.array(ComparisonMarker),
    caveats: z.array(z.string()),
    provenance: Provenance,
  })
  .describe(
    'Two aligned observations plus their difference image and candidate positions. ' +
      'All detection and alignment is done by the backend; the frontend only displays it.',
  );
export type Comparison = z.infer<typeof Comparison>;
