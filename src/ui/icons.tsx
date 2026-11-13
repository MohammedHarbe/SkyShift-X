import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 18, children, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export const PlayIcon = (p: P) => <Svg {...p}><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" /></Svg>;
export const PauseIcon = (p: P) => <Svg {...p}><path d="M7 5v14M17 5v14" strokeWidth={2.6} /></Svg>;
export const NextIcon = (p: P) => <Svg {...p}><path d="M6 5l9 7-9 7z" fill="currentColor" stroke="none" /><path d="M18 5v14" strokeWidth={2.2} /></Svg>;
export const PrevIcon = (p: P) => <Svg {...p}><path d="M18 5l-9 7 9 7z" fill="currentColor" stroke="none" /><path d="M6 5v14" strokeWidth={2.2} /></Svg>;
export const ReplayIcon = (p: P) => <Svg {...p}><path d="M4 12a8 8 0 1 0 2.6-5.9" /><path d="M4 4v4.5h4.5" /></Svg>;
export const VolumeIcon = (p: P) => <Svg {...p}><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></Svg>;
export const MuteIcon = (p: P) => <Svg {...p}><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></Svg>;
export const CloseIcon = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const ChevronRightIcon = (p: P) => <Svg {...p}><path d="M9 5l7 7-7 7" /></Svg>;
export const ChevronLeftIcon = (p: P) => <Svg {...p}><path d="M15 5l-7 7 7 7" /></Svg>;
export const ChevronDownIcon = (p: P) => <Svg {...p}><path d="M5 9l7 7 7-7" /></Svg>;
export const InfoIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></Svg>;
export const AlertIcon = (p: P) => <Svg {...p}><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17v.5" /></Svg>;
export const SearchIcon = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></Svg>;
export const ExternalIcon = (p: P) => <Svg {...p}><path d="M14 5h5v5M19 5l-8 8M11 6H6v12h12v-5" /></Svg>;
export const SparkIcon = (p: P) => <Svg {...p}><path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" /></Svg>;
export const LayersIcon = (p: P) => <Svg {...p}><path d="M12 4l9 5-9 5-9-5z" /><path d="M3 14l9 5 9-5" /></Svg>;
export const TargetIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="7" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></Svg>;
export const TranscriptIcon = (p: P) => <Svg {...p}><path d="M5 5h14v14H5z" /><path d="M8 9h8M8 12h8M8 15h5" /></Svg>;
export const GlobeIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></Svg>;
export const ClockIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5.5l3.5 2" /></Svg>;
export const ZoomInIcon = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5M11 8v6M8 11h6" /></Svg>;
export const ZoomOutIcon = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5M8 11h6" /></Svg>;
export const MenuIcon = (p: P) => <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>;
