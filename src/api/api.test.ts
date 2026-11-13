import { afterEach, describe, expect, it } from 'vitest';
import { createMockFetch } from '@/mocks/router';
import { api } from './endpoints';
import { ApiError } from './errors';
import { setTransportForTests } from './transport';

const useMock = () => setTransportForTests({ fetch: createMockFetch(), baseUrl: 'http://mock.test' });

afterEach(() => setTransportForTests(null));

describe('mock API satisfies the v1 contract', () => {
  it('serves every read endpoint with a valid, labelled envelope', async () => {
    useMock();
    const health = await api.health();
    expect(health.meta.dataOrigin).toBe('mock');
    expect(health.data.capabilities.dynamicJourneys).toBe(false);

    const objects = await api.objects();
    expect(objects.data.map((o) => o.id)).toEqual(expect.arrayContaining(['sun', 'neptune', 'kuiper-belt', 'spherex', 'planet-nine-region']));
    await api.object('neptune');
    await api.sources();

    const regions = await api.regions();
    expect(regions.data.length).toBeGreaterThanOrEqual(2);
    expect(regions.meta.simulated).toBe(true);
    for (const region of regions.data) {
      await api.region(region.id);
      const obs = await api.observations({ regionId: region.id, bandId: region.bands[0]!.id });
      expect(obs.data.length).toBeGreaterThanOrEqual(2);
      expect(obs.data.every((o) => o.provenance.classification === 'simulated')).toBe(true);
      const mjds = obs.data.map((o) => o.mjd);
      expect([...mjds].sort((a, b) => a - b)).toEqual(mjds);
      await api.observation(obs.data[0]!.id);
      const cands = await api.candidates({ regionId: region.id });
      for (const c of cands.data) {
        const full = await api.candidate(c.id);
        if (full.data.spectrumDatasetId) await api.dataset(full.data.spectrumDatasetId);
      }
    }
    const journeys = await api.journeys();
    for (const j of journeys.data) await api.journey(j.id);
  });

  it('compares two epochs and returns a labelled difference image with candidate markers', async () => {
    useMock();
    const obs = await api.observations({ regionId: 'field-a', bandId: 'SPHEREx-D2' });
    const cmp = await api.compare({ referenceObservationId: obs.data[0]!.id, targetObservationId: obs.data[1]!.id });
    expect(cmp.data.difference.provenance.classification).toBe('simulated');
    expect(cmp.data.timeBaselineDays).toBeGreaterThan(0);
    expect(cmp.data.markers.some((m) => m.candidateId === 'cand-a-001' && m.role === 'target-position')).toBe(true);
    expect((await api.comparison(cmp.data.id)).data.id).toBe(cmp.data.id);
  });

  it('never presents the Planet Nine region as confirmed or gives it an orbit', async () => {
    useMock();
    const p9 = (await api.object('planet-nine-region')).data;
    expect(p9.status).toBe('hypothetical');
    expect(p9.orbit).toBeUndefined();
    const all = (await api.candidates({})).data;
    expect(all.every((c) => c.classification === 'simulated')).toBe(true);
  });

  it('routes supported questions to the prepared journey and honestly declines the rest', async () => {
    useMock();
    const j = await api.askJourney({ question: 'Why does this source appear to move?', context: { candidateId: 'cand-a-001' } });
    expect(j.data.generation.mode).toBe('prepared');
    await expect(api.askJourney({ question: 'What is the airspeed of an unladen swallow?' })).rejects.toMatchObject({
      kind: 'http',
      code: 'unsupported_in_demo',
    });
  });

  it('journey references resolve: every cue target exists in the API', async () => {
    useMock();
    const journey = (await api.journey('journey-moving-source')).data;
    const objects = (await api.objects()).data.map((o) => o.id);
    const evidenceIds = new Set(journey.evidence.map((e) => e.id));
    const sourceIds = new Set(journey.sources.map((s) => s.id));
    expect(journey.scenes).toHaveLength(journey.sceneCount);
    for (const scene of journey.scenes) {
      for (const seg of scene.segments) {
        const v = seg.visual;
        if (v.type === 'camera3d') expect(objects).toContain(v.targetObjectId);
        if (v.type === 'imageComparison') await api.comparison(v.comparisonId);
        if (v.type === 'candidate') await api.candidate(v.candidateId);
        if (v.type === 'spectrum') await api.dataset(v.datasetId);
      }
      for (const claim of scene.claims) {
        for (const id of claim.evidenceIds) expect(evidenceIds.has(id), `${claim.id} -> ${id}`).toBe(true);
        for (const id of claim.sourceIds) expect(sourceIds.has(id), `${claim.id} -> ${id}`).toBe(true);
      }
    }
  });
});

describe('failure handling', () => {
  it('reports 404s with the contract error code', async () => {
    useMock();
    await expect(api.candidate('nope')).rejects.toMatchObject({ kind: 'http', status: 404, code: 'not_found' });
  });

  it('surfaces a network failure as an error and does not substitute mock data', async () => {
    setTransportForTests({
      fetch: () => Promise.reject(new TypeError('Failed to fetch')),
      baseUrl: 'http://live.test',
    });
    await expect(api.regions()).rejects.toBeInstanceOf(ApiError);
    await expect(api.regions()).rejects.toMatchObject({ kind: 'network' });
  });

  it('rejects a 200 response that violates the contract', async () => {
    setTransportForTests({
      fetch: async () => new Response(JSON.stringify({ apiVersion: '1.0', data: [{ id: 'x' }], meta: {} }), { status: 200 }),
      baseUrl: 'http://live.test',
    });
    await expect(api.regions()).rejects.toMatchObject({ kind: 'contract' });
  });

  it('rejects an unsupported API major version', async () => {
    setTransportForTests({
      fetch: async () =>
        new Response(
          JSON.stringify({ apiVersion: '2.0', data: [], meta: { dataOrigin: 'live', simulated: false, generatedAt: new Date().toISOString() } }),
          { status: 200 },
        ),
      baseUrl: 'http://live.test',
    });
    await expect(api.regions()).rejects.toMatchObject({ kind: 'contract' });
  });
});
