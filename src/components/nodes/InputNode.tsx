/**
 * InputNode.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Network input port renderer (SPAN, TAP, ERSPAN, East/West, VMWare).
 */

import React from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { useStore } from '../../store/store';
import { formatBandwidth, formatPackets } from '../../utils/format';
import {
  MapIcon, SpanIcon, TapIcon, ErspanIcon, EastWestIcon, VmwareIcon,
} from '../Icons';
import { CONFIG_TYPES } from '../../constants/nodeTypes';
import { getNodeValueProposition } from '../../constants/nodeValues';
import { useGlowClass } from './nodeStyles';
import { resolveHardwareIcon } from '../../assets/hardwareIcons';

const InputNodeComponent: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const configType = (data.configType as string) || '';
  const advancedMode = useStore((state) => state.advancedMode);

  /** Pick the correct icon based on the port class. */
  const renderIcon = () => {
    if (configType.startsWith(CONFIG_TYPES.SPAN)) return <SpanIcon size={20} />;
    if (configType.startsWith(CONFIG_TYPES.TAP)) return <TapIcon size={20} />;
    if (configType.startsWith(CONFIG_TYPES.ERSPAN)) return <ErspanIcon size={20} />;
    if (configType.startsWith(CONFIG_TYPES.EAST_WEST)) return <EastWestIcon size={20} />;
    if (configType.startsWith(CONFIG_TYPES.VMWARE)) return <VmwareIcon size={20} />;
    return <MapIcon size={20} />;
  };

  const nodeTypeLabel = configType.startsWith(CONFIG_TYPES.SPAN)
    ? 'SPAN Input Port'
    : configType.startsWith(CONFIG_TYPES.TAP)
    ? 'TAP Hardware Device'
    : configType.startsWith(CONFIG_TYPES.ERSPAN)
    ? 'ERSPAN Tunnel Input'
    : configType.startsWith(CONFIG_TYPES.EAST_WEST)
    ? 'East/West Traffic Source'
    : configType.startsWith(CONFIG_TYPES.VMWARE)
    ? 'VMWare Virtual Estate'
    : 'Network Input';

  const glowClass = useGlowClass(id);

  const tapImage = (configType.startsWith(CONFIG_TYPES.TAP) || data.model)
    ? resolveHardwareIcon((data.image as string | undefined) || (data.model as string | undefined) || (data.sku as string | undefined))
    : undefined;

  return (
    <>
      <NodeResizer minWidth={170} minHeight={75} isVisible={selected} />
      <div className={`custom-node input-node ${selected ? 'selected-node' : ''} ${glowClass}`}>
        {Boolean(data.site) && (
          <div style={{ position: 'absolute', top: '-8px', left: '8px', background: '#3b82f6', color: '#fff', fontSize: '9px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', zIndex: 10, border: '1px solid #60a5fa' }}>
            Site: {data.site as string}
          </div>
        )}
        <div className="node-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
            {renderIcon()}
            <span className="node-title">{data.label as string}</span>
          </div>
          <div className="node-value-tooltip-container">
            <span className="node-info-icon">ⓘ</span>
            <div className="node-value-tooltip">{getNodeValueProposition('inputNode', configType)}</div>
          </div>
        </div>
        <div className="node-type-label" style={{ display: 'block' }}>{nodeTypeLabel}</div>
        {tapImage && (
          <div style={{ marginTop: '6px', borderRadius: '3px', overflow: 'hidden', border: '1px solid #333', background: '#080808', maxHeight: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px' }}>
            <img src={tapImage} alt={String(data.model || 'TAP')} style={{ maxWidth: '100%', maxHeight: '38px', objectFit: 'contain' }} />
          </div>
        )}
        {advancedMode && (
          <div className="node-meta" style={{ fontSize: '9px', opacity: 0.8, display: 'flex', justifyContent: 'space-between' }}>
            <span>Type: {configType}</span>
          </div>
        )}

        {/* Only show live metrics while simulation is running */}
        {isRunning && (
          <div className="node-metrics">
            <span>Tx: {formatBandwidth(metrics?.txMbps)}</span>
            {Boolean(data.linkSpeed) && (metrics?.droppedPackets || 0) > 0 && (
              <span className="drop" title="Traffic dropped due to link speed exceeded">
                (Drops: {formatPackets(metrics!.droppedPackets)})
              </span>
            )}
          </div>
        )}

        {/* Multi-directional handles for hierarchical topology routing */}
        <Handle type="target" position={Position.Top} id="in-top" style={{ opacity: 0.6, width: '8px', height: '8px', background: '#3b82f6' }} />
        <Handle type="target" position={Position.Left} id="in" style={{ opacity: 0.6, width: '8px', height: '8px', background: '#3b82f6' }} />
        <Handle type="source" position={Position.Bottom} id="out-bottom" style={{ opacity: 0.6, width: '8px', height: '8px', background: '#3b82f6' }} />
        <Handle type="source" position={Position.Right} id="out" />
      </div>
    </>
  );
};

export const InputNode = React.memo(InputNodeComponent);
