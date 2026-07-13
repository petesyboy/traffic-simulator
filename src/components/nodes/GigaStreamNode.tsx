/**
 * GigaStreamNode.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * GigaStream load-balancer node renderer.
 */

import React from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { useStore } from '../../store/store';
import { formatBandwidth } from '../../utils/format';
import { AppIcon } from '../Icons';
import { useGlowClass } from './nodeStyles';

const GigaStreamNodeComponent: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const edges = useStore((state) => state.edges);
  const algorithm = (data.algorithm as string) || 'Round Robin';
  const linkCount = (data.linkCount as number) || 2;
  const advancedMode = useStore((state) => state.advancedMode);
  
  const actualLinks = edges.filter((e) => e.source === id).length;
  const isMismatch = actualLinks !== linkCount;
  const isActive = isRunning && (metrics?.rxMbps || 0) > 0;

  const glowClass = useGlowClass(id);

  return (
    <>
      <NodeResizer minWidth={170} minHeight={75} isVisible={selected} />
      <div className={`custom-node gigasmart-node ${selected ? 'selected-node' : ''} ${isActive ? 'gigastream-active' : ''} ${glowClass}`}>
        <Handle type="target" position={Position.Left} id="in" />
        <div className="node-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AppIcon type="Load Balancing" size={20} />
            <span className="node-title">{data.label as string}</span>
          </div>
        </div>
        <div className="node-type-label">GigaStream Load Balancer</div>
        {advancedMode && (
          <>
            <div className="node-meta">Method: {algorithm}</div>
            <div className="node-meta" style={{ color: '#00e5ff', fontWeight: 'bold' }}>
              Configured Links: {linkCount} (Connected: {actualLinks})
            </div>
          </>
        )}

        {isMismatch && (
          <div className="node-warning-badge" style={{
            marginTop: '6px',
            padding: '4px 6px',
            fontSize: '9.5px',
            color: '#ffd54f',
            background: 'rgba(255, 213, 79, 0.12)',
            border: '1px solid rgba(255, 213, 79, 0.35)',
            borderRadius: '3px',
            lineHeight: '1.2',
            fontWeight: 'bold'
          }}>
            ⚠️ Port mismatch: expected {linkCount}, connected {actualLinks}
          </div>
        )}

        {isRunning && (
          <div className="node-metrics">
            <span>Rx: {formatBandwidth(metrics?.rxMbps)}</span>
            <span>Tx: {formatBandwidth(metrics?.txMbps)}</span>
          </div>
        )}
        <Handle type="source" position={Position.Right} id="out" style={{ top: '11%' }} />
        <Handle type="source" position={Position.Right} id="out-2" style={{ top: '22%' }} />
        <Handle type="source" position={Position.Right} id="out-3" style={{ top: '33%' }} />
        <Handle type="source" position={Position.Right} id="out-4" style={{ top: '44%' }} />
        <Handle type="source" position={Position.Right} id="out-5" style={{ top: '55%' }} />
        <Handle type="source" position={Position.Right} id="out-6" style={{ top: '66%' }} />
        <Handle type="source" position={Position.Right} id="out-7" style={{ top: '77%' }} />
        <Handle type="source" position={Position.Right} id="out-8" style={{ top: '88%' }} />
      </div>
    </>
  );
};

export const GigaStreamNode = React.memo(GigaStreamNodeComponent);
