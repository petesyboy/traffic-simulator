/**
 * GigaSmartNode.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * GigaSMART processing engine node renderer (dedup, slicing, metadata, etc.).
 */

import React from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { useStore } from '../../store/store';
import { formatBandwidth } from '../../utils/format';
import { AppIcon } from '../Icons';
import { ACTION_TYPES, isMetadataAction, isDedupAction } from '../../constants/nodeTypes';
import { getNodeValueProposition } from '../../constants/nodeValues';
import { useGlowClass } from './nodeStyles';

const GigaSmartNodeComponent: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const actionType = (data.actionType as string) || ACTION_TYPES.DEDUPLICATION;
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);
  const advancedMode = useStore((state) => state.advancedMode);

  // Trace upstream from this GigaSMART node to find a GigaVUE-HC chassis
  let hasConnectedHc = false;
  const visited = new Set<string>();
  const queue = [id];
  visited.add(id);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const incoming = edges.filter(e => e.target === currentId);
    incoming.forEach(e => {
      if (!visited.has(e.source)) {
        visited.add(e.source);
        const sourceNode = nodes.find(n => n.id === e.source);
        if (sourceNode) {
          if (sourceNode.type === 'hardwareNode' && String(sourceNode.data?.model || '').includes('HC')) {
            hasConnectedHc = true;
          } else if (sourceNode.type !== 'hardwareNode') {
            queue.push(e.source);
          }
        }
      }
    });
    if (hasConnectedHc) break;
  }

  const glowClass = useGlowClass(id);

  return (
    <>
      <NodeResizer minWidth={170} minHeight={75} isVisible={selected} />
      <div className={`custom-node gigasmart-node ${selected ? 'selected-node' : ''} ${glowClass}`}>
        <Handle type="target" position={Position.Left} id="in" />
        <div className="node-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AppIcon type={actionType} size={22} rate={data.dedupRate as number} />
            <span className="node-title">{data.label as string}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className="node-value-tooltip-container">
              <span className="node-info-icon">ⓘ</span>
              <div className="node-value-tooltip">{getNodeValueProposition('gigaSmartNode', undefined, actionType)}</div>
            </div>
            <span style={{ fontSize: '12px', color: '#666' }}>⋮</span>
          </div>
        </div>

        {/* Action summary line — shows what this GigaSMART engine is doing */}
        <div className="node-meta-small">
          {isDedupAction(actionType) && 'Action: Drop'}
          {actionType === ACTION_TYPES.PACKET_SLICING && `Action: Slice (${(data.sliceSize as number) || 128}B)`}
          {actionType === ACTION_TYPES.HEADER_STRIP && 'Action: Strip'}
          {isMetadataAction(actionType) && `Format: ${data.metadataFormat as string || 'CEF'}`}
          {!isDedupAction(actionType) &&
            actionType !== ACTION_TYPES.PACKET_SLICING &&
            actionType !== ACTION_TYPES.HEADER_STRIP &&
            !isMetadataAction(actionType) &&
            `Action: ${actionType}`}
        </div>

        {/* Metadata output format chip — only shown for AMI/AMX/App Metadata */}
        {advancedMode && isMetadataAction(actionType) && (
          <div className="node-chip-row" style={{ marginTop: '4px' }}>
            <div className="node-inner-chip" style={{ color: '#00e5ff', borderColor: 'rgba(0, 229, 255, 0.2)', fontSize: '8px', padding: '2px 4px' }}>
              Output: {data.metadataFormat as string || 'CEF'}
            </div>
            <span style={{ fontSize: '8.5px', color: '#666' }}>Metadata Gen</span>
          </div>
        )}

        {advancedMode && actionType === ACTION_TYPES.PACKET_SLICING && (
          <div className="node-chip-row" style={{ marginTop: '4px' }}>
            <div className="node-inner-chip" style={{ color: '#00e5ff', borderColor: 'rgba(0, 229, 255, 0.2)', fontSize: '8px', padding: '2px 4px' }}>
              Slice: {(data.sliceSize as number) || 128} Bytes
            </div>
            <span style={{ fontSize: '8.5px', color: '#666' }}>Truncate Payload</span>
          </div>
        )}

        {isRunning && (
          <div className="node-metrics" style={{ marginTop: '8px' }}>
            <span>Rx: {formatBandwidth(metrics?.rxMbps)}</span>
            {/* Deduplication shows the dropped volume in red; all others show Tx */}
            <span className={isDedupAction(actionType) ? 'drop' : ''}>
              {isDedupAction(actionType)
                ? `Drop: ${formatBandwidth(metrics?.dedupDroppedMbps || 0)}`
                : `Tx: ${formatBandwidth(metrics?.txMbps)}`}
            </span>
          </div>
        )}
        {advancedMode && !hasConnectedHc && (
          <div style={{ color: '#ef5350', fontSize: '9px', fontWeight: 'bold', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>⚠️ Requires HC Chassis</span>
          </div>
        )}
        { (actionType === 'Load Balancing (Stateless)' || actionType === 'Load Balancing (Stateful)') ? (
          <>
            <Handle type="source" position={Position.Right} id="out" style={{ top: '20%', width: '8px', height: '8px', background: '#00e5ff' }} />
            <Handle type="source" position={Position.Right} id="out-2" style={{ top: '40%', width: '8px', height: '8px', background: '#00e5ff' }} />
            <Handle type="source" position={Position.Right} id="out-3" style={{ top: '60%', width: '8px', height: '8px', background: '#00e5ff' }} />
            <Handle type="source" position={Position.Right} id="out-4" style={{ top: '80%', width: '8px', height: '8px', background: '#00e5ff' }} />
          </>
        ) : (
          <Handle type="source" position={Position.Right} id="out" />
        )}
      </div>
    </>
  );
};

export const GigaSmartNode = React.memo(GigaSmartNodeComponent);
