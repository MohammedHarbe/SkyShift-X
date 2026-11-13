/**
 * Educational diagrams. These are teaching illustrations, not data: each is drawn by hand as SVG
 * and is always shown with an "Illustrative diagram" label. Journeys reference them by id only.
 */
import type { ReactNode } from 'react';

const INK = '#e8f4ff';
const MIST = '#a3b8cf';
const CYAN = '#7fe3ff';
const AMBER = '#ffb648';
const BLUE = '#46aaff';

function Frame({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 800 380" role="img" aria-label={`${title}. ${desc}`} className="h-full max-h-[52vh] w-full">
      <title>{title}</title>
      <desc>{desc}</desc>
      {children}
    </svg>
  );
}

const label = { fill: MIST, fontSize: 14, fontFamily: 'inherit' } as const;
const strong = { fill: INK, fontSize: 15, fontFamily: 'inherit', fontWeight: 500 } as const;

function ApparentMotion() {
  // Earth at two points of its orbit; sight lines to a near and a far object, projected on distant stars.
  const e1 = { x: 120, y: 250 };
  const e2 = { x: 120, y: 130 };
  const near = { x: 330, y: 190 };
  const far = { x: 560, y: 190 };
  const wall = 730;
  const proj = (from: { x: number; y: number }, via: { x: number; y: number }) => from.y + ((via.y - from.y) * (wall - from.x)) / (via.x - from.x);
  const stars = [42, 78, 104, 151, 229, 262, 301, 338];
  return (
    <Frame title="Why nearby objects appear to move" desc="As Earth moves along its orbit, the line of sight to a nearby object swings across the distant stars by a large angle; for a far object the swing is much smaller.">
      <ellipse cx={70} cy={190} rx={52} ry={62} fill="none" stroke={MIST} strokeOpacity={0.35} strokeDasharray="4 5" />
      <circle cx={70} cy={190} r={13} fill="#ffd9a0" />
      <text x={70} y={282} textAnchor="middle" {...label}>Sun</text>
      {[e1, e2].map((e, i) => (
        <g key={i}>
          <circle cx={e.x} cy={e.y} r={7} fill="#4f8fdc" />
          <text x={e.x - 14} y={e.y + (i ? -12 : 24)} textAnchor="end" {...label}>{i ? 'Earth, later' : 'Earth, earlier'}</text>
        </g>
      ))}
      {[near, far].map((o, k) => (
        <g key={k}>
          {[e1, e2].map((e, i) => (
            <line key={i} x1={e.x} y1={e.y} x2={wall} y2={proj(e, o)} stroke={k ? MIST : CYAN} strokeOpacity={k ? 0.5 : 0.85} strokeWidth={1.2} strokeDasharray={i ? undefined : '5 4'} />
          ))}
          <circle cx={o.x} cy={o.y} r={5} fill={k ? MIST : CYAN} />
          <text x={o.x} y={o.y + 26} textAnchor="middle" {...(k ? label : strong)}>{k ? 'far object' : 'nearby object'}</text>
        </g>
      ))}
      <line x1={wall} y1={24} x2={wall} y2={356} stroke={MIST} strokeOpacity={0.3} />
      {stars.map((y) => (
        <circle key={y} cx={wall + 18 + ((y * 7) % 30)} cy={y} r={1.8} fill={INK} opacity={0.8} />
      ))}
      <text x={wall + 30} y={372} textAnchor="middle" {...label}>distant stars</text>
      {[near, far].map((o, k) => {
        const a = proj(e1, o);
        const b = proj(e2, o);
        return (
          <g key={k}>
            <line x1={wall - (k ? 8 : 20)} y1={a} x2={wall - (k ? 8 : 20)} y2={b} stroke={k ? MIST : AMBER} strokeWidth={3} strokeLinecap="round" />
            <text x={wall - (k ? 16 : 30)} y={(a + b) / 2 + (k ? 5 : -Math.abs(a - b) / 2 - 8)} textAnchor="end" {...(k ? label : { ...strong, fill: AMBER })}>
              {k ? 'small shift' : 'large shift'}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}

function Tile({ x, caption, children }: { x: number; caption: string; children: ReactNode }) {
  return (
    <g transform={`translate(${x} 70)`}>
      <rect width={200} height={200} rx={10} fill="#05080f" stroke={MIST} strokeOpacity={0.3} />
      {children}
      <text x={100} y={232} textAnchor="middle" {...strong}>{caption}</text>
    </g>
  );
}

const FIXED: [number, number, number][] = [
  [38, 44, 3.2], [152, 36, 2.2], [96, 78, 2.6], [170, 120, 3.6], [44, 150, 2.4], [118, 168, 2], [70, 108, 1.8], [150, 172, 2.8],
];

function DifferenceImaging() {
  const was: [number, number] = [78, 132];
  const now: [number, number] = [112, 112];
  const dots = (
    <>
      {FIXED.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={INK} />
      ))}
    </>
  );
  return (
    <Frame title="Difference imaging" desc="A later image minus an earlier image of the same sky. Fixed stars cancel. A source that moved leaves a blue mark where it was and an amber mark where it is now.">
      <Tile x={30} caption="Later image">
        {dots}
        <circle cx={now[0]} cy={now[1]} r={2.6} fill={INK} />
      </Tile>
      <text x={265} y={180} textAnchor="middle" fill={INK} fontSize={40} fontWeight={300}>−</text>
      <Tile x={300} caption="Earlier image">
        {dots}
        <circle cx={was[0]} cy={was[1]} r={2.6} fill={INK} />
      </Tile>
      <text x={535} y={182} textAnchor="middle" fill={INK} fontSize={36} fontWeight={300}>=</text>
      <Tile x={570} caption="Difference">
        {FIXED.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.2} fill={MIST} opacity={0.18} />
        ))}
        <circle cx={was[0]} cy={was[1]} r={5} fill={BLUE} />
        <circle cx={now[0]} cy={now[1]} r={5} fill={AMBER} />
        <path d={`M${was[0] + 6} ${was[1] - 4} L${now[0] - 7} ${now[1] + 4}`} stroke={INK} strokeWidth={1.2} strokeDasharray="3 3" />
      </Tile>
      <g transform="translate(570 322)">
        <circle cx={8} cy={0} r={5} fill={BLUE} />
        <text x={20} y={5} {...label}>was here</text>
        <circle cx={112} cy={0} r={5} fill={AMBER} />
        <text x={124} y={5} {...label}>is here now</text>
      </g>
      <text x={230} y={338} textAnchor="middle" {...label}>Same patch of sky, two dates</text>
    </Frame>
  );
}

function SpectralScan() {
  const visits = [
    { x: 250, lambda: '1.3 µm', date: 'Visit 1' },
    { x: 400, lambda: '2.1 µm', date: 'Visit 2' },
    { x: 550, lambda: '3.4 µm', date: 'Visit 3' },
  ];
  return (
    <Frame title="How SPHEREx builds spectra and time series" desc="Each exposure records one patch of sky at one wavelength. Repeat visits on later dates record it at other wavelengths, building a spectrum and a record of how the patch changes over time.">
      <defs>
        <linearGradient id="lvf" x1="0" x2="1">
          <stop offset="0" stopColor="#8fd0ff" />
          <stop offset="0.5" stopColor="#ffd08a" />
          <stop offset="1" stopColor="#ff7a5a" />
        </linearGradient>
      </defs>
      <text x={400} y={34} textAnchor="middle" {...strong}>Detector filter: wavelength changes across the field of view</text>
      <rect x={130} y={48} width={540} height={26} rx={6} fill="url(#lvf)" opacity={0.85} />
      <text x={130} y={94} {...label}>0.75 µm</text>
      <text x={670} y={94} textAnchor="end" {...label}>5.0 µm</text>
      {visits.map((v, i) => (
        <g key={i}>
          <line x1={v.x} y1={74} x2={v.x} y2={150} stroke={CYAN} strokeDasharray="3 4" />
          <rect x={v.x - 46} y={150} width={92} height={92} rx={8} fill="#05080f" stroke={CYAN} strokeOpacity={0.6} />
          {[[-22, -18, 2.4], [14, -8, 3.2], [-6, 20, 2], [26, 24, 1.8]].map(([dx, dy, r], k) => (
            <circle key={k} cx={v.x + dx!} cy={196 + dy!} r={r} fill={INK} opacity={0.5 + 0.15 * ((i + k) % 3)} />
          ))}
          <text x={v.x} y={264} textAnchor="middle" {...strong}>{v.date}</text>
          <text x={v.x} y={284} textAnchor="middle" {...label}>seen at {v.lambda}</text>
        </g>
      ))}
      <text x={120} y={200} textAnchor="middle" {...label}>
        <tspan x={120} dy={-8}>same patch</tspan>
        <tspan x={120} dy={18}>of sky</tspan>
      </text>
      <path d="M660 196 h44" stroke={MIST} strokeWidth={1.4} markerEnd="url(#arrow)" />
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0L10 5L0 10z" fill={MIST} />
        </marker>
      </defs>
      <text x={745} y={192} textAnchor="middle" {...label}>
        <tspan x={745} dy={0}>many more</tspan>
        <tspan x={745} dy={18}>visits</tspan>
      </text>
      <text x={400} y={338} textAnchor="middle" {...strong}>Many dates × many wavelengths = a spectrum, and a history of change</text>
    </Frame>
  );
}

export const DIAGRAMS = {
  'apparent-motion': ApparentMotion,
  'difference-imaging': DifferenceImaging,
  'spectral-scan': SpectralScan,
} as const;
