/**
 * State shared between the persistent 3D canvas and everything that directs it
 * (explorer HUD, landing page, Discovery Journey player).
 */
import { create } from 'zustand';

export type Framing = 'close' | 'medium' | 'wide' | 'overview';
export type CameraTransition = 'travel' | 'cut';

export interface CameraRequest {
  targetId: string;
  framing: Framing;
  transition: CameraTransition;
  /** Increments on every request so repeating the same target still triggers a move. */
  nonce: number;
}

/** Simulated days per real second. 0.02 ≈ "real-ish", 365 = one Earth year per second. */
export const SIM_SPEEDS = [
  { value: 1, label: '1 day / s' },
  { value: 30, label: '1 month / s' },
  { value: 365, label: '1 year / s' },
  { value: 3650, label: '10 years / s' },
] as const;

export interface ExplorerState {
  selectedId: string | null;
  cameraRequest: CameraRequest | null;
  highlights: string[];
  simRunning: boolean;
  simSpeed: number;
  /** True while a journey or the landing page directs the camera: HUD hidden, pointer input ignored, slow drift allowed. */
  cinematic: boolean;
  quality: 'high' | 'low';
  webgl: 'unknown' | 'ok' | 'unavailable';

  /** Select an object (or clear) and fly the camera to it. */
  select: (id: string | null) => void;
  flyTo: (targetId: string, opts?: { framing?: Framing; transition?: CameraTransition }) => void;
  setHighlights: (ids: string[]) => void;
  setSimRunning: (running: boolean) => void;
  setSimSpeed: (daysPerSecond: number) => void;
  setCinematic: (cinematic: boolean) => void;
  setQuality: (q: 'high' | 'low') => void;
  setWebgl: (s: 'ok' | 'unavailable') => void;
}

let nonce = 0;

export const useExplorerStore = create<ExplorerState>((set) => ({
  selectedId: null,
  cameraRequest: null,
  highlights: [],
  simRunning: true,
  simSpeed: 30,
  cinematic: false,
  quality: 'high',
  webgl: 'unknown',

  select: (id) =>
    set(() =>
      id
        ? { selectedId: id, cameraRequest: { targetId: id, framing: 'medium', transition: 'travel', nonce: ++nonce } }
        : { selectedId: null },
    ),
  flyTo: (targetId, opts) =>
    set({
      cameraRequest: { targetId, framing: opts?.framing ?? 'medium', transition: opts?.transition ?? 'travel', nonce: ++nonce },
    }),
  setHighlights: (highlights) => set({ highlights }),
  setSimRunning: (simRunning) => set({ simRunning }),
  setSimSpeed: (simSpeed) => set({ simSpeed }),
  setCinematic: (cinematic) => set({ cinematic }),
  setQuality: (quality) => set({ quality }),
  setWebgl: (webgl) => set({ webgl }),
}));
