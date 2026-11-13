/**
 * StoryPlayer — plays a validated Journey segment by segment.
 *
 * Order of operations for every segment (this is the synchronisation contract):
 *   1. publish the new position           -> React renders the segment's visual
 *   2. await prepareVisual(segment)       -> data fetched, images decoded
 *   3. await afterPaint()                 -> the visual is actually on screen
 *   4. narration.speak(...)               -> voice or caption pacing begins
 *   5. on the narration's end event       -> advance to the next segment (back to 1)
 *
 * Nothing advances on a fixed timer. Every async continuation checks a run token, so selecting
 * another scene, another journey, or leaving the page makes all earlier callbacks inert.
 */
import type { Journey, Scene, Segment } from '@/contracts/v1';
import type { Chunk, NarrationController, NarrationStatus } from '@/narration';

export interface FlatSegment {
  index: number;
  sceneIndex: number;
  segmentIndex: number;
  scene: Scene;
  segment: Segment;
}

export function flattenJourney(journey: Journey): FlatSegment[] {
  const out: FlatSegment[] = [];
  journey.scenes.forEach((scene, sceneIndex) =>
    scene.segments.forEach((segment, segmentIndex) => out.push({ index: out.length, sceneIndex, segmentIndex, scene, segment })),
  );
  return out;
}

export type PlayerStatus = 'idle' | 'playing' | 'paused' | 'ended';

export interface PlayerState {
  status: PlayerStatus;
  /** Index into the flattened segment list. */
  index: number;
  sceneIndex: number;
  segmentIndex: number;
  /** True once the current visual has loaded and painted. */
  visualReady: boolean;
  /** Sentence currently being narrated, if any. */
  chunk: (Chunk & { index: number }) | null;
  /** Character offset (in the segment narration) of the word being spoken, when known. */
  wordAt: number | null;
  rate: number;
  muted: boolean;
  narration: NarrationStatus;
}

export interface PlayerDeps {
  narration: NarrationController;
  /** Load everything the segment's visual needs. Must never reject. */
  prepareVisual: (segment: Segment) => Promise<void>;
  /** Fire-and-forget warm-up for a segment that is coming up. */
  preload: (segment: Segment) => void;
  /** Resolves once the browser has painted the current React state. */
  afterPaint: () => Promise<void>;
}

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5] as const;

export class StoryPlayer {
  readonly segments: FlatSegment[];
  private state: PlayerState;
  private listeners = new Set<() => void>();
  private run = 0;
  private narrating = false;
  private disposed = false;

  constructor(
    readonly journey: Journey,
    private readonly deps: PlayerDeps,
  ) {
    this.segments = flattenJourney(journey);
    this.state = {
      status: 'idle',
      index: 0,
      sceneIndex: 0,
      segmentIndex: 0,
      visualReady: false,
      chunk: null,
      wordAt: null,
      rate: 1,
      muted: false,
      narration: deps.narration.status,
    };
    deps.narration.onStatus = (narration) => this.set({ narration });
    void deps.narration.prepare();
    // Show the opening visual straight away; narration waits for the user's click.
    void this.enter(0, false);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): PlayerState => this.state;

  get current(): FlatSegment {
    return this.segments[this.state.index]!;
  }

  /** Start from the beginning. MUST be called from a user gesture (click / key press). */
  begin(options: { muted?: boolean } = {}): void {
    this.deps.narration.unlock();
    if (options.muted !== undefined) this.setMuted(options.muted);
    this.set({ status: 'playing' });
    const run = ++this.run;
    void this.deps.narration.prepare().then(() => {
      if (run === this.run && !this.disposed) void this.enter(0, true);
    });
  }

  play(): void {
    if (this.state.status === 'idle' || this.state.status === 'ended') this.begin();
    else this.resume();
  }

  pause(): void {
    if (this.state.status !== 'playing') return;
    this.set({ status: 'paused' });
    if (this.narrating) this.deps.narration.pause();
  }

  resume(): void {
    if (this.state.status !== 'paused') return;
    this.deps.narration.unlock();
    this.set({ status: 'playing' });
    if (this.narrating) this.deps.narration.resume();
    else if (this.state.visualReady) this.narrate(this.run);
    // otherwise enter() is still preparing the visual and will start narration when it is ready
  }

  toggle(): void {
    if (this.state.status === 'playing') this.pause();
    else this.play();
  }

  next(): void {
    if (this.state.index + 1 < this.segments.length) void this.enter(this.state.index + 1, this.state.status === 'playing');
  }

  previous(): void {
    if (this.state.index > 0) void this.enter(this.state.index - 1, this.state.status === 'playing');
  }

  /** Jump to a scene (and optionally a segment within it), keeping the play/pause state. */
  goTo(sceneIndex: number, segmentIndex = 0): void {
    const target = this.segments.find((s) => s.sceneIndex === sceneIndex && s.segmentIndex === segmentIndex);
    if (target) void this.enter(target.index, this.state.status === 'playing');
  }

  /** Play the current scene again from its first segment. */
  replayScene(): void {
    const first = this.segments.find((s) => s.sceneIndex === this.state.sceneIndex);
    if (!first) return;
    this.deps.narration.unlock();
    void this.enter(first.index, true);
  }

  setRate(rate: number): void {
    this.set({ rate });
    this.deps.narration.setRate(rate);
  }

  setMuted(muted: boolean): void {
    this.set({ muted });
    this.deps.narration.setMuted(muted);
  }

  /** Stop everything. After this no callback from this player can fire. */
  dispose(): void {
    this.disposed = true;
    this.run++;
    this.narrating = false;
    this.deps.narration.cancel();
    this.deps.narration.onStatus = undefined;
    this.listeners.clear();
  }

  private set(patch: Partial<PlayerState>): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  private async enter(index: number, playing: boolean): Promise<void> {
    const item = this.segments[index];
    if (!item || this.disposed) return;
    const run = ++this.run;
    this.narrating = false;
    this.deps.narration.cancel(); // cancels the previous segment's narration and invalidates its callbacks
    const status: PlayerStatus = playing ? 'playing' : this.state.status === 'idle' ? 'idle' : 'paused';
    this.set({ status, index, sceneIndex: item.sceneIndex, segmentIndex: item.segmentIndex, visualReady: false, chunk: null, wordAt: null });

    const upcoming = this.segments[index + 1];
    if (upcoming) this.deps.preload(upcoming.segment);

    await this.deps.prepareVisual(item.segment);
    if (run !== this.run) return;
    await this.deps.afterPaint();
    if (run !== this.run) return;
    this.set({ visualReady: true });
    if (this.state.status === 'playing') this.narrate(run);
  }

  private narrate(run: number): void {
    const item = this.segments[this.state.index];
    if (!item) return;
    this.narrating = true;
    this.deps.narration.speak(item.segment.narration, this.state.rate, {
      onChunk: (i, chunk) => {
        if (run === this.run) this.set({ chunk: { ...chunk, index: i }, wordAt: null });
      },
      onWord: (charIndex) => {
        if (run === this.run) this.set({ wordAt: charIndex });
      },
      onDone: () => {
        if (run !== this.run) return;
        this.narrating = false;
        if (this.state.index + 1 < this.segments.length) void this.enter(this.state.index + 1, true);
        else {
          this.run++;
          this.set({ status: 'ended', chunk: null, wordAt: null });
        }
      },
    });
  }
}
