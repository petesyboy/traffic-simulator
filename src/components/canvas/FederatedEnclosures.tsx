import React, { useMemo } from 'react';
import { useViewport, type Edge } from '@xyflow/react';
import { type CustomNode } from '../../store/types';

interface FederatedEnclosuresProps {
  nodes: CustomNode[];
  edges: Edge[];
  onShowDashboard: () => void;
}

const NODE_EST_WIDTH = 180;
const NODE_EST_HEIGHT = 90;
const ENCLOSURE_PAD = 28;

export const FederatedEnclosures: React.FC<FederatedEnclosuresProps> = ({ nodes, edges, onShowDashboard }) => {
  const { x: vpX, y: vpY, zoom } = useViewport();

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
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of groupNodes) {
          // The canvas's <ReactFlow> is configured with nodeOrigin={[0.5, 0.5]},
          // so node.position is each node's CENTER here, not the library's
          // usual top-left-corner default - half-width/height either side of
          // it is correct. Nodes are resizable (NodeResizer) though, so use
          // the live measured size rather than a fixed estimate, or the
          // enclosure clips whichever side the node has grown past the guess.
          const w = n.measured?.width || n.width || NODE_EST_WIDTH;
          const h = n.measured?.height || n.height || NODE_EST_HEIGHT;
          minX = Math.min(minX, n.position.x - w / 2);
          minY = Math.min(minY, n.position.y - h / 2);
          maxX = Math.max(maxX, n.position.x + w / 2);
          maxY = Math.max(maxY, n.position.y + h / 2);
        }

        const left = (minX - ENCLOSURE_PAD) * zoom + vpX, top = (minY - ENCLOSURE_PAD) * zoom + vpY;
        const width = (maxX - minX + ENCLOSURE_PAD * 2) * zoom, height = (maxY - minY + ENCLOSURE_PAD * 2) * zoom;
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
