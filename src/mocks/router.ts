/**
 * In-process mock of the SkyShift X backend.
 *
 * `mockFetch` has the same signature as `fetch`, so the API client cannot tell the difference:
 * requests are routed, bodies validated against the SAME contract schemas, and JSON envelopes
 * returned. Loaded only in mock mode (dynamic import), so live builds never ship demo data.
 */
import type { z } from 'zod';
import {
  API_VERSION,
  Candidate,
  CandidateSummary,
  Comparison,
  ComparisonRequest,
  Dataset,
  Health,
  Journey,
  JourneyRequest,
  JourneySummary,
  Observation,
  SkyRegion,
  SolarSystemObject,
  Source,
  type ApiErrorCode,
} from '@/contracts/v1';
import { journeys, QUESTION_ROUTES, SUGGESTED_QUESTIONS } from './fixtures/journeys';
import { objects } from './fixtures/objects';
import { candidates, comparisons, datasets, observations, regions, SIM_NOTICE } from './fixtures/sim';
import { sources } from './fixtures/sources';

const NOTICE = 'Demo mode: responses come from the in-app mock API. ' + SIM_NOTICE;

function ok(data: unknown, opts: { simulated: boolean; status?: number } = { simulated: true }): Response {
  return new Response(
    JSON.stringify({
      apiVersion: API_VERSION,
      data,
      meta: { dataOrigin: 'mock', simulated: opts.simulated, generatedAt: new Date().toISOString(), notice: NOTICE },
    }),
    { status: opts.status ?? 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function fail(status: number, code: ApiErrorCode, message: string, details?: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ apiVersion: API_VERSION, error: { code, message, details } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const notFound = (what: string, id: string) => fail(404, 'not_found', `${what} "${id}" was not found.`);

/** Parse fixtures through the contract once, so the mock can never drift from the schema. */
function table<S extends z.ZodType>(schema: S, rows: unknown[]): z.output<S>[] {
  return rows.map((r) => schema.parse(r));
}

const db = {
  objects: table(SolarSystemObject, objects),
  sources: table(Source, sources),
  regions: table(SkyRegion, regions),
  observations: table(Observation, observations),
  comparisons: table(Comparison, comparisons),
  candidates: table(Candidate, candidates),
  datasets: table(Dataset, datasets),
  journeys: table(Journey, journeys),
};

const health = Health.parse({
  status: 'ok',
  service: 'skyshift-x mock api',
  apiVersion: API_VERSION,
  capabilities: { dynamicJourneys: false, liveObservations: false },
});

async function route(method: string, path: string, query: URLSearchParams, body: unknown): Promise<Response> {
  const seg = path.replace(/^\/api\/v1\/?/, '').split('/').filter(Boolean);
  const [resource, id] = seg;

  if (method === 'GET') {
    switch (resource) {
      case 'health':
        return ok(health, { simulated: false });
      case 'sources':
        return ok(db.sources, { simulated: false });
      case 'objects': {
        if (!id) return ok(db.objects, { simulated: false });
        const o = db.objects.find((x) => x.id === id);
        return o ? ok(o, { simulated: false }) : notFound('Object', id);
      }
      case 'regions': {
        if (!id) return ok(db.regions);
        const r = db.regions.find((x) => x.id === id);
        return r ? ok(r) : notFound('Region', id);
      }
      case 'observations': {
        if (id) {
          const o = db.observations.find((x) => x.id === id);
          return o ? ok(o) : notFound('Observation', id);
        }
        const regionId = query.get('regionId');
        const bandId = query.get('bandId');
        const rows = db.observations
          .filter((o) => (!regionId || o.regionId === regionId) && (!bandId || o.bandId === bandId))
          .sort((a, b) => a.mjd - b.mjd);
        return ok(rows);
      }
      case 'comparisons': {
        const c = db.comparisons.find((x) => x.id === id);
        return c ? ok(c) : notFound('Comparison', id ?? '');
      }
      case 'candidates': {
        if (id) {
          const c = db.candidates.find((x) => x.id === id);
          return c ? ok(c) : notFound('Candidate', id);
        }
        const regionId = query.get('regionId');
        return ok(db.candidates.filter((c) => !regionId || c.regionId === regionId).map((c) => CandidateSummary.parse(c)));
      }
      case 'datasets': {
        const d = db.datasets.find((x) => x.id === id);
        return d ? ok(d) : notFound('Dataset', id ?? '');
      }
      case 'journeys': {
        if (!id) return ok(db.journeys.map((j) => JourneySummary.parse(j)));
        const j = db.journeys.find((x) => x.id === id);
        return j ? ok(j) : notFound('Journey', id);
      }
    }
  }

  if (method === 'POST' && resource === 'comparisons') {
    const req = ComparisonRequest.safeParse(body);
    if (!req.success) return fail(400, 'validation_error', 'Invalid comparison request.', { issues: req.error.issues });
    const { referenceObservationId: a, targetObservationId: b } = req.data;
    if (a === b) return fail(400, 'validation_error', 'Choose two different observations to compare.');
    const c = db.comparisons.find((x) => x.reference.id === a && x.target.id === b);
    if (c) return ok(c);
    const reversed = db.comparisons.some((x) => x.reference.id === b && x.target.id === a);
    return fail(
      422,
      'unsupported_in_demo',
      reversed
        ? 'The demo only holds comparisons where the reference is the earlier observation. Swap the two selections.'
        : 'The demo has no pre-computed comparison for this pair. Choose two observations of the same field and band.',
    );
  }

  if (method === 'POST' && resource === 'journeys') {
    const req = JourneyRequest.safeParse(body);
    if (!req.success) return fail(400, 'validation_error', 'Invalid journey request.', { issues: req.error.issues });
    const hit = QUESTION_ROUTES.find((r) => r.pattern.test(req.data.question));
    const journey = hit && db.journeys.find((j) => j.id === hit.journeyId);
    if (!journey)
      return fail(
        422,
        'unsupported_in_demo',
        'Dynamic journey generation is not available in demo mode. This demo can only open its prepared journey.',
        { suggestions: SUGGESTED_QUESTIONS },
      );
    return ok(journey);
  }

  return fail(404, 'not_found', `No mock route for ${method} ${path}.`);
}

export interface MockOptions {
  latencyMs?: number;
}

export function createMockFetch(options: MockOptions = {}): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    let body: unknown;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const text = await request.text();
      try {
        body = text ? JSON.parse(text) : undefined;
      } catch {
        return fail(400, 'validation_error', 'Request body is not valid JSON.');
      }
    }
    if (options.latencyMs) await new Promise((r) => setTimeout(r, options.latencyMs));
    return route(request.method, url.pathname, url.searchParams, body);
  };
}
