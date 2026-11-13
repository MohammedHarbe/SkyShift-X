import { create } from 'zustand';

export type Audience = 'beginner' | 'research';

const KEY = 'skyshift.audience';

function readAudience(): Audience {
  try {
    return localStorage.getItem(KEY) === 'research' ? 'research' : 'beginner';
  } catch {
    return 'beginner';
  }
}

interface UiState {
  /** Beginner = plain-language explanations; Research = full metadata, units and flags. Same data either way. */
  audience: Audience;
  setAudience: (a: Audience) => void;
}

export const useUiStore = create<UiState>((set) => ({
  audience: readAudience(),
  setAudience: (audience) => {
    try {
      localStorage.setItem(KEY, audience);
    } catch {
      /* storage unavailable: preference lasts for this visit only */
    }
    set({ audience });
  },
}));
