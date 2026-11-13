import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSpeechProvider } from './webSpeech';

/** Minimal stand-in for the browser speech engine. */
class FakeUtterance {
  rate = 1;
  volume = 1;
  lang = '';
  voice: unknown = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onboundary: ((e: { name: string; charIndex: number }) => void) | null = null;
  constructor(public text: string) {}
}

function installSpeech(voices: { lang: string; localService: boolean; default: boolean; name: string }[]) {
  const spoken: FakeUtterance[] = [];
  const synth = {
    speaking: false,
    pending: false,
    getVoices: () => voices,
    speak: vi.fn((u: FakeUtterance) => void spoken.push(u)),
    cancel: vi.fn(),
    resume: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  return { synth, spoken };
}

const VOICE = { lang: 'en-GB', localService: true, default: false, name: 'Test voice' };

describe('WebSpeechProvider', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reports unavailable when the browser has no voices', async () => {
    installSpeech([]);
    const check = new WebSpeechProvider().checkAvailability();
    await vi.advanceTimersByTimeAsync(2000);
    await expect(check).resolves.toMatchObject({ available: false });
  });

  it('speaks with a local English voice and relays start, word boundaries and end', async () => {
    const { spoken } = installSpeech([{ lang: 'fr-FR', localService: true, default: true, name: 'fr' }, VOICE]);
    const provider = new WebSpeechProvider();
    await expect(provider.checkAvailability()).resolves.toEqual({ available: true });
    const events: string[] = [];
    provider.speak(
      { text: 'Hello distant world.', rate: 1.25 },
      { onStart: () => events.push('start'), onBoundary: (i) => events.push(`word@${i}`), onEnd: () => events.push('end'), onError: (r) => events.push(`error:${r}`) },
    );
    const u = spoken[0]!;
    expect(u.text).toBe('Hello distant world.');
    expect(u.rate).toBe(1.25);
    expect(u.voice).toBe(VOICE);
    u.onstart?.();
    u.onboundary?.({ name: 'word', charIndex: 6 });
    u.onend?.();
    u.onend?.(); // engines sometimes fire twice
    expect(events).toEqual(['start', 'word@6', 'end']);
  });

  it('reports an error if the voice never starts, and stays silent after cancel', async () => {
    const { spoken, synth } = installSpeech([VOICE]);
    const provider = new WebSpeechProvider();
    await provider.checkAvailability();
    const onError = vi.fn();
    provider.speak({ text: 'Never starts.', rate: 1 }, { onEnd: vi.fn(), onError });
    await vi.advanceTimersByTimeAsync(5100);
    expect(onError).toHaveBeenCalledWith('the voice did not start');

    const handlers = { onEnd: vi.fn(), onError: vi.fn() };
    const handle = provider.speak({ text: 'Cancelled.', rate: 1 }, handlers);
    handle.cancel();
    spoken.at(-1)!.onerror?.({ error: 'interrupted' });
    spoken.at(-1)!.onend?.();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(handlers.onEnd).not.toHaveBeenCalled();
    expect(handlers.onError).not.toHaveBeenCalled();
    expect(synth.cancel).toHaveBeenCalled();
  });

  it('reports an engine error such as a network voice failing', async () => {
    const { spoken } = installSpeech([VOICE]);
    const provider = new WebSpeechProvider();
    await provider.checkAvailability();
    const onError = vi.fn();
    provider.speak({ text: 'Fails.', rate: 1 }, { onEnd: vi.fn(), onError });
    spoken[0]!.onerror?.({ error: 'network' });
    expect(onError).toHaveBeenCalledWith('network');
  });
});
