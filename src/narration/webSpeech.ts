/**
 * Narration through the browser's Web Speech API.
 *
 * Availability and voice quality depend on the browser, operating system and installed voices;
 * some browsers use network voices and fail offline. Every failure path reports through
 * `onError` so the controller can continue with captions.
 */
import type { NarrationAvailability, NarrationHandle, NarrationProvider, SpeakHandlers, SpeakRequest } from './types';

const START_TIMEOUT_MS = 5000;

function hasSpeech(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

function loadVoices(timeoutMs: number): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      synth.removeEventListener?.('voiceschanged', done);
      resolve(synth.getVoices());
    };
    const timer = setTimeout(done, timeoutMs);
    synth.addEventListener?.('voiceschanged', done);
  });
}

/** Prefer an on-device English voice: it works offline and starts fastest. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  const pool = en.length ? en : voices;
  return pool.find((v) => v.localService && v.default) ?? pool.find((v) => v.localService) ?? pool.find((v) => v.default) ?? pool[0] ?? null;
}

export class WebSpeechProvider implements NarrationProvider {
  readonly id = 'web-speech';
  readonly label = 'Browser voice';
  readonly audible = true;
  private voice: SpeechSynthesisVoice | null = null;

  async checkAvailability(): Promise<NarrationAvailability> {
    if (!hasSpeech()) return { available: false, reason: 'This browser does not support spoken narration.' };
    const voices = await loadVoices(1500);
    if (!voices.length) return { available: false, reason: 'No speech voice is available in this browser.' };
    this.voice = pickVoice(voices);
    return { available: true };
  }

  unlock(): void {
    if (!hasSpeech()) return;
    try {
      // A silent utterance spoken inside the click handler lets later, asynchronous speech through.
      const primer = new SpeechSynthesisUtterance(' ');
      primer.volume = 0;
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(primer);
    } catch {
      /* ignored: failure will surface on the first real utterance */
    }
  }

  speak(request: SpeakRequest, handlers: SpeakHandlers): NarrationHandle {
    const synth = window.speechSynthesis;
    let settled = false;
    const timers: { start?: ReturnType<typeof setTimeout>; stall?: ReturnType<typeof setTimeout> } = {};
    const settle = (after?: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timers.start);
      clearTimeout(timers.stall);
      after?.();
    };

    const rate = Math.min(2, Math.max(0.5, request.rate));
    const u = new SpeechSynthesisUtterance(request.text);
    u.rate = rate;
    if (this.voice) {
      u.voice = this.voice;
      u.lang = this.voice.lang;
    } else {
      u.lang = request.lang ?? 'en-US';
    }
    u.onstart = () => {
      clearTimeout(timers.start);
      handlers.onStart?.();
    };
    u.onboundary = (e) => {
      if (!settled && e.name !== 'sentence') handlers.onBoundary?.(e.charIndex);
    };
    u.onend = () => settle(handlers.onEnd);
    u.onerror = (e) =>
      settle(() => {
        // Our own cancel() settles first, so reaching here means the engine gave up.
        handlers.onError(e.error || 'speech error');
      });

    try {
      if (synth.speaking || synth.pending) synth.cancel();
      synth.resume();
      synth.speak(u);
    } catch (err) {
      settle(() => handlers.onError(err instanceof Error ? err.message : 'speech error'));
      return { cancel: () => undefined };
    }

    // Failure detection only (these never drive scene timing): engines can silently drop or stall an utterance.
    timers.start = setTimeout(
      () =>
        settle(() => {
          synth.cancel();
          handlers.onError('the voice did not start');
        }),
      START_TIMEOUT_MS,
    );
    const generousMs = (request.text.length * 140) / rate + 8000;
    timers.stall = setTimeout(
      () =>
        settle(() => {
          synth.cancel();
          handlers.onError('the voice stalled');
        }),
      generousMs,
    );

    return {
      cancel: () =>
        settle(() => {
          try {
            synth.cancel();
          } catch {
            /* nothing to cancel */
          }
        }),
    };
  }
}
