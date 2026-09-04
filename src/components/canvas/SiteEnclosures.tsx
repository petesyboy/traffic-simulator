import React, { useCallback, useMemo } from 'react';
import { useViewport, useReactFlow, type Edge } from '@xyflow/react';
import { type CustomNode, useStore } from '../../store/store';
import { isAutoTrayModel } from '../../utils/trayModels';
import { NODE_TYPES } from '../../constants/nodeTypes';

interface SiteEnclosuresProps {
  nodes: CustomNode[];
  edges?: Edge[];
  enabled?: boolean;
}

const PAD_X = 36;
const PAD_TOP = 56;
const PAD_BOTTOM = 32;
const MIN_SITE_WIDTH = 290;

const SITE_PALETTES = [
  { border: 'rgba(0, 229, 255, 0.45)', bg: 'rgba(0, 229, 255, 0.035)', glow: 'rgba(0, 229, 255, 0.12)', text: '#00e5ff', badgeBg: 'rgba(0, 229, 255, 0.12)' },
  { border: 'rgba(168, 85, 247, 0.45)', bg: 'rgba(168, 85, 247, 0.035)', glow: 'rgba(168, 85, 247, 0.12)', text: '#c084fc', badgeBg: 'rgba(168, 85, 247, 0.12)' },
  { border: 'rgba(16, 185, 129, 0.45)', bg: 'rgba(16, 185, 129, 0.035)', glow: 'rgba(16, 185, 129, 0.12)', text: 'var(--status-green-soft, #34d399)', badgeBg: 'rgba(16, 185, 129, 0.12)' },
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

export const SiteEnclosures: React.FC<SiteEnclosuresProps> = ({ nodes, edges: propEdges, enabled = true }) => {
  const { x: vpX, y: vpY, zoom } = useViewport();
  const { getNodesBounds } = useReactFlow();
  const storeEdges = useStore((state) => state.edges);
  const edges = propEdges ?? storeEdges ?? [];
  const selectNodesBySite = useStore((state) => state.selectNodesBySite);
  const moveNodesTo = useStore((state) => state.moveNodesTo);

  /**
   * The header doubles as a handle for the whole data centre: pressing it
   * selects every device in the site - so the flow direction control acts on
   * all of them at once - and dragging carries them across the canvas together.
   */
  const beginSiteDrag = useCallback(
    (event: React.MouseEvent, site: string, siteNodes: CustomNode[]) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      selectNodesBySite(site);

      // Children move with their parent, so only top-level nodes are carried.
      const origin = siteNodes
        .filter((n) => !n.parentId)
        .map((n) => ({ id: n.id, x: n.position.x, y: n.position.y }));
      const startX = event.clientX;
      const startY = event.clientY;
      let moved = false;

      const handleMove = (moveEvent: MouseEvent) => {
        const dx = (moveEvent.clientX - startX) / zoom;
        const dy = (moveEvent.clientY - startY) / zoom;
        if (!moved) {
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
          // Checkpointed once, at the point the press becomes a drag, so undo
          // reverts the whole move rather than its last increment - and a plain
          // click to select never lands in the history at all.
          moved = true;
          useStore.getState().pushHistory();
        }
        moveNodesTo(origin.map((n) => ({ id: n.id, position: { x: n.x + dx, y: n.y + dy } })));
      };

      const handleUp = () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [moveNodesTo, selectNodesBySite, zoom],
  );

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

        const rawWidth = Math.max(bounds.width + PAD_X * 2, MIN_SITE_WIDTH);
        const extraX = (rawWidth - (bounds.width + PAD_X * 2)) / 2;
        const left = (bounds.x - PAD_X - extraX) * zoom + vpX;
        const top = (bounds.y - PAD_TOP) * zoom + vpY;
        const width = rawWidth * zoom;
        const height = (bounds.height + PAD_TOP + PAD_BOTTOM) * zoom;

        const palette = getSitePalette(site, idx);

        // Check if this site contains or is connected to a DWDM Optical Transport node
        const siteNodeIdSet = new Set(siteNodes.map((n) => n.id));
        const connectedDwdm =
          siteNodes.find((n) => n.type === NODE_TYPES.DWDM_NETWORK || n.type === 'dwdmNetworkNode') ||
          nodes.find(
            (n) =>
              (n.type === NODE_TYPES.DWDM_NETWORK || n.type === 'dwdmNetworkNode') &&
              edges.some(
                (e) =>
                  (siteNodeIdSet.has(e.source) && e.target === n.id) ||
                  (siteNodeIdSet.has(e.target) && e.source === n.id),
              ),
          );

        const dwdmSpeed = connectedDwdm ? (connectedDwdm.data?.wavelengthSpeed as string) || '100G' : '';
        const dwdmProt = connectedDwdm ? (connectedDwdm.data?.protectionMode as string) || 'Protected Ring (1+1)' : '';
        const dwdmShortProt = dwdmProt.includes('1+1') ? 'Protected' : dwdmProt.includes('Mesh') ? 'Mesh' : 'Unprotected';

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
              onMouseDown={(e) => beginSiteDrag(e, site, siteNodes)}
              title={`Drag to move all of ${site} together, or click to select the whole site`}
              style={{
                borderColor: palette.border,
                color: palette.text,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: '11px', flexShrink: 0 }}>🏢</span>
              <span style={{ fontWeight: 700, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                Data Centre: {site}
              </span>
              <span
                className="site-enclosure-count"
                style={{
                  background: palette.badgeBg,
                  color: palette.text,
                  borderColor: palette.border,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {siteNodes.length} {siteNodes.length === 1 ? 'device' : 'devices'}
              </span>
              {connectedDwdm && (
                <span
                  className="site-enclosure-dwdm-chip"
                  style={{
                    background: 'rgba(168, 85, 247, 0.2)',
                    color: '#e9d5ff',
                    border: '1px solid rgba(168, 85, 247, 0.5)',
                    borderRadius: '10px',
                    padding: '1px 7px',
                    fontSize: '9.5px',
                    fontWeight: 600,
                    letterSpacing: '0.2px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title={`Interconnected via ${dwdmSpeed} Optical Transport Network (${dwdmProt})`}
                >
                  λ DWDM Ring · {dwdmSpeed} {dwdmShortProt}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
};
