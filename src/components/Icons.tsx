/**
 * Icons.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * All SVG icon components used across the simulator UI in one place.
 *
 * PREVIOUSLY these were exported from Sidebar.tsx, which coupled the
 * sidebar's implementation details to CustomNodes.tsx and any other
 * consumer.  Moving them here:
 *   • Sidebar.tsx no longer needs to export non-sidebar concerns.
 *   • CustomNodes.tsx imports from a dedicated icons module — no circular
 *     dependency risk.
 *   • Adding a new icon is a single-file change.
 *
 * USAGE
 * ─────
 *   import { MapIcon, AppIcon, SpanIcon } from '../components/Icons';
 */

import React from 'react';

// ─── AppIcon ──────────────────────────────────────────────────────────────────
/**
 * Polymorphic icon for GigaSMART application types.
 * The `type` prop is matched case-insensitively against known action names.
 * Falls back to a generic blue square for unknown types.
 *
 * @param rate  Optional deduplication rate (0-100) rendered as a percentage
 *              overlay — only meaningful when type === 'Deduplication'.
 */
export const AppIcon: React.FC<{ type: string; size?: number; rate?: number }> = ({ type, size = 20, rate }) => {
  const t = type.toLowerCase().replace(/\s+/g, '-');

  switch (t) {
    case 'metadata':
    case 'application-metadata':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <path d="M14.5 6.5l4 4L10 19H6v-4l8.5-8.5z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="9.5" cy="14.5" r="1" fill="white"/>
        </svg>
      );
    case 'visualization':
    case 'application-visualization':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <path d="M4 12s3.5-5.5 8-5.5 8 5.5 8 5.5-3.5 5.5-8 5.5-8-5.5-8-5.5z" stroke="white" strokeWidth="1.5" fill="none"/>
          <circle cx="12" cy="12" r="2.5" stroke="white" strokeWidth="1.5"/>
        </svg>
      );
    case '5g-cloud':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <path d="M6.5 13.5a2.5 2.5 0 011.2-4.8 3.5 3.5 0 016.6 1 2.5 2.5 0 011.2 3.8H6.5z" stroke="white" strokeWidth="1.2" fill="none"/>
          <text x="12" y="15.5" fill="white" fontSize="5.5" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">5G</text>
        </svg>
      );
    case 'dedup':
    case 'deduplication':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          {/* Render the live deduplication rate percentage when provided */}
          <text x="12" y="12" fill="white" fontSize={rate !== undefined ? "12" : "13"} fontFamily="Inter, sans-serif" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
            {rate !== undefined ? `${Math.round(rate)}%` : '%'}
          </text>
        </svg>
      );
    case 'gvhttp2':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <rect x="4.5" y="7.5" width="15" height="9" rx="1" stroke="white" strokeWidth="1.2" fill="none"/>
          <text x="12" y="13.5" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">GV HTTP2</text>
        </svg>
      );
    case 'headerstripping':
    case 'header-stripping':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.5" strokeDasharray="2 2" fill="none"/>
          <path d="M12 4.5v3M12 16.5v3M4.5 12h3M16.5 12h3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      );
    case 'load-balancing':
    case 'giga-stream':
    case 'gigastream-lb':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <path d="M6 7.5h12M6 12h12M6 16.5h12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M14 5.5l2 2-2 2M14 10l2 2-2 2M14 14.5l2 2-2 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'masking':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <circle cx="12" cy="12" r="5" stroke="white" strokeWidth="1.5" fill="none"/>
          <path d="M12 7a5 5 0 010 10V7z" fill="white"/>
        </svg>
      );
    case 'amx':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <path d="M12 6.5v10M9 9.5l3-3 3 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 17.5h8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      );
    case 'ami':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <path d="M12 6.5v10M9 9.5l3-3 3 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 17.5h8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      );
    case 'pcapng':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <path d="M7 6.5h6l4 4V18H7V6.5z" stroke="white" strokeWidth="1.2" fill="none"/>
          <path d="M13 6.5V10h3.5" stroke="white" strokeWidth="1.2"/>
          <rect x="9" y="12" width="6" height="4.5" rx="0.5" stroke="white" strokeWidth="1" fill="none"/>
          <circle cx="12" cy="14.2" r="0.7" fill="white"/>
        </svg>
      );
    case '5g-sbi':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <text x="8" y="14" fill="white" fontSize="5.5" fontFamily="sans-serif" fontWeight="bold">5G</text>
          <path d="M15.5 11.5c.5-.5 1-.5 1.5 0M15.5 13.5c.5.5 1 .5 1.5 0" stroke="white" strokeWidth="1" strokeLinecap="round"/>
          <circle cx="16" cy="12.5" r="0.8" fill="white"/>
        </svg>
      );
    case 'sbipoe':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <rect x="6" y="6" width="3.5" height="3.5" rx="0.5" stroke="white" strokeWidth="1.2" fill="none"/>
          <rect x="14.5" y="6" width="3.5" height="3.5" rx="0.5" stroke="white" strokeWidth="1.2" fill="none"/>
          <rect x="10.25" y="14.5" width="3.5" height="3.5" rx="0.5" stroke="white" strokeWidth="1.2" fill="none"/>
          <path d="M7.75 9.5v2.5h8.5V9.5M12 12v2.5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      );
    case 'slicing':
    case 'packet-slicing':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <circle cx="12" cy="12" r="5" stroke="white" strokeWidth="1.5" strokeDasharray="1.5 1.5" fill="none"/>
          <path d="M12 5.5v13" stroke="white" strokeWidth="1.5"/>
        </svg>
      );
    case 'ssl-decrypt':
    case 'ssl-decryption':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <rect x="7.5" y="11.5" width="9" height="6" rx="1.2" stroke="white" strokeWidth="1.2" fill="none"/>
          <path d="M9.5 11.5v-2.5a2.5 2.5 0 015 0v2.5" stroke="white" strokeWidth="1.2" fill="none"/>
          <circle cx="12" cy="14.5" r="0.8" fill="white"/>
        </svg>
      );
    default:
      // Generic fallback: a simple blue square with a white inner square.
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect width="24" height="24" rx="4" fill="#0091ea"/>
          <rect x="7" y="7" width="10" height="10" rx="1.5" stroke="white" strokeWidth="1.5" fill="none"/>
        </svg>
      );
  }
};

// ─── MapIcon ──────────────────────────────────────────────────────────────────
/** Blue circle with three horizontal rule lines — represents a Traffic Map. */
export const MapIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="11" fill="#007cff" />
    <path d="M7 9h10M7 12h10M7 15h10" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="9" cy="9" r="1.2" fill="white"/>
    <circle cx="15" cy="12" r="1.2" fill="white"/>
    <circle cx="11" cy="15" r="1.2" fill="white"/>
  </svg>
);

// ─── GreenCircleIcon ──────────────────────────────────────────────────────────
/** Dark green circle — represents a generic Tool / Raw Endpoint. */
export const GreenCircleIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="11" fill="#163c20" stroke="#25b34b" strokeWidth="1.5" />
    <path d="M12 6c-3 0-5.5 2.5-5.5 5.5V17h11v-5.5C17.5 8.5 15 6 12 6z" stroke="white" strokeWidth="1.5" fill="none"/>
    <path d="M9 13.5h6" stroke="white" strokeWidth="1.2" />
  </svg>
);

// ─── SmartIcon ────────────────────────────────────────────────────────────────
/** Blue rotated square (diamond) with concentric circles — GigaSMART engine. */
export const SmartIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <rect x="12" y="3" width="12" height="12" rx="2" transform="rotate(45 12 3)" fill="#0091ea" stroke="#00b0ff" strokeWidth="1.2" />
    <circle cx="12" cy="12" r="3.5" fill="white"/>
    <circle cx="12" cy="12" r="1.5" fill="#0091ea"/>
  </svg>
);

// ─── Input port icons ─────────────────────────────────────────────────────────

/** Blue circle with arrow — SPAN port (Switch Port Analyser). */
export const SpanIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="11" fill="#1e88e5" stroke="#1565c0" strokeWidth="1.5" />
    <path d="M8 12h8M12 8l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="5.5" y="10" fill="white" fontSize="5.5" fontFamily="sans-serif" fontWeight="bold">S</text>
  </svg>
);

/** Green circle with T-junction — TAP hardware device. */
export const TapIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="11" fill="#43a047" stroke="#2e7d32" strokeWidth="1.5" />
    <path d="M7 12h4m2 0h4M12 7v10" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="12" cy="12" r="2.5" fill="none" stroke="white" strokeWidth="1.2"/>
  </svg>
);

/** Purple circle with waveform — ERSPAN tunnel source. */
export const ErspanIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="11" fill="#ab47bc" stroke="#7b1fa2" strokeWidth="1.5" />
    <path d="M6 10h5l3 5h4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="6" y="17" fill="white" fontSize="4.5" fontFamily="sans-serif" fontWeight="bold">ER</text>
  </svg>
);

/** Teal circle with opposite horizontal arrows — East/West traffic. */
export const EastWestIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="11" fill="#00acc1" stroke="#00838f" strokeWidth="1.5" />
    <path d="M6 10h12M10 6.5L6.5 10l3.5 3.5M18 14H6M14 10.5l3.5 3.5-3.5 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/** Blue circle with stacked isometric virtual hypervisor layers — VMWare estate. */
export const VmwareIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="11" fill="#1e88e5" stroke="#0d47a1" strokeWidth="1.5" />
    <path d="M6 8l6-3 6 3-6 3-6-3zm0 4l6 3 6-3m-12 4l6 3 6-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─── Tool icons ───────────────────────────────────────────────────────────────

/** Dark green shield — packet-consuming security tool. */
export const PacketToolIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <rect width="24" height="24" rx="4" fill="#2e7d32" stroke="#1b5e20" strokeWidth="1"/>
    <path d="M12 5l6 2.5v5.5c0 4-6 6-6 6s-6-2-6-6V7.5L12 5z" stroke="white" strokeWidth="1.5" fill="none"/>
    <path d="M9 10.5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/** Orange square with three lines — metadata-consuming SIEM/analytics tool. */
export const MetadataToolIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <rect width="24" height="24" rx="4" fill="#e65100" stroke="#b71c1c" strokeWidth="1"/>
    <path d="M7 17h10M7 13h10M7 9h6" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="15" cy="9" r="1.5" fill="white"/>
  </svg>
);

// ─── Storage tool icon ────────────────────────────────────────────────────────

/** Teal square with a cluster of cylinders — S3 / Object Storage tool (implies massive storage). */
export const S3StorageIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <rect width="24" height="24" rx="4" fill="#00695c" stroke="#004d40" strokeWidth="1"/>
    {/* Rear Left Cylinder */}
    <ellipse cx="9" cy="9.5" rx="3" ry="1" stroke="rgba(255, 255, 255, 0.7)" strokeWidth="1" fill="none"/>
    <path d="M6 9.5v4c0 .6 1.3 1 3 1s3-.4 3-1v-4" stroke="rgba(255, 255, 255, 0.7)" strokeWidth="1"/>
    {/* Rear Right Cylinder */}
    <ellipse cx="15" cy="9.5" rx="3" ry="1" stroke="rgba(255, 255, 255, 0.7)" strokeWidth="1" fill="none"/>
    <path d="M12 9.5v4c0 .6 1.3 1 3 1s3-.4 3-1v-4" stroke="rgba(255, 255, 255, 0.7)" strokeWidth="1"/>
    {/* Front Center Cylinder */}
    <ellipse cx="12" cy="13" rx="4" ry="1.3" stroke="white" strokeWidth="1.2" fill="#00695c"/>
    <path d="M8 13v4.5c0 .7 1.8 1.3 4 1.3s4-.6 4-1.3V13" stroke="white" strokeWidth="1.2"/>
    <ellipse cx="12" cy="15.5" rx="4" ry="1" stroke="white" strokeWidth="0.7" strokeDasharray="2 1.5" fill="none"/>
  </svg>
);

/** Blue square with a white shark fin — Wireshark protocol analyzer tool. */
export const WiresharkIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <rect width="24" height="24" rx="4" fill="#1679A7" />
    <path d="m2.95 0c-1.62 0-2.95 1.32-2.95 2.95v18.1c0 1.63 1.32 2.95 2.95 2.95h18.1c1.62 0 2.95-1.32 2.95-2.95v-18.1c-.00024-1.63-1.32-2.95-2.95-2.95zm0 1.09h18.1c1.04 0 1.85.818 1.85 1.86v14h-5.27c-.335-.796-2.57-6.47.283-10.9a.516.517 0 0 0-.443-.794c-5.24.0827-8.2 3.19-9.74 6.21-1.35 2.64-1.63 4.91-1.69 5.53h-4.95v-14c0-1.04.817-1.86 1.85-1.86zm13.6 5.24c-2.62 5.24.248 11.4.248 11.4a.516.517 0 0 0 .469.301h5.62v3.05c0 1.04-.817 1.86-1.85 1.86h-18.1c-1.04 0-1.85-.818-1.85-1.86v-3.05h5.39a.516.517 0 0 0 .514-.477s.226-2.8 1.66-5.62c1.34-2.62 3.67-5.17 7.91-5.57z" fill="white" />
  </svg>
);
