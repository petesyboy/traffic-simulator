/**
 * PortMapPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Manual override for port allocation. Links are auto-allocated by
 * `syncPortAssignments`; picking a port here pins that assignment so re-syncs
 * leave it alone.
 */
import React, { useMemo } from 'react';
import type { Edge } from '@xyflow/react';
import { useStore } from '../../../store/store';
import type { CustomNode, HardwareNodeData, PortLink } from '../../../store/types';
import { getChassisPorts, getPortOpticMap } from '../../../utils/ports';

interface PortMapPanelProps {
  selectedNode: CustomNode;
}

interface LinkRow {
  edgeId: string;
  linkIndex: number;
  isSource: boolean;
  portId: string;
  peerPortId: string;
  peerLabel: string;
  pinned: boolean;
}

export const PortMapPanel: React.FC<PortMapPanelProps> = ({ selectedNode }) => {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const setEdges = useStore((s) => s.setEdges);

  const model = String(selectedNode.data?.model || '');
  const hwData = selectedNode.data as HardwareNodeData;

  const ports = useMemo(() => getChassisPorts(model, hwData), [model, hwData]);
  const opticMap = useMemo(() => getPortOpticMap(ports, hwData.optics), [ports, hwData.optics]);

  const rows = useMemo(() => {
    const out: LinkRow[] = [];
    for (const edge of edges) {
      if (edge.source !== selectedNode.id && edge.target !== selectedNode.id) continue;
      const isSource = edge.source === selectedNode.id;
      const peerId = isSource ? edge.target : edge.source;
      const peer = nodes.find((n) => n.id === peerId);
      const links = (edge.data?.portLinks as PortLink[]) || [];
      links.forEach((link, linkIndex) => {
        out.push({
          edgeId: edge.id,
          linkIndex,
          isSource,
          portId: isSource ? link.sourcePortId : link.targetPortId,
          peerPortId: isSource ? link.targetPortId : link.sourcePortId,
          peerLabel: String(peer?.data?.label || peer?.data?.model || peerId),
          pinned: !!link.pinned,
        });
      });
    }
    return out;
  }, [edges, nodes, selectedNode.id]);

  // Ports already claimed by another link can't be offered as a target, but the
  // row's own current port must stay selectable.
  const takenPortIds = useMemo(() => new Set(rows.map((r) => r.portId).filter(Boolean)), [rows]);

  // Ports that have an optic fitted but are not currently connected to any active link
  const unlinkedFittedPorts = useMemo(() => {
    return ports.filter((p) => opticMap.has(p.id) && !takenPortIds.has(p.id));
  }, [ports, opticMap, takenPortIds]);

  if (ports.length === 0 || (rows.length === 0 && unlinkedFittedPorts.length === 0)) return null;

  const writeLink = (edgeId: string, linkIndex: number, mutate: (link: PortLink) => PortLink) => {
    setEdges(
      edges.map((edge: Edge) => {
        if (edge.id !== edgeId) return edge;
        const links = ((edge.data?.portLinks as PortLink[]) || []).map((link, i) =>
          i === linkIndex ? mutate(link) : link,
        );
        return { ...edge, data: { ...edge.data, portLinks: links } };
      }),
    );
  };

  const handlePortChange = (row: LinkRow, nextPortId: string) => {
    writeLink(row.edgeId, row.linkIndex, (link) => ({
      ...link,
      [row.isSource ? 'sourcePortId' : 'targetPortId']: nextPortId,
      opticSku: opticMap.get(nextPortId) || link.opticSku,
      pinned: true,
    }));
  };

  const handleResetAll = () => {
    setEdges(
      edges.map((edge: Edge) => {
        if (edge.source !== selectedNode.id && edge.target !== selectedNode.id) return edge;
        const links = ((edge.data?.portLinks as PortLink[]) || []).map((link) => ({ ...link, pinned: false }));
        return { ...edge, data: { ...edge.data, portLinks: links } };
      }),
    );
  };

  const pinnedCount = rows.filter((r) => r.pinned).length;

  return (
    <div className="panel-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3 className="text-base font-semibold m-0">🗺️ Port Map</h3>
        {pinnedCount > 0 && (
          <button
            onClick={handleResetAll}
            style={{
              fontSize: '9px', background: 'transparent', color: '#00e5ff',
              border: '1px solid rgba(0,229,255,0.4)', borderRadius: '3px',
              padding: '2px 6px', cursor: 'pointer',
            }}
            title="Clear manual pins and let ports be allocated automatically again"
          >
            Reset to auto
          </button>
        )}
      </div>
      <div style={{ background: '#111', padding: '8px', borderRadius: '4px', border: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {rows.map((row) => {
          const optic = opticMap.get(row.portId);
          return (
            <div key={`${row.edgeId}-${row.linkIndex}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px' }}>
              <select
                value={row.portId}
                onChange={(e) => handlePortChange(row, e.target.value)}
                style={{
                  fontFamily: 'monospace', fontSize: '10px', background: '#1a1a1a', color: '#eee',
                  border: `1px solid ${row.pinned ? '#00e5ff' : '#444'}`, borderRadius: '3px', padding: '2px 4px',
                }}
                title={row.pinned ? 'Pinned by hand - re-syncs leave this alone' : 'Allocated automatically'}
              >
                {row.portId === '' && <option value="">— none —</option>}
                {ports
                  .filter((p) => p.cage !== 'RJ45' && (p.id === row.portId || !takenPortIds.has(p.id)))
                  .map((p) => {
                    const portOptic = opticMap.get(p.id);
                    const isFitted = !!portOptic && p.id !== row.portId;
                    const label = `${p.id}${portOptic ? ` (${portOptic.split(' ')[0]}${isFitted ? ' — fitted' : ''})` : ''}${p.licensed ? '' : ' (unlicensed)'}`;
                    return (
                      <option key={p.id} value={p.id}>
                        {label}
                      </option>
                    );
                  })}
              </select>
              <span style={{ color: '#777', flexShrink: 0 }}>→</span>
              <span style={{ color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.peerLabel}
                {row.peerPortId && <span style={{ color: '#777', fontFamily: 'monospace' }}> {row.peerPortId}</span>}
              </span>
              {optic && (
                <span style={{ color: '#ff9800', marginLeft: 'auto', flexShrink: 0, fontSize: '9px' }} title={optic}>
                  {optic.split(' ')[0]}
                </span>
              )}
            </div>
          );
        })}

        {unlinkedFittedPorts.map((p) => {
          const optic = opticMap.get(p.id);
          return (
            <div
              key={`unlinked-${p.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '10px',
                opacity: 0.9,
              }}
            >
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  background: '#1a1a1a',
                  color: '#ff9800',
                  border: '1px dashed #ff9800',
                  borderRadius: '3px',
                  padding: '2px 5px',
                  minWidth: '55px',
                  textAlign: 'center',
                }}
                title={`Port ${p.id} is fitted with an optic but currently unlinked`}
              >
                {p.id}
              </span>
              <span style={{ color: '#555', flexShrink: 0 }}>→</span>
              <span style={{ color: '#888', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                (fitted but unlinked)
              </span>
              {optic && (
                <span
                  style={{
                    color: '#ff9800',
                    marginLeft: 'auto',
                    flexShrink: 0,
                    fontSize: '9px',
                    background: 'rgba(255,152,0,0.1)',
                    padding: '1px 4px',
                    borderRadius: '2px',
                    border: '1px solid rgba(255,152,0,0.25)',
                  }}
                  title={optic}
                >
                  {optic.split(' ')[0]}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '4px' }}>
        Ports are allocated automatically as links are made. Choosing one in the dropdown pins it to that link.
      </div>
    </div>
  );
};
