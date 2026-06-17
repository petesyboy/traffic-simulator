/**
 * CustomNodes.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * All custom React Flow node renderers used on the canvas.
 *
 * CHANGES (refactor/code-quality-improvements)
 * ─────────────────────────────────────────────
 * • `formatBandwidth` imported from utils/format.ts instead of being
 *   duplicated here.
 * • Icons imported from Icons.tsx instead of Sidebar.tsx, removing the
 *   implicit coupling between node rendering and sidebar code.
 * • Node type checks use NODE_TYPES / ACTION_TYPES / CONFIG_TYPES constants
 *   instead of bare magic strings.
 */

import React from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { useStore, type MapCondition } from '../store/store';
import { formatBandwidth } from '../utils/format';
import {
  MapIcon, GreenCircleIcon, SmartIcon, AppIcon,
  SpanIcon, TapIcon, ErspanIcon, EastWestIcon, VmwareIcon,
  PacketToolIcon, MetadataToolIcon, S3StorageIcon,
} from './Icons';
import { CONFIG_TYPES, ACTION_TYPES, isMetadataAction, isDedupAction } from '../constants/nodeTypes';

// ─── InputNode ────────────────────────────────────────────────────────────────

export const InputNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const configType = (data.configType as string) || '';

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

  return (
    <>
      <NodeResizer minWidth={170} minHeight={75} isVisible={selected} />
      <div className={`custom-node input-node ${selected ? 'selected-node' : ''}`}>
        <div className="node-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {renderIcon()}
            <span className="node-title">{data.label as string}</span>
          </div>
        </div>
        <div className="node-type-label" style={{ display: 'block' }}>{nodeTypeLabel}</div>
        <div className="node-meta" style={{ fontSize: '9px', opacity: 0.8 }}>Type: {configType}</div>

        {/* Only show live metrics while simulation is running */}
        {isRunning && (
          <div className="node-metrics">
            <span>Tx: {formatBandwidth(metrics?.txBps)}</span>
          </div>
        )}
        <Handle type="source" position={Position.Right} id="out" />
      </div>
    </>
  );
};

// ─── MapNode ──────────────────────────────────────────────────────────────────

export const MapNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const conditions = (data.conditions as MapCondition[]) || [];

  return (
    <>
      <NodeResizer minWidth={170} minHeight={75} isVisible={selected} />
      <div className={`custom-node map-node ${selected ? 'selected-node' : ''}`}>
        <Handle type="target" position={Position.Left} id="in" />
        <div className="node-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapIcon size={20} />
            <span className="node-title">{data.label as string}</span>
          </div>
          <span style={{ fontSize: '12px', color: '#666', cursor: 'pointer' }}>⋮</span>
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

        {isRunning && (
          <div className="node-metrics" style={{ marginTop: '4px' }}>
            <span>In: {formatBandwidth(metrics?.rxBps)}</span>
            <span>Out: {formatBandwidth(metrics?.txBps)}</span>
          </div>
        )}
        <Handle type="source" position={Position.Right} id="out" />
      </div>
    </>
  );
};

// ─── FilterNode ───────────────────────────────────────────────────────────────

export const FilterNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);

  return (
    <>
      <NodeResizer minWidth={170} minHeight={75} isVisible={selected} />
      <div className={`custom-node filter-node ${selected ? 'selected-node' : ''}`}>
        <Handle type="target" position={Position.Left} id="in" />
        <div className="node-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <SmartIcon size={20} />
            <span className="node-title">{data.label as string}</span>
          </div>
        </div>
        <div className="node-type-label">Transformation / Filter</div>

        {/* Show the relevant filter value (VLAN, subnet, or port) */}
        <div className="node-meta">
          {data.configType === CONFIG_TYPES.VLAN_FILTER && <span>VLANs: {data.vlanIds as string || 'None'}</span>}
          {data.configType === CONFIG_TYPES.IP_FILTER && <span>Subnet: {data.ipSubnet as string || 'None'}</span>}
          {data.configType === CONFIG_TYPES.PORT_FILTER && <span>Ports: {data.ports as string || 'None'}</span>}
        </div>

        {isRunning && (
          <div className="node-metrics">
            <span>Tx: {formatBandwidth(metrics?.txBps)}</span>
            {/* "drop" CSS class applies red colour — defined in App.css */}
            <span className="drop">Drop: {formatBandwidth(metrics?.droppedPackets)}</span>
          </div>
        )}
        <Handle type="source" position={Position.Right} id="out" />
      </div>
    </>
  );
};

// ─── ToolNode ─────────────────────────────────────────────────────────────────

export const ToolNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const configType = (data.configType as string) || '';
  const toolName = (data.toolName as string) || '';

  const isPacketTool = configType === CONFIG_TYPES.PACKET_TOOL;
  const isMetadataTool = configType === CONFIG_TYPES.METADATA_TOOL;
  const isStorageTool = configType === CONFIG_TYPES.STORAGE_TOOL;

  // Splunk and S3 can link to each other — they need a source handle
  const isSplunk = toolName === 'Splunk';
  const canLinkOut = isSplunk || isStorageTool;

  const renderIcon = () => {
    if (isStorageTool) return <S3StorageIcon size={20} />;
    if (isPacketTool) return <PacketToolIcon size={20} />;
    if (isMetadataTool) return <MetadataToolIcon size={20} />;
    return <GreenCircleIcon size={20} />;
  };

  const status = data.status as 'warning' | 'optimal' | undefined;
  const statusMessage = data.statusMessage as string | undefined;

  // Build the CSS class list for the node box.
  // A coloured left border indicates the tool class; a warning border/glow
  // indicates a traffic type or format mismatch detected by SimulationEngine.
  let nodeClass = 'tool-node';
  if (isPacketTool) nodeClass = 'tool-node packet-tool-node';
  else if (isStorageTool) nodeClass = 'tool-node storage-tool-node';
  else if (isMetadataTool) nodeClass = 'tool-node metadata-tool-node';
  if (status === 'warning') nodeClass += ' node-warning';

  return (
    <>
      <NodeResizer minWidth={170} minHeight={75} isVisible={selected} />
      <div className={`custom-node ${nodeClass} ${selected ? 'selected-node' : ''}`}>
        <Handle type="target" position={Position.Left} id="in" />
        <div className="node-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {renderIcon()}
            <span className="node-title">{data.label as string}</span>
          </div>
          <span style={{ fontSize: '12px', color: '#666' }}>⋮</span>
        </div>
        <div className="node-meta-small" style={{ fontSize: '9px', fontWeight: 600 }}>
          {toolName ? `${toolName}` : `Type: ${configType}`}
        </div>

        {/* Show expected format for metadata tools */}
        {isMetadataTool && !!data.expectedFormat && (
          <div className="node-meta-small" style={{ opacity: 0.7, fontSize: '8.5px' }}>
            Expects: {data.expectedFormat as string}
          </div>
        )}

        {/* Traffic mismatch warning badge — shown by SimulationEngine when
            the stream type or format doesn't match what this tool expects */}
        {isRunning && status === 'warning' && statusMessage && (
          <div className="node-warning-badge" style={{
            marginTop: '6px',
            padding: '4px 6px',
            fontSize: '9px',
            color: '#ff9100',
            background: 'rgba(255, 145, 0, 0.08)',
            border: '1px solid rgba(255, 145, 0, 0.2)',
            borderRadius: '3px',
            lineHeight: '1.2'
          }}>
            ⚠️ {statusMessage}
          </div>
        )}

        {isRunning && (
          <div className="node-metrics" style={{ marginTop: '8px' }}>
            <span>Rx: {formatBandwidth(metrics?.rxBps)}</span>
          </div>
        )}
        {canLinkOut && (
          <Handle type="source" position={Position.Right} id="out" />
        )}
      </div>
    </>
  );
};

// ─── GigaStreamNode ───────────────────────────────────────────────────────────

export const GigaStreamNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const algorithm = (data.algorithm as string) || 'Round Robin';

  return (
    <>
      <NodeResizer minWidth={170} minHeight={75} isVisible={selected} />
      <div className={`custom-node gigasmart-node ${selected ? 'selected-node' : ''}`}>
        <Handle type="target" position={Position.Left} id="in" />
        <div className="node-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AppIcon type="Load Balancing" size={20} />
            <span className="node-title">{data.label as string}</span>
          </div>
        </div>
        <div className="node-type-label">GigaStream Load Balancer</div>
        <div className="node-meta">Method: {algorithm}</div>

        {isRunning && (
          <div className="node-metrics">
            <span>Rx: {formatBandwidth(metrics?.rxBps)}</span>
            <span>Tx: {formatBandwidth(metrics?.txBps)}</span>
          </div>
        )}
        <Handle type="source" position={Position.Right} id="out" />
      </div>
    </>
  );
};

// ─── GigaSmartNode ────────────────────────────────────────────────────────────

export const GigaSmartNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const actionType = (data.actionType as string) || ACTION_TYPES.DEDUPLICATION;

  return (
    <>
      <NodeResizer minWidth={170} minHeight={75} isVisible={selected} />
      <div className={`custom-node gigasmart-node ${selected ? 'selected-node' : ''}`}>
        <Handle type="target" position={Position.Left} id="in" />
        <div className="node-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/*
              The AppIcon for Deduplication renders the live deduplication rate
              as a percentage (e.g. "34%") directly inside the icon square.
              This requires passing `rate` from node data.
            */}
            <AppIcon type={actionType} size={22} rate={data.dedupRate as number} />
            <span className="node-title">{data.label as string}</span>
          </div>
          <span style={{ fontSize: '12px', color: '#666' }}>⋮</span>
        </div>

        {/* Action summary line — shows what this GigaSMART engine is doing */}
        <div className="node-meta-small">
          {isDedupAction(actionType) && 'Action: Drop'}
          {actionType === ACTION_TYPES.PACKET_SLICING && 'Action: Slice'}
          {actionType === ACTION_TYPES.HEADER_STRIP && 'Action: Strip'}
          {isMetadataAction(actionType) && `Format: ${data.metadataFormat as string || 'CEF'}`}
          {!isDedupAction(actionType) &&
            actionType !== ACTION_TYPES.PACKET_SLICING &&
            actionType !== ACTION_TYPES.HEADER_STRIP &&
            !isMetadataAction(actionType) &&
            `Action: ${actionType}`}
        </div>

        {/* Metadata output format chip — only shown for AMI/AMX/App Metadata */}
        {isMetadataAction(actionType) && (
          <div className="node-chip-row" style={{ marginTop: '4px' }}>
            <div className="node-inner-chip" style={{ color: '#00e5ff', borderColor: 'rgba(0, 229, 255, 0.2)', fontSize: '8px', padding: '2px 4px' }}>
              Output: {data.metadataFormat as string || 'CEF'}
            </div>
            <span style={{ fontSize: '8.5px', color: '#666' }}>Metadata Gen</span>
          </div>
        )}

        {isRunning && (
          <div className="node-metrics" style={{ marginTop: '8px' }}>
            <span>Rx: {formatBandwidth(metrics?.rxBps)}</span>
            {/* Deduplication shows the dropped volume in red; all others show Tx */}
            <span className={isDedupAction(actionType) ? 'drop' : ''}>
              {isDedupAction(actionType)
                ? `Drop: ${formatBandwidth(metrics?.droppedPackets)}`
                : `Tx: ${formatBandwidth(metrics?.txBps)}`}
            </span>
          </div>
        )}
        <Handle type="source" position={Position.Right} id="out" />
      </div>
    </>
  );
};

// ─── GroupNode ────────────────────────────────────────────────────────────────

export const GroupNode: React.FC<NodeProps> = ({ data, selected }) => {
  return (
    /*
     * GroupNode uses width/height from its `style` prop (set dynamically in
     * store.groupSelectedNodes).  The inner div fills 100% of that area so
     * the dashed border covers the entire bounding box.
     */
    <div className={`custom-group-node ${selected ? 'selected' : ''}`} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Label floats above the bounding box */}
      <div className="group-header" style={{ position: 'absolute', top: '-24px', left: '0', fontSize: '11px', fontWeight: 'bold', color: '#00e5ff', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
        <span>📦 {data.label as string}</span>
      </div>
      {/* The group output handle connects to a downstream Traffic Map */}
      <Handle type="source" position={Position.Right} id="out" style={{ top: '50%' }} />
    </div>
  );
};