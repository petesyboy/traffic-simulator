/**
 * LinkDetailPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Sidebar panel shown when a connection link (edge) is selected on the canvas.
 * Displays source/target endpoints, installed optics, link speed, physical media,
 * operational purpose, live telemetry, and quick actions.
 */
import React from 'react';
import type { Edge } from '@xyflow/react';
import { useStore } from '../../store/store';
import type { CustomNode, HardwareNodeData, InputNodeData, PortLink } from '../../store/types';
import { getChassisPorts, getPortOpticMap, resolveTapAllocations } from '../../utils/ports';
import { getOpticSpeed, getOpticFiberType, formatOpticLabel, isBreakoutPanelModel } from '../../utils/hardwareUtils';
import { getSkus } from '../../utils/bom/skuUtils';

interface LinkDetailPanelProps {
  selectedEdge: Edge;
  selectedEdges?: Edge[];
  nodes?: CustomNode[];
  edges?: Edge[];
}

export const LinkDetailPanel: React.FC<LinkDetailPanelProps> = ({
  selectedEdge,
  selectedEdges = [selectedEdge],
  nodes: propNodes,
  edges: propEdges,
}) => {
  const storeNodes = useStore((s) => s.nodes);
  const storeEdges = useStore((s) => s.edges);
  const onEdgesChange = useStore((s) => s.onEdgesChange);
  const setSelectedNodeId = useStore((s) => s.setSelectedNodeId);
  const edgeMetrics = useStore((s) => s.edgeMetrics);
  const isRunning = useStore((s) => s.isRunning);

  const nodes = propNodes || storeNodes;
  const edges = propEdges || storeEdges;

  const sourceNode = nodes.find((n) => n.id === selectedEdge.source);
  const targetNode = nodes.find((n) => n.id === selectedEdge.target);

  const sourceLabel = String(sourceNode?.data?.label || sourceNode?.data?.model || selectedEdge.source);
  const targetLabel = String(targetNode?.data?.label || targetNode?.data?.model || selectedEdge.target);
  const sourceModel = String(sourceNode?.data?.model || sourceNode?.type || '');
  const targetModel = String(targetNode?.data?.model || targetNode?.type || '');

  const sourceSite = String(sourceNode?.data?.site || '');
  const targetSite = String(targetNode?.data?.site || '');
  const isCrossSite = sourceSite && targetSite && sourceSite !== targetSite;

  const parallelEdges = edges.filter(
    (e) => e.source === selectedEdge.source && e.target === selectedEdge.target && e.sourceHandle === selectedEdge.sourceHandle,
  );
  const totalParallel = parallelEdges.length;
  const parallelIndex = parallelEdges.findIndex((e) => e.id === selectedEdge.id);

  // ─── Resolve Port & Optic Information ───────────────────────────────────────
  const portLinks = (selectedEdge.data?.portLinks as PortLink[]) || [];
  const primaryLink = portLinks[0];

  const sourcePortId = primaryLink?.sourcePortId || '';
  const targetPortId = primaryLink?.targetPortId || '';

  const skus = getSkus();

  // Source Optic
  let sourceOptic = primaryLink?.opticSku || '';
  if (sourceNode?.type === 'hardwareNode' && !isBreakoutPanelModel(sourceModel) && !sourceModel.includes('TAP')) {
    const hwData = sourceNode.data as HardwareNodeData;
    const ports = getChassisPorts(sourceModel, hwData);
    const opticMap = getPortOpticMap(ports, hwData.optics);
    if (sourcePortId && opticMap.has(sourcePortId)) {
      sourceOptic = opticMap.get(sourcePortId)!;
    }
  } else if (sourceNode?.type === 'hardwareNode' && sourceModel.includes('TAP')) {
    const hwData = sourceNode.data as HardwareNodeData;
    const allocs = resolveTapAllocations(hwData, 'SFP-532');
    sourceOptic = allocs[0]?.toolOptic || allocs[0]?.optic || (hwData.tappedLinkOptic as string) || 'Passive Optical Splitter';
  } else if (sourceNode?.type === 'inputNode') {
    const inputData = sourceNode.data as InputNodeData;
    sourceOptic = inputData.tappedLinkOptic || 'Network Ingress Feed';
  } else if (sourceNode?.type === 'toolNode') {
    sourceOptic = (sourceNode.data?.ingestOptic as string) || 'Tool Export Feed';
  }

  // Target Optic
  let targetOptic = '';
  if (targetNode?.type === 'hardwareNode' && !isBreakoutPanelModel(targetModel) && !targetModel.includes('TAP')) {
    const hwData = targetNode.data as HardwareNodeData;
    const ports = getChassisPorts(targetModel, hwData);
    const opticMap = getPortOpticMap(ports, hwData.optics);
    if (targetPortId && opticMap.has(targetPortId)) {
      targetOptic = opticMap.get(targetPortId)!;
    }
  } else if (targetNode?.type === 'toolNode') {
    targetOptic = (targetNode.data?.ingestOptic as string) || 'Customer Supplied Optic';
  }

  // Speed & Media Resolution
  const sourceSpeed = sourceOptic ? getOpticSpeed(sourceOptic) : 'Unknown';
  const targetSpeed = targetOptic ? getOpticSpeed(targetOptic) : 'Unknown';
  const linkSpeed = sourceSpeed !== 'Unknown' ? sourceSpeed : (targetSpeed !== 'Unknown' ? targetSpeed : '10G / 25G');

  const sourceFiber = sourceOptic ? getOpticFiberType(sourceOptic) : '';
  const targetFiber = targetOptic ? getOpticFiberType(targetOptic) : '';
  const fiberMode = sourceFiber || targetFiber || 'Fiber';

  const isSpeedMismatch =
    sourceSpeed !== 'Unknown' && targetSpeed !== 'Unknown' && sourceSpeed !== targetSpeed;
  const isFiberMismatch =
    sourceFiber && targetFiber && sourceFiber !== targetFiber;

  // Derive Purpose (using British English spelling conventions)
  const derivePurpose = (): { title: string; description: string; badge: string; badgeColor: string } => {
    const isSourceTap = sourceNode?.type === 'inputNode' || String(sourceNode?.data?.model || '').includes('TAP');
    const isSourceHw = sourceNode?.type === 'hardwareNode' && !isSourceTap;
    const isTargetHw = targetNode?.type === 'hardwareNode' && !String(targetNode?.data?.model || '').includes('TAP');
    const isTargetTool = targetNode?.type === 'toolNode';
    const isSourceTool = sourceNode?.type === 'toolNode';
    const isGsa = sourceNode?.data?.toolName === 'GigaSMART Appliance' || targetNode?.data?.toolName === 'GigaSMART Appliance';

    if (isSourceTap && isTargetHw) {
      return {
        title: 'TAP Ingress Feed',
        description: 'Passively mirrors live full-duplex network traffic from network TAP into GigaVUE chassis ingress cages without introducing latency or network interruption.',
        badge: 'TAP MIRROR',
        badgeColor: '#00e5ff',
      };
    }
    if (isSourceHw && isTargetHw) {
      return {
        title: 'Inter-Chassis Fabric Interconnect',
        description: 'Aggregates and forwards filtered network traffic between GigaVUE visibility nodes for centralised security processing, load distribution, or cross-site transport.',
        badge: 'FABRIC TRUNK',
        badgeColor: '#ff9800',
      };
    }
    if (isGsa) {
      return {
        title: 'GigaSMART Appliance Offload Loop',
        description: 'Dedicated high-speed loop routing packet streams through GigaSMART Appliance engines for line-rate hardware offload (SSL decryption, deduplication, slicing).',
        badge: 'GIGASMART OFFLOAD',
        badgeColor: '#ffd54f',
      };
    }
    if (isSourceHw && isTargetTool) {
      return {
        title: 'Tool Delivery Feed',
        description: `Delivers optimised and filtered network traffic directly to ${targetLabel} for deep packet inspection, threat detection, and forensic analysis.`,
        badge: 'TOOL INGEST',
        badgeColor: '#81c784',
      };
    }
    if (isSourceTool && targetNode?.data?.toolName === 'Splunk') {
      return {
        title: 'Metadata & Telemetry Export',
        description: 'Exports enriched NetFlow/IPFIX or Application Metadata records to analytics and SIEM collectors.',
        badge: 'METADATA',
        badgeColor: '#ba68c8',
      };
    }
    return {
      title: 'Traffic Pipeline Link',
      description: 'Transfers packet and telemetry streams between visibility pipeline components.',
      badge: 'PIPELINE',
      badgeColor: '#00e5ff',
    };
  };

  const purpose = derivePurpose();

  // Telemetry
  const throughputMbps = edgeMetrics[selectedEdge.id] || 0;
  const throughputLabel =
    throughputMbps >= 1000
      ? `${(throughputMbps / 1000).toFixed(2)} Gbps`
      : `${throughputMbps.toFixed(0)} Mbps`;

  const handleDeleteEdge = () => {
    onEdgesChange([{ id: selectedEdge.id, type: 'remove' }]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', height: '100%', padding: '16px', overflowY: 'auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888', fontWeight: 600 }}>
            {totalParallel > 1 ? `Parallel Link ${parallelIndex + 1} of ${totalParallel}` : 'Physical Connection Link'}
          </span>
          <span
            style={{
              fontSize: '9px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '3px',
              background: `${purpose.badgeColor}20`,
              color: purpose.badgeColor,
              border: `1px solid ${purpose.badgeColor}40`,
            }}
          >
            {purpose.badge}
          </span>
        </div>
        <h2 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>🔗</span> {totalParallel > 1 ? `Link ${parallelIndex + 1}/${totalParallel}` : 'Selected Link Details'}
        </h2>
        {isCrossSite ? (
          <div style={{ fontSize: '10px', color: '#ffd54f', background: 'rgba(255,213,79,0.1)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,213,79,0.3)' }}>
            🌐 <b>Cross-Site Link:</b> {sourceSite} ➔ {targetSite} (Long-haul optics required)
          </div>
        ) : sourceSite ? (
          <div style={{ fontSize: '10px', color: '#aaa' }}>
            📍 <b>Site:</b> {sourceSite}
          </div>
        ) : null}
      </div>

      {/* Purpose & Role Card */}
      <div className="config-card" style={{ background: '#181818', border: '1px solid #333', borderRadius: '6px', padding: '12px' }}>
        <h3 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#00e5ff', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>🎯</span> Purpose & Role
        </h3>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
          {purpose.title}
        </div>
        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          {purpose.description}
        </p>
      </div>

      {/* Optical & Physical Specifications */}
      <div className="config-card" style={{ background: '#181818', border: '1px solid #333', borderRadius: '6px', padding: '12px' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#ff9800', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>⚡</span> Optical & Physical Specs
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px', fontSize: '11px' }}>
          <div style={{ background: '#111', padding: '8px', borderRadius: '4px', border: '1px solid #282828' }}>
            <div style={{ color: '#888', fontSize: '9px', textTransform: 'uppercase' }}>Link Speed</div>
            <div style={{ color: '#00e5ff', fontWeight: 700, fontSize: '13px', fontFamily: 'monospace', marginTop: '2px' }}>
              {linkSpeed}
            </div>
          </div>
          <div style={{ background: '#111', padding: '8px', borderRadius: '4px', border: '1px solid #282828' }}>
            <div style={{ color: '#888', fontSize: '9px', textTransform: 'uppercase' }}>Physical Medium</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '12px', marginTop: '2px' }}>
              {fiberMode === 'SM' ? 'Singlemode (SMF)' : (fiberMode === 'MM' ? 'Multimode (MMF)' : (fiberMode === 'Copper' ? 'Copper Direct Attach' : 'Optical Fibre'))}
            </div>
          </div>
        </div>

        {/* Mismatch warnings */}
        {isSpeedMismatch && (
          <div style={{ fontSize: '10px', color: '#ef5350', background: 'rgba(239,83,80,0.1)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(239,83,80,0.3)', marginBottom: '10px' }}>
            ⚠️ <b>Speed Mismatch:</b> Source is {sourceSpeed}, but Target is {targetSpeed}. Ensure transceivers operate at matching data rates.
          </div>
        )}
        {isFiberMismatch && (
          <div style={{ fontSize: '10px', color: '#ef5350', background: 'rgba(239,83,80,0.1)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(239,83,80,0.3)', marginBottom: '10px' }}>
            ⚠️ <b>Fibre Mismatch:</b> Source uses {sourceFiber}, but Target uses {targetFiber}.
          </div>
        )}

        {/* Source Endpoint Details */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>
            Source Device (Tx / Output)
          </div>
          <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: '11px' }}>{sourceLabel}</span>
              {sourcePortId && (
                <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#00e5ff', background: 'rgba(0,229,255,0.1)', padding: '1px 5px', borderRadius: '3px' }}>
                  Port {sourcePortId}
                </span>
              )}
            </div>
            <div style={{ fontSize: '10px', color: '#ffb74d' }}>
              {sourceOptic ? formatOpticLabel(sourceOptic) : 'No transceiver fitted (or auto-provisioned)'}
            </div>
            {sourceOptic && skus[sourceOptic.split(' ')[0]] && (
              <div style={{ fontSize: '9px', color: '#777', marginTop: '2px' }}>
                {skus[sourceOptic.split(' ')[0]]}
              </div>
            )}
          </div>
        </div>

        {/* Flow Direction Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#555', margin: '4px 0 8px 0' }}>
          <div style={{ height: '1px', background: '#333', flex: 1 }} />
          <span style={{ fontSize: '10px', color: '#00e5ff' }}>▼ Traffic Flow ▼</span>
          <div style={{ height: '1px', background: '#333', flex: 1 }} />
        </div>

        {/* Target Endpoint Details */}
        <div>
          <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>
            Target Device (Rx / Ingress)
          </div>
          <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: '11px' }}>{targetLabel}</span>
              {targetPortId && (
                <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#00e5ff', background: 'rgba(0,229,255,0.1)', padding: '1px 5px', borderRadius: '3px' }}>
                  Port {targetPortId}
                </span>
              )}
            </div>
            <div style={{ fontSize: '10px', color: '#ffb74d' }}>
              {targetOptic ? formatOpticLabel(targetOptic) : (targetNode?.type === 'toolNode' ? 'Customer Supplied Tool Port' : 'No transceiver fitted')}
            </div>
            {targetOptic && skus[targetOptic.split(' ')[0]] && (
              <div style={{ fontSize: '9px', color: '#777', marginTop: '2px' }}>
                {skus[targetOptic.split(' ')[0]]}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Simulation Telemetry */}
      <div className="config-card" style={{ background: '#181818', border: '1px solid #333', borderRadius: '6px', padding: '12px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#81c784', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>📈</span> Live Simulation Telemetry
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', padding: '8px 10px', borderRadius: '4px', border: '1px solid #282828' }}>
          <span style={{ fontSize: '11px', color: '#aaa' }}>Current Throughput:</span>
          <strong style={{ fontSize: '13px', fontFamily: 'monospace', color: isRunning && throughputMbps > 0 ? '#81c784' : '#888' }}>
            {isRunning ? throughputLabel : 'Simulation Offline'}
          </strong>
        </div>
        {!isRunning && (
          <div style={{ fontSize: '9px', color: '#777', marginTop: '4px' }}>
            Start the simulation in the top header to inject traffic and view real-time pipeline telemetry.
          </div>
        )}
      </div>

      {/* Quick Actions & Navigation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {sourceNode && (
            <button
              onClick={() => setSelectedNodeId(sourceNode.id)}
              style={{
                padding: '6px 8px',
                fontSize: '10px',
                background: '#222',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#ccc',
                cursor: 'pointer',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={`Jump to ${sourceLabel} configuration`}
            >
              ⚙️ Source Node
            </button>
          )}
          {targetNode && (
            <button
              onClick={() => setSelectedNodeId(targetNode.id)}
              style={{
                padding: '6px 8px',
                fontSize: '10px',
                background: '#222',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#ccc',
                cursor: 'pointer',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={`Jump to ${targetLabel} configuration`}
            >
              ⚙️ Target Node
            </button>
          )}
        </div>

        <button
          onClick={handleDeleteEdge}
          style={{
            padding: '8px',
            fontSize: '11px',
            fontWeight: 600,
            background: 'rgba(239, 83, 80, 0.15)',
            border: '1px solid rgba(239, 83, 80, 0.4)',
            borderRadius: '4px',
            color: '#ef5350',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
          }}
        >
          <span>🗑️</span> Remove Link{selectedEdges.length > 1 ? ` (${selectedEdges.length} selected)` : ''}
        </button>
      </div>
    </div>
  );
};
