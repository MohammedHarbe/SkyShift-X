/**
 * Generates the shared API documentation from the Zod contracts:
 *   docs/api/schemas/*.schema.json   one JSON Schema per contract type
 *   docs/api/openapi.json            OpenAPI 3.1 document for the FastAPI backend to implement
 *   docs/api/examples/*.json         real request/response examples captured from the mock API
 *
 * Run: pnpm gen:api   (CI fails if the committed output is stale.)
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import * as c from '../src/contracts/v1/index';
import { createMockFetch } from '../src/mocks/router';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs/api');

const schemas: Record<string, z.ZodType> = {
  SolarSystemObject: c.SolarSystemObject,
  Source: c.Source,
  SkyRegion: c.SkyRegion,
  Band: c.Band,
  Observation: c.Observation,
  ComparisonRequest: c.ComparisonRequest,
  Comparison: c.Comparison,
  CandidateSummary: c.CandidateSummary,
  Candidate: c.Candidate,
  EvidenceItem: c.EvidenceItem,
  SpectrumDataset: c.SpectrumDataset,
  Dataset: c.Dataset,
  VisualCue: c.VisualCue,
  Scene: c.Scene,
  JourneyRequest: c.JourneyRequest,
  JourneySummary: c.JourneySummary,
  Journey: c.Journey,
  Health: c.Health,
  ResponseMeta: c.ResponseMeta,
  ErrorEnvelope: c.ErrorEnvelope,
};

const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
const toSchema = (s: z.ZodType, io: 'input' | 'output') => {
  const { $schema: _drop, ...rest } = z.toJSONSchema(s, { io, unrepresentable: 'any' }) as Record<string, unknown>;
  return rest;
};

rmSync(join(OUT, 'schemas'), { recursive: true, force: true });
rmSync(join(OUT, 'examples'), { recursive: true, force: true });
mkdirSync(join(OUT, 'schemas'), { recursive: true });
mkdirSync(join(OUT, 'examples'), { recursive: true });

for (const [name, schema] of Object.entries(schemas)) {
  const io = name.endsWith('Request') ? 'input' : 'output';
  writeFileSync(
    join(OUT, 'schemas', `${name}.schema.json`),
    json({ $schema: 'https://json-schema.org/draft/2020-12/schema', $id: `https://skyshift-x/api/v1/${name}.schema.json`, title: name, ...toSchema(schema, io) }),
  );
}

/* ---------- OpenAPI ---------- */

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const enveloped = (data: unknown) => ({
  type: 'object',
  required: ['apiVersion', 'data', 'meta'],
  properties: { apiVersion: { type: 'string', pattern: '^1\\.\\d+$', example: c.API_VERSION }, data, meta: ref('ResponseMeta') },
});
const okResponse = (description: string, data: unknown) => ({ description, content: { 'application/json': { schema: enveloped(data) } } });
const errorResponse = (description: string) => ({ description, content: { 'application/json': { schema: ref('ErrorEnvelope') } } });
const idParam = (what: string) => ({ name: 'id', in: 'path', required: true, description: `${what} identifier`, schema: { type: 'string' } });
const listOf = (name: string) => ({ type: 'array', items: ref(name) });

const get = (summary: string, tag: string, data: unknown, extra: Record<string, unknown> = {}) => ({
  get: { summary, tags: [tag], ...extra, responses: { 200: okResponse('OK', data), 404: errorResponse('Not found'), 500: errorResponse('Server error') } },
});

const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'SkyShift X API',
    version: c.API_VERSION,
    description:
      'Contract between the SkyShift X frontend and the scientific/AI backend. GENERATED from src/contracts/v1 (Zod) by `pnpm gen:api`; do not edit by hand.\n\n' +
      'Rules: every 2xx body is `{ apiVersion, data, meta }`; every non-2xx body is `{ apiVersion, error: { code, message, details? } }`. ' +
      '`meta.simulated` must be true whenever any value in the response is synthetic. Image URLs may be absolute or relative to the API base URL. ' +
      'The backend performs all alignment, subtraction, detection and measurement; the frontend only displays results.',
  },
  servers: [{ url: 'http://localhost:8000', description: 'Local FastAPI backend (VITE_API_BASE_URL)' }],
  tags: [
    { name: 'Time Explorer', description: 'Sky regions, observation epochs, comparisons and difference images' },
    { name: 'Candidates', description: 'Sources that changed between observations, with evidence' },
    { name: 'Datasets', description: 'Spectra and other measured datasets' },
    { name: 'Journeys', description: 'Narrated Discovery Journeys (prepared or AI-generated)' },
    { name: 'Explorer', description: 'Bodies shown in the 3D explorer' },
    { name: 'System', description: 'Health and reference data' },
  ],
  paths: {
    '/api/v1/health': get('Service health and capabilities', 'System', ref('Health')),
    '/api/v1/sources': get('Scientific sources cited by the application', 'System', listOf('Source')),
    '/api/v1/objects': get('Bodies, spacecraft and regions for the 3D explorer', 'Explorer', listOf('SolarSystemObject')),
    '/api/v1/objects/{id}': get('One explorer object', 'Explorer', ref('SolarSystemObject'), { parameters: [idParam('Object')] }),
    '/api/v1/regions': get('Sky regions with time-resolved observations', 'Time Explorer', listOf('SkyRegion')),
    '/api/v1/regions/{id}': get('One sky region', 'Time Explorer', ref('SkyRegion'), { parameters: [idParam('Region')] }),
    '/api/v1/observations': get('Observations (epochs) of a region, oldest first', 'Time Explorer', listOf('Observation'), {
      parameters: [
        { name: 'regionId', in: 'query', required: false, schema: { type: 'string' } },
        { name: 'bandId', in: 'query', required: false, description: 'e.g. SPHEREx-D2', schema: { type: 'string' } },
      ],
    }),
    '/api/v1/observations/{id}': get('One observation', 'Time Explorer', ref('Observation'), { parameters: [idParam('Observation')] }),
    '/api/v1/comparisons': {
      post: {
        summary: 'Align two observations and compute their difference image',
        description: 'Idempotent: the same pair returns the same comparison id. Returns candidate positions in the aligned frame.',
        tags: ['Time Explorer'],
        requestBody: { required: true, content: { 'application/json': { schema: ref('ComparisonRequest') } } },
        responses: {
          200: okResponse('Comparison with difference image and candidate markers', ref('Comparison')),
          400: errorResponse('Invalid request'),
          422: errorResponse('The pair cannot be compared'),
          500: errorResponse('Server error'),
        },
      },
    },
    '/api/v1/comparisons/{id}': get('A previously computed comparison', 'Time Explorer', ref('Comparison'), { parameters: [idParam('Comparison')] }),
    '/api/v1/candidates': get('Candidate summaries', 'Candidates', listOf('CandidateSummary'), {
      parameters: [{ name: 'regionId', in: 'query', required: false, schema: { type: 'string' } }],
    }),
    '/api/v1/candidates/{id}': get('Full candidate: detections, motion, explanations, evidence', 'Candidates', ref('Candidate'), { parameters: [idParam('Candidate')] }),
    '/api/v1/datasets/{id}': get('A dataset (currently: spectrum)', 'Datasets', ref('Dataset'), { parameters: [idParam('Dataset')] }),
    '/api/v1/journeys': {
      ...get('Available journeys', 'Journeys', listOf('JourneySummary')),
      post: {
        summary: 'Ask a question in context and receive a narrated journey',
        description:
          'The AI backend generates a Journey from the question and the selected source/evidence. If it cannot, it must answer 422 with code `unsupported_in_demo` or `unavailable`; the frontend shows that message and never invents a journey.',
        tags: ['Journeys'],
        requestBody: { required: true, content: { 'application/json': { schema: ref('JourneyRequest') } } },
        responses: {
          200: okResponse('A journey answering the question', ref('Journey')),
          400: errorResponse('Invalid request'),
          422: errorResponse('The question cannot be answered'),
          500: errorResponse('Server error'),
        },
      },
    },
    '/api/v1/journeys/{id}': get('One journey', 'Journeys', ref('Journey'), { parameters: [idParam('Journey')] }),
  },
  components: {
    schemas: Object.fromEntries(Object.entries(schemas).map(([name, s]) => [name, toSchema(s, name.endsWith('Request') ? 'input' : 'output')])),
  },
};
writeFileSync(join(OUT, 'openapi.json'), json(openapi));

/* ---------- Examples captured from the mock API ---------- */

const mock = createMockFetch();
const BASE = 'http://localhost:8000';

async function capture(file: string, method: 'GET' | 'POST', path: string, body?: unknown, trim?: (data: unknown) => unknown) {
  const res = await mock(BASE + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const payload = (await res.json()) as { data?: unknown; meta?: { generatedAt?: string } };
  if (payload.meta) payload.meta.generatedAt = '2026-11-13T00:00:00.000Z'; // stable output
  if (trim && payload.data !== undefined) payload.data = trim(payload.data);
  writeFileSync(join(OUT, 'examples', file), json({ request: { method, path, ...(body ? { body } : {}) }, status: res.status, response: payload }));
}

const first = (n: number) => (d: unknown) => (Array.isArray(d) ? d.slice(0, n) : d);
const trimSpectrum = (d: unknown) => {
  const ds = d as { points: unknown[]; comparisonSeries: { points: unknown[] }[] };
  return { ...ds, points: ds.points.slice(0, 3), comparisonSeries: ds.comparisonSeries.map((s) => ({ ...s, points: s.points.slice(0, 3) })) };
};
const trimJourney = (d: unknown) => {
  const j = d as { scenes: unknown[]; evidence: unknown[]; sources: unknown[] };
  return { ...j, scenes: [j.scenes[0], j.scenes[3], j.scenes[4], j.scenes[8]], evidence: j.evidence.slice(0, 2), sources: j.sources.slice(0, 2) };
};

await capture('health.json', 'GET', '/api/v1/health');
await capture('regions.json', 'GET', '/api/v1/regions', undefined, first(1));
await capture('observations.json', 'GET', '/api/v1/observations?regionId=field-a&bandId=SPHEREx-D2', undefined, first(2));
await capture('comparison.json', 'POST', '/api/v1/comparisons', { referenceObservationId: 'obs-field-a-d2-e1', targetObservationId: 'obs-field-a-d2-e2' });
await capture('comparison-rejected.json', 'POST', '/api/v1/comparisons', { referenceObservationId: 'obs-field-a-d2-e2', targetObservationId: 'obs-field-a-d2-e1' });
await capture('candidates.json', 'GET', '/api/v1/candidates?regionId=field-a');
await capture('candidate.json', 'GET', '/api/v1/candidates/cand-a-001');
await capture('dataset-spectrum.json', 'GET', '/api/v1/datasets/ds-spec-a-001', undefined, trimSpectrum);
await capture('journey-request.json', 'POST', '/api/v1/journeys', { question: 'Why does this source appear to move?', context: { regionId: 'field-a', comparisonId: 'cmp-field-a-d2-e1-e2', candidateId: 'cand-a-001' }, audience: 'beginner' }, trimJourney);
await capture('journey-declined.json', 'POST', '/api/v1/journeys', { question: 'What is dark energy?', context: {}, audience: 'beginner' });
await capture('not-found.json', 'GET', '/api/v1/candidates/does-not-exist');

console.log(`Wrote ${Object.keys(schemas).length} JSON Schemas, openapi.json and examples to docs/api`);
