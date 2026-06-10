import React from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { useStore, type MapCondition } from '../store/store';
import { MapIcon, GreenCircleIcon, SmartIcon, AppIcon, SpanIcon, TapIcon, ErspanIcon, PacketToolIcon, MetadataToolIcon } from './Sidebar';

// Helper to format bps/Mbps
const formatBandwidth = (bps: number | undefined): string => {
  if (bps === undefined) return '0 Mbps';
  if (bps >= 1000) {
    return `${(bps / 1000).toFixed(1)} Gbps`;
  }
  return `${bps.toFixed(0)} Mbps`;
};

export const InputNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const configType = (data.configType as string) || '';

  const renderIcon = () => {
    if (configType.startsWith('SPAN')) return <SpanIcon size={20} />;
    if (configType.startsWith('TAP')) return <TapIcon size={20} />;
    if (configType.startsWith('ERSPAN')) return <ErspanIcon size={20} />;
    return <MapIcon size={20} />;
  };

  const nodeTypeLabel = configType.startsWith('SPAN') 
    ? 'SPAN Input Port' 
    : configType.startsWith('TAP') 
    ? 'TAP Hardware Device' 
    : configType.startsWith('ERSPAN') 
    ? 'ERSPAN Tunnel Input' 
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
          {conditions.length} rules(s)
        </div>
        
        {/* Nested chip row matching the screenshot */}
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
        
        <div className="node-meta">
          {data.configType === 'VLAN Filter' && <span>VLANs: {data.vlanIds as string || 'None'}</span>}
          {data.configType === 'IP Subnet Filter' && <span>Subnet: {data.ipSubnet as string || 'None'}</span>}
          {data.configType === 'Port Filter' && <span>Ports: {data.ports as string || 'None'}</span>}
        </div>
        
        {isRunning && (
          <div className="node-metrics">
            <span>Tx: {formatBandwidth(metrics?.txBps)}</span>
            <span className="drop">Drop: {formatBandwidth(metrics?.droppedPackets)}</span>
          </div>
        )}
        <Handle type="source" position={Position.Right} id="out" />
      </div>
    </>
  );
};

export const ToolNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const configType = (data.configType as string) || '';
  const toolName = (data.toolName as string) || '';
  
  const isPacketTool = configType === 'Packet Tool';
  const isMetadataTool = configType === 'Metadata Tool';

  const renderIcon = () => {
    if (isPacketTool) return <PacketToolIcon size={20} />;
    if (isMetadataTool) return <MetadataToolIcon size={20} />;
    return <GreenCircleIcon size={20} />;
  };

  const status = data.status as 'warning' | 'optimal' | undefined;
  const statusMessage = data.statusMessage as string | undefined;

  let nodeClass = 'tool-node';
  if (isPacketTool) nodeClass = 'tool-node packet-tool-node';
  else if (isMetadataTool) nodeClass = 'tool-node metadata-tool-node';

  if (status === 'warning') {
    nodeClass += ' node-warning';
  }

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
        
        {isMetadataTool && !!data.expectedFormat && (
          <div className="node-meta-small" style={{ opacity: 0.7, fontSize: '8.5px' }}>
            Expects: {data.expectedFormat as string}
          </div>
        )}

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
      </div>
    </>
  );
};

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

export const GigaSmartNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const actionType = (data.actionType as string) || 'Deduplication';

  return (
    <>
      <NodeResizer minWidth={170} minHeight={75} isVisible={selected} />
      <div className={`custom-node gigasmart-node ${selected ? 'selected-node' : ''}`}>
        <Handle type="target" position={Position.Left} id="in" />
        <div className="node-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AppIcon type={actionType} size={22} rate={data.dedupRate as number} />
            <span className="node-title">{data.label as string}</span>
          </div>
          <span style={{ fontSize: '12px', color: '#666' }}>⋮</span>
        </div>
        
        <div className="node-meta-small">
          {actionType === 'Deduplication' && 'Action: Drop'}
          {actionType === 'Packet Slicing' && 'Action: Slice'}
          {actionType === 'Header Stripping' && 'Action: Strip'}
          {(actionType === 'Application Metadata' || actionType === 'AMX' || actionType === 'AMI') && `Format: ${data.metadataFormat as string || 'CEF'}`}
          {actionType !== 'Deduplication' && actionType !== 'Packet Slicing' && actionType !== 'Header Stripping' && actionType !== 'Application Metadata' && actionType !== 'AMX' && actionType !== 'AMI' && `Action: ${actionType}`}
        </div>

        {(actionType === 'Application Metadata' || actionType === 'AMX' || actionType === 'AMI') && (
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
            <span className={actionType === 'Deduplication' ? 'drop' : ''}>
              {actionType === 'Deduplication' ? `Drop: ${formatBandwidth(metrics?.droppedPackets)}` : `Tx: ${formatBandwidth(metrics?.txBps)}`}
            </span>
          </div>
        )}
        <Handle type="source" position={Position.Right} id="out" />
      </div>
    </>
  );
};

export const GroupNode: React.FC<NodeProps> = ({ data, selected }) => {
  return (
    <div className={`custom-group-node ${selected ? 'selected' : ''}`} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div className="group-header" style={{ position: 'absolute', top: '-24px', left: '0', fontSize: '11px', fontWeight: 'bold', color: '#00e5ff', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
        <span>📦 {data.label as string}</span>
      </div>
      <Handle type="source" position={Position.Right} id="out" style={{ top: '50%' }} />
    </div>
  );
};