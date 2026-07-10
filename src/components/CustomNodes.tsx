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
import { formatBandwidth, formatPackets, formatBytes } from '../utils/format';
import {
  MapIcon, GreenCircleIcon, SmartIcon, AppIcon,
  SpanIcon, TapIcon, ErspanIcon, EastWestIcon, VmwareIcon,
  PacketToolIcon, MetadataToolIcon, S3StorageIcon, WiresharkIcon,
} from './Icons';
import { CONFIG_TYPES, ACTION_TYPES, isMetadataAction, isDedupAction } from '../constants/nodeTypes';
import { resolveNodeSkus } from '../utils/skuResolver';

import { getNodeValueProposition } from '../constants/nodeValues';
import { generateSingleNodeBom } from '../utils/bomEngine';

const useGlowClass = (id: string): string => {
  const glowingNodeId = useStore((state) => state.glowingNodeId);
  return glowingNodeId === id ? 'node-presentation-glow' : '';
};

const getTapDetails = (sku: string, model: string) => {
  const isULT = sku.includes('ULT') || model.includes('ULT');
  const isActiveTap = model.includes('A-TX') || model.includes('A-SF') || sku.startsWith('GTP-A');
  const isMM = sku.includes('251') || sku.includes('271') || sku.includes('451') || model.toLowerCase().includes('multi-mode') || model.toLowerCase().includes('mm');
  const isSM = sku.includes('253') || sku.includes('273') || sku.includes('453') || model.toLowerCase().includes('single-mode') || model.toLowerCase().includes('sm');
  
  let media = '';
  let splitRatio = '';
  let wavelength = '';

  if (isMM) {
    media = 'MMF (OM5)';
    wavelength = '850nm';
  } else if (isSM) {
    media = 'SMF (OS2)';
    wavelength = '1310nm';
  }

  // Active TAPs don't have a split ratio — they're electrically powered, not passive optical splitters
  if (!isActiveTap) {
    splitRatio = '50/50';
    if (sku.includes('271') || sku.includes('273')) {
      splitRatio = '70/30';
    } else if (sku.includes('451') || sku.includes('453')) {
      splitRatio = '60/40';
    }
  }

  return { media, splitRatio, wavelength, isULT };
};

const getConditionsSummary = (conditions: MapCondition[]) => {
  if (!conditions || conditions.length === 0) return 'No rules';
  return conditions.map((c) => {
    let fieldLabel = '';
    switch (c.field) {
      case 'vlan': fieldLabel = 'VLAN'; break;
      case 'protocol': fieldLabel = 'Proto'; break;
      case 'portdst': fieldLabel = 'Dst Port'; break;
      case 'portsrc': fieldLabel = 'Src Port'; break;
      case 'ipdst': fieldLabel = 'Dst IP'; break;
      case 'ipsrc': fieldLabel = 'Src IP'; break;
      case 'ipver': fieldLabel = 'IP Ver'; break;
      default: fieldLabel = c.field;
    }
    return c.value ? `${fieldLabel}(${c.value})` : fieldLabel;
  }).join(', ');
};


// ─── InputNode ────────────────────────────────────────────────────────────────

export const InputNode: React.FC<NodeProps> = ({ id, data, selected }) => {
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
  const advancedMode = useStore((state) => state.advancedMode);
  const exportDiagramMode = useStore((state) => state.exportDiagramMode);

  const glowClass = useGlowClass(id);

  return (
    <>
      <NodeResizer minWidth={170} minHeight={75} isVisible={selected} />
      <div className={`custom-node map-node ${selected ? 'selected-node' : ''} ${glowClass}`}>
        <Handle type="target" position={Position.Left} id="in" />
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
        <Handle type="source" position={Position.Right} id="out" />
      </div>

      {exportDiagramMode && (
        <div style={{
          background: 'rgba(20, 20, 20, 0.95)',
          border: '1px solid #009688',
          borderRadius: '4px',
          padding: '6px 8px',
          width: '170px',
          boxSizing: 'border-box',
          color: '#fff',
          fontSize: '9px',
          fontFamily: 'monospace',
          boxShadow: '0 2px 8px rgba(0,0,0,0.8)',
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

// ─── FilterNode ───────────────────────────────────────────────────────────────

export const FilterNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const advancedMode = useStore((state) => state.advancedMode);
  const exportDiagramMode = useStore((state) => state.exportDiagramMode);

  const glowClass = useGlowClass(id);

  return (
    <>
      <NodeResizer minWidth={170} minHeight={75} isVisible={selected} />
      <div className={`custom-node filter-node ${selected ? 'selected-node' : ''} ${glowClass}`}>
        <Handle type="target" position={Position.Left} id="in" />
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
        <Handle type="source" position={Position.Right} id="out" />
      </div>

      {exportDiagramMode && (
        <div style={{
          background: 'rgba(20, 20, 20, 0.95)',
          border: '1px solid #e91e63',
          borderRadius: '4px',
          padding: '6px 8px',
          width: '170px',
          boxSizing: 'border-box',
          color: '#fff',
          fontSize: '9px',
          fontFamily: 'monospace',
          boxShadow: '0 2px 8px rgba(0,0,0,0.8)',
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

// ─── ToolNode ─────────────────────────────────────────────────────────────────

export const ToolNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const configType = (data.configType as string) || '';
  const toolName = (data.toolName as string) || '';
  const projectLicenseMode = useStore((state) => state.projectLicenseMode);
  const globalTermDuration = useStore((state) => state.defaultTermDuration || '12');
  const globalRegion = useStore((state) => state.projectRegion || 'US');
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);
  const exportDiagramMode = useStore((state) => state.exportDiagramMode);
  const advancedMode = useStore((state) => state.advancedMode);

  const isPacketTool = configType === CONFIG_TYPES.PACKET_TOOL;
  const isMetadataTool = configType === CONFIG_TYPES.METADATA_TOOL;
  const isStorageTool = configType === CONFIG_TYPES.STORAGE_TOOL;
  const isFederatedSearch = data.label === 'Splunk Federated Search';

  // Splunk and S3 can link to each other — they need a source handle
  const isSplunk = toolName === 'Splunk';
  const canLinkOut = isSplunk || isStorageTool;

  const renderIcon = () => {
    if (isStorageTool) return <S3StorageIcon size={20} />;
    if (toolName === 'Wireshark') return <WiresharkIcon size={20} />;
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

  const glowClass = useGlowClass(id);

  const nodeObj = { id, type: 'toolNode', data } as any;
  const nodeBom = generateSingleNodeBom(nodeObj, projectLicenseMode, globalTermDuration, globalRegion, edges, nodes);
  
  let tooltipText = `${data.label} Configuration BOM:\n`;
  if (nodeBom.length > 0) {
    tooltipText += nodeBom.map(row => `• ${row.qty}x ${row.sku} (${row.description})${row.term ? ` [${row.term} mo]` : ''}`).join('\n');
  } else {
    tooltipText += 'No ingest components configured.';
  }

  return (
    <>
      <NodeResizer minWidth={170} minHeight={75} isVisible={selected} />
      <div 
        className={`custom-node ${nodeClass} ${selected ? 'selected-node' : ''} ${glowClass}`}
        title={tooltipText}
      >
        {Boolean(data.site) && (
          <div style={{ position: 'absolute', top: '-8px', left: '8px', background: '#3b82f6', color: '#fff', fontSize: '9px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', zIndex: 10, border: '1px solid #60a5fa' }}>
            Site: {data.site as string}
          </div>
        )}
        <Handle type="target" position={Position.Left} id="in" />
        <div className="node-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
            {renderIcon()}
            <span className="node-title">{data.label as string}</span>
            {isStorageTool && (
              <span style={{
                marginLeft: '6px',
                fontSize: '8px',
                background: 'rgba(0, 150, 136, 0.25)',
                color: '#1de9b6',
                border: '1px solid rgba(0, 150, 136, 0.4)',
                borderRadius: '3px',
                padding: '1px 4px',
                fontWeight: 'bold',
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap'
              }}>
                ∞ ELASTIC
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className="node-value-tooltip-container">
              <span className="node-info-icon">ⓘ</span>
              <div className="node-value-tooltip">{getNodeValueProposition('toolNode', configType, undefined, toolName)}</div>
            </div>
            {!isStorageTool && <span style={{ fontSize: '12px', color: '#666' }}>⋮</span>}
          </div>
        </div>
        <div className="node-meta-small" style={{ fontSize: '9px', fontWeight: 600 }}>
          {toolName ? `${toolName}` : `Type: ${configType}`}
        </div>

        {/* Show expected format for metadata tools */}
        {advancedMode && isMetadataTool && !isFederatedSearch && !!data.expectedFormat && (
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

        {isRunning && !isFederatedSearch && (
          <div className="node-metrics" style={{ marginTop: '8px' }}>
            <span>Rx: {formatBandwidth(metrics?.rxMbps)}</span>
            {(isMetadataTool || isStorageTool) && (
              <span style={{ color: '#00e5ff', display: 'block', fontSize: '9px', marginTop: '2px' }}>
                Ingested: {formatBytes(data.totalIngestedBytes as number)}
              </span>
            )}
          </div>
        )}

        {/* Infinite Storage Pool visualizer */}
        {isStorageTool && (
          <div className="storage-capacity-bar" style={{
            marginTop: '8px',
            background: 'rgba(0, 77, 64, 0.2)',
            border: '1px dashed rgba(0, 150, 136, 0.3)',
            borderRadius: '4px',
            padding: '4px 6px',
            fontSize: '8.5px',
            color: '#b2dfdb'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>Storage Pool</span>
              <span style={{ color: '#1de9b6', fontWeight: 'bold' }}>∞ Unlimited</span>
            </div>
            <div className="storage-wave-container" style={{
              height: '4px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '2px',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div className="storage-wave-fill" style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: '100%',
                background: 'linear-gradient(90deg, #004d40, #1de9b6, #004d40)',
                backgroundSize: '200% 100%',
                animation: isRunning ? 'storage-pulse-scroll 1.5s linear infinite' : 'none'
              }} />
            </div>
          </div>
        )}

        {canLinkOut && (
          <Handle type="source" position={Position.Right} id="out" />
        )}
      </div>

      {exportDiagramMode && (
        <div style={{
          background: 'rgba(20, 20, 20, 0.95)',
          border: '1px solid #4caf50',
          borderRadius: '4px',
          padding: '6px 8px',
          width: '170px',
          boxSizing: 'border-box',
          color: '#fff',
          fontSize: '9px',
          fontFamily: 'monospace',
          boxShadow: '0 2px 8px rgba(0,0,0,0.8)',
          pointerEvents: 'none',
          whiteSpace: 'pre-wrap',
          marginTop: '6px'
        }}>
          {(() => {
            const incoming = edges.filter(e => e.target === id);
            const connDesc = incoming.map(e => {
              const src = nodes.find(n => n.id === e.source);
              const optic = (data.ingestOptic as string) || '';
              const qty = data.ingestOpticQty || 1;
              const opticLabel = optic ? `${qty}x ${optic}` : 'Direct Cable';
              return `Ingests from ${src?.data?.label || src?.data?.model || 'Chassis'} via ${opticLabel}`;
            }).join('\n') || 'No connection';
            return connDesc;
          })()}
        </div>
      )}
    </>
  );
};

// ─── GigaStreamNode ───────────────────────────────────────────────────────────

export const GigaStreamNode: React.FC<NodeProps> = ({ id, data, selected }) => {
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
        <Handle type="source" position={Position.Right} id="out" style={{ top: '20%' }} />
        <Handle type="source" position={Position.Right} id="out-1" style={{ top: '40%' }} />
        <Handle type="source" position={Position.Right} id="out-2" style={{ top: '60%' }} />
        <Handle type="source" position={Position.Right} id="out-3" style={{ top: '80%' }} />
      </div>
    </>
  );
};

// ─── GigaSmartNode ────────────────────────────────────────────────────────────

export const GigaSmartNode: React.FC<NodeProps> = ({ id, data, selected }) => {
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

// ─── HardwareNode ─────────────────────────────────────────────────────────────

export const HardwareNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const updateNodeData = useStore((state) => state.updateNodeData);
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const model = (data.model as string) || 'Hardware';
  const projectLicenseMode = useStore((state) => state.projectLicenseMode);
  const globalTermDuration = useStore((state) => state.defaultTermDuration || '12');
  const globalRegion = useStore((state) => state.projectRegion || 'US');
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);
  const exportDiagramMode = useStore((state) => state.exportDiagramMode);
  const advancedMode = useStore((state) => state.advancedMode);
  const resolved = resolveNodeSkus(data, projectLicenseMode);
  
  let displaySku = resolved.hwSku;
  if (resolved.swSku) displaySku += ` + ${resolved.swSku}`;
  if (resolved.advSku) displaySku += ` + ${resolved.advSku}`;

  const image = (data.image as string) || '';
  
  let rawIcon = image ? (
    <img src={image} alt={model} style={{ height: '32px', display: 'block', objectFit: 'contain' }} />
  ) : <GreenCircleIcon size={20} />;
  
  if (!image) {
    if (model.includes('TAP')) rawIcon = <TapIcon size={20} />;
    else if (model.includes('HC')) rawIcon = <MapIcon size={20} />;
  }

  const iconComponent = (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {rawIcon}
      {resolved.advSku && (
        <div style={{
          position: 'absolute',
          top: '-5px',
          right: '-5px',
          background: '#ffd54f',
          color: '#000',
          borderRadius: '50%',
          width: '11px',
          height: '11px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '8px',
          fontWeight: 'bold',
          boxShadow: '0 0 3px rgba(0,0,0,0.8)',
          lineHeight: '1',
          pointerEvents: 'none'
        }} title="Advanced Features Licensed">★</div>
      )}
    </div>
  );
  
  const isTap = model.includes('TAP');
  const tapInfo = isTap ? getTapDetails(resolved.hwSku, model) : null;
  const conditions = (data.conditions as MapCondition[]) || [];

  const nodeObj = { id, type: 'hardwareNode', data } as any;
  const nodeBom = generateSingleNodeBom(nodeObj, projectLicenseMode, globalTermDuration, globalRegion, edges, nodes);
  
  let tooltipText = `${model} Configuration BOM:\n`;
  if (nodeBom.length > 0) {
    tooltipText += nodeBom.map(row => `• ${row.qty}x ${row.sku} (${row.description})${row.term ? ` [${row.term} mo]` : ''}`).join('\n');
  } else {
    tooltipText += 'No components configured.';
  }

  const glowClass = useGlowClass(id);

  return (
    <>
      <NodeResizer minWidth={170} minHeight={75} isVisible={selected} />
      <div 
        className={`custom-node hardware-node ${selected ? 'selected-node' : ''} ${glowClass} ${data.hasGigaSmartError ? 'has-error' : ''}`} 
        style={{ borderLeft: '4px solid #ff9800', ...(data.hasGigaSmartError ? { borderColor: '#f44336', boxShadow: '0 0 10px rgba(244,67,54,0.5)' } : {}) }}
        title={tooltipText}
      >
        {Boolean(data.site) && (
          <div style={{ position: 'absolute', top: '-8px', left: '8px', background: '#3b82f6', color: '#fff', fontSize: '9px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', zIndex: 10, border: '1px solid #60a5fa' }}>
            Site: {data.site as string}
          </div>
        )}
        <Handle type="target" position={Position.Left} id="in" />
        <div className="node-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {iconComponent}
            <span className="node-title">{data.label as string}</span>
          </div>
          <div className="node-value-tooltip-container">
            <span className="node-info-icon">ⓘ</span>
            <div className="node-value-tooltip">{getNodeValueProposition('hardwareNode')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between', marginTop: '2px' }}>
          <div className="node-type-label" style={{ display: 'block', color: '#ff9800', fontWeight: 'bold', margin: 0 }}>{model}</div>
          {advancedMode && resolved.advSku && (
            <span style={{
              fontSize: '8px',
              background: 'rgba(255, 213, 79, 0.15)',
              color: '#ffd54f',
              border: '1px solid rgba(255, 213, 79, 0.3)',
              borderRadius: '3px',
              padding: '1px 4px',
              fontWeight: 'bold',
              marginRight: '6px'
            }}>
              ★ ADV LICENSED
            </span>
          )}
        </div>
        {advancedMode && (
          <>
            <div className="node-meta" style={{ fontSize: '9px', opacity: 0.8, marginTop: '2px' }}>
              <span>SKU: {displaySku}</span>
            </div>
            {isTap && tapInfo && (
              <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                {tapInfo.splitRatio && (
                <span style={{
                  fontSize: '8px',
                  background: 'rgba(0, 229, 255, 0.15)',
                  color: '#00e5ff',
                  border: '1px solid rgba(0, 229, 255, 0.3)',
                  borderRadius: '3px',
                  padding: '1px 4px',
                  fontWeight: 'bold'
                }}>
                  ⚖️ {tapInfo.splitRatio}
                </span>
                )}
                {tapInfo.media && (
                  <span style={{
                    fontSize: '8px',
                    background: tapInfo.media.includes('SMF') ? 'rgba(255, 235, 59, 0.15)' : 'rgba(0, 230, 118, 0.15)',
                    color: tapInfo.media.includes('SMF') ? '#ffd54f' : '#00e676',
                    border: tapInfo.media.includes('SMF') ? '1px solid rgba(255, 235, 59, 0.3)' : '1px solid rgba(0, 230, 118, 0.3)',
                    borderRadius: '3px',
                    padding: '1px 4px',
                    fontWeight: 'bold'
                  }}>
                    {tapInfo.media}
                  </span>
                )}
                {tapInfo.wavelength && (
                  <span style={{
                    fontSize: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#ccc',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '3px',
                    padding: '1px 4px'
                  }}>
                    λ {tapInfo.wavelength}
                  </span>
                )}
                {tapInfo.isULT && (
                  <span style={{
                    fontSize: '8px',
                    background: 'rgba(244, 67, 54, 0.15)',
                    color: '#ff8a80',
                    border: '1px solid rgba(244, 67, 54, 0.3)',
                    borderRadius: '3px',
                    padding: '1px 4px',
                    fontWeight: 'bold'
                  }}>
                    🔒 ULT
                  </span>
                )}
              </div>
            )}
          </>
        )}

        {!isTap && conditions.length > 0 && (
          <div style={{
            marginTop: '6px',
            padding: '4px 6px',
            fontSize: '8.5px',
            background: 'rgba(255, 152, 0, 0.08)',
            border: '1px solid rgba(255, 152, 0, 0.2)',
            borderRadius: '3px',
            color: '#ffe0b2',
            wordBreak: 'break-all'
          }}>
            <div style={{ fontWeight: 'bold', color: '#ff9800', marginBottom: '2px' }}>
              🎯 Map ({conditions.length} rule{conditions.length > 1 ? 's' : ''}):
            </div>
            <div>
              {getConditionsSummary(conditions)}
            </div>
          </div>
        )}
        
        {/* Render GigaSMART validation errors */}
        {Boolean(data.hasGigaSmartError) && Boolean(data.gigaSmartErrorMsg) && (
          <div style={{
            marginTop: '8px', 
            padding: '4px',
            background: 'rgba(244,67,54,0.1)',
            border: '1px solid #f44336',
            borderRadius: '4px',
            color: '#f44336',
            fontSize: '9px',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            ⚠️ {String(data.gigaSmartErrorMsg)}
          </div>
        )}
        
        {/* Render internal GigaSMART apps in Advanced Mode */}
        {advancedMode && !!(data.gigaSmartApps && Array.isArray(data.gigaSmartApps) && data.gigaSmartApps.length > 0) && (
          <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,152,0,0.3)', paddingTop: '6px' }}>
            <div style={{ fontSize: '9px', color: '#ff9800', marginBottom: '4px', fontWeight: 'bold' }}>GigaSMART Apps:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {(data.gigaSmartApps as any[]).map((app, idx) => (
                <div key={app.id || idx} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px', padding: '2px 4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AppIcon type={app.actionType} size={14} rate={app.dedupRate} />
                    <span style={{ fontSize: '9px', color: '#ccc' }}>
                      {app.label || app.actionType}
                      {app.actionType === 'Packet Slicing' && ` (${app.sliceSize ?? 128}B)`}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const newApps = (data.gigaSmartApps as any[]).filter(a => a.id !== app.id);
                      updateNodeData(id, { gigaSmartApps: newApps });
                    }}
                    style={{
                      background: 'none', border: 'none', color: '#888', cursor: 'pointer',
                      fontSize: '10px', padding: '0 2px', lineHeight: 1
                    }}
                    title="Remove app"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {isRunning && (
          <div className="node-metrics" style={{ marginTop: '8px' }}>
            <span>In: {formatBandwidth(metrics?.rxMbps)}</span>
            <span>Out: {formatBandwidth(metrics?.txMbps)}</span>
          </div>
        )}

        <Handle type="source" position={Position.Right} id="out" />
      </div>

      {exportDiagramMode && (
        <div style={{
          background: 'rgba(20, 20, 20, 0.95)',
          border: '1px solid #ff9800',
          borderRadius: '4px',
          padding: '6px 8px',
          width: '180px',
          boxSizing: 'border-box',
          color: '#fff',
          fontSize: '9px',
          fontFamily: 'monospace',
          boxShadow: '0 2px 8px rgba(0,0,0,0.8)',
          pointerEvents: 'none',
          whiteSpace: 'pre-wrap',
          marginTop: '6px'
        }}>
          {(() => {
            if (isTap) {
              const allocations = (data.tappedLinkAllocations as { qty: number, optic: string }[]) || [
                { qty: data.tappedLinksCount ?? 1, optic: (data.tappedLinkOptic as string) || (tapInfo?.media?.includes('SMF') ? 'SFP-533 (10G SFP+ LR)' : 'SFP-532 (10G SFP+ SR)') }
              ];
              const descLines = allocations.map(a => `Tapping ${a.qty} network link(s) using ${a.optic} to mirror traffic.`);
              return descLines.join('\n');
            } else {
              // Find incoming TAP links (deduplicated by source node to prevent double-counting)
              const incomingSrcIds = Array.from(new Set(edges.filter(e => e.target === id).map(e => e.source)));
              const tapConns = incomingSrcIds.map(srcId => {
                const src = nodes.find(n => n.id === srcId);
                if (src && String(src.data?.model || '').toUpperCase().includes('TAP')) {
                  const allocations = (src.data?.tappedLinkAllocations as { qty: number, optic: string, toolOptic?: string }[]) || [
                    { qty: src.data?.tappedLinksCount ?? 1, optic: (src.data?.tappedLinkOptic as string) || 'SFP-532 (10G SFP+ SR)' }
                  ];
                  return allocations.map(a => ({
                    label: src.data?.label || 'TAP',
                    linksCount: a.qty,
                    optic: a.toolOptic || a.optic
                  }));
                }
                return null;
              }).filter(Boolean).flat() as { label: string, linksCount: number, optic: string }[];

              let desc = '';
              if (tapConns.length > 0) {
                const grouped = tapConns.reduce((acc, curr) => {
                  if (!acc[curr.optic]) acc[curr.optic] = { links: 0, labels: new Set<string>() };
                  acc[curr.optic].links += curr.linksCount;
                  acc[curr.optic].labels.add(curr.label);
                  return acc;
                }, {} as Record<string, { links: number, labels: Set<string> }>);

                desc += Object.entries(grouped).map(([optic, data]) => {
                  const ports = data.links * 2;
                  const labels = Array.from(data.labels).join(', ');
                  return `Terminating ${ports} TAP ports (from ${data.links} tapped links) from ${labels} using ${optic}.`;
                }).join('\n') + '\n\n';
              }

              const opticsDesc = nodeBom.filter(r => r.type === 'Optic' || r.type === 'TAP' || r.type === 'Module')
                .map(r => `${r.qty}x ${r.sku}`)
                .join(', ');
              
              const has4x10 = nodeBom.some(r => r.sku.includes('PNL-M341'));
              const has4x25 = nodeBom.some(r => r.sku.includes('PNL-M343'));
              let breakoutNote = '';
              if (has4x10 || has4x25) {
                breakoutNote += '\nNote: ';
                if (has4x10) breakoutNote += 'Each 4x10G breakout panel (PNL-M341) requires a 40G QSFP+ optic to supply the 10G ports. ';
                if (has4x25) breakoutNote += 'Each 4x25G breakout panel (PNL-M343) requires a 100G QSFP28 optic to supply the 25G ports. ';
              }
              
              desc += `Configured: ${opticsDesc || 'No modules or optics configured.'}${breakoutNote}\n\n`;
              desc += `Aggregating, filtering, and distributing network traffic to destination tools.`;
              
              if (conditions && conditions.length > 0) {
                desc += `\n\nTraffic Map (Filtering Rules):\n` + conditions.map((c, i) => {
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
              }
              
              return desc;
            }
          })()}
        </div>
      )}
    </>
  );
};
