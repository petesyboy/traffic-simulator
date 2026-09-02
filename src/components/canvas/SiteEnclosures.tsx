import React, { useMemo } from 'react';
import { useViewport, useReactFlow } from '@xyflow/react';
import { type CustomNode } from '../../store/types';
import { isAutoTrayModel } from '../../utils/trayModels';

interface SiteEnclosuresProps {
  nodes: CustomNode[];
  enabled?: boolean;
}

const PAD_X = 36;
const PAD_TOP = 48;
const PAD_BOTTOM = 32;

const SITE_PALETTES = [
  { border: 'rgba(0, 229, 255, 0.45)', bg: 'rgba(0, 229, 255, 0.035)', glow: 'rgba(0, 229, 255, 0.12)', text: '#00e5ff', badgeBg: 'rgba(0, 229, 255, 0.12)' },
  { border: 'rgba(168, 85, 247, 0.45)', bg: 'rgba(168, 85, 247, 0.035)', glow: 'rgba(168, 85, 247, 0.12)', text: '#c084fc', badgeBg: 'rgba(168, 85, 247, 0.12)' },
  { border: 'rgba(16, 185, 129, 0.45)', bg: 'rgba(16, 185, 129, 0.035)', glow: 'rgba(16, 185, 129, 0.12)', text: '#34d399', badgeBg: 'rgba(16, 185, 129, 0.12)' },
  { border: 'rgba(245, 158, 11, 0.45)', bg: 'rgba(245, 158, 11, 0.035)', glow: 'rgba(245, 158, 11, 0.12)', text: '#fbbf24', badgeBg: 'rgba(245, 158, 11, 0.12)' },
  { border: 'rgba(244, 63, 94, 0.45)', bg: 'rgba(244, 63, 94, 0.035)', glow: 'rgba(244, 63, 94, 0.12)', text: '#fb7185', badgeBg: 'rgba(244, 63, 94, 0.12)' },
  { border: 'rgba(56, 189, 248, 0.45)', bg: 'rgba(56, 189, 248, 0.035)', glow: 'rgba(56, 189, 248, 0.12)', text: '#38bdf8', badgeBg: 'rgba(56, 189, 248, 0.12)' },
];

function getSitePalette(siteName: string, index: number) {
  let hash = 0;
  for (let i = 0; i < siteName.length; i++) {
    hash = (hash << 5) - hash + siteName.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash + index) % SITE_PALETTES.length;
  return SITE_PALETTES[idx];
}

export const SiteEnclosures: React.FC<SiteEnclosuresProps> = ({ nodes, enabled = true }) => {
  const { x: vpX, y: vpY, zoom } = useViewport();
  const { getNodesBounds } = useReactFlow();

  const siteGroups = useMemo(() => {
    if (!enabled) return [];

    const map = new Map<string, CustomNode[]>();
    nodes.forEach((n) => {
      if (n.hidden || (n.type === 'hardwareNode' && isAutoTrayModel(String(n.data?.model || '')))) {
        return;
      }
      const s = ((n.data?.site as string) || '').trim();
      if (s) {
        if (!map.has(s)) map.set(s, []);
        map.get(s)!.push(n);
      }
    });

    // Only render site enclosures when at least one named site exists
    return Array.from(map.entries());
  }, [nodes, enabled]);

  if (!enabled || siteGroups.length === 0) return null;

  return (
    <>
      {siteGroups.map(([site, siteNodes], idx) => {
        if (siteNodes.length === 0) return null;

        const bounds = getNodesBounds(siteNodes);
        if (!isFinite(bounds.x) || !isFinite(bounds.y) || bounds.width <= 0 || bounds.height <= 0) {
          return null;
        }

        const left = (bounds.x - PAD_X) * zoom + vpX;
        const top = (bounds.y - PAD_TOP) * zoom + vpY;
        const width = (bounds.width + PAD_X * 2) * zoom;
        const height = (bounds.height + PAD_TOP + PAD_BOTTOM) * zoom;

        const palette = getSitePalette(site, idx);

        return (
          <div
            key={`site-enclosure-${site}`}
            className="site-enclosure"
            style={{
              left,
              top,
              width,
              height,
              borderColor: palette.border,
              backgroundColor: palette.bg,
              boxShadow: `0 0 24px ${palette.glow}, inset 0 0 16px ${palette.glow}`,
            }}
          >
            <div
              className="site-enclosure-header"
              style={{
                borderColor: palette.border,
                color: palette.text,
              }}
            >
              <span style={{ fontSize: '11px' }}>🏢</span>
              <span style={{ fontWeight: 700, letterSpacing: '0.3px' }}>
                Data Centre: {site}
              </span>
              <span
                className="site-enclosure-count"
                style={{
                  background: palette.badgeBg,
                  color: palette.text,
                  borderColor: palette.border,
                }}
              >
                {siteNodes.length} {siteNodes.length === 1 ? 'device' : 'devices'}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
};
