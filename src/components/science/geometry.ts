/**
 * Display geometry for the image viewers. Pure functions, no astronomy:
 * positions and candidates come from the API; this only decides where to draw them.
 */
import type { ComparisonMarker } from '@/contracts/v1';

/** Zoom and pan shared by every pane of a comparison. tx/ty are percent of the frame, applied before scaling. */
export interface ViewState {
  zoom: number;
  tx: number;
  ty: number;
}

export const INITIAL_VIEW: ViewState = { zoom: 1, tx: 0, ty: 0 };
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;

/** Keep the image covering the frame: no panning past its edges. */
export function clampView(v: ViewState): ViewState {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom));
  const limit = ((zoom - 1) / (2 * zoom)) * 100;
  const clamp = (t: number) => Math.min(limit, Math.max(-limit, t)) + 0; // + 0 normalises -0
  return { zoom, tx: clamp(v.tx), ty: clamp(v.ty) };
}

export function zoomBy(v: ViewState, factor: number): ViewState {
  return clampView({ ...v, zoom: Math.round(v.zoom * factor * 100) / 100 });
}

/**
 * Convert a point in the frame (fractions 0..1 from its top-left) to image pixel coordinates
 * (0-based, pixel centres at integers), taking the current zoom and pan into account.
 */
export function framePointToPixel(fx: number, fy: number, view: ViewState, width: number, height: number): { x: number; y: number } {
  const u = 0.5 + (fx - 0.5) / view.zoom - view.tx / 100;
  const v = 0.5 + (fy - 0.5) / view.zoom - view.ty / 100;
  return { x: u * width - 0.5, y: v * height - 0.5 };
}

export type Pane = 'reference' | 'target' | 'both';

export interface PaneMarker {
  marker: ComparisonMarker;
  /** Drawn faintly: the position belongs to the other epoch (shown for orientation). */
  ghost: boolean;
}

/** Which markers a pane shows. A reference pane shows where things were; a target pane where they are now. */
export function markersForPane(markers: ComparisonMarker[], pane: Pane): PaneMarker[] {
  return markers
    .filter((m) => pane !== 'reference' || m.role !== 'target-position')
    .map((marker) => ({
      marker,
      ghost: pane === 'target' && marker.role === 'reference-position',
    }));
}

export interface MarkerLink {
  candidateId: string;
  from: ComparisonMarker;
  to: ComparisonMarker;
}

/** Pair each candidate's earlier position with its later one. */
export function linkMarkers(markers: ComparisonMarker[]): MarkerLink[] {
  const links: MarkerLink[] = [];
  for (const from of markers) {
    if (from.role !== 'reference-position') continue;
    const to = markers.find((m) => m.candidateId === from.candidateId && m.role === 'target-position');
    if (to) links.push({ candidateId: from.candidateId, from, to });
  }
  return links;
}

/** Centre of a marker in SVG user units, where pixel i spans [i, i + 1]. */
export const markerCentre = (m: ComparisonMarker) => ({ cx: m.xPx + 0.5, cy: m.yPx + 0.5 });

export interface Arrow {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Polyline points for the arrow head. */
  head: string;
}

/**
 * Arrow showing the direction from the earlier position to the later one.
 * It runs between the ring edges; when the rings overlap (small displacement) it is drawn
 * between the two centres instead, so the direction is still readable. Null if the positions coincide.
 */
export function arrowBetween(link: MarkerLink, headSize = 1.8): Arrow | null {
  const a = markerCentre(link.from);
  const b = markerCentre(link.to);
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const dist = Math.hypot(dx, dy);
  if (!(dist > 2)) return null;
  const separated = dist - link.from.radiusPx - link.to.radiusPx > 1;
  const insetFrom = separated ? link.from.radiusPx : dist * 0.28;
  const insetTo = separated ? link.to.radiusPx : dist * 0.28;
  const ux = dx / dist;
  const uy = dy / dist;
  const x1 = a.cx + ux * insetFrom;
  const y1 = a.cy + uy * insetFrom;
  const x2 = b.cx - ux * insetTo;
  const y2 = b.cy - uy * insetTo;
  const h = Math.min(headSize, (dist - insetFrom - insetTo) * 0.6);
  // Two short barbs at +/-28 degrees from the shaft.
  const cos = Math.cos(0.49);
  const sin = Math.sin(0.49);
  const bx1 = x2 - h * (ux * cos - uy * sin);
  const by1 = y2 - h * (uy * cos + ux * sin);
  const bx2 = x2 - h * (ux * cos + uy * sin);
  const by2 = y2 - h * (uy * cos - ux * sin);
  const f = (n: number) => n.toFixed(2);
  return { x1, y1, x2, y2, head: `${f(bx1)},${f(by1)} ${f(x2)},${f(y2)} ${f(bx2)},${f(by2)}` };
}

const ROLE_TEXT: Record<ComparisonMarker['role'], string> = {
  'reference-position': 'position in the earlier image',
  'target-position': 'position in the later image',
  'static-position': 'same position in both images',
};

export function markerAriaLabel(m: ComparisonMarker): string {
  return `Candidate ${m.label}, ${ROLE_TEXT[m.role]}. Inspect.`;
}
