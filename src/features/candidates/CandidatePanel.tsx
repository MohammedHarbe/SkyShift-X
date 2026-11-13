/**
 * Candidate inspection: what was detected, how it moved, which explanations remain open and
 * what evidence exists. Everything shown comes from GET /candidates/{id}; nothing is inferred here.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { useCandidate, useDataset, useJourneys } from '@/api';
import { SpectrumChart } from '@/components/science/SpectrumChart';
import type { Candidate, EvidenceItem } from '@/contracts/v1';
import { AskBar } from '@/features/ask/AskBar';
import { formatDate, formatDec, formatDeg, formatMeasurement, formatRa, formatUtc } from '@/lib/astro';
import { cn } from '@/lib/cn';
import { useUiStore } from '@/stores/ui';
import {
  Badge,
  buttonClass,
  ChevronRightIcon,
  ClassificationBadge,
  CloseIcon,
  DataList,
  EmptyState,
  EpistemicBadge,
  IconButton,
  PlayIcon,
  QueryBoundary,
  Segmented,
} from '@/ui';
import { ASSESSMENT_LABEL, evidenceKindLabel, KIND_LABEL, sortExplanations, STATUS_LABEL } from './labels';

export type CandidateFocus = 'summary' | 'explanations' | 'evidence';

export interface CandidatePanelProps {
  candidateId: string;
  focus?: CandidateFocus;
  /** For journey scenes: header plus the focused section only, no question bar or close button. */
  compact?: boolean;
  onClose?: () => void;
  className?: string;
}

const SUGGESTIONS = ['Why does this source appear to move?', 'Could this be Planet Nine?', 'What is a difference image?'];

function SectionTitle({ children }: { children: string }) {
  return <h3 className="eyebrow mb-2 mt-5 first:mt-0">{children}</h3>;
}
// Note: the first:mt-0 above removes the gap when a title opens its container.

function DetectionsTable({ candidate }: { candidate: Candidate }) {
  return (
    <div className="scroll-area max-w-full overflow-x-auto rounded-xl border border-line" tabIndex={0} role="region" aria-label="Detections table">
      <table className="w-full min-w-[30rem] border-collapse text-left text-xs">
        <caption className="sr-only">Every observation that covered this position and whether the source was detected</caption>
        <thead className="bg-navy text-mist">
          <tr>
            <th scope="col" className="px-3 py-1.5 font-medium">Observed (UTC)</th>
            <th scope="col" className="px-3 py-1.5 text-right font-medium">Wavelength</th>
            <th scope="col" className="px-3 py-1.5 font-medium">Detected</th>
            <th scope="col" className="px-3 py-1.5 text-right font-medium">Flux ± 1σ</th>
            <th scope="col" className="px-3 py-1.5 text-right font-medium">S/N</th>
            <th scope="col" className="px-3 py-1.5 font-medium">Flags</th>
          </tr>
        </thead>
        <tbody>
          {candidate.detections.map((d) => (
            <tr key={d.observationId} className={cn('border-t border-line', d.detected ? 'text-ice' : 'text-dim')}>
              <td className="num px-3 py-1.5 whitespace-nowrap">{formatUtc(d.observedAt).replace(' UTC', '')}</td>
              <td className="num px-3 py-1.5 text-right whitespace-nowrap">{d.wavelengthUm.toFixed(2)} µm</td>
              <td className="px-3 py-1.5">{d.detected ? 'Yes' : 'No'}</td>
              <td className="num px-3 py-1.5 text-right whitespace-nowrap">{d.flux ? formatMeasurement(d.flux) : '—'}</td>
              <td className="num px-3 py-1.5 text-right">{d.snr !== undefined ? d.snr.toFixed(1) : '—'}</td>
              <td className="px-3 py-1.5">{d.flags.length ? d.flags.join(', ') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Summary({ candidate, compact }: { candidate: Candidate; compact: boolean }) {
  const research = useUiStore((s) => s.audience) === 'research';
  const m = candidate.motion;

  const whereWhen = (
    <div>
      <SectionTitle>Where and when</SectionTitle>
      <DataList
        items={[
          { label: 'Right ascension', value: <>{formatRa(candidate.position.raDeg)} <span className="text-dim">({formatDeg(candidate.position.raDeg, 5)})</span></>, mono: true },
          { label: 'Declination', value: <>{formatDec(candidate.position.decDeg)} <span className="text-dim">({formatDeg(candidate.position.decDeg, 5)})</span></>, mono: true },
          { label: 'Detections', value: `${candidate.detectionCount} of ${candidate.detections.length} observations`, mono: true },
          { label: 'First seen', value: formatDate(candidate.firstObservedAt), mono: true },
          { label: 'Last seen', value: formatDate(candidate.lastObservedAt), mono: true },
        ]}
      />
      <p className="mt-1.5 text-xs text-dim">Position at first detection (ICRS).</p>
    </div>
  );

  const motion = (
    <div>
      <SectionTitle>Apparent motion</SectionTitle>
      {m ? (
        <>
          {!research && !compact && (
            <p className="mb-2 text-sm leading-relaxed text-mist">
              Between two observations this source shifted on the sky. The numbers below say how far and how fast. A shift tells us it is probably inside our solar system, not what it is.
            </p>
          )}
          <DataList
            items={[
              { label: 'Angular separation', value: formatMeasurement(m.angularSeparation), mono: true },
              { label: 'Time baseline', value: `${m.baselineDays.toFixed(2)} days`, mono: true },
              { label: 'Apparent rate', value: formatMeasurement(m.rate), mono: true },
              { label: 'Direction (east of north)', value: `${m.positionAngleDeg.toFixed(1)}°`, mono: true },
            ]}
          />
          <p className="mt-1.5 text-xs text-dim">Method: {m.method}.</p>
        </>
      ) : (
        <p className="text-sm text-mist">No motion measurement was supplied for this candidate.</p>
      )}
    </div>
  );

  const limitations = compact ? candidate.limitations.slice(0, 1) : candidate.limitations;

  return (
    <div>
      {!compact && <p className="mb-5 text-sm leading-relaxed text-mist">{STATUS_LABEL[candidate.status].help}</p>}

      {compact ? (
        // Journey scenes: the measurement being narrated comes first, side by side with the position.
        <div className="grid gap-x-10 gap-y-4 @2xl:grid-cols-2">
          {motion}
          {whereWhen}
        </div>
      ) : (
        <>
          {whereWhen}
          <div className="mt-5">{motion}</div>
        </>
      )}

      {!compact && (
        <>
          <SectionTitle>Detections</SectionTitle>
          {research ? (
            <DetectionsTable candidate={candidate} />
          ) : (
            <details className="group rounded-xl border border-line">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm text-mist hover:text-ice">
                <ChevronRightIcon size={14} className="shrink-0 transition-transform group-open:rotate-90" />
                Show every observation of this position ({candidate.detections.length})
              </summary>
              <div className="px-2 pb-2">
                <DetectionsTable candidate={candidate} />
              </div>
            </details>
          )}
        </>
      )}

      <SectionTitle>Limitations</SectionTitle>
      <ul className="space-y-1.5 text-sm text-mist">
        {limitations.map((l, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber" />
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Explanations({ candidate, compact }: { candidate: Candidate; compact: boolean }) {
  const titles = new Map(candidate.evidence.map((e) => [e.id, e.title]));
  return (
    <div>
      <p className="text-sm leading-relaxed text-mist">
        Every explanation that could produce this signal, and how the available evidence bears on each. Assessments are qualitative; no probabilities are assigned.
      </p>
      <ul className={cn('mt-3', compact ? 'grid gap-2 @2xl:grid-cols-2' : 'space-y-2')}>
        {sortExplanations(candidate.explanations).map((x) => {
          const a = ASSESSMENT_LABEL[x.assessment];
          const faded = x.assessment === 'disfavoured' || x.assessment === 'ruled-out';
          return (
            <li key={x.id} className={cn('rounded-xl border border-line bg-white/[0.02]', compact ? 'px-3 py-2.5' : 'px-4 py-3')}>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <h4 className={cn('text-sm font-medium', faded ? 'text-mist' : 'text-ice')}>{x.label}</h4>
                <Badge tone={a.tone}>{a.label}</Badge>
              </div>
              {!compact && <p className="mt-1 text-xs text-dim">{x.description}</p>}
              <p className={cn('mt-1.5 leading-relaxed text-mist', compact ? 'text-xs' : 'text-[13px]')}>{x.rationale}</p>
              {!compact && x.evidenceIds.length > 0 && (
                <p className="mt-1.5 text-xs text-dim">
                  Evidence: {x.evidenceIds.map((id) => titles.get(id) ?? id).join(' · ')}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {!compact && (
        <>
          <SectionTitle>What would settle it</SectionTitle>
          <ul className="space-y-1.5 text-sm text-mist">
            {candidate.followUp.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan" />
                {f}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function EvidenceCard({ item, compact }: { item: EvidenceItem; compact: boolean }) {
  return (
    <li className={cn('rounded-xl border border-line bg-white/[0.02]', compact ? 'px-3 py-2.5' : 'px-4 py-3')}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="eyebrow !tracking-[0.12em]">{evidenceKindLabel(item.kind)}</span>
        <EpistemicBadge status={item.epistemicStatus} />
      </div>
      <h4 className="mt-1 text-sm font-medium text-ice">{item.title}</h4>
      <p className={cn('mt-1 leading-relaxed text-mist', compact ? 'text-xs' : 'text-[13px]')}>{item.summary}</p>
      {item.values.length > 0 && (
        <DataList className="mt-2 !text-xs" items={item.values.map((v) => ({ label: v.label, value: formatMeasurement(v.measurement), mono: true }))} />
      )}
    </li>
  );
}

function SpectrumBlock({ datasetId, compact }: { datasetId: string; compact: boolean }) {
  const query = useDataset(datasetId);
  return (
    <QueryBoundary query={query} loadingLabel="Loading spectrum…">
      {(dataset) =>
        dataset.kind === 'spectrum' ? (
          <SpectrumChart dataset={dataset} showComparison compact={compact} />
        ) : (
          <EmptyState title="This dataset is not a spectrum" />
        )
      }
    </QueryBoundary>
  );
}

function Evidence({ candidate, compact }: { candidate: Candidate; compact: boolean }) {
  const spectrumId = candidate.spectrumDatasetId ?? candidate.evidence.find((e) => e.kind === 'spectrum' && e.datasetId)?.datasetId;
  return (
    <div>
      {candidate.evidence.length > 0 ? (
        <ul className={cn(compact ? 'grid gap-2 @2xl:grid-cols-2' : 'space-y-2')}>
          {candidate.evidence.map((e) => (
            <EvidenceCard key={e.id} item={e} compact={compact} />
          ))}
        </ul>
      ) : (
        <EmptyState title="No evidence items supplied">The data service returned no itemised evidence for this candidate.</EmptyState>
      )}

      {!compact && (
        <>
          <SectionTitle>Spectrum</SectionTitle>
          {spectrumId ? (
            <SpectrumBlock datasetId={spectrumId} compact={false} />
          ) : (
            <EmptyState title="No spectrum available for this candidate">The data service did not supply a spectrum. Nothing is shown in its place.</EmptyState>
          )}
        </>
      )}
    </div>
  );
}

function PanelBody({ candidate, focus, compact, onClose }: { candidate: Candidate; focus: CandidateFocus; compact: boolean; onClose?: () => void }) {
  // The active tab follows the `focus` prop whenever it changes, but the user can switch freely in between.
  const [tab, setTab] = useState<CandidateFocus>(focus);
  const [lastFocus, setLastFocus] = useState(focus);
  if (lastFocus !== focus) {
    setLastFocus(focus);
    setTab(focus);
  }
  const journeys = useJourneys();
  const status = STATUS_LABEL[candidate.status];
  const active = compact ? focus : tab;

  return (
    <>
      <header className={cn('shrink-0 border-b border-line', compact ? 'px-4 pb-3 pt-3.5' : 'px-5 pb-4 pt-5')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="eyebrow">Candidate · {KIND_LABEL[candidate.kind]}</div>
            <h2 className={cn('num mt-1 font-medium text-ice', compact ? 'text-lg' : 'text-xl')}>{candidate.designation}</h2>
          </div>
          {!compact && onClose && (
            <IconButton size="sm" label="Close candidate panel" onClick={onClose}>
              <CloseIcon size={14} />
            </IconButton>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone={status.tone} title={status.help}>
            {status.label}
          </Badge>
          <ClassificationBadge classification={candidate.classification} />
        </div>
        <p className={cn('mt-2 leading-snug text-ice', compact ? 'text-sm' : 'text-[15px]')}>{candidate.headline}</p>
        {!compact && (
          <Segmented<CandidateFocus>
            label="Candidate details"
            size="sm"
            className="mt-3"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'summary', label: 'Summary' },
              { value: 'explanations', label: 'Explanations' },
              { value: 'evidence', label: 'Evidence' },
            ]}
          />
        )}
      </header>

      <div className={cn('scroll-area @container min-h-0 flex-1', compact ? 'px-4 py-3' : 'px-5 py-4')}>
        {active === 'summary' && <Summary candidate={candidate} compact={compact} />}
        {active === 'explanations' && <Explanations candidate={candidate} compact={compact} />}
        {active === 'evidence' && <Evidence candidate={candidate} compact={compact} />}
      </div>

      {!compact && (
        <footer className="shrink-0 border-t border-line px-5 py-3.5">
          {candidate.relatedJourneyIds.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-2">
              {candidate.relatedJourneyIds.map((id) => {
                const title = journeys.data?.data.find((j) => j.id === id)?.title;
                return (
                  <Link key={id} to={`/journey/${id}`} className={buttonClass('secondary', 'sm', 'max-w-full')}>
                    <PlayIcon size={12} className="shrink-0" />
                    <span className="truncate">{title ? `Narrated journey: ${title}` : 'Open the narrated journey'}</span>
                  </Link>
                );
              })}
            </div>
          )}
          {/* Keep the example questions on one scrollable row so the details above keep their space. */}
          <div className="[&_[aria-label='Example_questions']]:flex-nowrap [&_[aria-label='Example_questions']]:overflow-x-auto [&_[aria-label='Example_questions']]:[scrollbar-width:none] [&_[aria-label='Example_questions']>button]:shrink-0">
            <AskBar compact context={{ candidateId: candidate.id, regionId: candidate.regionId }} suggestions={SUGGESTIONS} placeholder="Ask about this candidate…" />
          </div>
        </footer>
      )}
    </>
  );
}

export function CandidatePanel({ candidateId, focus = 'summary', compact = false, onClose, className }: CandidatePanelProps) {
  const query = useCandidate(candidateId);
  return (
    <section aria-label="Candidate details" className={cn('glass flex min-h-0 flex-col overflow-hidden rounded-2xl', compact && 'max-h-full', className)}>
      <QueryBoundary query={query} loadingLabel="Loading candidate…" className="m-5">
        {(candidate) => <PanelBody key={candidate.id} candidate={candidate} focus={focus} compact={compact} onClose={onClose} />}
      </QueryBoundary>
    </section>
  );
}
