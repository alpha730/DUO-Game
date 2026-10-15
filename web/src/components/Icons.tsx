// Small inline icons (24×24, currentColor) — no icon font or library to download.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = ({ size = 24, ...p }: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
  ...p,
});

export const HomeIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 11 12 4l8.5 7" />
    <path d="M6 9.5V19a1 1 0 0 0 1 1h3.5v-5h3v5H17a1 1 0 0 0 1-1V9.5" />
  </svg>
);

export const DexIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="4" width="7" height="7" rx="2" />
    <rect x="13.5" y="4" width="7" height="7" rx="2" />
    <rect x="3.5" y="14" width="7" height="7" rx="2" />
    <rect x="13.5" y="14" width="7" height="7" rx="2" />
  </svg>
);

export const ScanIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
    <circle cx="12" cy="12" r="3.6" />
  </svg>
);

export const TrophyIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
    <path d="M8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3M12 13v3.5M8.5 20h7M9.5 20l.8-3.5h3.4l.8 3.5" />
  </svg>
);

export const UserIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8.5" r="3.8" />
    <path d="M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5" />
  </svg>
);

export const CloseIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const MicIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
  </svg>
);

export const SoundIcon = ({ off, ...p }: P & { off?: boolean }) => (
  <svg {...base(p)}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    {off ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />}
  </svg>
);

export const ShareIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 15V4M8 7.5 12 3.5l4 4M6 11v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8" />
  </svg>
);

/** Filled icons (fill = currentColor). */
export const FlameIcon = ({ size = 20, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...p}>
    <path
      fill="currentColor"
      d="M12.6 2.2c.3 3-1.1 4.6-2.6 6.2C8.4 10.1 6.5 12 6.5 15a5.5 5.5 0 0 0 11 0c0-2.3-1-4-2.1-5.3-.2 1.3-.8 2.3-1.8 2.9.4-3.6-.6-7.6-1-10.4Z"
    />
    <path fill="var(--det-snow)" fillOpacity=".45" d="M12 21a3 3 0 0 1-3-3c0-1.7 1.2-2.7 2.3-4 .3 1.2 1 1.8 1.8 2.1.7.3 1.9 1 1.9 2a3 3 0 0 1-3 2.9Z" />
  </svg>
);

/** Points coin: a star on a round coin. */
export const CoinIcon = ({ size = 20, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...p}>
    <circle cx="12" cy="12" r="10" fill="var(--gold)" />
    <circle cx="12" cy="12" r="10" fill="none" stroke="var(--gold-dark)" strokeWidth="2" />
    <path fill="var(--gold-dark)" d="m12 6.3 1.7 3.6 3.9.4-2.9 2.7.8 3.9-3.5-2-3.5 2 .8-3.9-2.9-2.7 3.9-.4z" />
  </svg>
);

export const StarIcon = ({ size = 18, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...p}>
    <path fill="currentColor" d="m12 2.8 2.8 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17l-5.7 3.1 1.2-6.3-4.6-4.4 6.3-.8z" />
  </svg>
);

export const BoltIcon = ({ size = 18, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...p}>
    <path fill="currentColor" d="M13.5 2 5 13.5h6L10 22l9-12h-6.2z" />
  </svg>
);

/** DET-style tick: filled green circle with a check (login list, skills, results). */
export const CheckIcon = ({ size = 26, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...p}>
    <circle cx="12" cy="12" r="11" fill="var(--primary)" />
    <path d="m7 12.4 3.2 3.1L17 8.8" fill="none" stroke="var(--surface)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** DET-style clock for the question timer ("0:12 for this question"). */
export const ClockIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
