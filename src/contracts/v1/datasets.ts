import { z } from 'zod';
import { DownloadLink, EpistemicStatus, Provenance, SkyCoord } from './common';

export const SpectrumPoint = z.object({
  wavelength: z.number().positive(),
  bandwidth: z.number().positive().optional().describe('Channel width, same unit as wavelength'),
  flux: z.number(),
  fluxUncertainty: z.number().nonnegative().optional().describe('1-sigma'),
  flagged: z.boolean().default(false).describe('true if the aperture contained flagged pixels'),
  flags: z.array(z.string()).default([]),
  bandId: z.string().optional(),
  observedAt: z.iso.datetime().optional(),
});
export type SpectrumPoint = z.infer<typeof SpectrumPoint>;

export const SpectrumDataset = z
  .object({
    id: z.string(),
    kind: z.literal('spectrum'),
    title: z.string(),
    description: z.string(),
    target: z.object({
      name: z.string(),
      candidateId: z.string().optional(),
      position: SkyCoord.optional(),
    }),
    wavelengthUnit: z.literal('um'),
    fluxUnit: z.string().describe('e.g. "uJy"'),
    points: z.array(SpectrumPoint),
    extraction: z.object({
      method: z.string().describe('e.g. "aperture photometry with annulus background subtraction"'),
      apertureRadiusPx: z.number().positive().optional(),
      backgroundAnnulusPx: z.tuple([z.number(), z.number()]).optional(),
      notes: z.string().optional(),
    }),
    comparisonSeries: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          description: z.string(),
          epistemicStatus: EpistemicStatus,
          points: z.array(z.object({ wavelength: z.number(), flux: z.number() })),
        }),
      )
      .default([]),
    features: z
      .array(
        z.object({
          wavelengthUm: z.number(),
          label: z.string(),
          epistemicStatus: EpistemicStatus,
          note: z.string().optional(),
        }),
      )
      .default([]),
    provenance: Provenance,
    downloads: z.array(DownloadLink).default([]),
  })
  .describe('A spectrum: flux versus wavelength with per-point uncertainty and quality flags.');
export type SpectrumDataset = z.infer<typeof SpectrumDataset>;

/** Discriminated on `kind` so further dataset types (light curves, cubes) can be added without breaking clients. */
export const Dataset = z.discriminatedUnion('kind', [SpectrumDataset]);
export type Dataset = z.infer<typeof Dataset>;
