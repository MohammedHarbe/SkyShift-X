/**
 * SkyShift Time Explorer: pick a patch of sky, pick two dates, and see what changed.
 *
 * The view is a thin shell over the API: regions, observations, comparisons (aligned images,
 * difference image, candidate positions) and candidates all come from the data service.
 * No detection, alignment or subtraction happens in the browser.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { isApiError, useCandidates, useComparePair, useObservations, useRegions } from '@/api';
import { ComparisonViewer } from '@/components/science/ComparisonViewer';
import { ObservationMetadata } from '@/components/science/ObservationMetadata';
import { AskBar } from '@/features/ask/AskBar';
import { CandidatePanel } from '@/features/candidates/CandidatePanel';
import { formatBaseline, formatDate } from '@/lib/astro';
import { cn } from '@/lib/cn';
import { prefersReducedMotion } from '@/lib/useReducedMotion';
import { useUiStore } from '@/stores/ui';
import { AlertIcon, Button, ChevronLeftIcon, EmptyState, ErrorState, LoadingState, Panel, Segmented } from '@/ui';
import { assignSlot, parseView, pickBand, pickPair, pickRegion, VIEW_MODE, withParams, type ViewParam } from './params';
import { BandPicker, CandidateList, EpochPicker, ReadThisFirst, RegionPicker } from './parts';

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-ice">
        <span className="num inline-flex h-5 w-5 items-center justify-center rounded-full border border-line-strong text-[11px] text-mist">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia?.(query);
      mq?.addEventListener('change', cb);
      return () => mq?.removeEventListener('change', cb);
    },
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  );
}

export default function TimeExplorerView() {
  const [params, setParams] = useSearchParams();
  const update = (updates: Record<string, string | null | undefined>) => setParams((prev) => withParams(prev, updates), { replace: true });
  const research = useUiStore((s) => s.audience) === 'research';
  // wide: candidate panel sits beside the viewer. twoColumn: controls sit beside the viewer.
  const wide = useMediaQuery('(min-width: 1280px)');
  const twoColumn = useMediaQuery('(min-width: 1024px)');

  const regionsQuery = useRegions();
  const regions = regionsQuery.data?.data ?? [];
  const region = pickRegion(regions, params.get('region'));
  const band = pickBand(region, params.get('band'));

  const observationsQuery = useObservations(region?.id, band?.id);
  const observations = observationsQuery.data?.data ?? [];
  const pair = pickPair(observations, params.get('ref'), params.get('tgt'));
  const view = parseView(params.get('view'));
  const candidateId = params.get('cand') ?? undefined;

  const compare = useComparePair(pair.reference?.id, pair.target?.id);
  const comparison = compare.data?.data;
  const candidatesQuery = useCandidates(region?.id);
  const [showMarkers, setShowMarkers] = useState(true);

  // On stacked layouts the candidate panel sits below the viewer: bring it into view when one is picked.
  const panelRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (candidateId && !wide) panelRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    // Only a new selection should scroll, not a layout change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId]);

  const selectCandidate = (id: string) => update({ cand: id });
  const reversed = !!pair.reference && !!pair.target && pair.reference.mjd > pair.target.mjd;
  const dLambda = pair.reference && pair.target ? Math.abs(pair.reference.centralWavelengthUm - pair.target.centralWavelengthUm) : 0;
  const simulated = regionsQuery.data?.meta.simulated ?? false;

  const candidateStep = (
    <Step n={4} title="Candidates in this field">
      <CandidateList query={candidatesQuery} selectedId={candidateId} comparison={comparison} onSelect={selectCandidate} />
      <p className="mt-2 text-xs leading-relaxed text-dim">
        A candidate is a source the data service flagged because it changed. Most turn out to be asteroids, variable stars or detector artifacts.
      </p>
    </Step>
  );

  return (
    <div className="scroll-area pointer-events-auto h-full bg-[radial-gradient(110%_60%_at_80%_0%,#0b1729_0%,#060b16_55%)]">
      <div className="mx-auto max-w-[100rem] px-4 pb-16 pt-5 sm:px-6 lg:px-8">
        <header>
          <div className="flex items-center justify-between gap-4">
            <div className="eyebrow">Time Explorer</div>
            <Link to="/explore" className="inline-flex items-center gap-1 rounded-full py-0.5 pr-2 text-[13px] text-mist hover:text-ice">
              <ChevronLeftIcon size={14} />
              3D explorer
            </Link>
          </div>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-x-10 gap-y-2">
            <h1 className="display text-2xl text-ice sm:text-3xl">How does this patch of sky change?</h1>
            <p className="max-w-xl text-[13px] leading-relaxed text-mist lg:text-right">
              Choose a field and two dates. Compare the images side by side, blink between them, or subtract one from the other so that only what changed remains.
            </p>
          </div>
        </header>

        {simulated && (
          <div role="note" className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber/40 bg-amber/[0.06] px-4 py-3 text-[13px] leading-relaxed">
            <AlertIcon size={16} className="mt-0.5 shrink-0 text-amber" />
            <p className="text-mist">
              <strong className="font-medium text-amber">Simulated observations.</strong> Every image, difference image, candidate and spectrum on this page is synthetic test data that mimics the structure of SPHEREx
              products. None of it is a NASA measurement.
              {research && regionsQuery.data?.meta.notice && <span className="mt-1 block text-xs text-dim">{regionsQuery.data.meta.notice}</span>}
            </p>
          </div>
        )}

        {regionsQuery.isPending && <LoadingState label="Loading sky regions…" className="mt-6" />}
        {regionsQuery.isError && <ErrorState error={regionsQuery.error} onRetry={() => void regionsQuery.refetch()} className="mt-6" />}
        {regionsQuery.isSuccess && regions.length === 0 && (
          <EmptyState title="No sky regions available" className="mt-6">
            The data service returned no regions with time-resolved observations.
          </EmptyState>
        )}

        {region && (
          <div className={cn('mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]', candidateId && wide && 'xl:grid-cols-[18rem_minmax(0,1fr)_25rem]')}>
            {/* ---- Controls ---- */}
            {/* On phones the images come first; the pickers follow and are reachable from the link above the viewer. */}
            <Panel as="aside" id="time-controls" aria-label="Choose what to compare" className="order-2 scroll-mt-4 space-y-5 self-start lg:order-none">
              <Step n={1} title="Sky region">
                <RegionPicker regions={regions} selectedId={region.id} onSelect={(id) => update({ region: id, band: null, ref: null, tgt: null, cand: null })} />
              </Step>
              <Step n={2} title="Wavelength band">
                <BandPicker bands={region.bands} selectedId={band?.id} onSelect={(id) => update({ band: id, ref: null, tgt: null })} />
              </Step>
              <Step n={3} title="Two observations">
                {observationsQuery.isPending && <LoadingState label="Loading observations…" className="!py-2" />}
                {observationsQuery.isError && <ErrorState error={observationsQuery.error} onRetry={() => void observationsQuery.refetch()} />}
                {observationsQuery.isSuccess &&
                  (observations.length === 0 ? (
                    <EmptyState title="No observations">The data service has no observations of this field in this band.</EmptyState>
                  ) : (
                    <EpochPicker
                      observations={observations}
                      referenceId={pair.reference?.id}
                      targetId={pair.target?.id}
                      onAssign={(slot, id) => update(assignSlot(pair, slot, id))}
                    />
                  ))}
              </Step>
              {twoColumn && candidateStep}
            </Panel>

            {/* ---- Comparison ---- */}
            <div className="order-1 min-w-0 space-y-5 lg:order-none">
              <Panel aria-label="Image comparison">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[13px] lg:hidden">
                  <span className="text-ice">
                    {region.name}
                    {band && <span className="text-mist"> · {band.label}</span>}
                  </span>
                  <button
                    type="button"
                    className="rounded-full text-cyan underline decoration-cyan/40 underline-offset-2"
                    onClick={() => document.getElementById('time-controls')?.scrollIntoView({ block: 'start' })}
                  >
                    Change field, band or dates
                  </button>
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
                  <Segmented<ViewParam>
                    label="Comparison view"
                    value={view}
                    onChange={(v) => update({ view: v })}
                    options={[
                      { value: 'side', label: 'Side by side' },
                      { value: 'blink', label: 'Blink' },
                      { value: 'diff', label: 'Difference' },
                    ]}
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-mist">
                    <input type="checkbox" checked={showMarkers} onChange={(e) => setShowMarkers(e.target.checked)} className="h-4 w-4 cursor-pointer accent-[#7fe3ff]" />
                    Show candidates
                  </label>
                  {pair.reference && pair.target && (
                    <div className="num ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dim">
                      <span>
                        <span className="text-mist">A</span> {formatDate(pair.reference.observedAt)}
                      </span>
                      <span>
                        <span className="text-mist">B</span> {formatDate(pair.target.observedAt)}
                      </span>
                      <span title="Time from A to B">
                        Δt {reversed ? '−' : ''}
                        {formatBaseline(pair.target.mjd - pair.reference.mjd)}
                      </span>
                      {dLambda > 0 && <span title="The two exposures sample slightly different wavelengths; see the notes below">Δλ {dLambda.toFixed(2)} µm</span>}
                    </div>
                  )}
                </div>

                <div className="min-h-[18rem]">
                  {observationsQuery.isSuccess && observations.length === 0 ? (
                    <EmptyState title="Nothing to compare">Choose a band or field that has observations.</EmptyState>
                  ) : observationsQuery.isSuccess && observations.length === 1 ? (
                    <EmptyState title="Only one observation">
                      Seeing change needs at least two observations of the same field. The data service has one for this band.
                    </EmptyState>
                  ) : compare.isError ? (
                    <div>
                      <ErrorState
                        error={compare.error}
                        onRetry={isApiError(compare.error) && compare.error.code === 'unsupported_in_demo' ? undefined : () => void compare.refetch()}
                      />
                      {reversed && (
                        <Button className="mt-3" variant="primary" size="sm" onClick={() => update({ ref: pair.target?.id, tgt: pair.reference?.id })}>
                          Swap A and B
                        </Button>
                      )}
                    </div>
                  ) : comparison ? (
                    <ComparisonViewer
                      comparison={comparison}
                      mode={VIEW_MODE[view]}
                      showMarkers={showMarkers}
                      selectedCandidateId={candidateId}
                      onSelectCandidate={selectCandidate}
                      className="[--viewer-max:clamp(18rem,calc(100dvh-28rem),40rem)]"
                    />
                  ) : (
                    <LoadingState label="Asking the data service to compare the two observations…" />
                  )}
                </div>
              </Panel>

              {/* On single-column layouts the candidate list follows the images it refers to. */}
              {!twoColumn && <Panel aria-label="Candidates">{candidateStep}</Panel>}

              {comparison && <ReadThisFirst comparison={comparison} research={research} />}

              {!candidateId && (
                <AskBar
                  compact
                  context={{ regionId: region.id, comparisonId: comparison?.id }}
                  suggestions={['What is a difference image?', 'Why would a source appear to move?']}
                  placeholder="Ask about what you are seeing…"
                />
              )}

              {/* Stacked position of the candidate panel (below xl). */}
              {candidateId && !wide && (
                <div ref={panelRef} className="scroll-mt-4">
                  <CandidatePanel candidateId={candidateId} onClose={() => update({ cand: null })} />
                </div>
              )}

              {pair.reference && pair.target && (
                <Panel aria-label="Observation details">
                  <h2 className="mb-4 text-[15px] font-medium text-ice">Observation details</h2>
                  <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
                    <div>
                      <div className="eyebrow mb-2 !text-cyan">A · Reference</div>
                      <ObservationMetadata observation={pair.reference} />
                    </div>
                    <div>
                      <div className="eyebrow mb-2 !text-cyan">B · Comparison</div>
                      <ObservationMetadata observation={pair.target} />
                    </div>
                  </div>
                </Panel>
              )}
            </div>

            {/* ---- Candidate (wide screens) ---- */}
            {candidateId && wide && (
              <div className="sticky top-4 self-start">
                <CandidatePanel candidateId={candidateId} onClose={() => update({ cand: null })} className="max-h-[max(28rem,calc(100dvh-15.5rem))]" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
