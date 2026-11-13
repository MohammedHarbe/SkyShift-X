/**
 * Explorer route: the HUD that sits over the persistent 3D canvas.
 * The root ignores pointer events so the canvas stays draggable; each panel opts back in.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useObjects, useSources } from '@/api';
import type { SolarSystemObject, Source } from '@/contracts/v1';
import { AskBar } from '@/features/ask/AskBar';
import { cn } from '@/lib/cn';
import { useExplorerStore, type Framing } from '@/stores/explorer';
import { useUiStore } from '@/stores/ui';
import { Badge, ChevronDownIcon, EmptyState, ErrorState, InfoIcon, LoadingState, Panel } from '@/ui';
import { ObjectDetails, ObjectHeader } from './hud/ObjectInfoPanel';
import { ObjectNavigator } from './hud/ObjectNavigator';
import { SimControls } from './hud/SimControls';
import { useIsDesktop } from './hud/useMediaQuery';
import { Orrery2D } from './Orrery2D';

const DEFAULT_OBJECT = 'neptune';
const SUGGESTIONS = ['Why does this source appear to move?', 'Could this be Planet Nine?'];
const SCALE_NOTE = 'Distances are compressed and sizes exaggerated so everything fits in one view. Positions along orbits are illustrative, not an ephemeris.';

function ScaleChip({ reduced }: { reduced: boolean }) {
  return (
    <div className="pointer-events-auto flex flex-nowrap items-center gap-1.5">
      <span title={SCALE_NOTE} className="glass inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[11px] text-mist">
        <InfoIcon size={13} className="text-cyan" />
        Not to scale · illustrative positions
      </span>
      {reduced && (
        <Badge tone="neutral" className="whitespace-nowrap" title="Detail was lowered automatically to keep the view smooth on this device.">
          Reduced detail
        </Badge>
      )}
    </div>
  );
}

export default function ExplorerView() {
  const { objectId } = useParams();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  const objectsQuery = useObjects();
  const sourcesQuery = useSources();
  const audience = useUiStore((s) => s.audience);

  const selectedId = useExplorerStore((s) => s.selectedId);
  const select = useExplorerStore((s) => s.select);
  const flyTo = useExplorerStore((s) => s.flyTo);
  const setCinematic = useExplorerStore((s) => s.setCinematic);
  const setHighlights = useExplorerStore((s) => s.setHighlights);
  const webgl = useExplorerStore((s) => s.webgl);
  const quality = useExplorerStore((s) => s.quality);

  // The framing control mirrors the camera's actual state, whoever moved it (HUD, 3D click, journey).
  const cameraRequest = useExplorerStore((s) => s.cameraRequest);
  const framing: Framing = cameraRequest && cameraRequest.targetId === selectedId ? cameraRequest.framing : 'medium';
  const [sheetOpen, setSheetOpen] = useState(false);

  const objects = objectsQuery.data?.data;
  const selected = useMemo(() => objects?.find((o) => o.id === selectedId) ?? null, [objects, selectedId]);
  const sources = useMemo(() => new Map<string, Source>((sourcesQuery.data?.data ?? []).map((s) => [s.id, s])), [sourcesQuery.data]);

  // Entering the explorer hands the camera back to the visitor.
  useEffect(() => {
    setCinematic(false);
    setHighlights([]);
  }, [setCinematic, setHighlights]);

  // URL -> selection. Runs when the route parameter changes or the object list arrives.
  useEffect(() => {
    if (!objects) return;
    const current = useExplorerStore.getState().selectedId;
    if (objectId) {
      if (!objects.some((o) => o.id === objectId)) {
        navigate('/explore', { replace: true });
        return;
      }
      if (current !== objectId) {
        select(objectId);
      }
    } else if (current && objects.some((o) => o.id === current)) {
      navigate(`/explore/${current}`, { replace: true });
    } else if (objects.some((o) => o.id === DEFAULT_OBJECT)) {
      // First visit: open on Neptune with the outer solar system behind it.
      select(DEFAULT_OBJECT);
      flyTo(DEFAULT_OBJECT, { framing: 'wide' });
    }
  }, [objectId, objects, navigate, select, flyTo]);

  // Selection (e.g. a click in the 3D view) -> URL.
  useEffect(() => {
    if (selectedId && selectedId !== objectId) navigate(`/explore/${selectedId}`, { replace: true });
  }, [selectedId, objectId, navigate]);

  const onSelect = (id: string) => select(id);
  const onFraming = (f: Framing) => {
    if (selectedId) flyTo(selectedId, { framing: f });
  };

  const fallback = webgl === 'unavailable';
  const info = selected && { object: selected as SolarSystemObject, sources, audience, framing, onFraming, hideCamera: fallback };

  const statusPanel = objectsQuery.isPending ? (
    <Panel className="pointer-events-auto w-72">
      <LoadingState label="Loading the solar system…" className="py-1" />
    </Panel>
  ) : objectsQuery.isError ? (
    <Panel className="pointer-events-auto w-80 max-w-full">
      <ErrorState error={objectsQuery.error} onRetry={() => void objectsQuery.refetch()} />
    </Panel>
  ) : objects && objects.length === 0 ? (
    <Panel className="pointer-events-auto w-80 max-w-full">
      <EmptyState title="No objects available">The data service returned an empty object list.</EmptyState>
    </Panel>
  ) : null;

  return (
    <div className="pointer-events-none relative h-full w-full overflow-hidden">
      <h1 className="sr-only">Solar system explorer</h1>

      {fallback && objects && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center px-3 pb-56 pt-14 lg:px-72 lg:pb-24 lg:pt-4">
          <p role="status" className="glass mb-2 max-w-xl rounded-full px-4 py-1.5 text-center text-xs text-mist">
            3D graphics are unavailable on this device, so this is a 2D map of the same objects.
          </p>
          <div className="min-h-0 w-full flex-1">
            <Orrery2D objects={objects} selectedId={selectedId} onSelect={onSelect} />
          </div>
        </div>
      )}

      {statusPanel && <div className="absolute left-3 top-3 lg:left-4 lg:top-4">{statusPanel}</div>}

      {objects && objects.length > 0 && isDesktop && (
        <>
          <div className="absolute bottom-32 left-4 top-4 flex">
            <ObjectNavigator layout="rail" objects={objects} selectedId={selectedId} onSelect={onSelect} />
          </div>
          {info && (
            <Panel as="aside" padded={false} aria-label={`About ${info.object.name}`} className="pointer-events-auto absolute right-4 top-4 flex max-h-[calc(100%-8rem)] w-[23rem] flex-col overflow-hidden animate-fade">
              <div className="border-b border-line p-5">
                <ObjectHeader object={info.object} />
              </div>
              <div className="scroll-area min-h-0 flex-1 p-5">
                <ObjectDetails {...info} />
              </div>
            </Panel>
          )}
          <div className="absolute inset-x-4 bottom-4 flex items-end gap-4">
            <div className="flex w-[23rem] shrink-0 flex-col items-start gap-2">
              <ScaleChip reduced={quality === 'low' && !fallback} />
              <SimControls />
            </div>
            <div className="pointer-events-auto mx-auto w-full max-w-xl">
              <AskBar context={{ objectId: selectedId ?? undefined }} suggestions={SUGGESTIONS} />
            </div>
            <div className="hidden w-[23rem] shrink-0 xl:block" />
          </div>
        </>
      )}

      {objects && objects.length > 0 && !isDesktop && (
        <>
          <div className="absolute inset-x-0 top-2">
            <ObjectNavigator layout="strip" objects={objects} selectedId={selectedId} onSelect={onSelect} />
          </div>
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SimControls />
              <ScaleChip reduced={false} />
            </div>
            <div className="pointer-events-auto">
              <AskBar compact context={{ objectId: selectedId ?? undefined }} placeholder="Ask about what you see…" />
            </div>
            {info && (
              <Panel as="aside" padded={false} aria-label={`About ${info.object.name}`} className="pointer-events-auto flex flex-col overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSheetOpen((v) => !v)}
                  aria-expanded={sheetOpen}
                  aria-controls="explorer-sheet"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="eyebrow block">{info.object.status === 'hypothetical' ? 'Hypothesis · not observed' : info.object.tagline}</span>
                    <span className="mt-0.5 block truncate text-lg font-medium text-ice">{info.object.name}</span>
                  </span>
                  <span className="text-xs text-mist">{sheetOpen ? 'Hide' : 'Details'}</span>
                  <ChevronDownIcon size={16} className={cn('text-mist transition-transform', !sheetOpen && 'rotate-180')} />
                </button>
                {sheetOpen && (
                  <div id="explorer-sheet" className="scroll-area max-h-[42vh] border-t border-line p-4">
                    <ObjectHeader object={info.object} />
                    <div className="mt-4">
                      <ObjectDetails {...info} />
                    </div>
                  </div>
                )}
              </Panel>
            )}
          </div>
        </>
      )}
    </div>
  );
}
