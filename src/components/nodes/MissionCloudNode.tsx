/**
 * MissionCloudNode.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Dedicated custom node representing the Cloud VPC / Hybrid Cloud workloads
 * at the top of the Mission Demo network hierarchy (matching the presentation slide).
 */

import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStore } from '../../store/store';
import { formatBandwidth } from '../../utils/format';

const MissionCloudNodeComponent: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);

  return (
    <div
      className={`custom-node mission-cloud-node ${selected ? 'selected-node' : ''}`}
      style={{
        width: '320px',
        minHeight: '110px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
        border: '2px dashed #38bdf8',
        boxShadow: '0 0 20px rgba(56, 189, 248, 0.25), inset 0 0 15px rgba(56, 189, 248, 0.1)',
        padding: '12px 16px',
        boxSizing: 'border-box',
        color: '#fff',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Target handle for return or inspection */}
      <Handle type="target" position={Position.Left} id="in" style={{ width: '8px', height: '8px', background: '#38bdf8' }} />

      {/* Cloud Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>☁️</span>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#38bdf8', letterSpacing: '0.02em' }}>
              {(data.label as string) || 'Hybrid Cloud Estate (AWS / Azure / VPC)'}
            </div>
            <div style={{ fontSize: '9px', color: '#94a3b8' }}>Virtual Machines, Kubernetes & Container Services</div>
          </div>
        </div>
      </div>

      {/* Cloud VMs / Workload Containers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
        <div
          style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '6px',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ fontSize: '11px' }}>📦</span>
          <div>
            <div style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#e0f2fe' }}>EKS Workloads</div>
            <div style={{ fontSize: '8px', color: '#7dd3fc' }}>Microservices & APIs</div>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '6px',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ fontSize: '11px' }}>🖥️</span>
          <div>
            <div style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#e0f2fe' }}>EC2 Instances</div>
            <div style={{ fontSize: '8px', color: '#7dd3fc' }}>App & DB Clusters</div>
          </div>
        </div>
      </div>

      {/* Live Metrics */}
      {isRunning && (
        <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#38bdf8', fontWeight: 'bold' }}>
          <span>Cloud Egress:</span>
          <span>{formatBandwidth(metrics?.txMbps || 18000)}</span>
        </div>
      )}

      {/* Downward handle towards Routers */}
      <Handle type="source" position={Position.Bottom} id="out-down" style={{ left: '50%', width: '10px', height: '10px', background: '#38bdf8' }} />

      {/* Right handles for Direct / Pipeline Taps */}
      <Handle type="source" position={Position.Right} id="out" style={{ top: '30%', width: '10px', height: '10px', background: '#38bdf8' }} />
      <Handle type="source" position={Position.Right} id="out-2" style={{ top: '70%', width: '10px', height: '10px', background: '#38bdf8' }} />
    </div>
  );
};

export const MissionCloudNode = React.memo(MissionCloudNodeComponent);
