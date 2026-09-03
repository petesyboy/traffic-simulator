/**
 * DwdmNetworkNode.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Custom node representing a high-capacity DWDM (Dense Wavelength Division
 * Multiplexing) Optical Transport Network / WAN ring interconnecting multiple
 * data centre sites and aggregation chassis without using cloud iconography.
 */

import React, { useMemo } from 'react';
import { Handle, Position, NodeResizer, useConnection, type NodeProps } from '@xyflow/react';
import { useStore } from '../../store/store';
import { formatBandwidth } from '../../utils/format';
import { useGlowClass } from './nodeStyles';

/**
 * The ring's eight ports. Ingress and egress sit on all four sides so links can
 * come in from whichever direction a site happens to be laid out.
 */
const RING_PORTS = [
  { id: 'in-left', type: 'target' as const, position: Position.Left, offset: { top: '35%' }, label: 'Ingress ← from a site to the west' },
  { id: 'out-left', type: 'source' as const, position: Position.Left, offset: { top: '65%' }, label: 'Egress → to a site to the west' },
  { id: 'in-right', type: 'target' as const, position: Position.Right, offset: { top: '35%' }, label: 'Ingress → from a site to the east' },
  { id: 'out-right', type: 'source' as const, position: Position.Right, offset: { top: '65%' }, label: 'Egress ← to a site to the east' },
  { id: 'in-top', type: 'target' as const, position: Position.Top, offset: { left: '35%' }, label: 'Ingress ↓ from a site above' },
  { id: 'out-top', type: 'source' as const, position: Position.Top, offset: { left: '65%' }, label: 'Egress ↑ to a site above' },
  { id: 'in-bottom', type: 'target' as const, position: Position.Bottom, offset: { left: '35%' }, label: 'Ingress ↑ from a site below' },
  { id: 'out-bottom', type: 'source' as const, position: Position.Bottom, offset: { left: '65%' }, label: 'Egress ↓ to a site below' },
];

const DwdmNetworkNodeComponent: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const edges = useStore((state) => state.edges);
  const nodes = useStore((state) => state.nodes);

  const wavelengthSpeed = (data.wavelengthSpeed as string) || '100G';
  const protectionMode = (data.protectionMode as string) || 'Protected Ring (1+1)';
  const spanDistanceKm = (data.spanDistanceKm as number) || 40;
  const latencyMs = (data.latencyMs as number) || 2.0;
  const carrierName = (data.carrierName as string) || 'Dark Fiber Transport';

  // Find all connected endpoints (incoming and outgoing)
  const connectedNodes = useMemo(() => {
    const connectedNodeIds = new Set<string>();
    edges.forEach((e) => {
      if (e.source === id) connectedNodeIds.add(e.target);
      if (e.target === id) connectedNodeIds.add(e.source);
    });
    return nodes.filter((n) => connectedNodeIds.has(n.id));
  }, [edges, nodes, id]);

  // While a link is being dragged, only the opposite kind of port can accept it:
  // a drag started at another node's output needs one of this ring's inputs, and
  // vice versa. Anything else is dimmed so there is one obvious place to drop.
  const connection = useConnection((c) => ({
    inProgress: c.inProgress,
    fromType: c.inProgress ? c.fromHandle?.type : undefined,
    fromNodeId: c.inProgress ? c.fromNode?.id : undefined,
  }));
  const acceptingType =
    connection.inProgress && connection.fromNodeId !== id
      ? connection.fromType === 'source'
        ? 'target'
        : 'source'
      : null;

  const glowClass = useGlowClass(id);
  const isActive = isRunning && ((metrics?.rxMbps || 0) > 0 || (metrics?.txMbps || 0) > 0);

  return (
    <>
      <NodeResizer minWidth={260} minHeight={130} isVisible={selected} />
      <div
        className={`custom-node dwdm-network-node ${selected ? 'selected-node' : ''} ${isActive ? 'dwdm-active' : ''} ${glowClass}`}
        style={{
          width: '280px',
          minHeight: '135px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(24, 16, 47, 0.95) 0%, rgba(12, 10, 28, 0.96) 100%)',
          border: selected ? '2px solid #a855f7' : '1.5px solid rgba(168, 85, 247, 0.55)',
          boxShadow: isActive
            ? '0 0 25px rgba(168, 85, 247, 0.4), inset 0 0 15px rgba(168, 85, 247, 0.15)'
            : '0 4px 18px rgba(0, 0, 0, 0.45)',
          padding: '12px 14px',
          boxSizing: 'border-box',
          color: '#f3e8ff',
          position: 'relative',
          userSelect: 'none',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Ingress and egress on all four sides for multi-site interconnectivity.
            Hovering names each port; dragging a link lights up the ones that
            can take it. */}
        {RING_PORTS.map((port) => {
          const canAccept = acceptingType === port.type;
          const dimmed = acceptingType !== null && !canAccept;
          return (
            <Handle
              key={port.id}
              type={port.type}
              position={port.position}
              id={port.id}
              title={port.label}
              className={canAccept ? 'dwdm-port-open' : undefined}
              style={{
                ...port.offset,
                width: canAccept ? '18px' : '10px',
                height: canAccept ? '18px' : '10px',
                background: canAccept ? 'var(--status-green-light, #4ade80)' : port.type === 'target' ? '#c084fc' : '#a855f7',
                border: canAccept ? '2px solid #bbf7d0' : '1px solid rgba(12, 10, 28, 0.8)',
                boxShadow: canAccept ? '0 0 0 4px rgba(74, 222, 128, 0.25), 0 0 14px rgba(74, 222, 128, 0.9)' : 'none',
                opacity: dimmed ? 0.18 : 1,
                zIndex: canAccept ? 12 : 1,
                transition: 'width 0.12s ease, height 0.12s ease, opacity 0.12s ease, box-shadow 0.12s ease',
              }}
            />
          );
        })}

        {/* Node Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: 'rgba(168, 85, 247, 0.2)',
                border: '1px solid rgba(192, 132, 252, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '900',
                color: '#e9d5ff',
                boxShadow: '0 0 10px rgba(168, 85, 247, 0.3)',
              }}
            >
              λ
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#f3e8ff', letterSpacing: '0.01em' }}>
                {(data.label as string) || 'DWDM Transport Network'}
              </div>
              <div style={{ fontSize: '9px', color: '#c084fc', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                Optical Transport • {carrierName}
              </div>
            </div>
          </div>
        </div>

        {/* Transport Specifications Badges */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {acceptingType && (
            <div
              style={{
                fontSize: '10px',
                padding: '2px 7px',
                borderRadius: '4px',
                background: 'rgba(74, 222, 128, 0.2)',
                border: '1px solid rgba(74, 222, 128, 0.6)',
                color: '#bbf7d0',
                fontWeight: 700,
              }}
            >
              ↳ Drop on a glowing {acceptingType === 'target' ? 'ingress' : 'egress'} port
            </div>
          )}
          <div
            style={{
              fontSize: '10px',
              padding: '2px 7px',
              borderRadius: '4px',
              background: 'rgba(168, 85, 247, 0.25)',
              border: '1px solid rgba(192, 132, 252, 0.45)',
              color: '#f5d0fe',
              fontWeight: 600,
            }}
          >
            ⚡ {wavelengthSpeed} Wavelength
          </div>
          <div
            style={{
              fontSize: '10px',
              padding: '2px 7px',
              borderRadius: '4px',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: '#bae6fd',
              fontWeight: 500,
            }}
          >
            🛡️ {protectionMode}
          </div>
        </div>

        {/* Connected Sites Summary */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(168, 85, 247, 0.2)',
            borderRadius: '6px',
            padding: '6px 8px',
            fontSize: '10px',
            marginBottom: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d8b4fe', marginBottom: '2px', fontWeight: 600 }}>
            <span>Connected Endpoints:</span>
            <span style={{ color: connectedNodes.length > 0 ? 'var(--status-green-light, #4ade80)' : '#94a3b8' }}>
              {connectedNodes.length} Chassis
            </span>
          </div>
          {connectedNodes.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
              {connectedNodes.slice(0, 4).map((n) => (
                <span
                  key={n.id}
                  style={{
                    fontSize: '9px',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    background: 'rgba(168, 85, 247, 0.3)',
                    color: '#f3e8ff',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {String(n.data?.label || n.data?.model || n.id)}
                </span>
              ))}
              {connectedNodes.length > 4 && (
                <span style={{ fontSize: '9px', color: '#c084fc', padding: '1px 3px' }}>
                  +{connectedNodes.length - 4} more
                </span>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '9px', color: '#94a3b8', fontStyle: 'italic' }}>
              Drag links from TA200/TA25/HC nodes to connect
            </div>
          )}
        </div>

        {/* Optical Span & Live Bandwidth Metrics */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#cbd5e1', paddingTop: '2px' }}>
          <span>Span: {spanDistanceKm} km ({latencyMs} ms)</span>
          {isRunning ? (
            <span style={{ color: '#c084fc', fontWeight: 'bold' }}>
              Throughput: {formatBandwidth(metrics?.rxMbps || 0)}
            </span>
          ) : (
            <span style={{ color: '#a855f7' }}>Ready</span>
          )}
        </div>
      </div>
    </>
  );
};

export const DwdmNetworkNode = React.memo(DwdmNetworkNodeComponent);
