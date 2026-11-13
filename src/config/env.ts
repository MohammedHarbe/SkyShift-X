/** Runtime configuration, read once from Vite env. See .env.example. */
export type ApiMode = 'mock' | 'live';

const raw = import.meta.env;

function parseMode(v: unknown): ApiMode {
  return v === 'live' ? 'live' : 'mock';
}

export const config = {
  apiMode: parseMode(raw.VITE_API_MODE),
  apiBaseUrl: String(raw.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(/\/+$/, ''),
  mockLatencyMs: Number(raw.VITE_MOCK_LATENCY_MS ?? 250),
  router: raw.VITE_ROUTER === 'browser' ? ('browser' as const) : ('hash' as const),
  /** Base path the static app is served from (always ends with "/"). */
  assetBase: new URL(raw.BASE_URL || './', typeof document !== 'undefined' ? document.baseURI : 'http://localhost/').href,
} as const;
