/**
 * Camera direction for the persistent 3D view.
 *
 * Responsibilities:
 *  - honour `cameraRequest` from the store (animated "travel" or instant "cut"),
 *  - keep following the target as it moves along its orbit,
 *  - hand control to the user (OrbitControls) when idle, and take it away in cinematic mode,
 *    where a very slow drift keeps the shot alive.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { useExplorerStore, type CameraRequest, type Framing } from '@/stores/explorer';
import { bodyRegistry, cameraState, FRAME, type BodyEntry } from './registry';

/** The parts of drei's OrbitControls this rig touches. */
interface ControlsLike {
  target: THREE.Vector3;
  enabled: boolean;
  minDistance: number;
  maxDistance: number;
  update: () => void;
}

interface Travel {
  t: number;
  duration: number;
  fromPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  /** Camera position relative to the (moving) target at the end of the flight. */
  offset: THREE.Vector3;
  lift: number;
}

const MAX_DISTANCE = 1300;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/** How far the camera sits from a target for each framing. */
function framingDistance(entry: BodyEntry, framing: Framing, aspect: number): number {
  // Wide structures need more room on portrait screens, where the horizontal field of view is narrow.
  const portrait = Math.max(1, 1.15 / aspect);
  if (entry.id === 'sun') return { close: 9, medium: 18, wide: 44, overview: 205 * portrait }[framing];
  if (entry.extent) return entry.extent * { close: 1.35, medium: 1.9, wide: 2.4, overview: 2.9 }[framing] * portrait;
  return Math.max(entry.radius, 0.22) * { close: 3.4, medium: 8, wide: 13, overview: 40 }[framing];
}

/** Unit vector from the target towards where the camera should sit. */
function shotDirection(entry: BodyEntry, framing: Framing): THREE.Vector3 {
  if (entry.extent || entry.id === 'sun') {
    // Elevated three-quarter view of the whole system.
    const elevation = framing === 'close' ? 0.38 : 0.62;
    return new THREE.Vector3(0.48, elevation, 0.78).normalize();
  }
  // For a body: stand on its sunward side, swung round and raised a little, so we see a lit
  // three-quarter phase with the outer solar system behind it.
  const sunward = entry.position.lengthSq() > 1e-6 ? entry.position.clone().multiplyScalar(-1).normalize() : new THREE.Vector3(0, 0, 1);
  return sunward.applyAxisAngle(Y_AXIS, 0.92).add(new THREE.Vector3(0, entry.cameraElevation ?? 0.26, 0)).normalize();
}

export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;
  const size = useThree((s) => s.size);
  const reducedMotion = useReducedMotion();

  const rig = useRef({
    handledNonce: -1,
    pending: null as CameraRequest | null,
    targetId: null as string | null,
    travel: null as Travel | null,
    target: new THREE.Vector3(),
    lastTargetPosition: new THREE.Vector3(),
    offset: new THREE.Vector3(),
  });

  useFrame((_, rawDt) => {
    const r = rig.current;
    const dt = Math.min(rawDt, 0.1);
    const { cameraRequest, cinematic } = useExplorerStore.getState();
    const aspect = size.width / Math.max(size.height, 1);

    if (cameraRequest && cameraRequest.nonce !== r.handledNonce) {
      r.pending = cameraRequest;
      r.handledNonce = cameraRequest.nonce;
    }
    // Before anyone has asked for a shot, show the whole system.
    if (!r.pending && !r.targetId && bodyRegistry.has('sun')) r.pending = { targetId: 'sun', framing: 'overview', transition: 'cut', nonce: -1 };

    if (r.pending) {
      const entry = bodyRegistry.get(r.pending.targetId);
      if (entry) {
        const offset = shotDirection(entry, r.pending.framing).multiplyScalar(framingDistance(entry, r.pending.framing, aspect));
        if (r.pending.transition === 'cut' || reducedMotion || !r.targetId) {
          r.travel = null;
          r.target.copy(entry.position);
          camera.position.copy(entry.position).add(offset);
        } else {
          const destination = entry.position.clone().add(offset);
          const distance = camera.position.distanceTo(destination);
          r.travel = {
            t: 0,
            duration: THREE.MathUtils.clamp(1.3 + 0.95 * Math.log10(1 + distance), 1.6, 3.8),
            fromPosition: camera.position.clone(),
            fromTarget: r.target.clone(),
            offset,
            lift: distance > 30 ? distance * 0.1 : 0,
          };
        }
        r.targetId = r.pending.targetId;
        r.lastTargetPosition.copy(entry.position);
        r.pending = null;
        if (controls) {
          controls.minDistance = entry.extent ? entry.extent * 0.2 : Math.max(entry.radius * 1.5, 0.45);
          controls.maxDistance = MAX_DISTANCE;
        }
      } else if (bodyRegistry.has('sun')) {
        r.pending = null; // objects are loaded and this id is not among them
      }
    }

    const entry = r.targetId ? bodyRegistry.get(r.targetId) : undefined;
    cameraState.targetId = r.targetId;
    cameraState.travelling = !!r.travel;
    if (!entry) return;

    if (r.travel) {
      const tr = r.travel;
      tr.t += dt / tr.duration;
      const k = easeInOut(Math.min(tr.t, 1));
      const kTarget = easeInOut(Math.min(tr.t * 1.3, 1)); // look at the destination a little before arriving
      camera.position.copy(entry.position).add(tr.offset).sub(tr.fromPosition).multiplyScalar(k).add(tr.fromPosition);
      camera.position.y += Math.sin(Math.PI * k) * tr.lift;
      r.target.copy(entry.position).sub(tr.fromTarget).multiplyScalar(kTarget).add(tr.fromTarget);
      if (tr.t >= 1) r.travel = null;
    } else {
      // Follow: carry the camera along with the target's own motion.
      camera.position.add(r.offset.copy(entry.position).sub(r.lastTargetPosition));
      r.target.copy(entry.position);
      if (cinematic && !reducedMotion) {
        r.offset.copy(camera.position).sub(r.target).applyAxisAngle(Y_AXIS, dt * 0.022);
        camera.position.copy(r.target).add(r.offset);
      }
    }
    r.lastTargetPosition.copy(entry.position);

    const userControl = !cinematic && !r.travel;
    if (controls) {
      controls.target.copy(r.target);
      controls.enabled = userControl;
    }
    // OrbitControls only orients the camera while enabled; otherwise we aim it ourselves.
    if (!controls || !userControl) camera.lookAt(r.target);
  }, FRAME.camera);

  return null;
}
