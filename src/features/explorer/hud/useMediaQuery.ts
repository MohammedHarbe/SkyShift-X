import { useSyncExternalStore } from 'react';

/** Subscribe to a CSS media query. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}

/** True from Tailwind's `lg` breakpoint up: side-by-side panels instead of a bottom sheet. */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
