/**
 * MissionPipelineNode.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Dedicated custom node representing the iconic "Gigamon Deep Observability Pipeline"
 * centerpiece for the Mission Demo (matching the metallic cylinder presentation slide).
 */

import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStore } from '../../store/store';
import { formatBandwidth } from '../../utils/format';

const MissionPipelineNodeComponent: React.FC<NodeProps> = ({ id, selected }) => {
  const metrics = useStore((state) => state.nodeMetrics[id]);

  const rx = metrics?.rxMbps || 0;
  const tx = metrics?.txMbps || 0;
  const savingsPct = rx > 0 ? Math.max(0, Math.round(((rx - tx) / rx) * 100)) : 28;

  return (
    <div
      className={`custom-node mission-pipeline-node ${selected ? 'selected-node' : ''}`}
      style={{
        width: '320px',
        minHeight: '660px',
        borderRadius: '28px',
        background: 'linear-gradient(135deg, #2b303a 0%, #4a5568 25%, #cbd5e1 50%, #4a5568 75%, #1e2530 100%)',
        border: '3px solid #ff9800',
        boxShadow: '0 0 30px rgba(255, 152, 0, 0.4), inset 0 0 20px rgba(255, 255, 255, 0.25), 0 10px 40px rgba(0, 0, 0, 0.8)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 18px',
        boxSizing: 'border-box',
        color: '#0f172a',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Multiple Target Handles distributed vertically on Left */}
      <Handle type="target" position={Position.Left} id="in-cloud" style={{ top: '8%', width: '10px', height: '10px', background: '#ff9800', border: '2px solid #fff' }} />
      <Handle type="target" position={Position.Left} id="in-r1" style={{ top: '22%', width: '10px', height: '10px', background: '#ff9800', border: '2px solid #fff' }} />
      <Handle type="target" position={Position.Left} id="in-r2" style={{ top: '32%', width: '10px', height: '10px', background: '#ff9800', border: '2px solid #fff' }} />
      <Handle type="target" position={Position.Left} id="in-core1" style={{ top: '44%', width: '10px', height: '10px', background: '#ff9800', border: '2px solid #fff' }} />
      <Handle type="target" position={Position.Left} id="in-core2" style={{ top: '54%', width: '10px', height: '10px', background: '#ff9800', border: '2px solid #fff' }} />
      <Handle type="target" position={Position.Left} id="in-dist" style={{ top: '68%', width: '10px', height: '10px', background: '#ff9800', border: '2px solid #fff' }} />
      <Handle type="target" position={Position.Left} id="in-acc" style={{ top: '85%', width: '10px', height: '10px', background: '#ff9800', border: '2px solid #fff' }} />
      <Handle type="target" position={Position.Left} id="in" style={{ top: '50%', width: '12px', height: '12px', background: '#ff9800', border: '2px solid #fff' }} />

      {/* Multiple Source Handles distributed vertically on Right */}
      <Handle type="source" position={Position.Right} id="out-fso" style={{ top: '8%', width: '10px', height: '10px', background: '#ff9800', border: '2px solid #fff' }} />
      <Handle type="source" position={Position.Right} id="out-cdr" style={{ top: '16%', width: '10px', height: '10px', background: '#ff9800', border: '2px solid #fff' }} />
      <Handle type="source" position={Position.Right} id="out-fw" style={{ top: '24%', width: '10px', height: '10px', background: '#ff9800', border: '2px solid #fff' }} />
      <Handle type="source" position={Position.Right} id="out-dlp" style={{ top: '32%', width: '10px', height: '10px', background: '#ff9800', border: '2px solid #fff' }} />
      <Handle type="source" position={Position.Right} id="out-waf" style={{ top: '40%', width: '10px', height: '10px', background: '#ff9800', border: '2px solid #fff' }} />
      <Handle type="source" position={Position.Right} id="out-ndr" style={{ top: '48%', width: '10px', height: '10px', background: '#ff9800', border: '2px solid #fff' }} />
      <Handle type="source" position={Position.Right} id="out-apm" style={{ top: '56%', width: '10px', height: '10px', background: '#ff9800', border: '2px solid #fff' }} />
      <Handle type="source" position={Position.Right} id="out-grc" style={{ top: '64%', width: '10px', height: '10px', background: '#ff9800', border: '2px solid #fff' }} />
      <Handle type="source" position={Position.Right} id="out-apisec" style={{ top: '72%', width: '10px', height: '10px', background: '#ff9800', border: '2px solid #fff' }} />
      <Handle type="source" position={Position.Right} id="out-npm" style={{ top: '80%', width: '10px', height: '10px', background: '#ff9800', border: '2px solid #fff' }} />
      <Handle type="source" position={Position.Right} id="out-ueba" style={{ top: '88%', width: '10px', height: '10px', background: '#ff9800', border: '2px solid #fff' }} />
      <Handle type="source" position={Position.Right} id="out-siem" style={{ top: '94%', width: '10px', height: '10px', background: '#ff9800', border: '2px solid #fff' }} />
      <Handle type="source" position={Position.Right} id="out" style={{ top: '50%', width: '12px', height: '12px', background: '#ff9800', border: '2px solid #fff' }} />

      {/* Top Cylinder 3D Ellipse Rim */}
      <div
        style={{
          width: '100%',
          height: '24px',
          borderRadius: '50%',
          background: 'linear-gradient(180deg, #e2e8f0 0%, #94a3b8 100%)',
          border: '1.5px solid #cbd5e1',
          marginBottom: '16px',
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: '85%', height: '8px', borderRadius: '50%', background: '#64748b' }} />
      </div>

      {/* Gigamon Branding Header */}
      <div style={{ textAlign: 'center', marginBottom: '16px', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '0.08em', color: '#0f172a', textTransform: 'uppercase' }}>
            Gigamon<span style={{ color: '#ea580c', fontSize: '24px' }}>®</span>
          </span>
        </div>
        <div style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.04em', color: '#1e293b', lineHeight: 1.2 }}>
          Deep Observability
        </div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.25em',
            color: '#ea580c',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '4px',
          }}
        >
          <span style={{ height: '1px', width: '28px', background: '#ea580c' }} />
          PIPELINE
          <span style={{ height: '1px', width: '28px', background: '#ea580c' }} />
        </div>
      </div>

      {/* Live Metric Display */}
      <div
        style={{
          width: '100%',
          background: 'rgba(15, 23, 42, 0.88)',
          borderRadius: '12px',
          padding: '12px',
          color: '#fff',
          marginBottom: '16px',
          border: '1px solid rgba(255, 152, 0, 0.4)',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
          <span style={{ color: '#94a3b8' }}>Ingress Traffic:</span>
          <span style={{ fontWeight: 'bold', color: '#00e5ff' }}>{formatBandwidth(rx || 77700)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
          <span style={{ color: '#94a3b8' }}>Optimised Tool Egress:</span>
          <span style={{ fontWeight: 'bold', color: '#4ade80' }}>{formatBandwidth(tx || 55950)}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            paddingTop: '6px',
            marginTop: '4px',
          }}
        >
          <span style={{ color: '#ea580c', fontWeight: 'bold' }}>Bandwidth Reduction:</span>
          <span style={{ fontWeight: 'bold', color: '#ea580c' }}>{savingsPct}% Saved</span>
        </div>
      </div>

      {/* GigaSMART Intelligence Engines Container */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1e293b', textAlign: 'center' }}>
          Active GigaSMART® Engines
        </div>

        {/* Engine 1: De-duplication */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.75)',
            backdropFilter: 'blur(4px)',
            borderRadius: '8px',
            padding: '8px 10px',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>⚡</span>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#0f172a' }}>Packet De-duplication</div>
              <div style={{ fontSize: '9px', color: '#475569' }}>Eliminates duplicate packets at line rate</div>
            </div>
          </div>
          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#ea580c', background: '#ffedd5', padding: '2px 6px', borderRadius: '4px' }}>
            -25% to -50%
          </span>
        </div>

        {/* Engine 2: Traffic Map Noise Filtering */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.75)',
            backdropFilter: 'blur(4px)',
            borderRadius: '8px',
            padding: '8px 10px',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>🛡️</span>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#0f172a' }}>VLAN 999 Noise Drop</div>
              <div style={{ fontSize: '9px', color: '#475569' }}>Drops broadcast/multicast clutter before tools</div>
            </div>
          </div>
          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#dc2626', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>
            DROP NOISE
          </span>
        </div>

        {/* Engine 3: SSL/TLS Decryption */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.75)',
            backdropFilter: 'blur(4px)',
            borderRadius: '8px',
            padding: '8px 10px',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>🔓</span>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#0f172a' }}>SSL/TLS Decryption</div>
              <div style={{ fontSize: '9px', color: '#475569' }}>Decrypt once, inspect with multiple security tools</div>
            </div>
          </div>
          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#2563eb', background: '#dbeafe', padding: '2px 6px', borderRadius: '4px' }}>
            0 BLIND SPOTS
          </span>
        </div>

        {/* Engine 4: Application Metadata Intelligence */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.75)',
            backdropFilter: 'blur(4px)',
            borderRadius: '8px',
            padding: '8px 10px',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>📊</span>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#0f172a' }}>Application Metadata</div>
              <div style={{ fontSize: '9px', color: '#475569' }}>5,000+ app attributes generated as CEF / IPFIX</div>
            </div>
          </div>
          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#059669', background: '#d1fae5', padding: '2px 6px', borderRadius: '4px' }}>
            SIEM OPTIMISED
          </span>
        </div>
      </div>

      {/* Bottom Cylinder 3D Base Rim */}
      <div
        style={{
          width: '100%',
          height: '24px',
          borderRadius: '50%',
          background: 'linear-gradient(180deg, #64748b 0%, #1e293b 100%)',
          border: '1.5px solid #475569',
          marginTop: '16px',
          boxShadow: '0 6px 12px rgba(0,0,0,0.4)',
        }}
      />
    </div>
  );
};

export const MissionPipelineNode = React.memo(MissionPipelineNodeComponent);
