/**
 * Silent narration: paces captions at a comfortable reading speed and emits the same
 * start / word-boundary / end events as a voice would. Used when sound is muted or no voice exists,
 * so a journey plays identically with or without audio. Pace derives from the words themselves
 * (count, length, punctuation) and the chosen speed, not from a per-scene duration.
 */
import type { NarrationAvailability, NarrationHandle, NarrationProvider, SpeakHandlers, SpeakRequest } from './types';

const WORDS_PER_MINUTE = 165;

export class CaptionPaceProvider implements NarrationProvider {
  readonly id = 'caption-pace';
  readonly label = 'Captions only';
  readonly audible = false;

  checkAvailability(): Promise<NarrationAvailability> {
    return Promise.resolve({ available: true });
  }

  speak(request: SpeakRequest, handlers: SpeakHandlers): NarrationHandle {
    const words = [...request.text.matchAll(/\S+/g)].map((m) => ({ at: m.index ?? 0, word: m[0] }));
    const base = 60000 / (WORDS_PER_MINUTE * Math.min(2, Math.max(0.5, request.rate)));
    let i = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      if (cancelled) return;
      const w = words[i++];
      if (!w) {
        handlers.onEnd();
        return;
      }
      handlers.onBoundary?.(w.at);
      const length = base * (0.55 + Math.min(w.word.length, 12) / 11);
      const pause = /[.!?]["')\]]*$/.test(w.word) ? base * 1.5 : /[,;:]$/.test(w.word) ? base * 0.55 : 0;
      timer = setTimeout(tick, length + pause);
    };

    handlers.onStart?.();
    timer = setTimeout(tick, 0);

    return {
      cancel: () => {
        cancelled = true;
        clearTimeout(timer);
      },
    };
  }
}
