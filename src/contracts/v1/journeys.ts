import { z } from 'zod';
import { DataClassification, EpistemicStatus, ImageRef, Source } from './common';
import { EvidenceItem } from './candidates';

/* ---------- Visual cues: the closed set of things a scene may show ---------- */

export const Camera3dCue = z.object({
  type: z.literal('camera3d'),
  targetObjectId: z.string(),
  framing: z.enum(['close', 'medium', 'wide', 'overview']),
  transition: z.enum(['travel', 'cut']).default('travel'),
  highlightObjectIds: z.array(z.string()).default([]),
  caption: z.string().optional(),
});

export const ImageCue = z.object({
  type: z.literal('image'),
  source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('observation'), observationId: z.string() }),
    z.object({ kind: z.literal('asset'), assetId: z.string() }),
  ]),
  caption: z.string(),
});

export const ImageComparisonCue = z.object({
  type: z.literal('imageComparison'),
  comparisonId: z.string(),
  mode: z.enum(['side-by-side', 'blink', 'difference']),
  showMarkers: z.boolean().default(false),
  focusCandidateId: z.string().optional(),
  caption: z.string(),
});

export const SpectrumCue = z.object({
  type: z.literal('spectrum'),
  datasetId: z.string(),
  showComparison: z.boolean().default(false),
  highlightRangeUm: z.tuple([z.number(), z.number()]).optional(),
  caption: z.string(),
});

export const SkyMapCue = z.object({
  type: z.literal('skyMap'),
  regionIds: z.array(z.string()).min(1),
  highlightRegionId: z.string().optional(),
  caption: z.string(),
});

export const DiagramCue = z.object({
  type: z.literal('diagram'),
  diagramId: z
    .enum(['apparent-motion', 'difference-imaging', 'spectral-scan'])
    .describe('Key into the frontend diagram library. Unknown ids are rejected, never executed.'),
  caption: z.string(),
});

export const CandidateCue = z.object({
  type: z.literal('candidate'),
  candidateId: z.string(),
  focus: z.enum(['summary', 'explanations', 'evidence']).default('summary'),
  caption: z.string().optional(),
});

export const ConclusionCue = z.object({
  type: z.literal('conclusion'),
  headline: z.string(),
  points: z.array(z.object({ text: z.string(), epistemicStatus: EpistemicStatus })).min(1),
  nextSteps: z.array(z.string()).default([]),
});

export const VisualCue = z
  .discriminatedUnion('type', [
    Camera3dCue,
    ImageCue,
    ImageComparisonCue,
    SpectrumCue,
    SkyMapCue,
    DiagramCue,
    CandidateCue,
    ConclusionCue,
  ])
  .describe('What is on screen during a narration segment. A closed, validated set — no generated code.');
export type VisualCue = z.infer<typeof VisualCue>;
export type VisualCueType = VisualCue['type'];

/* ---------- Narration ---------- */

export const TimedCaption = z.object({
  text: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
});

export const Segment = z
  .object({
    id: z.string(),
    narration: z.string().min(1).describe('Text spoken (and shown as captions) while this visual is on screen'),
    visual: VisualCue,
    audio: z
      .object({
        url: z.string(),
        mediaType: z.string(),
        durationMs: z.number().positive(),
        captions: z.array(TimedCaption).default([]),
      })
      .optional()
      .describe('Optional pre-rendered narration (premium TTS). When absent the client synthesises speech.'),
  })
  .describe('The unit of synchronisation: one visual + the narration that plays over it.');
export type Segment = z.infer<typeof Segment>;

export const Claim = z.object({
  id: z.string(),
  text: z.string(),
  epistemicStatus: EpistemicStatus,
  evidenceIds: z.array(z.string()).default([]),
  sourceIds: z.array(z.string()).default([]),
});
export type Claim = z.infer<typeof Claim>;

export const Scene = z.object({
  id: z.string(),
  title: z.string(),
  segments: z.array(Segment).min(1),
  claims: z.array(Claim).default([]),
  limitations: z.array(z.string()).default([]),
});
export type Scene = z.infer<typeof Scene>;

export const Asset = z
  .object({
    id: z.string(),
    title: z.string(),
    classification: DataClassification,
    image: ImageRef,
    credit: z.string(),
    sourceUrl: z.url().optional(),
    usageTerms: z.string(),
    observation: z
      .object({
        instrument: z.string().optional(),
        wavelength: z.string().optional(),
        observedAt: z.string().optional(),
      })
      .optional(),
  })
  .describe('Entry of the asset manifest: every image carries credit, terms and classification.');
export type Asset = z.infer<typeof Asset>;

export const JourneyContext = z
  .object({
    objectId: z.string().optional(),
    regionId: z.string().optional(),
    comparisonId: z.string().optional(),
    candidateId: z.string().optional(),
  })
  .describe('What the user was looking at when they asked.');
export type JourneyContext = z.infer<typeof JourneyContext>;

export const JourneyRequest = z
  .object({
    question: z.string().min(1).max(500),
    context: JourneyContext.default({}),
    audience: z.enum(['beginner', 'research']).default('beginner'),
  })
  .describe('Ask for a narrated journey answering a question in context.');
export type JourneyRequest = z.infer<typeof JourneyRequest>;

export const JourneySummary = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  estimatedMinutes: z.number().positive(),
  sceneCount: z.number().int().positive(),
  tags: z.array(z.string()).default([]),
  generation: z
    .object({
      mode: z.enum(['prepared', 'generated']).describe('prepared = hand-written demo script; generated = AI backend'),
      model: z.string().optional(),
      disclosure: z.string().describe('Shown to the user, e.g. "Prepared demo journey — not AI-generated."'),
    })
    .describe('Honest statement of how this journey was produced.'),
  context: JourneyContext.default({}),
});
export type JourneySummary = z.infer<typeof JourneySummary>;

export const Journey = JourneySummary.extend({
  scenes: z.array(Scene).min(1),
  evidence: z.array(EvidenceItem).default([]),
  sources: z.array(Source).default([]),
  assets: z.array(Asset).default([]),
}).describe('A self-describing narrated story: ordered scenes with claims, evidence and sources.');
export type Journey = z.infer<typeof Journey>;
