/**
 * DwdmNetworkNode.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Custom node representing a high-capacity DWDM (Dense Wavelength Division
 * Multiplexing) Optical Transport Network / WAN ring interconnecting multiple
 * data centre sites and aggregation chassis without using cloud iconography.
 */

import React, { useMemo } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { useStore } from '../../store/store';
import { formatBandwidth } from '../../utils/format';
import { useGlowClass } from './nodeStyles';

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
        {/* Handles on all 4 sides for intuitive multi-site interconnectivity */}
        <Handle type="target" position={Position.Left} id="in-left" style={{ top: '35%', background: '#c084fc', width: '8px', height: '8px' }} />
        <Handle type="source" position={Position.Left} id="out-left" style={{ top: '65%', background: '#a855f7', width: '8px', height: '8px' }} />

        <Handle type="target" position={Position.Right} id="in-right" style={{ top: '35%', background: '#c084fc', width: '8px', height: '8px' }} />
        <Handle type="source" position={Position.Right} id="out-right" style={{ top: '65%', background: '#a855f7', width: '8px', height: '8px' }} />

        <Handle type="target" position={Position.Top} id="in-top" style={{ left: '35%', background: '#c084fc', width: '8px', height: '8px' }} />
        <Handle type="source" position={Position.Top} id="out-top" style={{ left: '65%', background: '#a855f7', width: '8px', height: '8px' }} />

        <Handle type="target" position={Position.Bottom} id="in-bottom" style={{ left: '35%', background: '#c084fc', width: '8px', height: '8px' }} />
        <Handle type="source" position={Position.Bottom} id="out-bottom" style={{ left: '65%', background: '#a855f7', width: '8px', height: '8px' }} />

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
            <span style={{ color: connectedNodes.length > 0 ? '#4ade80' : '#94a3b8' }}>
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
