import React, { useMemo } from 'react';
import { useViewport, useReactFlow, type Edge } from '@xyflow/react';
import { type CustomNode } from '../../store/types';

interface FederatedEnclosuresProps {
  nodes: CustomNode[];
  edges: Edge[];
  onShowDashboard: () => void;
}

const ENCLOSURE_PAD = 28;
// getNodesBounds gives the exact node bounds, but the enclosure still needs
// extra breathing room on the left (handles/labels sit right at the edge)
// and bottom (vs. the default pad used on top/right).
const ENCLOSURE_PAD_LEFT = ENCLOSURE_PAD + 25;
const ENCLOSURE_PAD_BOTTOM = ENCLOSURE_PAD + 80;

export const FederatedEnclosures: React.FC<FederatedEnclosuresProps> = ({ nodes, edges, onShowDashboard }) => {
  const { x: vpX, y: vpY, zoom } = useViewport();
  // Hand-rolling this bounding-box math kept coming out a few pixels off
  // (nodeOrigin/measured-size edge cases) - getNodesBounds is xyflow's own
  // tested helper and already accounts for both correctly.
  const { getNodesBounds } = useReactFlow();

  const groups = useMemo(() => {
    const splunkGroups = new Map<string, CustomNode[]>();
    for (const edge of edges) {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      if (!sourceNode || !targetNode) continue;

      const srcTool = (sourceNode.data?.toolName as string) || '';
      const tgtTool = (targetNode.data?.toolName as string) || '';
      const srcConfig = (sourceNode.data?.configType as string) || '';
      const tgtConfig = (targetNode.data?.configType as string) || '';

      let splunkNode: CustomNode | null = null;
      let s3Node: CustomNode | null = null;

      if (srcTool === 'Splunk' && (tgtConfig === 'Objects' || tgtConfig === 'Storage Tool')) {
        splunkNode = sourceNode; s3Node = targetNode;
      } else if ((srcConfig === 'Objects' || srcConfig === 'Storage Tool') && tgtTool === 'Splunk') {
        splunkNode = targetNode; s3Node = sourceNode;
      }

      if (splunkNode && s3Node) {
        if (!splunkGroups.has(splunkNode.id)) splunkGroups.set(splunkNode.id, [splunkNode]);
        const groupNodes = splunkGroups.get(splunkNode.id)!;
        if (!groupNodes.some(n => n.id === s3Node!.id)) groupNodes.push(s3Node);
      }
    }
    return Array.from(splunkGroups.values());
  }, [nodes, edges]);

  if (groups.length === 0) return null;

  return (
    <>
      {groups.map((groupNodes) => {
        const bounds = getNodesBounds(groupNodes);
        const left = (bounds.x - ENCLOSURE_PAD_LEFT) * zoom + vpX, top = (bounds.y - ENCLOSURE_PAD) * zoom + vpY;
        const width = (bounds.width + ENCLOSURE_PAD_LEFT + ENCLOSURE_PAD) * zoom, height = (bounds.height + ENCLOSURE_PAD + ENCLOSURE_PAD_BOTTOM) * zoom;
        const groupKey = groupNodes.map(n => n.id).sort().join('-');

        return (
          <div key={`federated-${groupKey}`} className="federated-enclosure pulse" style={{ left, top, width, height }}>
            <div className="federated-enclosure-label">🔍 Federated Search</div>
            <button onClick={onShowDashboard} style={{
              position: 'absolute', top: '-12px', right: '10px', background: 'rgba(22, 22, 22, 0.95)',
              border: '1px solid rgba(0, 229, 255, 0.4)', borderRadius: '8px', padding: '4px 8px',
              fontSize: '10px', color: '#00e5ff', cursor: 'pointer', display: 'flex', alignItems: 'center',
              gap: '4px', pointerEvents: 'auto', boxShadow: '0 0 10px rgba(0, 229, 255, 0.2)'
            }}>📊 Insights</button>
          </div>
        );
      })}
    </>
  );
};
