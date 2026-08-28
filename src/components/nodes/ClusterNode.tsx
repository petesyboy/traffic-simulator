/**
 * ClusterNode.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * High-density stacked card node representation for collapsed TAP clusters and
 * Tool groups. Features 3D stacked deck visual styling, rich multi-line breakdown
 * badges for mixed singlemode/multimode optics & split ratios, aggregate traffic
 * throughput metrics, and quick [+] Expand / [-] Collapse triggers.
 */

import React, { useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStore } from '../../store/store';
import type { ClusterNodeData } from '../../store/types';
import { formatBandwidth } from '../../utils/format';

export const ClusterNodeComponent: React.FC<NodeProps> = ({ id, data, selected }) => {
  const cData = data as unknown as ClusterNodeData;
  const toggleClusterCollapse = useStore((s) => s.toggleClusterCollapse);
  const dissolveCluster = useStore((s) => s.dissolveCluster);
  const nodeMetrics = useStore((s) => s.nodeMetrics);
  const isRunning = useStore((s) => s.isRunning);
  const exportDiagramMode = useStore((s) => s.exportDiagramMode);
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);

  const isCollapsed = cData.isCollapsed !== false;
  const clusterType = cData.clusterType || 'tap';
  const summary = cData.summary || {
    count: (cData.memberNodeIds || []).length,
    breakdown: [],
  };

  // Compute aggregate live throughput for member nodes
  const { totalRxMbps, totalTxMbps } = useMemo(() => {
    let rx = 0;
    let tx = 0;
    (cData.memberNodeIds || []).forEach((mId) => {
      const m = nodeMetrics[mId];
      if (m) {
        rx += m.rxMbps || 0;
        tx += m.txMbps || 0;
      }
    });
    // Also check cluster node's own metrics if simulation delivers directly to it
    const selfM = nodeMetrics[id];
    if (selfM) {
      if (selfM.rxMbps > rx) rx = selfM.rxMbps;
      if (selfM.txMbps > tx) tx = selfM.txMbps;
    }
    return { totalRxMbps: rx, totalTxMbps: tx };
  }, [nodeMetrics, cData.memberNodeIds, id]);

  const avgRxMbps = summary.count > 0 ? totalRxMbps / summary.count : 0;

  const isTap = clusterType === 'tap';
  const themeColor = isTap ? '#00e5ff' : '#a855f7';
  const themeBg = isTap ? 'rgba(0, 229, 255, 0.08)' : 'rgba(168, 85, 247, 0.08)';
  const themeBorder = isTap ? 'rgba(0, 229, 255, 0.45)' : 'rgba(168, 85, 247, 0.45)';

  const renderDiagramModeDetails = () => {
    if (!exportDiagramMode) return null;
    const memberIds = new Set(cData.memberNodeIds || []);

    if (isTap) {
      const lines: string[] = [];
      lines.push(`📦 TAP Architecture Stack: ${summary.count}x modules`);
      lines.push(`⚡ Total Links Monitored: ${summary.totalLinks || summary.count * 6} network links`);
      
      if (summary.isMixed) {
        summary.breakdown.forEach((b) => {
          lines.push(` • ${b.count}x ${b.model} (${b.fiberType || 'Fiber'} ${b.splitRatio || ''} · ${b.totalLinks || b.linksCount || 0} links)`);
        });
      } else {
        const b = summary.breakdown[0];
        if (b) lines.push(`Optics: ${b.fiberType || 'Fiber'} · ${b.splitRatio || '50/50'} Split`);
      }

      // Calculate tray occupancy
      const m200Trays = Math.floor(summary.count / 6);
      const rem = summary.count % 6;
      const m100Trays = rem > 0 ? (rem <= 3 ? 1 : 0) : 0;
      const extraM200 = rem > 3 ? 1 : 0;
      const totalM200 = m200Trays + extraM200;
      const trayParts: string[] = [];
      if (totalM200 > 0) trayParts.push(`${totalM200}x TAP-M200T`);
      if (m100Trays > 0) trayParts.push(`${m100Trays}x TAP-M100T`);
      if (trayParts.length > 0) lines.push(`Rack Trays: ${trayParts.join(' + ')}`);

      // Outbound connections
      const outbound = edges.filter((e) => e.source === id || memberIds.has(e.source));
      const destCounts = new Map<string, number>();
      outbound.forEach((e) => {
        const targetNode = nodes.find((n) => n.id === e.target);
        if (targetNode && targetNode.id !== id && !memberIds.has(targetNode.id)) {
          const lbl = (targetNode.data?.label as string) || (targetNode.data?.model as string) || 'Chassis';
          destCounts.set(lbl, (destCounts.get(lbl) || 0) + 1);
        }
      });
      if (destCounts.size > 0) {
        const destStr = Array.from(destCounts.entries())
          .map(([name, count]) => `${name} (${count} link${count > 1 ? 's' : ''})`)
          .join(', ');
        lines.push(`Feeds: ${destStr}`);
      } else {
        lines.push(`Feeds: Standalone`);
      }

      return (
        <div
          style={{
            background: 'var(--node-desc-bg, rgba(20, 20, 20, 0.95))',
            border: '1px solid #ff9800',
            borderRadius: '4px',
            padding: '6px 8px',
            minWidth: '220px',
            maxWidth: '320px',
            boxSizing: 'border-box',
            color: 'var(--text-primary, #fff)',
            fontSize: '9px',
            fontFamily: 'monospace',
            boxShadow: 'var(--shadow-md, 0 2px 8px rgba(0,0,0,0.8))',
            pointerEvents: 'none',
            whiteSpace: 'pre-wrap',
            marginTop: '6px',
            lineHeight: '1.35',
          }}
        >
          {lines.join('\n')}
        </div>
      );
    } else {
      const lines: string[] = [];
      lines.push(`🛠️ Tool Receiver Array: ${summary.count}x instances`);
      
      if (summary.isMixed) {
        summary.breakdown.forEach((b) => {
          const limitStr = b.ingestLimitMbps ? `${(b.ingestLimitMbps / 1000).toFixed(0)} Gbps each` : 'Packet Tool';
          lines.push(` • ${b.count}x ${b.toolName || b.model} (${limitStr})`);
        });
      } else {
        const b = summary.breakdown[0];
        const limitStr = b?.ingestLimitMbps ? `${(b.ingestLimitMbps / 1000).toFixed(0)} Gbps limit each` : 'Standard Ingest';
        lines.push(`Target: ${b?.toolName || 'Packet Analysis Tool'} (${limitStr})`);
      }

      if (summary.totalIngestLimitMbps) {
        lines.push(`Total Ingest Rating: ${(summary.totalIngestLimitMbps / 1000).toFixed(0)} Gbps`);
      }

      // Inbound connections
      const inbound = edges.filter((e) => e.target === id || memberIds.has(e.target));
      const srcCounts = new Map<string, number>();
      inbound.forEach((e) => {
        const srcNode = nodes.find((n) => n.id === e.source);
        if (srcNode && srcNode.id !== id && !memberIds.has(srcNode.id)) {
          const lbl = (srcNode.data?.label as string) || (srcNode.data?.model as string) || 'Chassis';
          srcCounts.set(lbl, (srcCounts.get(lbl) || 0) + 1);
        }
      });
      if (srcCounts.size > 0) {
        const srcStr = Array.from(srcCounts.entries())
          .map(([name, count]) => `${name} (${count} link${count > 1 ? 's' : ''})`)
          .join(', ');
        lines.push(`Ingests from: ${srcStr}`);
      } else {
        lines.push(`Ingests from: Unconnected`);
      }

      return (
        <div
          style={{
            background: 'var(--node-desc-bg, rgba(20, 20, 20, 0.95))',
            border: '1px solid #ff9800',
            borderRadius: '4px',
            padding: '6px 8px',
            minWidth: '220px',
            maxWidth: '320px',
            boxSizing: 'border-box',
            color: 'var(--text-primary, #fff)',
            fontSize: '9px',
            fontFamily: 'monospace',
            boxShadow: 'var(--shadow-md, 0 2px 8px rgba(0,0,0,0.8))',
            pointerEvents: 'none',
            whiteSpace: 'pre-wrap',
            marginTop: '6px',
            lineHeight: '1.35',
          }}
        >
          {lines.join('\n')}
        </div>
      );
    }
  };

  if (!isCollapsed) {
    // ── EXPANDED BOUNDING HEADER ──
    return (
      <div style={{ position: 'relative' }}>
        <div
          style={{
            background: 'rgba(18, 22, 30, 0.92)',
            border: `1px dashed ${themeColor}`,
            borderRadius: '8px',
            padding: '8px 12px',
            boxShadow: `0 0 16px ${themeBg}`,
            minWidth: '220px',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px' }}>{isTap ? '⚡' : '🛠️'}</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: themeColor }}>
                {cData.label} (Expanded)
              </span>
            </div>
            <button
              onClick={() => toggleClusterCollapse(id)}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="Collapse back into stacked card"
            >
              <span>⤡</span> Collapse Stack
            </button>
          </div>
          {/* Handles to ensure ReactFlow always has registered endpoints */}
          <Handle
            type="target"
            position={Position.Left}
            id="in"
            style={{ opacity: 0, pointerEvents: 'none', width: '1px', height: '1px' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="out"
            style={{ opacity: 0, pointerEvents: 'none', width: '1px', height: '1px' }}
          />
        </div>
        {renderDiagramModeDetails()}
      </div>
    );
  }

  // ── COLLAPSED 3D STACKED CARD DECK ──
  return (
    <div style={{ position: 'relative', minWidth: '260px', maxWidth: '320px' }}>
      {/* 3D Under-layer Card 2 (Bottommost) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: 'translate(8px, 8px)',
          background: '#0a0e17',
          border: `1px solid ${themeBorder}`,
          borderRadius: '10px',
          zIndex: 1,
          opacity: 0.5,
          pointerEvents: 'none',
        }}
      />

      {/* 3D Under-layer Card 1 (Middle) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: 'translate(4px, 4px)',
          background: '#101624',
          border: `1px solid ${themeBorder}`,
          borderRadius: '10px',
          zIndex: 2,
          opacity: 0.8,
          pointerEvents: 'none',
        }}
      />

      {/* Main Top Card */}
      <div
        style={{
          position: 'relative',
          zIndex: 3,
          background: 'linear-gradient(145deg, #151d2d 0%, #0d131f 100%)',
          border: `1.5px solid ${selected ? '#fff' : themeColor}`,
          borderRadius: '10px',
          padding: '10px 14px',
          boxShadow: selected
            ? `0 0 20px ${themeColor}, 0 8px 24px rgba(0,0,0,0.8)`
            : `0 4px 16px rgba(0,0,0,0.6), 0 0 10px ${themeBg}`,
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Handles */}
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          style={{
            background: themeColor,
            width: '10px',
            height: '10px',
            border: '2px solid #111',
            borderRadius: '50%',
          }}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          style={{
            background: themeColor,
            width: '10px',
            height: '10px',
            border: '2px solid #111',
            borderRadius: '50%',
          }}
        />

        {/* HEADER BAR */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '15px' }}>{isTap ? '⚡' : '🛠️'}</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: themeColor, letterSpacing: '0.2px' }}>
                {cData.label}
              </span>
              <span style={{ fontSize: '10px', color: '#88a0c0', fontWeight: 600 }}>
                {isTap ? 'TAP Module Cluster' : 'Tool Receiver Cluster'}
              </span>
            </div>
          </div>

          <button
            onClick={() => toggleClusterCollapse(id)}
            style={{
              background: `linear-gradient(135deg, ${themeColor} 0%, ${isTap ? '#0070f3' : '#7928ca'} 100%)`,
              border: 'none',
              color: '#fff',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              transition: 'transform 0.1s ease',
            }}
            title="Expand to view and edit all individual nodes"
          >
            <span>+</span> Expand
          </button>
        </div>

        {/* SUMMARY BADGES SECTION */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '6px' }}>
          {isTap && summary.totalLinks !== undefined && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(0, 229, 255, 0.12)',
                border: '1px solid rgba(0, 229, 255, 0.25)',
                borderRadius: '4px',
                padding: '3px 7px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#00e5ff',
              }}
            >
              <span>🔗</span>
              <span>
                {summary.totalLinks} Total Links Tapped ({summary.count} TAPs)
              </span>
            </div>
          )}

          {/* TAP BREAKDOWN LIST (Handles homogeneous and mixed singlemode/multimode types) */}
          {isTap && summary.breakdown && summary.breakdown.length > 0 && (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '5px',
                padding: '5px 8px',
                fontSize: '10.5px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
              }}
            >
              {summary.breakdown.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: '#c5d3e8',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    • {item.count}x {item.model}
                  </span>
                  <span style={{ color: '#88a0c0', fontSize: '10px' }}>
                    {item.fiberType || 'Fiber'} · {item.splitRatio || '50/50'} ({item.totalLinks || (item.count * (item.linksCount || 2))} links)
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* TOOL BREAKDOWN & INGEST LIMITS */}
          {!isTap && summary.breakdown && summary.breakdown.length > 0 && (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '5px',
                padding: '5px 8px',
                fontSize: '10.5px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
              }}
            >
              {summary.breakdown.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: '#e2d4f5',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    • {item.count}x {item.toolName || item.model}
                  </span>
                  <span style={{ color: '#b392e2', fontSize: '10px' }}>
                    {item.ingestLimitMbps ? `${(item.ingestLimitMbps / 1000).toFixed(0)} Gbps limit each` : 'Packet Tool'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* LIVE SIMULATION TRAFFIC METRICS */}
          {isRunning && (totalRxMbps > 0 || totalTxMbps > 0) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(0, 200, 83, 0.15)',
                border: '1px solid rgba(0, 200, 83, 0.4)',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                color: '#69f0ae',
                fontWeight: 700,
                marginTop: '2px',
              }}
            >
              <span>📊 Active Ingest:</span>
              <span>
                {formatBandwidth(totalRxMbps || totalTxMbps)}
                {!isTap && summary.count > 1 && (
                  <span style={{ fontSize: '9.5px', color: '#b9f6ca', fontWeight: 'normal', marginLeft: '4px' }}>
                    ({formatBandwidth(avgRxMbps)} avg / tool)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            marginTop: '8px',
            paddingTop: '6px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <button
            onClick={() => dissolveCluster(id)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888',
              fontSize: '10px',
              cursor: 'pointer',
              padding: '2px 4px',
              textDecoration: 'underline',
            }}
            title="Ungroup back to independent nodes"
          >
            Ungroup Stack
          </button>
        </div>
      </div>
      {renderDiagramModeDetails()}
    </div>
  );
};

export const ClusterNode = React.memo(ClusterNodeComponent);
export default ClusterNode;
