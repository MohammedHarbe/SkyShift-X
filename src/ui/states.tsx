/** Loading / empty / unavailable / error presentation, shared by every data-driven view. */
import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { describeError, type ApiResult } from '@/api';
import { cn } from '@/lib/cn';
import { AlertIcon, InfoIcon } from './icons';
import { Button, Spinner } from './primitives';

export function LoadingState({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn('flex items-center gap-3 py-6 text-sm text-mist', className)}>
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, children, className }: { title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-dashed border-line px-4 py-5 text-sm', className)}>
      <div className="flex items-center gap-2 font-medium text-ice">
        <InfoIcon size={16} className="text-mist" />
        {title}
      </div>
      {children && <div className="mt-1.5 text-mist">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const { title, message } = describeError(error);
  return (
    <div role="alert" className={cn('rounded-xl border border-rose/40 bg-rose/[0.07] px-4 py-4 text-sm', className)}>
      <div className="flex items-center gap-2 font-medium text-rose">
        <AlertIcon size={16} />
        {title}
      </div>
      <p className="mt-1.5 text-mist">{message}</p>
      {onRetry && (
        <Button size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * Renders the right state for a query and hands validated data to `children`.
 * Errors are always shown; nothing is silently replaced.
 */
export function QueryBoundary<T>({
  query,
  children,
  loadingLabel,
  isEmpty,
  empty,
  className,
}: {
  query: UseQueryResult<ApiResult<T>>;
  children: (data: T, meta: ApiResult<T>['meta']) => ReactNode;
  loadingLabel?: string;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  className?: string;
}) {
  if (query.isPending) return query.fetchStatus === 'idle' ? null : <LoadingState label={loadingLabel} className={className} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} className={className} />;
  const { data, meta } = query.data;
  if (isEmpty?.(data)) return <>{empty ?? <EmptyState title="Nothing to show" className={className} />}</>;
  return <>{children(data, meta)}</>;
}
