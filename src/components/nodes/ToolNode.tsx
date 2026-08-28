/**
 * ToolNode.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Destination tool node renderer (Packet, Metadata, Storage tools).
 */

import React, { useEffect } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { useStore } from '../../store/store';
import type { CustomNode, GigaSmartNodeData } from '../../store/types';
import { formatBandwidth, formatBytes } from '../../utils/format';
import {
  GreenCircleIcon, PacketToolIcon, MetadataToolIcon, S3StorageIcon, WiresharkIcon,
} from '../Icons';
import { CONFIG_TYPES, isMetadataAction } from '../../constants/nodeTypes';
import { getNodeValueProposition } from '../../constants/nodeValues';
import { getDefaultIngestLimitMbps } from '../../constants/toolIngestLimits';
import { GSA_DEFAULT_DATA_PORT_OPTIC, isValidGsaDataPortOptic } from '../../constants/gsaOptics';
import { generateSingleNodeBom } from '../../utils/bomEngine';
import { useGlowClass } from './nodeStyles';

// Short on-canvas tags for each GigaSMART app, shown next to the GSA's title
// so its pipeline is visible at a glance without opening the config panel.
const GSA_APP_ABBREVIATIONS: Record<string, string> = {
  'Deduplication': 'DD',
  'Application Filtering Intelligence': 'AFI',
  'AMI': 'AMI',
  'AMX': 'AMX',
  'Application Visualization': 'AppViz',
};

const ToolNodeComponent: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const peakRxMbps = useStore((state) => state.peakNodeRxMbps[id]);
  const configType = (data.configType as string) || '';
  const toolName = (data.toolName as string) || '';
  const projectLicenseMode = useStore((state) => state.projectLicenseMode);
  const globalTermDuration = useStore((state) => state.defaultTermDuration || '12');
  const globalRegion = useStore((state) => state.projectRegion || 'US');
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);
  const exportDiagramMode = useStore((state) => state.exportDiagramMode);
  const advancedMode = useStore((state) => state.advancedMode);
  const updateNodeData = useStore((state) => state.updateNodeData);

  const isPacketTool = configType === CONFIG_TYPES.PACKET_TOOL;
  const isMetadataTool = configType === CONFIG_TYPES.METADATA_TOOL;
  const isStorageTool = configType === CONFIG_TYPES.STORAGE_TOOL;
  const isFederatedSearch = data.label === 'Splunk Federated Search';

  // Splunk and S3 can link to each other — they need a source handle
  const isSplunk = toolName === 'Splunk';
  // The GigaSMART Appliance (GSA) is a hybrid tool: it consumes packets, runs a
  // fixed GigaSMART pipeline on them, and sends the processed packet stream back
  // out to a TA/HC chassis (its only valid packet destination) — it needs the
  // same source handle Splunk/S3 use for their onward link.
  const isGigaSmartAppliance = toolName === 'GigaSMART Appliance';
  const canLinkOut = isSplunk || isStorageTool || isGigaSmartAppliance;
  // Separate metadata-egress handle, shown only once the appliance actually has
  // a metadata-generating app configured (AMI/AMX/Application Metadata).
  const hasMetadataApp = isGigaSmartAppliance &&
    ((data.gigaSmartApps as GigaSmartNodeData[] | undefined) || []).some((app) => isMetadataAction(app.actionType));
  // Tag the title with whatever's actually configured (in pipeline order),
  // e.g. "AMI, DD" once Deduplication is added alongside AMI.
  const gsaAppTag = isGigaSmartAppliance
    ? ((data.gigaSmartApps as GigaSmartNodeData[] | undefined) || [])
        .map((app) => GSA_APP_ABBREVIATIONS[app.actionType as string] || (app.actionType as string))
        .join(', ')
    : '';

  // The GSA is a Gigamon appliance, so "Customer Supplied Optic" (the default
  // every other packet tool gets on drop) never applies to it. Nodes created
  // before this distinction existed can still carry that stale value in a
  // saved project — correct it in place the first time the node renders.
  const storedIngestOptic = data.ingestOptic as string | undefined;
  const storedIngestOpticQty = data.ingestOpticQty as string | undefined;
  useEffect(() => {
    if (isGigaSmartAppliance && !isValidGsaDataPortOptic(storedIngestOptic)) {
      updateNodeData(id, { ingestOptic: GSA_DEFAULT_DATA_PORT_OPTIC, ingestOpticQty: storedIngestOpticQty || '1' });
    }
  }, [id, isGigaSmartAppliance, storedIngestOptic, storedIngestOpticQty, updateNodeData]);

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

  const nodeObj = { id, type: 'toolNode', position: { x: 0, y: 0 }, data } as CustomNode;
  const nodeBom = generateSingleNodeBom(nodeObj, projectLicenseMode, globalTermDuration, globalRegion, edges, nodes, peakRxMbps);
  
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
        <Handle type="target" position={Position.Left} id="in" style={{ top: '20%', width: '8px', height: '8px', background: '#00e5ff' }} />
        <Handle type="target" position={Position.Left} id="in-2" style={{ top: '40%', width: '8px', height: '8px', background: '#00e5ff' }} />
        <Handle type="target" position={Position.Left} id="in-3" style={{ top: '60%', width: '8px', height: '8px', background: '#00e5ff' }} />
        <Handle type="target" position={Position.Left} id="in-4" style={{ top: '80%', width: '8px', height: '8px', background: '#00e5ff' }} />
        <div className="node-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
            {renderIcon()}
            <span className="node-title">{data.label as string}{gsaAppTag ? ` — ${gsaAppTag}` : ''}</span>
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
        {isRunning && status === 'warning' && statusMessage && !id.startsWith('mission-') && (
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
            {isPacketTool && !id.startsWith('mission-') && (
              <span style={{ color: '#888', display: 'block', fontSize: '9px', marginTop: '2px' }}>
                Ingest Limit: {formatBandwidth((data.ingestLimitMbps as number) || getDefaultIngestLimitMbps(toolName))}
              </span>
            )}
            {(isMetadataTool || isStorageTool) && (
              <span style={{ color: '#00e5ff', display: 'block', fontSize: '9px', marginTop: '2px' }}>
                Ingested: {formatBytes(data.totalIngestedBytes as number)}
              </span>
            )}
          </div>
        )}

        {/* Infinite Storage Pool visualiser */}
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
          <Handle
            type="source"
            position={Position.Right}
            id="out"
            style={hasMetadataApp ? { top: '30%' } : undefined}
            title={isGigaSmartAppliance ? 'Processed packets - must return to a GigaVUE TA/HC chassis (400G data port)' : undefined}
          />
        )}
        {hasMetadataApp && (
          <Handle
            type="source"
            position={Position.Right}
            id="metadata-out"
            style={{ top: '70%', background: '#ffb74d' }}
            title="Generated metadata (AMI/AMX) to metadata tools"
          />
        )}
      </div>

      {exportDiagramMode && (
        <div style={{
          background: 'rgba(20, 20, 20, 0.95)',
          border: '1px solid #ff9800',
          borderRadius: '4px',
          padding: '6px 8px',
          width: '170px',
          boxSizing: 'border-box',
          color: '#ffffff',
          fontSize: '9px',
          fontFamily: 'monospace',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.8)',
          pointerEvents: 'none',
          whiteSpace: 'pre-wrap',
          marginTop: '6px'
        }}>
          {(() => {
            const incoming = edges.filter(e => e.target === id);
            const connDesc = incoming.map(e => {
              const src = nodes.find(n => n.id === e.source);
              const optic = isGigaSmartAppliance
                ? (isValidGsaDataPortOptic(storedIngestOptic) ? storedIngestOptic! : GSA_DEFAULT_DATA_PORT_OPTIC)
                : ((data.ingestOptic as string) || '');
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

export const ToolNode = React.memo(ToolNodeComponent);
