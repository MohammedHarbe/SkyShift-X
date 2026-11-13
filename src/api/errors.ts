import type { ApiErrorCode } from '@/contracts/v1';

export type ApiErrorKind =
  /** Could not reach the server at all. */
  | 'network'
  /** Server answered with a non-2xx status. */
  | 'http'
  /** Server answered 2xx but the body did not match the v1 contract. */
  | 'contract';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: ApiErrorCode;
  readonly details?: unknown;

  constructor(kind: ApiErrorKind, message: string, extra: { status?: number; code?: ApiErrorCode; details?: unknown } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = extra.status;
    this.code = extra.code;
    this.details = extra.details;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** Text safe to show to a user for any thrown value. */
export function describeError(e: unknown): { title: string; message: string } {
  if (isApiError(e)) {
    if (e.kind === 'network')
      return { title: 'Cannot reach the data service', message: 'The request did not get through. No substitute data is shown.' };
    if (e.kind === 'contract')
      return { title: 'Unexpected response from the data service', message: 'The service replied in a format this version of SkyShift X does not understand.' };
    if (e.code === 'not_found') return { title: 'Not found', message: e.message };
    if (e.code === 'unsupported_in_demo') return { title: 'Not available in demo mode', message: e.message };
    return { title: 'The data service reported a problem', message: e.message };
  }
  return { title: 'Something went wrong', message: e instanceof Error ? e.message : 'Unknown error' };
}
