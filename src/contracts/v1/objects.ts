import { z } from 'zod';
import { EpistemicStatus } from './common';

export const ObjectFact = z.object({
  label: z.string(),
  value: z.string(),
  epistemicStatus: EpistemicStatus,
  sourceIds: z.array(z.string()).default([]),
});
export type ObjectFact = z.infer<typeof ObjectFact>;

export const Orbit = z
  .object({
    semiMajorAxisAu: z.number().positive(),
    eccentricity: z.number().min(0).max(0.999),
    inclinationDeg: z.number(),
    periodYears: z.number().positive(),
    approximate: z.boolean().describe('true when values are rounded for visualisation'),
  })
  .describe('Heliocentric orbit of a CONFIRMED body. Must be omitted for hypothetical objects.');
export type Orbit = z.infer<typeof Orbit>;

export const SolarSystemObject = z
  .object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(['star', 'planet', 'dwarf-planet', 'moon', 'belt', 'spacecraft', 'region']),
    status: z.enum(['confirmed', 'hypothetical']),
    epistemicStatus: EpistemicStatus,
    tagline: z.string(),
    summary: z.string().describe('Plain-language explanation (beginner mode)'),
    detail: z.string().describe('Additional context (research mode)'),
    facts: z.array(ObjectFact),
    orbit: Orbit.optional(),
    parentId: z.string().optional().describe('Body this object orbits or accompanies'),
    meanRadiusKm: z.number().positive().optional(),
    visual: z.object({
      style: z.enum(['sun', 'rocky', 'gas-giant', 'ice-giant', 'icy-body', 'belt', 'spacecraft', 'search-region']),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      rings: z.boolean().default(false),
      disclaimer: z.string().describe('What is exaggerated or illustrative in the 3D depiction'),
    }),
    links: z
      .object({
        timeExplorerRegionId: z.string().optional(),
        journeyId: z.string().optional(),
      })
      .default({}),
    sourceIds: z.array(z.string()).default([]),
  })
  .describe('A body, spacecraft or region shown in the 3D explorer.');
export type SolarSystemObject = z.infer<typeof SolarSystemObject>;
