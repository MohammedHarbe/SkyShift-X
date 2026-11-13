import { z } from 'zod';
import { EpistemicStatus, Measurement, Provenance, SkyCoord } from './common';

export const EvidenceItem = z
  .object({
    id: z.string(),
    kind: z.enum(['image', 'difference-image', 'measurement', 'spectrum', 'catalog-crossmatch', 'literature']),
    title: z.string(),
    summary: z.string(),
    epistemicStatus: EpistemicStatus,
    observationIds: z.array(z.string()).default([]),
    comparisonId: z.string().optional(),
    datasetId: z.string().optional(),
    values: z.array(z.object({ label: z.string(), measurement: Measurement })).default([]),
    sourceIds: z.array(z.string()).default([]),
  })
  .describe('One inspectable piece of evidence behind a claim or candidate.');
export type EvidenceItem = z.infer<typeof EvidenceItem>;

export const CandidateStatus = z
  .enum(['unclassified', 'needs-follow-up', 'known-object-match', 'likely-variable-source', 'likely-artifact'])
  .describe('Review state. There is deliberately no "confirmed planet" value.');
export type CandidateStatus = z.infer<typeof CandidateStatus>;

export const CandidateSummary = z.object({
  id: z.string(),
  designation: z.string().describe('Internal label, e.g. "SSX-A-001". Not an official designation.'),
  regionId: z.string(),
  kind: z.enum(['moving-source', 'brightness-change', 'single-epoch-detection']),
  status: CandidateStatus,
  headline: z.string(),
  position: SkyCoord.describe('Position at first detection'),
  detectionCount: z.number().int().nonnegative(),
  firstObservedAt: z.iso.datetime(),
  lastObservedAt: z.iso.datetime(),
  classification: Provenance.shape.classification,
});
export type CandidateSummary = z.infer<typeof CandidateSummary>;

export const Detection = z.object({
  observationId: z.string(),
  observedAt: z.iso.datetime(),
  detected: z.boolean().describe('false = looked for and not found at this epoch'),
  position: SkyCoord.optional(),
  positionUncertaintyArcsec: z.number().nonnegative().optional(),
  flux: Measurement.optional(),
  wavelengthUm: z.number().positive(),
  snr: z.number().optional(),
  flags: z.array(z.string()).default([]),
});
export type Detection = z.infer<typeof Detection>;

export const Explanation = z
  .object({
    id: z.string(),
    label: z.string(),
    description: z.string(),
    assessment: z
      .enum(['consistent', 'not-ruled-out', 'disfavoured', 'ruled-out'])
      .describe('Qualitative only. The API never carries uncalibrated probabilities.'),
    rationale: z.string(),
    evidenceIds: z.array(z.string()).default([]),
  })
  .describe('One possible explanation for a candidate and how the evidence bears on it.');
export type Explanation = z.infer<typeof Explanation>;

export const Candidate = CandidateSummary.extend({
  detections: z.array(Detection),
  motion: z
    .object({
      angularSeparation: Measurement,
      baselineDays: z.number().positive(),
      rate: Measurement.describe('Apparent rate on the sky'),
      positionAngleDeg: z.number().describe('Direction of motion, degrees east of north'),
      method: z.string(),
    })
    .optional()
    .describe('Apparent motion as measured by the backend. Omitted for non-moving candidates.'),
  explanations: z.array(Explanation).min(1),
  evidence: z.array(EvidenceItem),
  spectrumDatasetId: z.string().optional(),
  followUp: z.array(z.string()).describe('Observations that would discriminate between explanations'),
  limitations: z.array(z.string()),
  relatedJourneyIds: z.array(z.string()).default([]),
  provenance: Provenance,
}).describe(
  'A source flagged because it changed between observations. A candidate is a question, not a discovery.',
);
export type Candidate = z.infer<typeof Candidate>;
