import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Journey } from '@/contracts/v1';
import { CaptionPaceProvider, NarrationController, splitIntoChunks, type NarrationProvider, type SpeakHandlers } from '@/narration';
import { StoryPlayer, type PlayerDeps } from './StoryPlayer';

const journey = Journey.parse({
  id: 'j',
  title: 'T',
  subtitle: 'S',
  estimatedMinutes: 1,
  sceneCount: 2,
  generation: { mode: 'prepared', disclosure: 'test' },
  scenes: [
    {
      id: 's1',
      title: 'One',
      segments: [
        { id: 's1a', narration: 'First sentence. Second sentence.', visual: { type: 'diagram', diagramId: 'apparent-motion', caption: 'c' } },
        { id: 's1b', narration: 'Third.', visual: { type: 'diagram', diagramId: 'difference-imaging', caption: 'c' } },
      ],
    },
    { id: 's2', title: 'Two', segments: [{ id: 's2a', narration: 'Fourth.', visual: { type: 'diagram', diagramId: 'spectral-scan', caption: 'c' } }] },
  ],
});

/** A scripted voice: records what it was asked to say and ends only when the test says so. */
class FakeVoice implements NarrationProvider {
  readonly id = 'fake';
  readonly label = 'fake';
  readonly audible = true;
  available = true;
  spoken: string[] = [];
  private pending: { handlers: SpeakHandlers; cancelled: boolean }[] = [];
  checkAvailability = () => Promise.resolve({ available: this.available, reason: 'No voice' });
  unlock = vi.fn();
  speak(req: { text: string }, handlers: SpeakHandlers) {
    this.spoken.push(req.text);
    const entry = { handlers, cancelled: false };
    this.pending.push(entry);
    return { cancel: () => void (entry.cancelled = true) };
  }
  /** Finish the most recent utterance (as the engine would). */
  end() {
    this.pending.at(-1)!.handlers.onEnd();
  }
  /** Fire `onend` of an OLD utterance, as buggy engines sometimes do after cancellation. */
  endStale(n: number) {
    this.pending[n]!.handlers.onEnd();
  }
  fail(reason = 'synthesis-failed') {
    this.pending.at(-1)!.handlers.onError(reason);
  }
}

function setup(voice = new FakeVoice()) {
  const order: string[] = [];
  let releaseVisual: (() => void) | null = null;
  const deps: PlayerDeps = {
    narration: new NarrationController(voice, new CaptionPaceProvider()),
    prepareVisual: (segment) => {
      order.push(`prepare:${segment.id}`);
      return new Promise<void>((resolve) => {
        releaseVisual = () => {
          order.push(`ready:${segment.id}`);
          resolve();
        };
      });
    },
    preload: (segment) => void order.push(`preload:${segment.id}`),
    afterPaint: () => Promise.resolve(),
  };
  const origSpeak = voice.speak.bind(voice);
  voice.speak = (req, h) => {
    order.push(`speak:${req.text}`);
    return origSpeak(req, h);
  };
  const player = new StoryPlayer(journey, deps);
  const flush = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  };
  const visualReady = async () => {
    await flush(); // let begin()/enter() reach prepareVisual
    releaseVisual?.();
    releaseVisual = null;
    await flush();
  };
  return { player, voice, order, flush, visualReady };
}

describe('splitIntoChunks', () => {
  it('splits sentences but not decimals', () => {
    const chunks = splitIntoChunks('It covers 0.75 to 5 micrometres. It launched in 2025! Why?');
    expect(chunks.map((c) => c.text)).toEqual(['It covers 0.75 to 5 micrometres.', 'It launched in 2025!', 'Why?']);
    const text = 'A b. C d.';
    for (const c of splitIntoChunks(text)) expect(text.slice(c.start, c.end)).toBe(c.text);
  });
});

describe('StoryPlayer synchronisation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not narrate until the user starts playback', async () => {
    const { player, voice, visualReady } = setup();
    await visualReady();
    expect(player.getState().status).toBe('idle');
    expect(player.getState().visualReady).toBe(true);
    expect(voice.spoken).toEqual([]);
  });

  it('shows the visual before narration starts, then advances on the narration end event', async () => {
    const { player, voice, order, flush, visualReady } = setup();
    await visualReady();
    order.length = 0;
    player.begin();
    expect(voice.unlock).toHaveBeenCalled();
    await flush();
    expect(voice.spoken).toEqual([]); // visual for segment 1 not ready yet
    await visualReady();
    expect(order).toEqual(['preload:s1b', 'prepare:s1a', 'ready:s1a', 'speak:First sentence.']);
    expect(player.getState().chunk?.text).toBe('First sentence.');

    await vi.advanceTimersByTimeAsync(60_000); // time passing alone must not advance anything
    expect(player.getState().index).toBe(0);

    voice.end();
    expect(voice.spoken.at(-1)).toBe('Second sentence.');
    voice.end();
    await flush();
    expect(player.getState().index).toBe(1);
    expect(voice.spoken).toHaveLength(2); // segment 2 visual still loading
    await visualReady();
    expect(voice.spoken.at(-1)).toBe('Third.');
  });

  it('ignores a stale end callback after the user jumps to another scene', async () => {
    const { player, voice, visualReady } = setup();
    await visualReady();
    player.begin();
    await visualReady();
    expect(voice.spoken).toEqual(['First sentence.']);
    player.goTo(1);
    await visualReady();
    expect(player.getState().sceneIndex).toBe(1);
    expect(voice.spoken.at(-1)).toBe('Fourth.');
    voice.endStale(0); // late `onend` from the cancelled first utterance
    await Promise.resolve();
    expect(player.getState().sceneIndex).toBe(1);
    expect(player.getState().status).toBe('playing');
    expect(voice.spoken.at(-1)).toBe('Fourth.');
  });

  it('pauses, resumes from the interrupted sentence, and reaches the end', async () => {
    const { player, voice, flush, visualReady } = setup();
    await visualReady();
    player.begin();
    await visualReady();
    voice.end(); // now on "Second sentence."
    player.pause();
    expect(player.getState().status).toBe('paused');
    voice.endStale(1); // engine reports end after pause(): must be ignored
    expect(player.getState().index).toBe(0);
    player.resume();
    expect(voice.spoken.at(-1)).toBe('Second sentence.');
    voice.end();
    await flush();
    await visualReady();
    voice.end();
    await flush();
    await visualReady();
    voice.end();
    await flush();
    expect(player.getState().status).toBe('ended');
  });

  it('keeps its position when paused and the user steps through scenes', async () => {
    const { player, voice, visualReady } = setup();
    await visualReady();
    player.begin();
    await visualReady();
    player.pause();
    const said = voice.spoken.length;
    player.next();
    await visualReady();
    expect(player.getState()).toMatchObject({ index: 1, status: 'paused', visualReady: true });
    expect(voice.spoken).toHaveLength(said);
    player.previous();
    await visualReady();
    expect(player.getState().index).toBe(0);
  });

  it('falls back to captions with a notice when the voice fails mid-journey, and still finishes', async () => {
    const { player, voice, flush, visualReady } = setup();
    await visualReady();
    player.begin();
    await visualReady();
    voice.fail('network');
    expect(player.getState().narration).toMatchObject({ mode: 'captions', voiceAvailable: false });
    expect(player.getState().narration.notice).toMatch(/Captions will continue/);
    for (let i = 0; i < 6 && player.getState().status !== 'ended'; i++) {
      await vi.advanceTimersByTimeAsync(20_000);
      await visualReady();
    }
    await vi.advanceTimersByTimeAsync(20_000);
    await flush();
    expect(player.getState().status).toBe('ended');
  });

  it('plays with captions only when no voice is installed', async () => {
    const voice = new FakeVoice();
    voice.available = false;
    const { player, visualReady } = setup(voice);
    await visualReady();
    player.begin();
    await visualReady();
    expect(player.getState().narration.mode).toBe('captions');
    expect(player.getState().narration.notice).toMatch(/Captions will play instead/);
    expect(voice.spoken).toEqual([]);
    expect(player.getState().chunk?.text).toBe('First sentence.');
    await vi.advanceTimersByTimeAsync(400);
    expect(player.getState().wordAt).not.toBeNull();
  });

  it('muting switches to caption pacing without losing position; dispose silences everything', async () => {
    const { player, voice, visualReady } = setup();
    await visualReady();
    player.begin();
    await visualReady();
    player.setMuted(true);
    expect(player.getState()).toMatchObject({ muted: true, index: 0 });
    expect(player.getState().narration.mode).toBe('captions');
    const listener = vi.fn();
    player.subscribe(listener);
    player.dispose();
    voice.endStale(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(listener).not.toHaveBeenCalled();
  });
});
