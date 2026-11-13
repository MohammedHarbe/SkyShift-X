/**
 * One square image pane with a marker overlay. Used by every comparison mode.
 * It only draws what the API supplies: preview images, their classification and marker positions.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { resolveAssetUrl } from '@/api';
import type { DataClassification, ImageRef } from '@/contracts/v1';
import { cn } from '@/lib/cn';
import { AlertIcon, ClassificationBadge } from '@/ui';
import {
  arrowBetween,
  clampView,
  framePointToPixel,
  markerAriaLabel,
  markerCentre,
  zoomBy,
  type MarkerLink,
  type PaneMarker,
  type ViewState,
} from './geometry';

export interface FrameLayer {
  key: string;
  image: ImageRef;
  /** Only one layer is visible at a time; hidden layers stay loaded so switching never flashes. */
  visible: boolean;
}

export interface ImageFrameProps {
  layers: FrameLayer[];
  classification: DataClassification;
  /** Image size in pixels (marker coordinates are in this frame). */
  width: number;
  height: number;
  markers?: PaneMarker[];
  links?: MarkerLink[];
  selectedCandidateId?: string;
  onSelectCandidate?: (candidateId: string) => void;
  view: ViewState;
  /** Supply to enable drag-to-pan, Ctrl+scroll zoom and keyboard control. */
  onViewChange?: (next: ViewState) => void;
  /** Pointer position in image pixels (0-based, pixel centres at integers), or null when the pointer leaves. */
  onHoverPixel?: (p: { x: number; y: number } | null) => void;
  /** Extra chip rendered in the top-right corner (e.g. which epoch is showing). */
  corner?: ReactNode;
  /** Accessible name of the pane. */
  label: string;
  compact?: boolean;
  className?: string;
}

const RING = '#7fe3ff';
const RING_SELECTED = '#ffffff';

export function ImageFrame({
  layers,
  classification,
  width,
  height,
  markers = [],
  links = [],
  selectedCandidateId,
  onSelectCandidate,
  view,
  onViewChange,
  onHoverPixel,
  corner,
  label,
  compact,
  className,
}: ImageFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; id: number } | null>(null);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const interactive = !!onViewChange;
  const viewRef = useRef(view);
  viewRef.current = view;

  // Ctrl/Cmd + wheel zooms. Registered natively because React's wheel listener is passive.
  useEffect(() => {
    const el = frameRef.current;
    if (!el || !onViewChange) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      onViewChange(zoomBy(viewRef.current, e.deltaY < 0 ? 1.25 : 0.8));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onViewChange]);

  const toPixel = (e: PointerEvent) => {
    const rect = frameRef.current!.getBoundingClientRect();
    return framePointToPixel((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height, view, width, height);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!interactive || e.button !== 0 || view.zoom <= 1) return;
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d && onViewChange) {
      const rect = e.currentTarget.getBoundingClientRect();
      onViewChange(
        clampView({
          zoom: view.zoom,
          tx: d.tx + (((e.clientX - d.x) / rect.width) * 100) / view.zoom,
          ty: d.ty + (((e.clientY - d.y) / rect.height) * 100) / view.zoom,
        }),
      );
    }
    onHoverPixel?.(toPixel(e));
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onViewChange || e.target !== e.currentTarget) return;
    const step = 10 / view.zoom;
    const next: ViewState | null =
      e.key === '+' || e.key === '='
        ? zoomBy(view, 1.5)
        : e.key === '-' || e.key === '_'
          ? zoomBy(view, 1 / 1.5)
          : e.key === '0'
            ? { zoom: 1, tx: 0, ty: 0 }
            : e.key === 'ArrowLeft'
              ? clampView({ ...view, tx: view.tx + step })
              : e.key === 'ArrowRight'
                ? clampView({ ...view, tx: view.tx - step })
                : e.key === 'ArrowUp'
                  ? clampView({ ...view, ty: view.ty + step })
                  : e.key === 'ArrowDown'
                    ? clampView({ ...view, ty: view.ty - step })
                    : null;
    if (next) {
      e.preventDefault();
      onViewChange(next);
    }
  };

  const visible = layers.find((l) => l.visible) ?? layers[0];
  const visibleFailed = visible ? failed[visible.key] : false;
  const hasSelection = !!selectedCandidateId && markers.some((p) => p.marker.candidateId === selectedCandidateId);

  return (
    <div
      ref={frameRef}
      role="group"
      aria-label={interactive ? `${label}. Press plus or minus to zoom, arrow keys to pan, zero to reset.` : label}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => onHoverPixel?.(null)}
      className={cn(
        'relative aspect-square w-full overflow-hidden rounded-xl border border-line bg-black select-none',
        interactive && view.zoom > 1 && 'cursor-grab touch-none active:cursor-grabbing',
        className,
      )}
    >
      {/* Zoom by resizing the layer (not a CSS transform) so pixels stay sharp and labels keep their size. */}
      <div
        className="absolute"
        style={{
          width: `${view.zoom * 100}%`,
          height: `${view.zoom * 100}%`,
          left: `${(0.5 + view.zoom * (view.tx / 100 - 0.5)) * 100}%`,
          top: `${(0.5 + view.zoom * (view.ty / 100 - 0.5)) * 100}%`,
        }}
      >
        {layers.map((l) => (
          <img
            key={l.key}
            src={resolveAssetUrl(l.image.url)}
            alt={l.visible ? l.image.alt : ''}
            aria-hidden={!l.visible}
            draggable={false}
            decoding="async"
            onError={() => setFailed((f) => ({ ...f, [l.key]: true }))}
            className={cn('pixelated absolute inset-0 h-full w-full', l.visible ? 'opacity-100' : 'opacity-0')}
          />
        ))}

        {markers.length > 0 && !visibleFailed && (
          <>
            <svg viewBox={`0 0 ${width} ${height}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              {links.map((link) => {
                const arrow = arrowBetween(link);
                if (!arrow) return null;
                const selected = link.candidateId === selectedCandidateId;
                const stroke = selected ? RING_SELECTED : RING;
                return (
                  <g key={`link-${link.candidateId}`} opacity={hasSelection && !selected ? 0.45 : 0.95} fill="none" stroke={stroke} strokeWidth={selected ? 1.8 : 1.3} strokeLinecap="round" strokeLinejoin="round">
                    <line x1={arrow.x1} y1={arrow.y1} x2={arrow.x2} y2={arrow.y2} vectorEffect="non-scaling-stroke" />
                    <polyline points={arrow.head} vectorEffect="non-scaling-stroke" />
                  </g>
                );
              })}
              {markers.map(({ marker, ghost }) => {
                const { cx, cy } = markerCentre(marker);
                const selected = marker.candidateId === selectedCandidateId;
                const earlier = marker.role === 'reference-position';
                return (
                  <g key={`${marker.candidateId}-${marker.role}`} opacity={ghost ? 0.5 : hasSelection && !selected ? 0.55 : 1}>
                    {/* Dark halo keeps the ring legible over bright stars. */}
                    <circle cx={cx} cy={cy} r={marker.radiusPx} fill="none" stroke="rgb(0 0 0 / 0.65)" strokeWidth={selected ? 5 : 3.6} vectorEffect="non-scaling-stroke" />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={marker.radiusPx}
                      fill="none"
                      stroke={selected ? RING_SELECTED : RING}
                      strokeWidth={selected ? 2.4 : 1.5}
                      strokeDasharray={earlier ? '4 3' : undefined}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })}
            </svg>

            {markers.map(({ marker, ghost }) => {
              const { cx, cy } = markerCentre(marker);
              const selected = marker.candidateId === selectedCandidateId;
              const hit = Math.max(marker.radiusPx, 7);
              // One label per candidate per pane: on the later position when both are shown.
              const showLabel = !ghost && (marker.role !== 'reference-position' || !markers.some((p) => p.marker.candidateId === marker.candidateId && p.marker.role === 'target-position'));
              const labelLeft = cx / width > 0.72;
              return (
                <div key={`hit-${marker.candidateId}-${marker.role}`}>
                  {onSelectCandidate ? (
                    <button
                      type="button"
                      aria-label={markerAriaLabel(marker)}
                      aria-pressed={selected}
                      onClick={() => onSelectCandidate(marker.candidateId)}
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      style={{ left: `${(cx / width) * 100}%`, top: `${(cy / height) * 100}%`, width: `${((hit * 2) / width) * 100}%`, height: `${((hit * 2) / height) * 100}%` }}
                    />
                  ) : null}
                  {showLabel && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'num pointer-events-none absolute whitespace-nowrap rounded px-1 font-medium leading-4',
                        compact ? 'text-[10px]' : 'text-[11px]',
                        selected ? 'bg-white text-void' : 'bg-black/75 text-cyan',
                        hasSelection && !selected && 'opacity-60',
                      )}
                      style={{
                        left: `${((cx + (labelLeft ? -marker.radiusPx - 1.5 : marker.radiusPx + 1.5)) / width) * 100}%`,
                        top: `${((cy - marker.radiusPx) / height) * 100}%`,
                        transform: `translate(${labelLeft ? '-100%' : '0'}, -50%)`,
                      }}
                    >
                      {marker.label}
                    </span>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {visibleFailed && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink px-6 text-center text-sm text-mist">
          <AlertIcon size={20} className="text-rose" />
          <span className="font-medium text-rose">Image could not be loaded</span>
          <span>The data service did not return this image. Nothing has been substituted.</span>
        </div>
      )}

      {/* The classification label lives on the image itself so it survives screenshots. */}
      <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/75 backdrop-blur-sm">
        <ClassificationBadge classification={classification} />
      </div>
      {corner && <div className="pointer-events-none absolute right-2 top-2">{corner}</div>}
    </div>
  );
}
