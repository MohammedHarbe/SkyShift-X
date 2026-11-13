import { z } from 'zod';
import {
  Candidate,
  CandidateSummary,
  Comparison,
  Dataset,
  Health,
  Journey,
  JourneySummary,
  Observation,
  SkyRegion,
  SolarSystemObject,
  Source,
  type ComparisonRequest,
  type JourneyRequest,
} from '@/contracts/v1';
import { request } from './client';

type Opt = { signal?: AbortSignal };

export const api = {
  health: (o?: Opt) => request(Health, '/health', o),
  sources: (o?: Opt) => request(z.array(Source), '/sources', o),
  objects: (o?: Opt) => request(z.array(SolarSystemObject), '/objects', o),
  object: (id: string, o?: Opt) => request(SolarSystemObject, `/objects/${encodeURIComponent(id)}`, o),
  regions: (o?: Opt) => request(z.array(SkyRegion), '/regions', o),
  region: (id: string, o?: Opt) => request(SkyRegion, `/regions/${encodeURIComponent(id)}`, o),
  observations: (q: { regionId?: string; bandId?: string }, o?: Opt) => request(z.array(Observation), '/observations', { ...o, query: q }),
  observation: (id: string, o?: Opt) => request(Observation, `/observations/${encodeURIComponent(id)}`, o),
  compare: (body: z.input<typeof ComparisonRequest>, o?: Opt) => request(Comparison, '/comparisons', { ...o, method: 'POST', body }),
  comparison: (id: string, o?: Opt) => request(Comparison, `/comparisons/${encodeURIComponent(id)}`, o),
  candidates: (q: { regionId?: string }, o?: Opt) => request(z.array(CandidateSummary), '/candidates', { ...o, query: q }),
  candidate: (id: string, o?: Opt) => request(Candidate, `/candidates/${encodeURIComponent(id)}`, o),
  dataset: (id: string, o?: Opt) => request(Dataset, `/datasets/${encodeURIComponent(id)}`, o),
  journeys: (o?: Opt) => request(z.array(JourneySummary), '/journeys', o),
  journey: (id: string, o?: Opt) => request(Journey, `/journeys/${encodeURIComponent(id)}`, o),
  askJourney: (body: z.input<typeof JourneyRequest>, o?: Opt) => request(Journey, '/journeys', { ...o, method: 'POST', body }),
};
