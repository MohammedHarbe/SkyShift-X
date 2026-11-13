/**
 * SkyShift X API contract v1 — shared building blocks.
 *
 * These Zod schemas are the single source of truth for the frontend <-> backend contract.
 * JSON Schema and the OpenAPI document in docs/api are GENERATED from them (`pnpm gen:api`).
 * Every response the UI consumes — mock or live — is parsed with these schemas.
 */
import { z } from 'zod';

export const API_VERSION = '1.0';

/** How strongly a statement or visual is supported. Rendered as a badge next to every claim. */
export const EpistemicStatus = z
  .enum(['established', 'observed', 'model-derived', 'hypothesis', 'illustrative', 'simulated'])
  .describe(
    'established = accepted science; observed = real measurement; model-derived = output of a model or pipeline; ' +
      'hypothesis = proposed, unconfirmed; illustrative = teaching visual, not data; simulated = synthetic data.',
  );
export type EpistemicStatus = z.infer<typeof EpistemicStatus>;

/** What kind of thing an image or dataset is. Drives the mandatory on-image label. */
export const DataClassification = z.enum([
  'real-observation',
  'simulated',
  'model-derived',
  'artist-impression',
  'illustrative-diagram',
  'procedural-visualization',
]);
export type DataClassification = z.infer<typeof DataClassification>;

export const SkyCoord = z
  .object({
    raDeg: z.number().min(0).max(360).describe('Right ascension, decimal degrees'),
    decDeg: z.number().min(-90).max(90).describe('Declination, decimal degrees'),
    frame: z.literal('ICRS').default('ICRS'),
  })
  .describe('Sky position (ICRS).');
export type SkyCoord = z.infer<typeof SkyCoord>;

export const Measurement = z
  .object({
    value: z.number(),
    uncertainty: z.number().nonnegative().optional().describe('1-sigma, same unit as value'),
    unit: z.string(),
  })
  .describe('A number with its unit and, where known, 1-sigma uncertainty.');
export type Measurement = z.infer<typeof Measurement>;

export const Source = z
  .object({
    id: z.string(),
    kind: z.enum(['paper', 'archive', 'documentation', 'tutorial', 'mission-page', 'challenge']),
    title: z.string(),
    authors: z.string().optional(),
    publisher: z.string(),
    year: z.number().int().optional(),
    url: z.url(),
    note: z.string().optional(),
  })
  .describe('A citable source. Never fabricated: every entry must resolve to a real document.');
export type Source = z.infer<typeof Source>;

export const Provenance = z
  .object({
    classification: DataClassification,
    origin: z.string().describe('Plain-language statement of where this came from'),
    pipeline: z.string().optional().describe('Processing pipeline or generator name/version'),
    processingVersion: z.string().optional(),
    sourceIds: z.array(z.string()).default([]),
    notes: z.string().optional(),
  })
  .describe('Where a product came from and how it must be labelled.');
export type Provenance = z.infer<typeof Provenance>;

export const ImageRef = z
  .object({
    url: z.string().describe('Absolute URL, or a path relative to the API base URL'),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    alt: z.string().describe('Text alternative describing the image'),
  })
  .describe('Browser-displayable preview image (the backend renders FITS to PNG).');
export type ImageRef = z.infer<typeof ImageRef>;

export const DownloadLink = z.object({
  label: z.string(),
  url: z.string(),
  format: z.enum(['fits', 'csv', 'json', 'votable', 'png']),
  sizeBytes: z.number().int().nonnegative().optional(),
});
export type DownloadLink = z.infer<typeof DownloadLink>;

export const ResponseMeta = z
  .object({
    dataOrigin: z.enum(['mock', 'live']).describe('mock = in-app demo data; live = real backend'),
    simulated: z.boolean().describe('true if ANY measurement in this response is synthetic'),
    generatedAt: z.iso.datetime(),
    notice: z.string().optional().describe('Human-readable caveat shown with the data'),
  })
  .describe('Envelope metadata. The UI renders its SIMULATED/DEMO labels from this, never from guesses.');
export type ResponseMeta = z.infer<typeof ResponseMeta>;

/** Wrap a payload schema in the standard success envelope. */
export function envelope<T extends z.ZodType>(data: T) {
  return z.object({
    apiVersion: z.string().regex(/^1\.\d+$/, 'Unsupported API major version'),
    data,
    meta: ResponseMeta,
  });
}

export const ApiErrorCode = z.enum([
  'not_found',
  'validation_error',
  'unsupported_in_demo',
  'unavailable',
  'internal_error',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCode>;

export const ErrorEnvelope = z
  .object({
    apiVersion: z.string(),
    error: z.object({
      code: ApiErrorCode,
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional(),
    }),
  })
  .describe('Every non-2xx response uses this body.');
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;
