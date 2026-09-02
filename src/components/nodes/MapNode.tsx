/**
 * MapNode.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Traffic Map node renderer — applies filtering conditions to traffic flows.
 */

import React from 'react';
import { Handle, NodeResizer, type NodeProps } from '@xyflow/react';
import { useStore } from '../../store/store';
import type { MapCondition } from '../../store/types';
import { formatBandwidth } from '../../utils/format';
import { MapIcon } from '../Icons';
import { getNodeValueProposition } from '../../constants/nodeValues';
import { useGlowClass, getHandleSides, getConditionsSummary } from './nodeStyles';

const MapNodeComponent: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { inSide, outSide } = getHandleSides(data);
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const conditions = (data.conditions as MapCondition[]) || [];
  const advancedMode = useStore((state) => state.advancedMode);
  const exportDiagramMode = useStore((state) => state.exportDiagramMode);

  const glowClass = useGlowClass(id);

  return (
    <>
      <NodeResizer minWidth={170} minHeight={75} isVisible={selected} />
      <div className={`custom-node map-node ${selected ? 'selected-node' : ''} ${glowClass}`}>
        <Handle type="target" position={inSide} id="in" />
        <div className="node-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapIcon size={20} />
            <span className="node-title">{data.label as string}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className="node-value-tooltip-container">
              <span className="node-info-icon">ⓘ</span>
              <div className="node-value-tooltip">{getNodeValueProposition('mapNode')}</div>
            </div>
            <span style={{ fontSize: '12px', color: '#666', cursor: 'pointer' }}>⋮</span>
          </div>
        </div>
        <div className="node-meta-small">
          {conditions.length} rule(s)
        </div>

        {/* Summary chip row showing how many rules are active and the output port */}
        <div className="node-chip-row">
          <div className="node-inner-chip">
            Pass ({conditions.length} rules)
          </div>
          <div className="node-port-chip">
            P1
          </div>
        </div>

        {advancedMode && conditions.length > 0 && (
          <div style={{
            fontSize: '9px',
            color: '#b2dfdb',
            marginTop: '6px',
            padding: '4px 6px',
            background: 'rgba(0, 150, 136, 0.1)',
            borderRadius: '3px',
            border: '1px solid rgba(0, 150, 136, 0.2)',
            wordBreak: 'break-all'
          }}>
            🎯 {getConditionsSummary(conditions)}
          </div>
        )}

        {isRunning && (
          <div className="node-metrics" style={{ marginTop: '4px' }}>
            <span>In: {formatBandwidth(metrics?.rxMbps)}</span>
            <span>Out: {formatBandwidth(metrics?.txMbps)}</span>
          </div>
        )}
        <Handle type="source" position={outSide} id="out" />
      </div>

      {exportDiagramMode && (
        <div style={{
          background: 'var(--node-desc-bg, rgba(20, 20, 20, 0.95))',
          border: '1px solid #009688',
          borderRadius: '4px',
          padding: '6px 8px',
          width: '170px',
          boxSizing: 'border-box',
          color: 'var(--text-primary, #fff)',
          fontSize: '9px',
          fontFamily: 'monospace',
          boxShadow: 'var(--shadow-md, 0 2px 8px rgba(0,0,0,0.8))',
          pointerEvents: 'none',
          whiteSpace: 'pre-wrap',
          marginTop: '6px'
        }}>
          {(() => {
            if (conditions.length === 0) return 'Traffic Map: Pass All (No filters)';
            return `Traffic Map (Filtering Rules):\n` + conditions.map((c, i) => {
              const logicPrefix = i > 0 ? `${c.logic} ` : '';
              let fieldLabel = c.field.toUpperCase();
              if (c.field === 'portdst') fieldLabel = 'DST PORT';
              if (c.field === 'portsrc') fieldLabel = 'SRC PORT';
              if (c.field === 'ipdst') fieldLabel = 'DST IP';
              if (c.field === 'ipsrc') fieldLabel = 'SRC IP';
              if (c.field === 'ipver') fieldLabel = 'IP VER';
              if (c.field === 'vlan') fieldLabel = 'VLAN';
              if (c.field === 'protocol') fieldLabel = 'PROTO';
              
              const actionLabel = c.action === 'drop' ? 'DROP' : 'PASS';
              return `• ${logicPrefix}${fieldLabel} = ${c.value} -> ${actionLabel}`;
            }).join('\n');
          })()}
        </div>
      )}
    </>
  );
};

export const MapNode = React.memo(MapNodeComponent);
