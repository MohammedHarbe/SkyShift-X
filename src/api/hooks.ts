/** TanStack Query bindings. Components use these; they never call fetch or import fixtures. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import type { JourneyRequest } from '@/contracts/v1';
import { api } from './endpoints';

export const keys = {
  health: ['health'] as const,
  sources: ['sources'] as const,
  objects: ['objects'] as const,
  regions: ['regions'] as const,
  observation: (id?: string) => ['observation', id ?? null] as const,
  observations: (regionId?: string, bandId?: string) => ['observations', regionId ?? null, bandId ?? null] as const,
  comparePair: (refId?: string, tgtId?: string) => ['comparison', 'pair', refId ?? null, tgtId ?? null] as const,
  comparison: (id?: string) => ['comparison', 'id', id ?? null] as const,
  candidates: (regionId?: string) => ['candidates', regionId ?? null] as const,
  candidate: (id?: string) => ['candidate', id ?? null] as const,
  dataset: (id?: string) => ['dataset', id ?? null] as const,
  journeys: ['journeys'] as const,
  journey: (id?: string) => ['journey', id ?? null] as const,
};

export const useHealth = () => useQuery({ queryKey: keys.health, queryFn: ({ signal }) => api.health({ signal }) });
export const useSources = () => useQuery({ queryKey: keys.sources, queryFn: ({ signal }) => api.sources({ signal }) });
export const useObjects = () => useQuery({ queryKey: keys.objects, queryFn: ({ signal }) => api.objects({ signal }) });
export const useRegions = () => useQuery({ queryKey: keys.regions, queryFn: ({ signal }) => api.regions({ signal }) });

export const useObservations = (regionId?: string, bandId?: string) =>
  useQuery({
    queryKey: keys.observations(regionId, bandId),
    queryFn: ({ signal }) => api.observations({ regionId, bandId }, { signal }),
    enabled: !!regionId,
  });

/** Ask the backend to compare two observations (idempotent, so modelled as a query). */
export const useComparePair = (referenceObservationId?: string, targetObservationId?: string) =>
  useQuery({
    queryKey: keys.comparePair(referenceObservationId, targetObservationId),
    queryFn: ({ signal }) =>
      api.compare({ referenceObservationId: referenceObservationId!, targetObservationId: targetObservationId! }, { signal }),
    enabled: !!referenceObservationId && !!targetObservationId && referenceObservationId !== targetObservationId,
  });

export const useObservation = (id?: string) =>
  useQuery({ queryKey: keys.observation(id), queryFn: ({ signal }) => api.observation(id!, { signal }), enabled: !!id });

export const useComparison = (id?: string) =>
  useQuery({ queryKey: keys.comparison(id), queryFn: ({ signal }) => api.comparison(id!, { signal }), enabled: !!id });

export const useCandidates = (regionId?: string) =>
  useQuery({ queryKey: keys.candidates(regionId), queryFn: ({ signal }) => api.candidates({ regionId }, { signal }) });

export const useCandidate = (id?: string) =>
  useQuery({ queryKey: keys.candidate(id), queryFn: ({ signal }) => api.candidate(id!, { signal }), enabled: !!id });

export const useDataset = (id?: string) =>
  useQuery({ queryKey: keys.dataset(id), queryFn: ({ signal }) => api.dataset(id!, { signal }), enabled: !!id });

export const useJourneys = () => useQuery({ queryKey: keys.journeys, queryFn: ({ signal }) => api.journeys({ signal }) });

export const useJourney = (id?: string) =>
  useQuery({ queryKey: keys.journey(id), queryFn: ({ signal }) => api.journey(id!, { signal }), enabled: !!id });

/** Ask a question in context. On success the journey is cached so the player opens instantly. */
export function useAskJourney() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: z.input<typeof JourneyRequest>) => api.askJourney(body),
    onSuccess: (result) => qc.setQueryData(keys.journey(result.data.id), result),
  });
}

/**
 * Query definitions for imperative use (`queryClient.ensureQueryData`), sharing cache keys with the hooks above.
 * The journey player uses these to load a scene's data before its narration starts.
 */
export const queries = {
  regions: () => ({ queryKey: keys.regions, queryFn: () => api.regions() }),
  observation: (id: string) => ({ queryKey: keys.observation(id), queryFn: () => api.observation(id) }),
  comparison: (id: string) => ({ queryKey: keys.comparison(id), queryFn: () => api.comparison(id) }),
  candidate: (id: string) => ({ queryKey: keys.candidate(id), queryFn: () => api.candidate(id) }),
  dataset: (id: string) => ({ queryKey: keys.dataset(id), queryFn: () => api.dataset(id) }),
};
