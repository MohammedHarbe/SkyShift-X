/**
 * Centralised API client. Every byte of scientific or story data enters the UI through `request`,
 * where it is validated against the v1 contract. Mock and live modes share this exact path.
 */
import type { z } from 'zod';
import { config } from '@/config/env';
import { envelope, ErrorEnvelope, type ResponseMeta } from '@/contracts/v1';
import { ApiError } from './errors';
import { getTransport } from './transport';

export interface ApiResult<T> {
  data: T;
  meta: ResponseMeta;
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  query?: Record<string, string | undefined>;
  body?: unknown;
  signal?: AbortSignal;
}

export async function request<S extends z.ZodType>(schema: S, path: string, options: RequestOptions = {}): Promise<ApiResult<z.output<S>>> {
  const { fetch: doFetch, baseUrl } = await getTransport();
  const url = new URL(`/api/v1${path}`, baseUrl);
  for (const [k, v] of Object.entries(options.query ?? {})) if (v !== undefined) url.searchParams.set(k, v);

  let response: Response;
  try {
    response = await doFetch(url, {
      method: options.method ?? 'GET',
      headers: { Accept: 'application/json', ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError('network', `Network error calling ${path}`, { details: cause });
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new ApiError(response.ok ? 'contract' : 'http', `Non-JSON response from ${path}`, { status: response.status });
  }

  if (!response.ok) {
    const err = ErrorEnvelope.safeParse(json);
    if (err.success)
      throw new ApiError('http', err.data.error.message, { status: response.status, code: err.data.error.code, details: err.data.error.details });
    throw new ApiError('http', `Request to ${path} failed with status ${response.status}`, { status: response.status });
  }

  const parsed = envelope(schema).safeParse(json);
  if (!parsed.success) {
    if (import.meta.env.DEV) console.error(`[api] contract violation for ${path}`, parsed.error.issues);
    throw new ApiError('contract', `Response from ${path} does not match API contract v1`, { status: response.status, details: parsed.error.issues });
  }
  const body = parsed.data as unknown as { data: z.output<S>; meta: ResponseMeta };
  return { data: body.data, meta: body.meta };
}

/**
 * Turn an image/download URL from the API into something the browser can load.
 * Absolute URLs pass through; relative ones resolve against the backend (live) or the app's own static files (mock).
 */
export function resolveAssetUrl(url: string): string {
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  const clean = url.replace(/^\/+/, '');
  return config.apiMode === 'live' ? `${config.apiBaseUrl}/${clean}` : new URL(clean, config.assetBase).href;
}
