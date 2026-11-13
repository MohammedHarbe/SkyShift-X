import { describe, expect, it } from 'vitest';
import type { Observation, SkyRegion } from '@/contracts/v1';
import { assignSlot, parseView, pickBand, pickPair, pickRegion, withParams } from './params';

const obs = (id: string, mjd: number) => ({ id, mjd }) as Observation;
const list = [obs('e1', 100), obs('e2', 110), obs('e3', 300)];
const regions = [
  { id: 'field-a', bands: [{ id: 'SPHEREx-D2' }, { id: 'SPHEREx-D4' }] },
  { id: 'field-b', bands: [{ id: 'SPHEREx-D2' }] },
] as unknown as SkyRegion[];

describe('Time Explorer URL state', () => {
  it('defaults to blink view and accepts only known views', () => {
    expect(parseView(null)).toBe('blink');
    expect(parseView('diff')).toBe('diff');
    expect(parseView('side')).toBe('side');
    expect(parseView('nonsense')).toBe('blink');
  });

  it('falls back to the first region and band when the URL names none or an unknown one', () => {
    expect(pickRegion(regions, null)?.id).toBe('field-a');
    expect(pickRegion(regions, 'field-b')?.id).toBe('field-b');
    expect(pickRegion(regions, 'missing')?.id).toBe('field-a');
    expect(pickRegion([], null)).toBeUndefined();
    expect(pickBand(regions[0], 'SPHEREx-D4')?.id).toBe('SPHEREx-D4');
    expect(pickBand(regions[0], 'SPHEREx-D9')?.id).toBe('SPHEREx-D2');
    expect(pickBand(undefined, null)).toBeUndefined();
  });

  it('defaults to the earliest observation as A and the next one as B', () => {
    const p = pickPair(list, null, null);
    expect([p.reference?.id, p.target?.id]).toEqual(['e1', 'e2']);
  });

  it('honours the URL and never pairs an observation with itself', () => {
    expect(pickPair(list, 'e2', 'e3')).toMatchObject({ reference: { id: 'e2' }, target: { id: 'e3' } });
    const same = pickPair(list, 'e2', 'e2');
    expect(same.reference?.id).toBe('e2');
    expect(same.target?.id).toBe('e3');
    // Reference is the last epoch: fall back to another observation rather than leaving B empty.
    const last = pickPair(list, 'e3', null);
    expect(last.reference?.id).toBe('e3');
    expect(last.target?.id).toBe('e1');
    // Only B given: A defaults to an observation other than B.
    expect(pickPair(list, null, 'e1')).toMatchObject({ reference: { id: 'e2' }, target: { id: 'e1' } });
  });

  it('copes with zero or one observation', () => {
    expect(pickPair([], null, null)).toEqual({});
    const one = pickPair([obs('e1', 1)], null, null);
    expect(one.reference?.id).toBe('e1');
    expect(one.target).toBeUndefined();
  });

  it('swaps A and B when one slot takes the other slot’s observation', () => {
    const pair = pickPair(list, 'e1', 'e2');
    expect(assignSlot(pair, 'reference', 'e2')).toEqual({ ref: 'e2', tgt: 'e1' });
    expect(assignSlot(pair, 'target', 'e1')).toEqual({ ref: 'e2', tgt: 'e1' });
    expect(assignSlot(pair, 'target', 'e3')).toEqual({ ref: 'e1', tgt: 'e3' });
  });

  it('updates and removes query parameters without touching the others', () => {
    const next = withParams(new URLSearchParams('region=field-a&cand=x&view=diff'), { cand: null, band: 'SPHEREx-D4' });
    expect(next.get('region')).toBe('field-a');
    expect(next.get('view')).toBe('diff');
    expect(next.has('cand')).toBe(false);
    expect(next.get('band')).toBe('SPHEREx-D4');
  });
});
