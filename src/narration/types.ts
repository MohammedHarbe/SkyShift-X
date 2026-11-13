/**
 * Narration provider contract.
 *
 * The StoryPlayer never talks to a speech engine directly. It asks a provider to speak one short
 * chunk of text and waits for `onEnd`. Visuals advance on that event, never on a fixed timer.
 *
 * To add premium narration later (pre-rendered audio + timestamped captions), implement this
 * interface with an <audio> element: `onBoundary` from caption timestamps, `onEnd` from the
 * `ended` event. Nothing else in the app needs to change.
 */
export interface SpeakRequest {
  text: string;
  /** Playback speed multiplier, 1 = normal. */
  rate: number;
  lang?: string;
}

export interface SpeakHandlers {
  onStart?: () => void;
  /** Character offset (within `text`) of the word now being spoken, when the engine reports it. */
  onBoundary?: (charIndex: number) => void;
  onEnd: () => void;
  /** The provider could not speak this text. Not called for deliberate cancellation. */
  onError: (reason: string) => void;
}

export interface NarrationHandle {
  /** Stop immediately. No further handlers fire. */
  cancel: () => void;
}

export interface NarrationAvailability {
  available: boolean;
  /** Plain-language reason shown to the user when unavailable. */
  reason?: string;
}

export interface NarrationProvider {
  readonly id: string;
  readonly label: string;
  /** false for providers that only pace captions. */
  readonly audible: boolean;
  checkAvailability: () => Promise<NarrationAvailability>;
  /** Called synchronously inside a user gesture so browsers that gate audio allow later speech. */
  unlock?: () => void;
  speak: (request: SpeakRequest, handlers: SpeakHandlers) => NarrationHandle;
}
