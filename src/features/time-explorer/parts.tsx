/** Building blocks of the Time Explorer. All data arrives through props from API hooks. */
import type { UseQueryResult } from '@tanstack/react-query';
import { useId } from 'react';
import type { ApiResult } from '@/api';
import type { Band, CandidateSummary, Comparison, Observation, SkyRegion } from '@/contracts/v1';
import { KIND_LABEL, STATUS_LABEL } from '@/features/candidates/labels';
import { formatBaseline, formatCoord, formatDate, formatUtc } from '@/lib/astro';
import { cn } from '@/lib/cn';
import { AlertIcon, Badge, ClassificationBadge, EmptyState, QueryBoundary } from '@/ui';

/* ---------- Region ---------- */

export function RegionPicker({ regions, selectedId, onSelect }: { regions: SkyRegion[]; selectedId?: string; onSelect: (id: string) => void }) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label="Sky region" className="space-y-2">
      {regions.map((r) => {
        const selected = r.id === selectedId;
        return (
          <label
            key={r.id}
            className={cn(
              'block cursor-pointer rounded-xl border px-3.5 py-3 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-cyan',
              selected ? 'border-cyan/60 bg-cyan/[0.07]' : 'border-line bg-white/[0.02] hover:border-line-strong',
            )}
          >
            <input type="radio" name={name} className="sr-only" checked={selected} onChange={() => onSelect(r.id)} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={cn('text-sm font-medium', selected ? 'text-ice' : 'text-mist')}>{r.name}</span>
              <ClassificationBadge classification={r.provenance.classification} />
            </div>
            {selected && <p className="mt-1.5 text-xs leading-relaxed text-mist">{r.description}</p>}
            <div className="num mt-2 text-[11px] leading-5 text-dim">
              <div className="text-mist">{formatCoord(r.center)}</div>
              <div>
                {(r.sizeDeg.width * 60).toFixed(1)}′ × {(r.sizeDeg.height * 60).toFixed(1)}′ · {formatDate(r.epochRange.start)} – {formatDate(r.epochRange.end)}
              </div>
              <div>
                {r.observationCount} observations · {r.candidateCount} candidates
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
}

/* ---------- Band ---------- */

export function BandPicker({ bands, selectedId, onSelect }: { bands: Band[]; selectedId?: string; onSelect: (id: string) => void }) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label="Wavelength band" className="grid grid-cols-2 gap-2">
      {bands.map((b) => {
        const selected = b.id === selectedId;
        return (
          <label
            key={b.id}
            className={cn(
              'cursor-pointer rounded-xl border px-3 py-2 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-cyan',
              selected ? 'border-cyan/60 bg-cyan/[0.07] text-ice' : 'border-line bg-white/[0.02] text-mist hover:border-line-strong',
            )}
          >
            <input type="radio" name={name} className="sr-only" checked={selected} onChange={() => onSelect(b.id)} />
            <div className="text-sm font-medium">{b.label}</div>
            <div className="num text-[11px] text-dim">
              {b.wavelengthMinUm}–{b.wavelengthMaxUm} µm
            </div>
          </label>
        );
      })}
    </div>
  );
}

/* ---------- Epochs ---------- */

function SlotButton({ slot, pressed, epochLabel, onClick }: { slot: 'A' | 'B'; pressed: boolean; epochLabel: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={`Use ${epochLabel} as ${slot === 'A' ? 'A, the reference image' : 'B, the comparison image'}`}
      title={slot === 'A' ? 'Reference (earlier) image' : 'Comparison (later) image'}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
        pressed ? 'border-cyan bg-cyan text-void' : 'border-line-strong text-dim hover:border-cyan/60 hover:text-ice',
      )}
    >
      {slot}
    </button>
  );
}

/** Dots on a line, spaced by real time, so uneven gaps between visits are obvious at a glance. */
function TimeAxis({ observations, referenceId, targetId }: { observations: Observation[]; referenceId?: string; targetId?: string }) {
  if (observations.length < 2) return null;
  const t0 = observations[0]!.mjd;
  const span = Math.max(observations[observations.length - 1]!.mjd - t0, 1e-6);
  const W = 260;
  const x = (o: Observation) => 8 + ((o.mjd - t0) / span) * (W - 16);
  return (
    <svg viewBox={`0 0 ${W} 44`} className="mb-2 w-full" role="img" aria-label={`Timeline of ${observations.length} observations from ${formatDate(observations[0]!.observedAt)} to ${formatDate(observations[observations.length - 1]!.observedAt)}`}>
      <line x1={8} x2={W - 8} y1={22} y2={22} stroke="rgb(150 200 240 / 0.28)" strokeWidth={1} />
      {observations.map((o) => {
        const slot = o.id === referenceId ? 'A' : o.id === targetId ? 'B' : null;
        return (
          <g key={o.id}>
            <circle cx={x(o)} cy={22} r={slot ? 4.5 : 3} fill={slot ? '#7fe3ff' : '#060b16'} stroke={slot ? '#7fe3ff' : 'rgb(150 200 240 / 0.6)'} strokeWidth={1.2} />
            {slot && (
              <text x={x(o)} y={slot === 'A' ? 11 : 40} textAnchor="middle" fontSize={10} fontWeight={600} fill="#7fe3ff">
                {slot}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function EpochPicker({
  observations,
  referenceId,
  targetId,
  onAssign,
}: {
  observations: Observation[];
  referenceId?: string;
  targetId?: string;
  onAssign: (slot: 'reference' | 'target', id: string) => void;
}) {
  const reference = observations.find((o) => o.id === referenceId);
  const target = observations.find((o) => o.id === targetId);
  const baseline = reference && target ? target.mjd - reference.mjd : null;
  return (
    <div>
      <TimeAxis observations={observations} referenceId={referenceId} targetId={targetId} />
      <ul className="space-y-1.5">
        {observations.map((o) => (
          <li key={o.id} className={cn('flex items-center gap-2.5 rounded-xl border px-2.5 py-2', o.id === referenceId || o.id === targetId ? 'border-line-strong bg-white/[0.04]' : 'border-line')}>
            <div className="flex gap-1">
              <SlotButton slot="A" pressed={o.id === referenceId} epochLabel={o.epochLabel} onClick={() => onAssign('reference', o.id)} />
              <SlotButton slot="B" pressed={o.id === targetId} epochLabel={o.epochLabel} onClick={() => onAssign('target', o.id)} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-ice">{o.epochLabel}</div>
              <div className="num text-[11px] text-dim">
                <time dateTime={o.observedAt}>{formatUtc(o.observedAt)}</time> · {o.centralWavelengthUm.toFixed(2)} µm
              </div>
            </div>
          </li>
        ))}
      </ul>
      {baseline !== null && (
        <p className="mt-2.5 text-xs text-mist" aria-live="polite">
          {baseline >= 0 ? (
            <>
              B was taken <span className="num text-ice">{formatBaseline(baseline)}</span> after A.
            </>
          ) : (
            <>
              B was taken <span className="num text-ice">{formatBaseline(baseline)}</span> <span className="text-amber">before</span> A.
            </>
          )}
        </p>
      )}
    </div>
  );
}

/* ---------- Candidates ---------- */

export function CandidateList({
  query,
  selectedId,
  comparison,
  onSelect,
}: {
  query: UseQueryResult<ApiResult<CandidateSummary[]>>;
  selectedId?: string;
  /** When loaded, candidates without a position in this pair are marked as such. */
  comparison?: Comparison;
  onSelect: (id: string) => void;
}) {
  const inView = comparison ? new Set(comparison.markers.map((m) => m.candidateId)) : null;
  return (
    <QueryBoundary
      query={query}
      loadingLabel="Loading candidates…"
      isEmpty={(d) => d.length === 0}
      empty={<EmptyState title="No candidates in this field">The data service reported no changing sources here.</EmptyState>}
    >
      {(candidates) => (
        <ul className="space-y-1.5">
          {candidates.map((c) => {
            const selected = c.id === selectedId;
            const absent = inView !== null && !inView.has(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    'w-full rounded-xl border px-3 py-2 text-left transition-colors',
                    selected ? 'border-cyan/60 bg-cyan/[0.07]' : 'border-line bg-white/[0.02] hover:border-line-strong',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className="num text-[13px] font-medium text-ice">{c.designation}</span>
                    <Badge tone={STATUS_LABEL[c.status].tone}>{STATUS_LABEL[c.status].label}</Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-mist">{KIND_LABEL[c.kind]}</div>
                  {absent && <div className="mt-0.5 text-[11px] text-dim">No position in the pair currently shown</div>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </QueryBoundary>
  );
}

/* ---------- Caveats ---------- */

export function ReadThisFirst({ comparison, research }: { comparison: Comparison; research: boolean }) {
  const a = comparison.alignment;
  return (
    <section aria-labelledby="read-first" className="rounded-2xl border border-amber/30 bg-amber/[0.04] px-4 py-3.5">
      <h2 id="read-first" className="flex items-center gap-2 text-sm font-medium text-amber">
        <AlertIcon size={15} />
        Read this first
      </h2>
      <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-mist">
        {comparison.caveats.map((c, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber" />
            {c}
          </li>
        ))}
      </ul>
      <p className="mt-2.5 border-t border-amber/20 pt-2.5 text-xs text-dim">
        Alignment: <span className="text-mist">{a.status === 'aligned' ? 'aligned by the data service' : 'approximate'}</span>
        {a.residualRmsPx !== undefined && (
          <>
            {' '}
            · residual <span className="num text-mist">{a.residualRmsPx} px</span> RMS
          </>
        )}
        {research && <> · {a.method}</>}
        {research && comparison.difference.noiseRms !== undefined && (
          <>
            {' '}
            · difference noise <span className="num text-mist">{comparison.difference.noiseRms} {comparison.difference.display.unit}</span> RMS
          </>
        )}
      </p>
    </section>
  );
}
