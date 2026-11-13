/**
 * Chooses how requests leave the app. This is the ONLY module allowed to touch the mock router.
 *
 *   live -> real `fetch` against VITE_API_BASE_URL. Failures surface as errors; there is no fallback.
 *   mock -> the in-process mock API (same Request/Response contract).
 */
import { config } from '@/config/env';

export interface Transport {
  fetch: typeof fetch;
  baseUrl: string;
}

let transport: Promise<Transport> | null = null;

export function getTransport(): Promise<Transport> {
  transport ??=
    config.apiMode === 'live'
      ? Promise.resolve({ fetch: (input, init) => fetch(input, init), baseUrl: config.apiBaseUrl })
      : import('@/mocks/router').then((m) => ({
          fetch: m.createMockFetch({ latencyMs: config.mockLatencyMs }),
          baseUrl: 'http://mock.skyshift.local',
        }));
  return transport;
}

/** Test hook: replace the transport (e.g. to simulate a failing live backend). */
export function setTransportForTests(t: Transport | null): void {
  transport = t ? Promise.resolve(t) : null;
}
