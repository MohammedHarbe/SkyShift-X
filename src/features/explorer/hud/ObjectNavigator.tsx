import type { SolarSystemObject } from '@/contracts/v1';
import { cn } from '@/lib/cn';
import { Panel } from '@/ui';
import { GROUP_LABEL, groupOf, type ObjectGroup } from '../model';

const ORDER: ObjectGroup[] = ['planets', 'outer', 'mission', 'hypothesis'];

function Swatch({ object }: { object: SolarSystemObject }) {
  const hypothetical = object.status === 'hypothetical';
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', hypothetical && 'border border-dashed border-amber bg-transparent')}
      style={hypothetical ? undefined : { background: object.visual.color, boxShadow: `0 0 8px ${object.visual.color}66` }}
    />
  );
}

export interface ObjectNavigatorProps {
  objects: SolarSystemObject[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** `rail` = vertical grouped list (desktop); `strip` = one horizontal scroller (small screens). */
  layout: 'rail' | 'strip';
}

/** Keyboard-operable list of everything in the scene. This, not the 3D labels, is the accessible way to navigate. */
export function ObjectNavigator({ objects, selectedId, onSelect, layout }: ObjectNavigatorProps) {
  if (layout === 'strip') {
    return (
      <nav aria-label="Objects in the scene" className="pointer-events-auto overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
        <ul className="flex w-max gap-1.5">
          {ORDER.flatMap((g) => objects.filter((o) => groupOf(o) === g)).map((o) => {
            const current = o.id === selectedId;
            return (
              <li key={o.id}>
                <button
                  type="button"
                  aria-current={current ? 'true' : undefined}
                  onClick={() => onSelect(o.id)}
                  className={cn(
                    'glass flex h-8 items-center gap-2 rounded-full px-3 text-xs whitespace-nowrap transition-colors',
                    current ? 'border-cyan/60 text-cyan' : 'text-mist hover:text-ice',
                  )}
                >
                  <Swatch object={o} />
                  {o.name}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <Panel as="aside" padded={false} className="pointer-events-auto flex max-h-full w-60 flex-col overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <div className="eyebrow">Solar system</div>
        <h2 className="mt-0.5 text-[15px] font-medium text-ice">Objects</h2>
      </div>
      <nav aria-label="Objects in the scene" className="scroll-area min-h-0 flex-1 px-2 py-2">
        {ORDER.map((g) => {
          const items = objects.filter((o) => groupOf(o) === g);
          if (!items.length) return null;
          return (
            <div key={g} className="mb-2 last:mb-0">
              <h3 className="eyebrow px-2 pb-1 pt-1.5 text-[10px] text-dim">{GROUP_LABEL[g]}</h3>
              <ul>
                {items.map((o) => {
                  const current = o.id === selectedId;
                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        aria-current={current ? 'true' : undefined}
                        onClick={() => onSelect(o.id)}
                        className={cn(
                          'flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] leading-snug transition-colors [&>span:first-child]:mt-1',
                          current ? 'bg-cyan/12 text-cyan' : 'text-mist hover:bg-white/[0.05] hover:text-ice',
                        )}
                      >
                        <Swatch object={o} />
                        <span className="min-w-0 flex-1">
                          {o.name}
                          {o.status === 'hypothetical' && <span className="block text-[10px] uppercase tracking-wider text-amber">Hypothetical · not observed</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </Panel>
  );
}
