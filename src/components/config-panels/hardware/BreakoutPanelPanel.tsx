/**
 * BreakoutPanelPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Read-only summary for a PNL-M341T/M343T MPO breakout panel: its 3 MPO
 * groups, what each is wired to (a GigaVUE chassis on the MPO side, tools or
 * TAP modules on the LC side), and the detected speed tier. The panel is
 * passive - it has no optics, power or config of its own, so this is purely
 * a summary of the topology around it; see validateBreakoutPanels() in
 * configValidator.ts for the actual correctness checks (parallel optic,
 * lane speed match, etc.) surfaced in the BOM/validation panel.
 */
import React, { useMemo } from 'react';
import type { Edge } from '@xyflow/react';
import type { CustomNode, HardwareNodeData, PortLink } from '../../../store/types';
import { getChassisPorts, getPortOpticMap } from '../../../utils/ports';
import { getOpticSpeed } from '../../../utils/hardwareUtils';
import { isParallelBreakoutOptic, getBreakoutLaneSpeed, panelFiberType, type BreakoutParentSpeed } from '../../../utils/breakoutRules';

interface BreakoutPanelPanelProps {
  selectedNode: CustomNode;
  nodes: CustomNode[];
  edges: Edge[];
}

interface LinkInfo {
  peerLabel: string;
  peerOptic?: string;
}

const isBreakoutSpeed = (speed: string): speed is BreakoutParentSpeed =>
  speed === '40G' || speed === '100G' || speed === '400G';

export const BreakoutPanelPanel: React.FC<BreakoutPanelPanelProps> = ({ selectedNode, nodes, edges }) => {
  const model = String(selectedNode.data?.model || '');
  const fiberType = panelFiberType(model);

  const panelPorts = useMemo(
    () => getChassisPorts(model, selectedNode.data as HardwareNodeData),
    [model, selectedNode.data],
  );

  const linkByPortId = useMemo(() => {
    const map = new Map<string, LinkInfo>();
    edges.forEach((edge) => {
      if (edge.source !== selectedNode.id && edge.target !== selectedNode.id) return;
      const isSource = edge.source === selectedNode.id;
      const peerId = isSource ? edge.target : edge.source;
      const peer = nodes.find((n) => n.id === peerId);
      const peerData = (peer?.data as HardwareNodeData) || ({} as HardwareNodeData);
      const peerPorts = peer ? getChassisPorts(String(peer.data?.model || ''), peerData) : [];
      const peerOptics = getPortOpticMap(peerPorts, peerData.optics);
      const links = (edge.data?.portLinks as PortLink[]) || [];
      links.forEach((link) => {
        const portId = isSource ? link.sourcePortId : link.targetPortId;
        const peerPortId = isSource ? link.targetPortId : link.sourcePortId;
        if (!portId) return;
        map.set(portId, {
          peerLabel: String(peer?.data?.label || peer?.data?.model || peerId),
          peerOptic: peerPortId ? peerOptics.get(peerPortId) : undefined,
        });
      });
    });
    return map;
  }, [edges, nodes, selectedNode.id]);

  const groups = panelPorts.filter((p) => p.cage === 'MPO');

  return (
    <div className="panel-section">
      <h3 className="text-base font-semibold mb-2">🧵 MPO Breakout / Aggregation</h3>
      <div style={{ fontSize: '11px', color: '#ccc', marginBottom: '10px', lineHeight: 1.5 }}>
        Passive - no power, optics or configuration of its own.{' '}
        {fiberType === 'SM'
          ? 'Singlemode: MPO-12/APC on the trunk side, singlemode LC/UPC on each of the 4 breakout legs.'
          : 'Multimode: MPO-12/UPC on the trunk side, multimode LC/UPC on each of the 4 breakout legs.'}{' '}
        Wire a GigaVUE chassis QSFP/QSFP-DD port (fitted with a parallel SR4/PLR4/PSM4/DR4/DR4+ optic) to a group's
        MPO port below to activate it - or wire up to 4 lower-speed sources into its LC legs instead, to aggregate
        them back into one high-speed uplink.
      </div>
      {groups.map((mpo, i) => {
        const mpoLink = linkByPortId.get(mpo.id);
        const chassisOptic = mpoLink?.peerOptic;
        const isValidParent = chassisOptic ? isParallelBreakoutOptic(chassisOptic) : undefined;
        const parentSpeed = chassisOptic ? getOpticSpeed(chassisOptic) : undefined;
        const laneSpeed = parentSpeed && isBreakoutSpeed(parentSpeed) ? getBreakoutLaneSpeed(parentSpeed) : undefined;
        const lanes = panelPorts.filter((p) => p.id.startsWith(`${mpo.id}/`));

        return (
          <div
            key={mpo.id}
            style={{ background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '8px', marginBottom: '8px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
              <span style={{ color: '#888' }}>
                Group {i + 1} <span style={{ fontFamily: 'monospace', color: '#666' }}>({mpo.id})</span>
              </span>
              {mpoLink ? (
                <span style={{ color: isValidParent ? '#4caf50' : '#ef5350' }}>
                  {mpoLink.peerLabel}
                  {chassisOptic ? ` — ${chassisOptic.split(' ')[0]}` : ' (no optic fitted)'}
                  {laneSpeed ? ` · 4×${laneSpeed}` : ''}
                </span>
              ) : (
                <span style={{ color: '#555' }}>Not wired</span>
              )}
            </div>
            {mpoLink && chassisOptic && !isValidParent && (
              <div style={{ fontSize: '9px', color: '#ef5350', marginTop: '4px' }}>
                ⚠️ {chassisOptic.split(' ')[0]} is not a parallel-fibre optic - MPO breakout needs SR4 (multimode) or
                PLR4/PSM4/DR4/DR4+ (singlemode).
              </div>
            )}
            <div
              style={{
                display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px',
                paddingLeft: '8px', borderLeft: '2px solid #2a2a2a',
              }}
            >
              {lanes.map((lane, laneIdx) => {
                const laneLink = linkByPortId.get(lane.id);
                return (
                  <div key={lane.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                    <span style={{ color: '#777', fontFamily: 'monospace' }}>LC{laneIdx + 1}</span>
                    <span style={{ color: laneLink ? '#ccc' : '#555' }}>
                      {laneLink ? `${laneLink.peerLabel}${laneLink.peerOptic ? ` — ${laneLink.peerOptic.split(' ')[0]}` : ''}` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
