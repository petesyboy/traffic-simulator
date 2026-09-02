/**
 * GigaSmartNode.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * GigaSMART processing engine node renderer (dedup, slicing, metadata, etc.).
 */

import React from 'react';
import { Handle, NodeResizer, type NodeProps } from '@xyflow/react';
import { useStore } from '../../store/store';
import { formatBandwidth } from '../../utils/format';
import { AppIcon } from '../Icons';
import { ACTION_TYPES, isMetadataAction, isDedupAction, isGtpAction, isHeaderStripAction, isTunnelingAction } from '../../constants/nodeTypes';
import { getNodeValueProposition } from '../../constants/nodeValues';
import { useGlowClass, getHandleSides } from './nodeStyles';

const GigaSmartNodeComponent: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { inSide, outSide } = getHandleSides(data);
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const actionType = (data.actionType as string) || ACTION_TYPES.DEDUPLICATION;
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);
  const advancedMode = useStore((state) => state.advancedMode);

  const isLoadBalancing = actionType === 'Load Balancing (Stateless)' || actionType === 'Load Balancing (Stateful)';
  const linkCount = (data.linkCount as number) || 2;
  const actualLinks = edges.filter((e) => e.source === id).length;
  const isMismatch = isLoadBalancing && actualLinks !== linkCount;

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
        <Handle type="target" position={inSide} id="in" />
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
          {isHeaderStripAction(actionType) && `Action: Strip ${String(data.headerStripProtocol || 'VXLAN')}`}
          {isTunnelingAction(actionType) && `Action: Decap ${String(data.tunnelMode || 'ERSPAN')}`}
          {actionType === ACTION_TYPES.GTP_WHITELISTING && 'Action: GTP Whitelist'}
          {actionType === ACTION_TYPES.GTP_FLOW_SAMPLING && `Action: GTP Sample (${(data.gtpSamplePercent as number) ?? 10}%)`}
          {actionType === ACTION_TYPES.GTP_FLOW_FILTERING && 'Action: GTP Correlation'}
          {isMetadataAction(actionType) && `Format: ${data.metadataFormat as string || 'CEF'}`}
          {!isDedupAction(actionType) &&
            actionType !== ACTION_TYPES.PACKET_SLICING &&
            !isHeaderStripAction(actionType) &&
            !isTunnelingAction(actionType) &&
            !isGtpAction(actionType) &&
            !isMetadataAction(actionType) &&
            `Action: ${actionType}`}
        </div>

        {/* Header Stripping packet breakdown chip */}
        {isHeaderStripAction(actionType) && (
          <div style={{ marginTop: '4px' }}>
            <div style={{ padding: '2px 6px', background: 'rgba(0,0,0,0.4)', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.08)', fontSize: '8.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#ef5350', textDecoration: 'line-through', opacity: 0.85 }}>[{String(data.headerStripProtocol || 'VXLAN')}]</span>
              <span style={{ color: '#888' }}>➔</span>
              <span style={{ color: '#81c784', fontWeight: 600 }}>[IP/Data]</span>
            </div>
          </div>
        )}

        {/* Tunneling / ERSPAN Decap packet breakdown chip */}
        {isTunnelingAction(actionType) && (
          <div style={{ marginTop: '4px' }}>
            <div style={{ padding: '2px 6px', background: 'rgba(0,0,0,0.4)', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.08)', fontSize: '8.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#ef5350', textDecoration: 'line-through', opacity: 0.85 }}>[{String(data.tunnelMode || 'ERSPAN / GRE')}]</span>
              <span style={{ color: '#888' }}>➔</span>
              <span style={{ color: '#81c784', fontWeight: 600 }}>[Inner Payload]</span>
            </div>
          </div>
        )}

        {/* GTP Session Correlation chip */}
        {isGtpAction(actionType) && (
          <div style={{ marginTop: '4px' }}>
            <div style={{ padding: '2px 6px', background: 'rgba(0, 145, 234, 0.12)', borderRadius: '3px', border: '1px solid rgba(0, 145, 234, 0.25)', fontSize: '8.5px', color: '#00e5ff', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>📶</span>
              <span style={{ fontWeight: 600 }}>GTP-C ⮂ GTP-U Correlated</span>
            </div>
          </div>
        )}

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

        {advancedMode && isLoadBalancing && (
          <div style={{ marginTop: '6px', fontSize: '9px' }}>
            <div style={{ opacity: 0.8 }}>Method: {String(data.algorithm || 'Round Robin')}</div>
            <div style={{ color: '#00e5ff', fontWeight: 'bold', marginTop: '2px' }}>
              Configured Links: {linkCount} (Connected: {actualLinks})
            </div>
          </div>
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
        {!hasConnectedHc && nodes.some(n => n.type === 'hardwareNode') && (
          <div style={{ color: '#ef5350', fontSize: '9px', fontWeight: 'bold', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>⚠️ Requires HC Chassis</span>
          </div>
        )}
        { (actionType === 'Load Balancing (Stateless)' || actionType === 'Load Balancing (Stateful)') ? (
          <>
            <Handle type="source" position={outSide} id="out" style={{ top: '20%', width: '8px', height: '8px', background: '#00e5ff' }} />
            <Handle type="source" position={outSide} id="out-2" style={{ top: '40%', width: '8px', height: '8px', background: '#00e5ff' }} />
            <Handle type="source" position={outSide} id="out-3" style={{ top: '60%', width: '8px', height: '8px', background: '#00e5ff' }} />
            <Handle type="source" position={outSide} id="out-4" style={{ top: '80%', width: '8px', height: '8px', background: '#00e5ff' }} />
          </>
        ) : (
          <Handle type="source" position={outSide} id="out" />
        )}
      </div>
    </>
  );
};

export const GigaSmartNode = React.memo(GigaSmartNodeComponent);
