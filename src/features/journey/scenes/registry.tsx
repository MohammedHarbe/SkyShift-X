/**
 * Scene registry: the ONLY way journey data becomes pixels.
 *
 * Each validated visual-cue type maps to one reusable React component. A journey can select and
 * parameterise these components; it cannot supply markup or code. A cue type without an entry
 * renders a plain "unsupported" card instead of failing.
 */
import { useEffect, type ComponentType } from 'react';
import { Link } from 'react-router';
import { resolveAssetUrl, useComparison, useDataset, useObjects, useObservation, useRegions } from '@/api';
import { ComparisonViewer } from '@/components/science/ComparisonViewer';
import { SpectrumChart } from '@/components/science/SpectrumChart';
import type { Journey, VisualCue, VisualCueType } from '@/contracts/v1';
import { CandidatePanel } from '@/features/candidates/CandidatePanel';
import { formatCoord, formatUtc } from '@/lib/astro';
import { useExplorerStore } from '@/stores/explorer';
import { Badge, buttonClass, ClassificationBadge, EmptyState, EpistemicBadge, QueryBoundary } from '@/ui';
import { DIAGRAMS } from './diagrams';

type CueOf<K extends VisualCueType> = Extract<VisualCue, { type: K }>;

export interface SceneProps<K extends VisualCueType = VisualCueType> {
  cue: CueOf<K>;
  journey: Journey;
}

interface SceneEntry<K extends VisualCueType> {
  /** 'canvas' scenes let the persistent 3D view show through; 'panel' scenes sit on a glass stage. */
  stage: 'canvas' | 'panel';
  label: string;
  Component: ComponentType<SceneProps<K>>;
}

/* ---------- 3D camera ---------- */

function Camera3dScene({ cue }: SceneProps<'camera3d'>) {
  const flyTo = useExplorerStore((s) => s.flyTo);
  const setHighlights = useExplorerStore((s) => s.setHighlights);
  const webgl = useExplorerStore((s) => s.webgl);
  const objects = useObjects();
  const target = objects.data?.data.find((o) => o.id === cue.targetObjectId);

  useEffect(() => {
    flyTo(cue.targetObjectId, { framing: cue.framing, transition: cue.transition });
    setHighlights(cue.highlightObjectIds);
    return () => setHighlights([]);
  }, [cue, flyTo, setHighlights]);

  return (
    <div className="flex h-full flex-col items-start justify-end gap-3 px-5 pb-4 sm:px-8">
      {webgl === 'unavailable' && target && (
        <div className="glass max-w-xl self-center rounded-2xl p-5">
          <div className="eyebrow mb-1">3D view unavailable on this device</div>
          <h3 className="text-lg font-medium">{target.name}</h3>
          <p className="mt-1 text-sm text-mist">{target.summary}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {target && <EpistemicBadge status={target.epistemicStatus} />}
        <Badge>Illustrative 3D view · not to scale</Badge>
      </div>
      {(cue.caption ?? target?.name) && <p className="text-sm text-mist [text-shadow:0_1px_8px_rgb(0_0_0_/_0.9)]">{cue.caption ?? target?.name}</p>}
    </div>
  );
}

/* ---------- Images ---------- */

function ImageScene({ cue, journey }: SceneProps<'image'>) {
  const observation = useObservation(cue.source.kind === 'observation' ? cue.source.observationId : undefined);
  if (cue.source.kind === 'asset') {
    const assetId = cue.source.assetId;
    const asset = journey.assets.find((a) => a.id === assetId);
    if (!asset) return <EmptyState title="Image unavailable">This journey refers to an image that was not supplied.</EmptyState>;
    return (
      <figure className="mx-auto max-w-3xl">
        <div className="relative overflow-hidden rounded-xl border border-line">
          <img src={resolveAssetUrl(asset.image.url)} alt={asset.image.alt} className="max-h-[52vh] w-full object-contain" />
          <ClassificationBadge classification={asset.classification} className="absolute left-2 top-2 bg-black/70" />
        </div>
        <figcaption className="mt-2 text-sm text-mist">
          {cue.caption} <span className="text-dim">Credit: {asset.credit}. {asset.usageTerms}</span>
        </figcaption>
      </figure>
    );
  }
  return (
    <QueryBoundary query={observation} loadingLabel="Loading image…">
      {(o) => (
        <figure className="mx-auto max-w-xl">
          <div className="relative overflow-hidden rounded-xl border border-line bg-black">
            <img src={resolveAssetUrl(o.image.url)} alt={o.image.alt} className="pixelated aspect-square w-full" />
            <ClassificationBadge classification={o.provenance.classification} className="absolute left-2 top-2 bg-black/70" />
          </div>
          <figcaption className="mt-2 text-sm text-mist">
            {cue.caption} <span className="text-dim">{o.epochLabel} · {formatUtc(o.observedAt)} · {o.centralWavelengthUm} µm</span>
          </figcaption>
        </figure>
      )}
    </QueryBoundary>
  );
}

function ImageComparisonScene({ cue }: SceneProps<'imageComparison'>) {
  const comparison = useComparison(cue.comparisonId);
  return (
    <QueryBoundary query={comparison} loadingLabel="Loading observations…">
      {(c) => (
        <div>
          {/* Size the square panes from the viewport height so image, caption and controls fit without scrolling. */}
          <ComparisonViewer
            comparison={c}
            mode={cue.mode}
            showMarkers={cue.showMarkers}
            selectedCandidateId={cue.focusCandidateId}
            compact
            className="[--viewer-max:clamp(13rem,calc(100dvh-29rem),30rem)]"
          />
          <p className="mt-3 text-center text-sm text-mist">{cue.caption}</p>
        </div>
      )}
    </QueryBoundary>
  );
}

/* ---------- Spectrum ---------- */

function SpectrumScene({ cue }: SceneProps<'spectrum'>) {
  const dataset = useDataset(cue.datasetId);
  return (
    <QueryBoundary query={dataset} loadingLabel="Loading spectrum…">
      {(d) =>
        d.kind === 'spectrum' ? (
          <div>
            <SpectrumChart dataset={d} showComparison={cue.showComparison} highlightRangeUm={cue.highlightRangeUm} height={340} compact />
            <p className="mt-2 text-center text-sm text-mist">{cue.caption}</p>
          </div>
        ) : (
          <EmptyState title="Unsupported dataset">This dataset is not a spectrum.</EmptyState>
        )
      }
    </QueryBoundary>
  );
}

/* ---------- Sky map ---------- */

const OBLIQUITY = (23.44 * Math.PI) / 180;
const mapX = (raDeg: number) => 720 - (raDeg / 360) * 720; // east (increasing RA) to the left
const mapY = (decDeg: number) => 180 - (decDeg / 90) * 180;

function eclipticPath(): string {
  const pts: string[] = [];
  for (let lon = 0; lon <= 360; lon += 4) {
    const l = (lon * Math.PI) / 180;
    const ra = ((Math.atan2(Math.cos(OBLIQUITY) * Math.sin(l), Math.cos(l)) * 180) / Math.PI + 360) % 360;
    const dec = (Math.asin(Math.sin(OBLIQUITY) * Math.sin(l)) * 180) / Math.PI;
    pts.push(`${mapX(lon === 360 ? 359.99 : ra).toFixed(1)},${mapY(dec).toFixed(1)}`);
  }
  return pts.sort((a, b) => parseFloat(a) - parseFloat(b)).join(' ');
}

function SkyMapScene({ cue }: SceneProps<'skyMap'>) {
  const regions = useRegions();
  return (
    <QueryBoundary query={regions} loadingLabel="Loading sky regions…">
      {(all) => {
        const shown = all.filter((r) => cue.regionIds.includes(r.id));
        return (
          <figure>
            <div className="mb-2 flex justify-end">
              <ClassificationBadge classification="illustrative-diagram" />
            </div>
            <svg viewBox="0 0 720 360" role="img" aria-label={`Sky map in right ascension and declination showing ${shown.map((r) => r.name).join(', ') || 'no regions'}.`} className="w-full rounded-xl border border-line bg-black/50">
              {[60, 120, 180, 240, 300].map((ra) => (
                <line key={ra} x1={mapX(ra)} x2={mapX(ra)} y1={0} y2={360} stroke="#a3b8cf" strokeOpacity={0.12} />
              ))}
              {[-60, -30, 0, 30, 60].map((dec) => (
                <line key={dec} x1={0} x2={720} y1={mapY(dec)} y2={mapY(dec)} stroke="#a3b8cf" strokeOpacity={dec === 0 ? 0.3 : 0.12} />
              ))}
              <polyline points={eclipticPath()} fill="none" stroke="#ffb648" strokeOpacity={0.6} strokeDasharray="5 5" />
              <text x={10} y={mapY(0) - 6} fill="#a3b8cf" fontSize={11}>celestial equator</text>
              <text x={10} y={20} fill="#ffb648" fontSize={11}>ecliptic (dashed)</text>
              {shown.map((r) => {
                const hot = r.id === cue.highlightRegionId;
                return (
                  <g key={r.id} transform={`translate(${mapX(r.center.raDeg)} ${mapY(r.center.decDeg)})`}>
                    <circle r={hot ? 9 : 6} fill="none" stroke="#7fe3ff" strokeWidth={hot ? 2.2 : 1.4} />
                    <circle r={2} fill="#7fe3ff" />
                    <text x={12} y={4} fill="#e8f4ff" fontSize={12}>{r.name}</text>
                  </g>
                );
              })}
            </svg>
            <figcaption className="mt-2 text-sm text-mist">
              {cue.caption}
              <span className="block text-dim">{shown.map((r) => `${r.name}: ${formatCoord(r.center)}`).join(' · ')}</span>
            </figcaption>
          </figure>
        );
      }}
    </QueryBoundary>
  );
}

/* ---------- Diagram ---------- */

function DiagramScene({ cue }: SceneProps<'diagram'>) {
  const Diagram = DIAGRAMS[cue.diagramId];
  return (
    <figure>
      <div className="mb-1 flex justify-end">
        <ClassificationBadge classification="illustrative-diagram" />
      </div>
      <Diagram />
      <figcaption className="mt-2 text-center text-sm text-mist">{cue.caption}</figcaption>
    </figure>
  );
}

/* ---------- Candidate ---------- */

function CandidateScene({ cue }: SceneProps<'candidate'>) {
  return (
    <div>
      <CandidatePanel candidateId={cue.candidateId} focus={cue.focus} compact />
      {cue.caption && <p className="mt-2 text-center text-sm text-mist">{cue.caption}</p>}
    </div>
  );
}

/* ---------- Conclusion ---------- */

function ConclusionScene({ cue, journey }: SceneProps<'conclusion'>) {
  const { regionId, candidateId } = journey.context;
  const investigate = regionId ? `/time?region=${regionId}&view=diff${candidateId ? `&cand=${candidateId}` : ''}` : null;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="eyebrow">Conclusion</div>
      <h3 className="display mt-1 text-2xl sm:text-3xl">{cue.headline}</h3>
      <ul className="mt-5 space-y-3">
        {cue.points.map((p, i) => (
          <li key={i} className="flex items-start gap-3">
            <EpistemicBadge status={p.epistemicStatus} className="mt-0.5 shrink-0" />
            <span className="text-[15px] leading-snug text-ice">{p.text}</span>
          </li>
        ))}
      </ul>
      {cue.nextSteps.length > 0 && (
        <>
          <div className="eyebrow mt-6">What would settle it</div>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-mist">
            {cue.nextSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </>
      )}
      {investigate && (
        <Link to={investigate} className={buttonClass('secondary', 'md', 'mt-6')}>
          Inspect this candidate in the Time Explorer
        </Link>
      )}
    </div>
  );
}

function UnsupportedScene({ type }: { type: string }) {
  return (
    <EmptyState title="This scene cannot be shown">
      This version of SkyShift X has no component for the “{type}” scene type. Narration and captions continue.
    </EmptyState>
  );
}

export const sceneRegistry: { [K in VisualCueType]: SceneEntry<K> } = {
  camera3d: { stage: 'canvas', label: '3D view', Component: Camera3dScene },
  image: { stage: 'panel', label: 'Image', Component: ImageScene },
  imageComparison: { stage: 'panel', label: 'Image comparison', Component: ImageComparisonScene },
  spectrum: { stage: 'panel', label: 'Spectrum', Component: SpectrumScene },
  skyMap: { stage: 'panel', label: 'Sky map', Component: SkyMapScene },
  diagram: { stage: 'panel', label: 'Diagram', Component: DiagramScene },
  candidate: { stage: 'panel', label: 'Candidate', Component: CandidateScene },
  conclusion: { stage: 'panel', label: 'Conclusion', Component: ConclusionScene },
};

export function stageOf(cue: VisualCue): 'canvas' | 'panel' {
  return (sceneRegistry[cue.type] as SceneEntry<VisualCueType> | undefined)?.stage ?? 'panel';
}

/** Render the registered component for a cue. */
export function SceneVisual({ cue, journey }: { cue: VisualCue; journey: Journey }) {
  const entry = sceneRegistry[cue.type] as SceneEntry<VisualCueType> | undefined;
  if (!entry) return <UnsupportedScene type={(cue as { type: string }).type} />;
  const Component = entry.Component;
  return <Component cue={cue} journey={journey} />;
}
