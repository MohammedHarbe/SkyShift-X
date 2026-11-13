/**
 * Speaks one narration segment at a time, sentence by sentence, through whichever provider is
 * usable, and tells the caller when the segment is finished.
 *
 * Guarantees:
 *  - Starting, cancelling or re-starting narration invalidates every callback of the previous run
 *    (generation counter), so a stale `onend` can never advance a newer scene.
 *  - If the voice fails at any point, narration continues with captions and the user is told why.
 */
import { splitIntoChunks, type Chunk } from './chunks';
import type { NarrationHandle, NarrationProvider } from './types';

export interface NarrationStatus {
  /** What is driving narration right now. */
  mode: 'voice' | 'captions';
  /** null until availability has been checked. */
  voiceAvailable: boolean | null;
  /** Shown to the user when voice is not being used although sound is on. */
  notice: string | null;
}

export interface SegmentCallbacks {
  onChunk?: (index: number, chunk: Chunk) => void;
  /** Character offset within the full segment text. */
  onWord?: (charIndex: number) => void;
  onDone: () => void;
}

interface Current {
  chunks: Chunk[];
  index: number;
  rate: number;
  callbacks: SegmentCallbacks;
}

export class NarrationController {
  onStatus?: (status: NarrationStatus) => void;

  private generation = 0;
  private handle: NarrationHandle | null = null;
  private current: Current | null = null;
  private paused = false;
  private muted = false;
  private voiceAvailable: boolean | null = null;
  private notice: string | null = null;
  private preparing: Promise<void> | null = null;

  constructor(
    private readonly voice: NarrationProvider,
    private readonly captions: NarrationProvider,
  ) {}

  get status(): NarrationStatus {
    return {
      mode: !this.muted && this.voiceAvailable ? 'voice' : 'captions',
      voiceAvailable: this.voiceAvailable,
      notice: this.muted ? null : this.notice,
    };
  }

  /** Check once whether a voice exists. Safe to call repeatedly. */
  prepare(): Promise<void> {
    this.preparing ??= this.voice
      .checkAvailability()
      .catch(() => ({ available: false, reason: 'Spoken narration could not be started.' }))
      .then((a) => {
        this.voiceAvailable = a.available;
        this.notice = a.available ? null : `${a.reason ?? 'Spoken narration is unavailable.'} Captions will play instead.`;
        this.emit();
      });
    return this.preparing;
  }

  /** Call synchronously from the click that starts playback. */
  unlock(): void {
    this.voice.unlock?.();
  }

  speak(text: string, rate: number, callbacks: SegmentCallbacks): void {
    this.cancel();
    this.current = { chunks: splitIntoChunks(text), index: 0, rate, callbacks };
    this.speakChunk();
  }

  pause(): void {
    if (!this.current || this.paused) return;
    this.paused = true;
    this.stop();
  }

  /** Resumes at the start of the sentence that was interrupted (reliable on every engine). */
  resume(): void {
    if (!this.current || !this.paused) return;
    this.paused = false;
    this.speakChunk();
  }

  cancel(): void {
    this.stop();
    this.current = null;
    this.paused = false;
  }

  setRate(rate: number): void {
    if (!this.current) return;
    this.current.rate = rate;
    if (!this.paused) this.speakChunk();
  }

  setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    this.emit();
    if (this.current && !this.paused) this.speakChunk();
  }

  private emit(): void {
    this.onStatus?.(this.status);
  }

  private stop(): void {
    this.generation++;
    this.handle?.cancel();
    this.handle = null;
  }

  private speakChunk(): void {
    const cur = this.current;
    if (!cur) return;
    this.stop();
    const generation = this.generation;
    const chunk = cur.chunks[cur.index];
    if (!chunk) {
      this.current = null;
      cur.callbacks.onDone();
      return;
    }
    cur.callbacks.onChunk?.(cur.index, chunk);
    const provider = !this.muted && this.voiceAvailable ? this.voice : this.captions;
    const live = () => generation === this.generation;
    this.handle = provider.speak(
      { text: chunk.text, rate: cur.rate },
      {
        onBoundary: (i) => {
          if (live()) cur.callbacks.onWord?.(chunk.start + i);
        },
        onEnd: () => {
          if (!live()) return;
          this.handle = null;
          cur.index++;
          this.speakChunk();
        },
        onError: (reason) => {
          if (!live()) return;
          this.handle = null;
          if (provider.audible) {
            // Voice failed: say so, then carry on with captions from the same sentence.
            this.voiceAvailable = false;
            this.notice = `Spoken narration stopped (${reason}). Captions will continue.`;
            this.emit();
          } else {
            cur.index++;
          }
          this.speakChunk();
        },
      },
    );
  }
}
