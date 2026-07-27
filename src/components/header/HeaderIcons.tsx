/**
 * HeaderIcons.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Minimal line-art icon set for the top toolbar (Header.tsx).
 *
 * Unlike the node-palette icons in ../Icons.tsx (which are colored badges),
 * these use `currentColor` so they inherit whatever color the surrounding
 * button already carries (default, cyan, orange, green, red, ...).
 */

import React from 'react';

type IconProps = { size?: number };

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  style: { flexShrink: 0 } as React.CSSProperties,
};

export const PlayIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <svg width={size} height={size} {...base}>
    <path d="M6 4.5v15l13-7.5-13-7.5z" fill="currentColor" />
  </svg>
);

export const PauseIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <svg width={size} height={size} {...base}>
    <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
    <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
  </svg>
);

export const CopyIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <svg width={size} height={size} {...base}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M15.5 8.5V6a1.5 1.5 0 00-1.5-1.5H6A1.5 1.5 0 004.5 6v8A1.5 1.5 0 006 15.5h2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export const ClipboardIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <svg width={size} height={size} {...base}>
    <rect x="5.5" y="5" width="13" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    <rect x="9" y="3.5" width="6" height="3" rx="1" fill="currentColor" />
    <path d="M8.5 11.5h7M8.5 15h7M8.5 18h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const GridIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <svg width={size} height={size} {...base}>
    <rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7" />
    <rect x="13" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7" />
    <rect x="4" y="13" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7" />
    <rect x="13" y="13" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

export const ServerRackIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <svg width={size} height={size} {...base}>
    <rect x="4.5" y="3.5" width="15" height="17" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M4.5 9.5h15M4.5 15h15" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="7.5" cy="6.5" r="0.9" fill="currentColor" />
    <circle cx="7.5" cy="12" r="0.9" fill="currentColor" />
    <circle cx="7.5" cy="17.5" r="0.9" fill="currentColor" />
  </svg>
);

export const PresentationIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <svg width={size} height={size} {...base}>
    <rect x="3.5" y="4.5" width="17" height="11" rx="1.3" stroke="currentColor" strokeWidth="1.7" />
    <path d="M9.5 8.5l4 3-4 3v-6z" fill="currentColor" />
    <path d="M12 15.5V19M8.5 19h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export const StopIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <svg width={size} height={size} {...base}>
    <rect x="5.5" y="5.5" width="13" height="13" rx="1.5" fill="currentColor" />
  </svg>
);

export const CameraIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <svg width={size} height={size} {...base}>
    <path d="M4 8.5A1.5 1.5 0 015.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0120 8.5v9A1.5 1.5 0 0118.5 19h-13A1.5 1.5 0 014 17.5v-9z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

export const SaveIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <svg width={size} height={size} {...base}>
    <path d="M12 3.5v10.5M12 14l-4-4M12 14l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.5 15v3.5A1.5 1.5 0 006 20h12a1.5 1.5 0 001.5-1.5V15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const FolderOpenIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <svg width={size} height={size} {...base}>
    <path d="M4 7.5A1.5 1.5 0 015.5 6h4l2 2h7A1.5 1.5 0 0120 9.5v.5H6.2a1.5 1.5 0 00-1.45 1.11L3 18V7.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M4.75 18l1.72-6.4A1.5 1.5 0 018.9 10.5h10.6a1 1 0 01.96 1.28l-1.7 5.42a1.5 1.5 0 01-1.43 1.05H5.7a1 1 0 01-.95-1.25z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

export const GearIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <svg width={size} height={size} {...base}>
    <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.7" />
    <path
      d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <svg width={size} height={size} {...base}>
    <path d="M4.5 12a7.5 7.5 0 0113-5.1M19.5 12a7.5 7.5 0 01-13 5.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M17.5 3.5v3.5H14M6.5 20.5V17H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const UndoIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <svg width={size} height={size} {...base}>
    <path d="M7 8H16.5A4.5 4.5 0 0121 12.5v0A4.5 4.5 0 0116.5 17H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10.5 4.5L7 8l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const RedoIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <svg width={size} height={size} {...base}>
    <path d="M17 8H7.5A4.5 4.5 0 003 12.5v0A4.5 4.5 0 007.5 17H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.5 4.5L17 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 14 }) => (
  <svg width={size} height={size} {...base}>
    <path d="M5 7h14M9.5 7V5a1 1 0 011-1h3a1 1 0 011 1v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M7 7l.8 12a1.5 1.5 0 001.5 1.4h5.4a1.5 1.5 0 001.5-1.4L17 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10.2 10.5v6M13.8 10.5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
