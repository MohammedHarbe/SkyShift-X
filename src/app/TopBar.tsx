import { useState } from 'react';
import { Link, NavLink } from 'react-router';
import { useHealth } from '@/api';
import { config } from '@/config/env';
import { cn } from '@/lib/cn';
import { useUiStore, type Audience } from '@/stores/ui';
import { Badge, CloseIcon, MenuIcon, Segmented } from '@/ui';
import type { Section } from './Shell';

const NAV = [
  { to: '/explore', label: 'Explore' },
  { to: '/time', label: 'Time Explorer' },
  { to: '/journey/journey-moving-source', label: 'Journey' },
  { to: '/mission', label: 'Mission & sources' },
];

/** Tells the visitor, at all times, whether they are looking at demo or live data. */
function DataModeBadge() {
  const health = useHealth();
  if (health.isError)
    return (
      <Badge tone="rose" title="The data service could not be reached. No substitute data is shown.">
        Data service unreachable
      </Badge>
    );
  if (config.apiMode === 'mock')
    return (
      <Badge tone="amber" title="All observations, candidates and spectra in this build are simulated.">
        Demo · simulated data
      </Badge>
    );
  if (health.isPending)
    return (
      <Badge tone="neutral" title={`Connecting to ${config.apiBaseUrl}`}>
        Connecting…
      </Badge>
    );
  // The service itself says whether what it serves is real: never label simulated data as live observations.
  const simulated = health.data.meta.dataOrigin === 'mock' || !health.data.data.capabilities.liveObservations;
  return simulated ? (
    <Badge tone="amber" title={`Connected to ${config.apiBaseUrl}. The service reports that its observations are simulated.`}>
      Live service · simulated data
    </Badge>
  ) : (
    <Badge tone="cyan" title={`Connected to ${config.apiBaseUrl}`}>
      Live data
    </Badge>
  );
}

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-full pr-2" aria-label="SkyShift X home">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="12" cy="18" r="5.5" fill="none" stroke="#7fe3ff" strokeWidth="1.6" />
        <circle cx="22" cy="11" r="2.6" fill="#7fe3ff" />
        <path d="M16 15.5l3.6-2.6" stroke="#7fe3ff" strokeWidth="1.2" strokeDasharray="1.6 1.6" />
      </svg>
      <span className="text-[13px] font-semibold tracking-[0.28em] text-ice">
        SKYSHIFT <span className="text-cyan">X</span>
      </span>
    </Link>
  );
}

export function TopBar({ section }: { section: Section }) {
  const audience = useUiStore((s) => s.audience);
  const setAudience = useUiStore((s) => s.setAudience);
  const [open, setOpen] = useState(false);
  const minimal = section === 'landing';

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn('rounded-full px-3 py-1.5 text-[13px] transition-colors', isActive ? 'bg-white/[0.08] text-ice' : 'text-mist hover:text-ice');

  return (
    <header className={cn('absolute inset-x-0 top-0 z-40 h-14', !minimal && 'border-b border-line bg-ink/70 backdrop-blur-xl')}>
      <div className="flex h-full items-center gap-3 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Primary" className="ml-3 hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={linkClass}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:block">
            <DataModeBadge />
          </div>
          {!minimal && (
            <div className="hidden md:block">
              <Segmented<Audience>
                label="Explanation level"
                size="sm"
                value={audience}
                onChange={setAudience}
                options={[
                  { value: 'beginner', label: 'Beginner' },
                  { value: 'research', label: 'Research' },
                ]}
              />
            </div>
          )}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-mist hover:text-ice lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon size={16} /> : <MenuIcon size={16} />}
          </button>
        </div>
      </div>
      {open && (
        <div id="mobile-nav" className="glass mx-3 mt-1 rounded-2xl p-3 lg:hidden">
          <nav aria-label="Primary" className="flex flex-col gap-1">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={linkClass} onClick={() => setOpen(false)}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <DataModeBadge />
            <Segmented<Audience>
              label="Explanation level"
              size="sm"
              value={audience}
              onChange={setAudience}
              options={[
                { value: 'beginner', label: 'Beginner' },
                { value: 'research', label: 'Research' },
              ]}
            />
          </div>
        </div>
      )}
    </header>
  );
}
