/**
 * FilterNode.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Transformation / filter node renderer (VLAN, IP, Port filters).
 */

import React from 'react';
import { Handle, NodeResizer, type NodeProps } from '@xyflow/react';
import { useStore } from '../../store/store';
import { formatBandwidth } from '../../utils/format';
import { SmartIcon } from '../Icons';
import { CONFIG_TYPES } from '../../constants/nodeTypes';
import { getNodeValueProposition } from '../../constants/nodeValues';
import { useGlowClass, useHandleSides } from './nodeStyles';

const FilterNodeComponent: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { inSide, outSide } = useHandleSides(id, data);
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const advancedMode = useStore((state) => state.advancedMode);
  const exportDiagramMode = useStore((state) => state.exportDiagramMode);

  const glowClass = useGlowClass(id);

  return (
    <>
      <NodeResizer minWidth={170} minHeight={75} isVisible={selected} />
      <div className={`custom-node filter-node ${selected ? 'selected-node' : ''} ${glowClass}`}>
        <Handle type="target" position={inSide} id="in" />
        <div className="node-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <SmartIcon size={20} />
            <span className="node-title">{data.label as string}</span>
          </div>
          <div className="node-value-tooltip-container">
            <span className="node-info-icon">ⓘ</span>
            <div className="node-value-tooltip">{getNodeValueProposition('filterNode', data.configType as string)}</div>
          </div>
        </div>
        <div className="node-type-label">Transformation / Filter</div>

        {/* Show the relevant filter value (VLAN, subnet, or port) */}
        {advancedMode && (
          <div className="node-meta">
            {data.configType === CONFIG_TYPES.VLAN_FILTER && <span>VLANs: {data.vlanIds as string || 'None'}</span>}
            {data.configType === CONFIG_TYPES.IP_FILTER && <span>Subnet: {data.ipSubnet as string || 'None'}</span>}
            {data.configType === CONFIG_TYPES.PORT_FILTER && <span>Ports: {data.ports as string || 'None'}</span>}
          </div>
        )}

        {isRunning && (
          <div className="node-metrics">
            <span>Tx: {formatBandwidth(metrics?.txMbps)}</span>
            {/* "drop" CSS class applies red colour — defined in App.css */}
            <span className="drop">Drop: {formatBandwidth(metrics?.filterDroppedMbps || 0)}</span>
          </div>
        )}
        <Handle type="source" position={outSide} id="out" />
      </div>

      {exportDiagramMode && (
        <div style={{
          background: 'var(--node-desc-bg, rgba(20, 20, 20, 0.95))',
          border: '1px solid #e91e63',
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
            const configType = data.configType;
            if (configType === CONFIG_TYPES.VLAN_FILTER) {
              return `VLAN Filter:\n• VLAN IDs: ${data.vlanIds as string || 'None'}\n• Action: PASS matching / DROP others`;
            } else if (configType === CONFIG_TYPES.IP_FILTER) {
              return `IP Filter:\n• Subnet: ${data.ipSubnet as string || 'None'}\n• Action: PASS matching / DROP others`;
            } else if (configType === CONFIG_TYPES.PORT_FILTER) {
              return `Port Filter:\n• Port numbers: ${data.ports as string || 'None'}\n• Action: PASS matching / DROP others`;
            }
            return 'Filter: No criteria set';
          })()}
        </div>
      )}
    </>
  );
};

export const FilterNode = React.memo(FilterNodeComponent);
