import { useEffect, useId, useRef } from 'react';
import { SIM_SPEEDS, useExplorerStore } from '@/stores/explorer';
import { IconButton, PauseIcon, PlayIcon } from '@/ui';
import { simClock } from '../registry';
import { DAYS_PER_YEAR } from '../scale';

function formatElapsed(days: number): string {
  if (days < 60) return `${days.toFixed(0)} days`;
  const years = days / DAYS_PER_YEAR;
  return years < 10 ? `${years.toFixed(1)} years` : `${Math.round(years).toLocaleString('en-US')} years`;
}

/** Play / pause and speed of the orbital simulation, with a read-out of simulated time elapsed. */
export function SimControls() {
  const running = useExplorerStore((s) => s.simRunning);
  const speed = useExplorerStore((s) => s.simSpeed);
  const setRunning = useExplorerStore((s) => s.setSimRunning);
  const setSpeed = useExplorerStore((s) => s.setSimSpeed);
  const selectId = useId();
  const readout = useRef<HTMLSpanElement>(null);

  // The clock changes every frame; write the read-out straight to the DOM a few times a second.
  useEffect(() => {
    const paint = () => {
      if (readout.current) readout.current.textContent = formatElapsed(simClock.days);
    };
    paint();
    const t = window.setInterval(paint, 400);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="glass pointer-events-auto flex h-11 shrink-0 items-center gap-2 rounded-full pl-1.5 pr-4" role="group" aria-label="Orbit simulation">
      <IconButton label={running ? 'Pause orbital motion' : 'Play orbital motion'} size="sm" active={running} onClick={() => setRunning(!running)}>
        {running ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
      </IconButton>
      <label htmlFor={selectId} className="sr-only">
        Simulation speed
      </label>
      <select
        id={selectId}
        value={speed}
        onChange={(e) => setSpeed(Number(e.target.value))}
        className="h-8 rounded-full border border-line bg-black/40 px-2.5 text-xs text-ice focus:outline-none focus-visible:outline-2 focus-visible:outline-cyan"
      >
        {SIM_SPEEDS.map((s) => (
          <option key={s.value} value={s.value} className="bg-ink text-ice">
            {s.label}
          </option>
        ))}
      </select>
      <span className="hidden whitespace-nowrap text-xs text-dim sm:inline" title="Simulated time elapsed since the view opened">
        +<span ref={readout} className="num text-mist" />
      </span>
    </div>
  );
}
