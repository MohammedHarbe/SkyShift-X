/**
 * Loads what a segment's visual needs BEFORE its narration starts (data via the API cache, images
 * decoded), so the picture is on screen when the first word is spoken. Also used to warm up the
 * next segment while the current one plays.
 */
import type { QueryClient } from '@tanstack/react-query';
import { queries, resolveAssetUrl } from '@/api';
import type { VisualCue } from '@/contracts/v1';

const images = new Map<string, Promise<void>>();

export function preloadImage(url: string): Promise<void> {
  const src = resolveAssetUrl(url);
  let pending = images.get(src);
  if (!pending) {
    pending = new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const decoded = typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve();
        void decoded.then(() => resolve());
      };
      img.onerror = () => resolve(); // the scene itself reports a broken image
      img.src = src;
    });
    images.set(src, pending);
  }
  return pending;
}

async function load(qc: QueryClient, cue: VisualCue): Promise<void> {
  switch (cue.type) {
    case 'camera3d':
    case 'diagram':
    case 'conclusion':
      return;
    case 'image':
      if (cue.source.kind === 'observation') {
        const res = await qc.ensureQueryData(queries.observation(cue.source.observationId));
        await preloadImage(res.data.image.url);
      }
      return;
    case 'imageComparison': {
      const res = await qc.ensureQueryData(queries.comparison(cue.comparisonId));
      const c = res.data;
      await Promise.all([c.reference.image.url, c.target.image.url, c.difference.image.url].map(preloadImage));
      return;
    }
    case 'spectrum':
      await Promise.all([qc.ensureQueryData(queries.dataset(cue.datasetId)), import('@/components/science/SpectrumChart')]);
      return;
    case 'candidate': {
      const res = await qc.ensureQueryData(queries.candidate(cue.candidateId));
      if (cue.focus === 'evidence' && res.data.spectrumDatasetId)
        await Promise.all([qc.ensureQueryData(queries.dataset(res.data.spectrumDatasetId)), import('@/components/science/SpectrumChart')]);
      return;
    }
    case 'skyMap':
      await qc.ensureQueryData(queries.regions());
      return;
  }
}

/** Guard so a slow or failing request can never freeze a journey; the scene then shows its own loading/error state. */
const PREPARE_LIMIT_MS = 7000;

export async function prepareCue(qc: QueryClient, cue: VisualCue): Promise<void> {
  let guard: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([load(qc, cue), new Promise<void>((resolve) => (guard = setTimeout(resolve, PREPARE_LIMIT_MS)))]);
  } catch {
    /* surfaced by the scene component through its own query */
  } finally {
    clearTimeout(guard);
  }
}
