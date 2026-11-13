import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Journey } from '@/contracts/v1';
import { CaptionPaceProvider, NarrationController, WebSpeechProvider } from '@/narration';
import { StoryPlayer, type PlayerState } from './player/StoryPlayer';
import { prepareCue } from './prepare';

/** Two animation frames: the first commits React's render, the second follows the paint. */
const afterPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/** Creates a StoryPlayer for a journey and tears it down (cancelling narration) when the journey changes or the view unmounts. */
export function useStoryPlayer(journey: Journey): StoryPlayer | null {
  const queryClient = useQueryClient();
  const [player, setPlayer] = useState<StoryPlayer | null>(null);

  useEffect(() => {
    const instance = new StoryPlayer(journey, {
      narration: new NarrationController(new WebSpeechProvider(), new CaptionPaceProvider()),
      prepareVisual: (segment) => prepareCue(queryClient, segment.visual),
      preload: (segment) => void prepareCue(queryClient, segment.visual),
      afterPaint,
    });
    setPlayer(instance);
    return () => {
      instance.dispose();
      setPlayer(null);
    };
  }, [journey, queryClient]);

  return player;
}

export function usePlayerState(player: StoryPlayer): PlayerState {
  return useSyncExternalStore(player.subscribe, player.getState, player.getState);
}
