import { describe, expect, it } from 'vitest';
import type { ComparisonMarker } from '@/contracts/v1';
import { arrowBetween, clampView, framePointToPixel, INITIAL_VIEW, linkMarkers, markerCentre, markersForPane, zoomBy } from './geometry';

const m = (candidateId: string, role: ComparisonMarker['role'], xPx: number, yPx: number): ComparisonMarker => ({
  candidateId,
  label: candidateId.toUpperCase(),
  role,
  xPx,
  yPx,
  radiusPx: 5,
  position: { raDeg: 10, decDeg: 10, frame: 'ICRS' },
});

const markers = [m('a', 'reference-position', 58.4, 88.2), m('a', 'target-position', 66.3, 84.9), m('b', 'static-position', 31.6, 119.3), m('c', 'reference-position', 105.2, 40.7)];

describe('viewer geometry', () => {
  it('clamps zoom and pan so the image always covers the frame', () => {
    expect(clampView({ zoom: 0.2, tx: 30, ty: -30 })).toEqual({ zoom: 1, tx: 0, ty: 0 });
    const v = clampView({ zoom: 2, tx: 90, ty: -90 });
    expect(v).toEqual({ zoom: 2, tx: 25, ty: -25 });
    expect(clampView({ zoom: 100, tx: 0, ty: 0 }).zoom).toBe(8);
    expect(zoomBy(INITIAL_VIEW, 2).zoom).toBe(2);
  });

  it('maps frame points to image pixels, with pixel centres at integers', () => {
    // Centre of the frame is the centre of a 150 px image: between pixels 74 and 75.
    expect(framePointToPixel(0.5, 0.5, INITIAL_VIEW, 150, 150)).toEqual({ x: 74.5, y: 74.5 });
    // Top-left corner of the frame is the outer corner of pixel 0.
    expect(framePointToPixel(0, 0, INITIAL_VIEW, 150, 150)).toEqual({ x: -0.5, y: -0.5 });
    // Zoomed 2x with no pan, the frame shows the central half of the image.
    const p = framePointToPixel(0, 0, { zoom: 2, tx: 0, ty: 0 }, 150, 150);
    expect(p.x).toBeCloseTo(37, 6);
    // Panning right by 25% at 2x brings the image's left edge to the frame's left edge.
    expect(framePointToPixel(0, 0.5, { zoom: 2, tx: 25, ty: 0 }, 150, 150).x).toBeCloseTo(-0.5, 6);
  });

  it('shows earlier positions on the reference pane and later ones on the target pane', () => {
    const ref = markersForPane(markers, 'reference');
    expect(ref.map((p) => p.marker.role)).toEqual(['reference-position', 'static-position', 'reference-position']);
    expect(ref.every((p) => !p.ghost)).toBe(true);
    const tgt = markersForPane(markers, 'target');
    expect(tgt).toHaveLength(4);
    expect(tgt.filter((p) => p.ghost).map((p) => p.marker.role)).toEqual(['reference-position', 'reference-position']);
    expect(markersForPane(markers, 'both').every((p) => !p.ghost)).toBe(true);
  });

  it('links a candidate’s earlier and later positions and draws an arrow between the rings', () => {
    const links = linkMarkers(markers);
    expect(links).toHaveLength(1);
    expect(links[0]!.candidateId).toBe('a');
    // The simulated mover shifts 8.6 px, less than two ring radii: the arrow sits between the centres.
    const inner = arrowBetween(links[0]!)!;
    const from = markerCentre(links[0]!.from);
    const to = markerCentre(links[0]!.to);
    const dist = Math.hypot(to.cx - from.cx, to.cy - from.cy);
    expect(Math.hypot(inner.x1 - from.cx, inner.y1 - from.cy)).toBeCloseTo(dist * 0.28, 5);
    expect(Math.hypot(inner.x2 - from.cx, inner.y2 - from.cy)).toBeLessThan(dist);
    // Well-separated rings: the shaft starts and ends on the ring edges (5 px from each centre).
    const far = { candidateId: 'x', from: m('x', 'reference-position', 10, 10), to: m('x', 'target-position', 60, 40) };
    const arrow = arrowBetween(far)!;
    expect(Math.hypot(arrow.x1 - 10.5, arrow.y1 - 10.5)).toBeCloseTo(5, 5);
    expect(Math.hypot(arrow.x2 - 60.5, arrow.y2 - 40.5)).toBeCloseTo(5, 5);
    // Coincident positions get no arrow.
    expect(arrowBetween({ candidateId: 'y', from: m('y', 'reference-position', 10, 10), to: m('y', 'target-position', 11, 10) })).toBeNull();
  });
});
