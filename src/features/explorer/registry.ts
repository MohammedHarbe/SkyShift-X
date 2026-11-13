/**
 * Per-frame scene state that must NOT live in React state (it changes 60 times a second):
 * the simulation clock and the current world position of every object, which the camera rig,
 * labels and selection markers read.
 */
import type { Vector3 } from 'three';

export interface BodyEntry {
  id: string;
  /** Current world position (mutated in place every frame). */
  position: Vector3;
  /** Rendered radius in scene units (for point-like bodies). */
  radius: number;
  /** For diffuse structures (belt, search region): the radius that must fit in view. */
  extent?: number;
  /** How far above the orbital plane the camera sits when framing this object (default: a low three-quarter view). */
  cameraElevation?: number;
}

export const bodyRegistry = new Map<string, BodyEntry>();

/**
 * useFrame priorities. Lower runs first; all are negative so react-three-fiber keeps rendering
 * automatically. The order matters: positions must be final before the camera reads them, and the
 * camera must be final before OrbitControls (priority -1) and the label projector (0) run.
 */
export const FRAME = { clock: -5, bodies: -4, satellites: -3, camera: -2 } as const;

/** Simulated days elapsed since the scene started. */
export const simClock = { days: 0 };

/** What the camera is currently following (set by the camera rig, read by labels). */
export const cameraState = { targetId: null as string | null, travelling: false };

/** Where an object's DOM label should be pinned. `position` is a live reference that bodies mutate. */
export interface LabelAnchor {
  id: string;
  position: Vector3;
  /** World units above `position` at which the label sits. */
  lift: number;
  /** Camera distance beyond which the label fades out (keeps far-out views uncluttered). */
  maxDistance: number;
}

export const labelAnchors = new Map<string, LabelAnchor>();
/** DOM nodes of the label layer, keyed by object id (set by LabelLayer, moved by LabelProjector). */
export const labelElements = new Map<string, HTMLElement>();

export function registerLabel(anchor: LabelAnchor): () => void {
  labelAnchors.set(anchor.id, anchor);
  return () => {
    if (labelAnchors.get(anchor.id) === anchor) labelAnchors.delete(anchor.id);
  };
}

export function registerBody(entry: BodyEntry): () => void {
  bodyRegistry.set(entry.id, entry);
  return () => {
    if (bodyRegistry.get(entry.id) === entry) bodyRegistry.delete(entry.id);
  };
}
