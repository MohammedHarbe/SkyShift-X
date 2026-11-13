/**
 * Persistent question input. Sends the question plus what the user is looking at to POST /journeys.
 * In demo mode only prepared journeys exist; anything else is declined in plain words.
 */
import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { describeError, isApiError, useAskJourney } from '@/api';
import type { JourneyContext } from '@/contracts/v1';
import { cn } from '@/lib/cn';
import { useUiStore } from '@/stores/ui';
import { Button, CloseIcon, SparkIcon, Spinner } from '@/ui';

export interface AskBarProps {
  /** What the user is currently looking at; sent with the question. */
  context?: JourneyContext;
  /** One-tap example questions. */
  suggestions?: string[];
  placeholder?: string;
  className?: string;
  /** Tighter layout for use inside panels. */
  compact?: boolean;
}

export function AskBar({ context = {}, suggestions = [], placeholder = 'Ask about what you are seeing…', className, compact }: AskBarProps) {
  const [question, setQuestion] = useState('');
  const inputId = useId();
  const navigate = useNavigate();
  const audience = useUiStore((s) => s.audience);
  const ask = useAskJourney();

  const submit = (text: string) => {
    const q = text.trim();
    if (!q || ask.isPending) return;
    ask.mutate(
      { question: q, context, audience },
      { onSuccess: (res) => navigate(`/journey/${res.data.id}`, { state: { question: q } }) },
    );
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(question);
  };

  const err = ask.error;
  const more = isApiError(err) && err.code === 'unsupported_in_demo' ? ((err.details as { suggestions?: string[] } | undefined)?.suggestions ?? []) : [];
  const chips = more.length ? more : suggestions;

  return (
    <div className={cn('w-full', className)}>
      <form onSubmit={onSubmit} className={cn('glass flex items-center gap-2 rounded-full pl-4 pr-1.5', compact ? 'h-11' : 'h-13 py-1.5')}>
        <SparkIcon size={18} className="shrink-0 text-cyan" />
        <label htmlFor={inputId} className="sr-only">
          Ask a question
        </label>
        <input
          id={inputId}
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            if (ask.isError) ask.reset();
          }}
          placeholder={placeholder}
          maxLength={500}
          autoComplete="off"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm text-ice placeholder:text-dim focus:outline-none"
        />
        <Button type="submit" variant="primary" size="sm" disabled={!question.trim() || ask.isPending}>
          {ask.isPending ? <Spinner className="border-void/30 border-t-void" /> : 'Ask'}
        </Button>
      </form>

      {ask.isError && (
        <div role="alert" className="glass mt-2 flex items-start gap-3 rounded-2xl px-4 py-3 text-[13px]">
          <div className="min-w-0 flex-1">
            <div className="font-medium text-amber">{describeError(ask.error).title}</div>
            <p className="mt-0.5 text-mist">{describeError(ask.error).message}</p>
          </div>
          <button type="button" onClick={() => ask.reset()} aria-label="Dismiss" className="rounded-full p-1 text-mist hover:text-ice">
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Example questions">
          {chips.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setQuestion(s);
                submit(s);
              }}
              disabled={ask.isPending}
              className="rounded-full border border-line bg-black/40 px-3 py-1 text-xs text-mist transition-colors hover:border-cyan/50 hover:text-ice disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
