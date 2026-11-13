/** SkyShift X design-system primitives. Keep feature code free of ad-hoc styling for these patterns. */
import { useId, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import type { DataClassification, EpistemicStatus } from '@/contracts/v1';
import { cn } from '@/lib/cn';

/* ---------- Button ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

/** Class string for button-styled elements (use on <Link> too). */
export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', className?: string): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-200 select-none',
    'disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap',
    size === 'sm' && 'h-8 px-3.5 text-[13px]',
    size === 'md' && 'h-10 px-5 text-sm',
    size === 'lg' && 'h-12 px-7 text-[15px] tracking-wide',
    variant === 'primary' && 'bg-cyan text-void hover:bg-white shadow-[0_0_32px_-6px_rgb(127_227_255_/_0.65)]',
    variant === 'secondary' && 'border border-line-strong bg-white/[0.04] text-ice hover:bg-white/[0.1] hover:border-cyan/60',
    variant === 'ghost' && 'text-mist hover:text-ice hover:bg-white/[0.06]',
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant, size, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name; also shown as tooltip. Required because the button has no text. */
  label: string;
  active?: boolean;
  size?: 'sm' | 'md';
}

export function IconButton({ label, active, size = 'md', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none',
        size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
        active ? 'border-cyan/70 bg-cyan/15 text-cyan' : 'border-line bg-white/[0.03] text-mist hover:text-ice hover:border-line-strong hover:bg-white/[0.08]',
        className,
      )}
      {...rest}
    />
  );
}

/* ---------- Panel ---------- */

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: 'section' | 'aside' | 'div' | 'article';
  padded?: boolean;
}

export function Panel({ as: Tag = 'section', padded = true, className, ...rest }: PanelProps) {
  return <Tag className={cn('glass rounded-2xl', padded && 'p-5', className)} {...rest} />;
}

export function PanelHeading({ eyebrow, title, action }: { eyebrow?: string; title: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h2 className="text-lg font-medium leading-snug text-ice">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/* ---------- Badges ---------- */

type Tone = 'neutral' | 'cyan' | 'amber' | 'rose' | 'mint';

const TONE: Record<Tone, string> = {
  neutral: 'border-line-strong text-mist bg-white/[0.04]',
  cyan: 'border-cyan/45 text-cyan bg-cyan/10',
  amber: 'border-amber/50 text-amber bg-amber/10',
  rose: 'border-rose/50 text-rose bg-rose/10',
  mint: 'border-mint/45 text-mint bg-mint/10',
};

export function Badge({ tone = 'neutral', className, children, title }: { tone?: Tone; className?: string; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase leading-4 tracking-[0.08em]', TONE[tone], className)}>
      {children}
    </span>
  );
}

const EPISTEMIC: Record<EpistemicStatus, { label: string; tone: Tone; help: string }> = {
  established: { label: 'Established', tone: 'mint', help: 'Accepted science' },
  observed: { label: 'Observed', tone: 'cyan', help: 'A real measurement' },
  'model-derived': { label: 'Model-derived', tone: 'cyan', help: 'Output of a model or processing pipeline' },
  hypothesis: { label: 'Hypothesis', tone: 'amber', help: 'Proposed, not confirmed' },
  illustrative: { label: 'Illustrative', tone: 'neutral', help: 'A teaching visual, not data' },
  simulated: { label: 'Simulated', tone: 'amber', help: 'Synthetic data, not a real measurement' },
};

/** Shows how strongly a statement is supported. Use next to every scientific claim. */
export function EpistemicBadge({ status, className }: { status: EpistemicStatus; className?: string }) {
  const e = EPISTEMIC[status];
  return (
    <Badge tone={e.tone} title={e.help} className={className}>
      {e.label}
    </Badge>
  );
}

const CLASSIFICATION: Record<DataClassification, { label: string; tone: Tone }> = {
  'real-observation': { label: 'Real observation', tone: 'cyan' },
  simulated: { label: 'Simulated data', tone: 'amber' },
  'model-derived': { label: 'Model-derived', tone: 'cyan' },
  'artist-impression': { label: 'Artist impression', tone: 'neutral' },
  'illustrative-diagram': { label: 'Illustrative diagram', tone: 'neutral' },
  'procedural-visualization': { label: 'Visualisation', tone: 'neutral' },
};

/** Mandatory label for any image, chart or dataset: says what kind of thing the viewer is looking at. */
export function ClassificationBadge({ classification, className }: { classification: DataClassification; className?: string }) {
  const c = CLASSIFICATION[classification];
  return (
    <Badge tone={c.tone} className={className}>
      {c.label}
    </Badge>
  );
}

/* ---------- Segmented control ---------- */

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'md',
  className,
}: {
  /** Accessible group name. */
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-full border border-line bg-black/30 p-0.5', className)}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <label
            key={o.value}
            className={cn(
              'relative cursor-pointer rounded-full font-medium transition-colors duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-cyan',
              size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-[13px]',
              selected ? 'bg-cyan/15 text-cyan' : 'text-mist hover:text-ice',
              o.disabled && 'pointer-events-none opacity-40',
            )}
          >
            <input type="radio" className="sr-only" name={name} checked={selected} disabled={o.disabled} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

/* ---------- Data list ---------- */

export interface DataItem {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
}

export function DataList({ items, className }: { items: DataItem[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]', className)}>
      {items.map((it, i) => (
        <div key={i} className="contents">
          <dt className="text-dim">{it.label}</dt>
          <dd className={cn('min-w-0 break-words text-right text-ice', it.mono && 'num')}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- Misc ---------- */

export function Spinner({ className }: { className?: string }) {
  return <span role="presentation" className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-cyan/30 border-t-cyan', className)} />;
}

export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={cn('text-cyan underline decoration-cyan/40 underline-offset-2 hover:decoration-cyan', className)}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
