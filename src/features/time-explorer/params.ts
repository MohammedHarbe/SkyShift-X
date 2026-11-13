/**
 * URL state of the Time Explorer. Everything the user chose lives in the query string so a view
 * can be shared, and so the 3D explorer and journeys can deep-link into it:
 *   /time?region=field-a&band=SPHEREx-D2&ref=<obs id>&tgt=<obs id>&view=diff&cand=<candidate id>
 */
import type { Band, Observation, SkyRegion } from '@/contracts/v1';
import type { ComparisonMode } from '@/components/science/ComparisonViewer';

export type ViewParam = 'side' | 'blink' | 'diff';

export const VIEW_MODE: Record<ViewParam, ComparisonMode> = { side: 'side-by-side', blink: 'blink', diff: 'difference' };

export function parseView(value: string | null): ViewParam {
  return value === 'side' || value === 'diff' ? value : 'blink';
}

export function pickRegion(regions: SkyRegion[], param: string | null): SkyRegion | undefined {
  return regions.find((r) => r.id === param) ?? regions[0];
}

export function pickBand(region: SkyRegion | undefined, param: string | null): Band | undefined {
  return region?.bands.find((b) => b.id === param) ?? region?.bands[0];
}

export interface Pair {
  reference?: Observation;
  target?: Observation;
}

/**
 * Resolve the A/B pair from the URL. Defaults: the earliest observation as reference (A) and the
 * next one after it as comparison (B). A and B are never the same observation.
 * `observations` must be in time order (the API returns them that way).
 */
export function pickPair(observations: Observation[], refParam: string | null, tgtParam: string | null): Pair {
  if (observations.length === 0) return {};
  const reference = observations.find((o) => o.id === refParam) ?? observations.find((o) => o.id !== tgtParam) ?? observations[0]!;
  const requested = observations.find((o) => o.id === tgtParam && o.id !== reference.id);
  const later = observations.find((o) => o.mjd > reference.mjd);
  const target = requested ?? later ?? observations.find((o) => o.id !== reference.id);
  return { reference, target };
}

/** Selecting an observation for one slot that is already in the other swaps the two. */
export function assignSlot(pair: Pair, slot: 'reference' | 'target', id: string): { ref?: string; tgt?: string } {
  const ref = pair.reference?.id;
  const tgt = pair.target?.id;
  if (slot === 'reference') return id === tgt ? { ref: id, tgt: ref } : { ref: id, tgt };
  return id === ref ? { ref: tgt, tgt: id } : { ref, tgt: id };
}

/** Apply updates to a query string; null or undefined removes the key. */
export function withParams(current: URLSearchParams, updates: Record<string, string | null | undefined>): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [k, v] of Object.entries(updates)) {
    if (v === null || v === undefined || v === '') next.delete(k);
    else next.set(k, v);
  }
  return next;
}
