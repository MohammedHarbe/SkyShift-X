import { Link } from 'react-router';
import type { SolarSystemObject, Source } from '@/contracts/v1';
import type { Framing } from '@/stores/explorer';
import type { Audience } from '@/stores/ui';
import { Badge, buttonClass, ClockIcon, DataList, EpistemicBadge, ExternalLink, InfoIcon, PlayIcon, Segmented } from '@/ui';
import { kindLabel } from '../model';

export interface ObjectInfoProps {
  object: SolarSystemObject;
  sources: Map<string, Source>;
  audience: Audience;
  framing: Framing;
  onFraming: (f: Framing) => void;
  /** Hide the camera framing control (2D fallback has no camera). */
  hideCamera?: boolean;
}

function SourceLinks({ ids, sources }: { ids: string[]; sources: Map<string, Source> }) {
  const found = ids.map((id) => sources.get(id)).filter((s): s is Source => !!s);
  if (!found.length) return null;
  return (
    <span className="text-[11px] text-dim">
      Source:{' '}
      {found.map((s, i) => (
        <span key={s.id}>
          {i > 0 && ', '}
          <ExternalLink href={s.url} className="text-mist decoration-line-strong">
            {s.publisher}
          </ExternalLink>
        </span>
      ))}
    </span>
  );
}

/** Name, status and one-line description. Always visible, also as the header of the mobile sheet. */
export function ObjectHeader({ object }: { object: SolarSystemObject }) {
  return (
    <div>
      <div className="eyebrow">{kindLabel(object)}</div>
      <h2 className="display mt-1 text-[26px] leading-tight text-ice">{object.name}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <EpistemicBadge status={object.epistemicStatus} />
        {object.status === 'hypothetical' && <Badge tone="amber">Not observed</Badge>}
      </div>
      <p className="mt-2 text-sm text-mist">{object.tagline}</p>
    </div>
  );
}

/** Explanation, facts with their evidence level and sources, visual disclaimer and onward actions. */
export function ObjectDetails({ object, sources, audience, framing, onFraming, hideCamera }: ObjectInfoProps) {
  const research = audience === 'research';
  const allSourceIds = [...new Set([...object.sourceIds, ...object.facts.flatMap((f) => f.sourceIds)])];
  const referenced = allSourceIds.map((id) => sources.get(id)).filter((s): s is Source => !!s);
  const { timeExplorerRegionId, journeyId } = object.links;

  return (
    <div className="space-y-5 text-sm leading-relaxed">
      <div className="space-y-3 text-ice/90">
        <p>{object.summary}</p>
        {research && <p className="text-mist">{object.detail}</p>}
      </div>

      {(timeExplorerRegionId || journeyId) && (
        <div className="flex flex-col gap-2">
          {timeExplorerRegionId && (
            <Link to={`/time?region=${encodeURIComponent(timeExplorerRegionId)}`} className={buttonClass('primary', 'md', 'w-full')}>
              <ClockIcon size={16} />
              Compare observations over time
            </Link>
          )}
          {journeyId && (
            <Link to={`/journey/${encodeURIComponent(journeyId)}`} className={buttonClass('secondary', 'md', 'w-full')}>
              <PlayIcon size={14} />
              Play the narrated journey
            </Link>
          )}
        </div>
      )}

      {!hideCamera && (
        <div>
          <div className="eyebrow mb-1.5">Camera</div>
          <Segmented<Framing>
            label="Camera framing"
            size="sm"
            value={framing}
            onChange={onFraming}
            options={[
              { value: 'close', label: 'Close' },
              { value: 'medium', label: 'Medium' },
              { value: 'wide', label: 'Wide' },
              { value: 'overview', label: 'Far' },
            ]}
          />
        </div>
      )}

      {object.facts.length > 0 && (
        <section aria-label="Key facts">
          <div className="eyebrow mb-2">Key facts</div>
          <ul className="divide-y divide-line">
            {object.facts.map((f) => (
              <li key={f.label} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[13px] text-dim">{f.label}</span>
                  <span className="text-right text-[13px] text-ice">{f.value}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <EpistemicBadge status={f.epistemicStatus} />
                  <SourceLinks ids={f.sourceIds} sources={sources} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {research && (
        <section aria-label="Orbit">
          <div className="eyebrow mb-2">Orbit</div>
          {object.orbit ? (
            <>
              <DataList
                items={[
                  { label: 'Semi-major axis', value: `${object.orbit.semiMajorAxisAu} AU`, mono: true },
                  { label: 'Eccentricity', value: object.orbit.eccentricity.toFixed(3), mono: true },
                  { label: 'Inclination', value: `${object.orbit.inclinationDeg}°`, mono: true },
                  { label: 'Period', value: `${object.orbit.periodYears.toLocaleString('en-US')} yr`, mono: true },
                ]}
              />
              <p className="mt-2 text-xs text-dim">
                {object.orbit.approximate ? 'Rounded values. ' : ''}The orientation of the orbit and the position along it in this view are illustrative.
              </p>
            </>
          ) : (
            <p className="text-[13px] text-mist">
              {object.status === 'hypothetical'
                ? 'No orbit is shown or listed, because none is known. This object has not been observed.'
                : 'No single orbit applies to this object.'}
            </p>
          )}
        </section>
      )}

      <aside className="flex gap-2.5 rounded-xl border border-line bg-black/25 p-3 text-xs text-mist" aria-label="About this visualisation">
        <InfoIcon size={15} className="mt-0.5 shrink-0 text-cyan" />
        <p>
          <span className="font-medium text-ice">About this view. </span>
          {object.visual.disclaimer}
        </p>
      </aside>

      {referenced.length > 0 && (
        <section aria-label="Sources">
          <div className="eyebrow mb-1.5">Sources</div>
          <ul className="space-y-1.5 text-xs text-mist">
            {referenced.map((s) => (
              <li key={s.id}>
                <ExternalLink href={s.url}>{s.title}</ExternalLink>
                <span className="text-dim"> · {s.publisher}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
