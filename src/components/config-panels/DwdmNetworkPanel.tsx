/**
 * DwdmNetworkPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuration panel for the DWDM Optical Transport Network node.
 */

import React, { useMemo, useState, useEffect } from 'react';
import type { CustomNode } from '../../store/types';
import { useStore } from '../../store/store';
import { FormGroup } from './LiveMetrics';

interface DwdmNetworkPanelProps {
  node: CustomNode;
  onGenericChange: (key: string, value: string) => void;
}

export const DwdmNetworkPanel: React.FC<DwdmNetworkPanelProps> = ({ node, onGenericChange }) => {
  const edges = useStore((state) => state.edges);
  const nodes = useStore((state) => state.nodes);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const deployPerSiteDwdmRing = useStore((state) => state.deployPerSiteDwdmRing);

  const wavelengthSpeed = (node.data?.wavelengthSpeed as string) || '100G';
  const protectionMode = (node.data?.protectionMode as string) || 'Protected Ring (1+1)';
  const spanDistanceKm = (node.data?.spanDistanceKm as number) ?? 40;
  const latencyMs = (node.data?.latencyMs as number) ?? 2.0;
  const carrierName = (node.data?.carrierName as string) || 'Dark Fiber Transport';

  // Connected chassis endpoints
  const connectedEndpoints = useMemo(() => {
    const connectedNodeIds = new Set<string>();
    edges.forEach((e) => {
      if (e.source === node.id) connectedNodeIds.add(e.target);
      if (e.target === node.id) connectedNodeIds.add(e.source);
    });
    return nodes.filter((n) => connectedNodeIds.has(n.id));
  }, [edges, nodes, node.id]);

  // All valid data centre sites detected on canvas
  const allSites = useMemo(() => {
    const sites = new Set<string>();
    nodes.forEach((n) => {
      const s = ((n.data?.site as string) || '').trim();
      if (s && s.toUpperCase() !== 'WAN' && s.toUpperCase() !== 'TRANSPORT' && s.toUpperCase() !== 'CLOUD') {
        sites.add(s);
      }
    });
    return Array.from(sites).sort((a, b) => a.localeCompare(b));
  }, [nodes]);

  // Selected sites for multi-site deployment
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [autoConnectChassis, setAutoConnectChassis] = useState<boolean>(true);

  // Preselect all detected sites
  useEffect(() => {
    if (allSites.length >= 2 && selectedSites.length === 0) {
      setSelectedSites(allSites);
    }
  }, [allSites, selectedSites.length]);

  const isExternalHub = !((node.data?.site as string) || '').trim();
  const canDeployRing = isExternalHub && allSites.length >= 2;

  const handleSpanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const dist = isNaN(val) ? 0 : val;
    // Calculate typical optical latency in standard SMF (approx 5 us per km)
    const lat = Math.round((dist * 0.005 + 0.1) * 10) / 10;
    updateNodeData(node.id, { spanDistanceKm: dist, latencyMs: lat });
  };

  const uniqueSites = useMemo(() => {
    return Array.from(new Set(nodes.map((n) => n.data?.site).filter((s) => typeof s === 'string' && (s as string).trim() !== ''))) as string[];
  }, [nodes]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {canDeployRing && (
        <div
          style={{
            padding: '12px',
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(59, 130, 246, 0.15))',
            border: '1px solid rgba(168, 85, 247, 0.45)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#f3e8ff', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>⚡</span> Deploy Per-Site Optical Ring
          </div>
          <div style={{ fontSize: '11px', color: '#e9d5ff', lineHeight: '1.4' }}>
            Detected <strong>{allSites.length} data centres</strong> on canvas. Instantly deploy a dedicated DWDM gateway to each site and link them in an optical ring with clean 2D triangular layout.
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {allSites.map((s) => {
              const isChecked = selectedSites.includes(s);
              const count = nodes.filter((n) => ((n.data?.site as string) || '').trim() === s && n.id !== node.id).length;
              return (
                <label
                  key={s}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11px',
                    padding: '3px 8px',
                    background: isChecked ? 'rgba(147, 51, 234, 0.4)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${isChecked ? '#a855f7' : 'rgba(255, 255, 255, 0.12)'}`,
                    borderRadius: '5px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: isChecked ? '#f3e8ff' : '#94a3b8',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSites((prev) => Array.from(new Set([...prev, s])).sort((a, b) => a.localeCompare(b)));
                      } else {
                        setSelectedSites((prev) => prev.filter((item) => item !== s));
                      }
                    }}
                    style={{ cursor: 'pointer', margin: 0 }}
                  />
                  <span style={{ fontWeight: 600 }}>{s}</span>
                  <span style={{ fontSize: '9.5px', opacity: 0.7 }}>({count})</span>
                </label>
              );
            })}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#c084fc', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoConnectChassis}
              onChange={(e) => setAutoConnectChassis(e.target.checked)}
              style={{ cursor: 'pointer', margin: 0 }}
            />
            <span>Auto-connect local packet broker / chassis in each data centre</span>
          </label>

          <button
            type="button"
            disabled={selectedSites.length < 2}
            onClick={() => deployPerSiteDwdmRing(node.id, selectedSites, autoConnectChassis)}
            style={{
              padding: '8px 12px',
              background: selectedSites.length >= 2 ? '#9333ea' : 'rgba(255, 255, 255, 0.1)',
              color: selectedSites.length >= 2 ? '#ffffff' : '#64748b',
              border: 'none',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: selectedSites.length >= 2 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: selectedSites.length >= 2 ? '0 2px 6px rgba(147, 51, 234, 0.35)' : 'none',
              transition: 'background 0.15s ease',
            }}
            onMouseOver={(e) => {
              if (selectedSites.length >= 2) e.currentTarget.style.background = '#a855f7';
            }}
            onMouseOut={(e) => {
              if (selectedSites.length >= 2) e.currentTarget.style.background = '#9333ea';
            }}
          >
            <span>🚀</span> Deploy Optical Ring ({selectedSites.length} Sites)
          </button>
        </div>
      )}
      <div
        style={{
          padding: '10px 12px',
          background: 'rgba(168, 85, 247, 0.1)',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          borderRadius: '8px',
          fontSize: '11px',
          color: '#e9d5ff',
          lineHeight: '1.4',
        }}
      >
        <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span>λ</span> DWDM Optical Transport Network
        </div>
        Provides high-capacity, multi-site optical wavelength transport between data centres and aggregation nodes (e.g. TA200/TA25/HC1-Plus).
      </div>

      <FormGroup label="Site Assignment (Optional)">
        <datalist id="existing-sites-dwdm-list">
          {uniqueSites.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <input
          type="text"
          list="existing-sites-dwdm-list"
          placeholder="e.g. DC1, DC2, DC3 (leave empty for external hub)"
          value={(node.data?.site as string) || ''}
          onChange={(e) => onGenericChange('site', e.target.value)}
        />
      </FormGroup>

      <FormGroup label="Carrier / Transport Domain">
        <input
          type="text"
          value={carrierName}
          onChange={(e) => onGenericChange('carrierName', e.target.value)}
          placeholder="e.g. Metro DWDM Ring A"
        />
      </FormGroup>

      <FormGroup label="Wavelength Channel Speed">
        <select
          value={wavelengthSpeed}
          onChange={(e) => onGenericChange('wavelengthSpeed', e.target.value)}
        >
          <option value="100G">100G (100 Gbps λ Wavelength)</option>
          <option value="25G">25G (25 Gbps λ Wavelength)</option>
          <option value="400G">400G (400 Gbps λ Wavelength)</option>
          <option value="10G">10G (10 Gbps λ Wavelength)</option>
        </select>
      </FormGroup>

      <FormGroup label="Protection & Redundancy Scheme">
        <select
          value={protectionMode}
          onChange={(e) => onGenericChange('protectionMode', e.target.value)}
        >
          <option value="Protected Ring (1+1)">Protected Ring (1+1 Optical Subnetwork Connection)</option>
          <option value="Dual Homed Mesh">Dual Homed Mesh (Diverse Carrier Ingress)</option>
          <option value="Point-to-Point Wavelength">Point-to-Point Wavelength (Unprotected)</option>
        </select>
      </FormGroup>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <FormGroup label="Span Distance (km)">
          <input
            type="number"
            min="1"
            max="2000"
            value={spanDistanceKm}
            onChange={handleSpanChange}
          />
        </FormGroup>

        <FormGroup label="One-Way Latency (ms)">
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={latencyMs}
            onChange={(e) => updateNodeData(node.id, { latencyMs: parseFloat(e.target.value) || 0.1 })}
          />
        </FormGroup>
      </div>

      {/* Connected Nodes List */}
      <div style={{ marginTop: '6px' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Interconnected Endpoints ({connectedEndpoints.length})
        </div>
        {connectedEndpoints.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {connectedEndpoints.map((ep) => (
              <div
                key={ep.id}
                style={{
                  padding: '8px 10px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#f3e8ff' }}>
                    {String(ep.data?.label || ep.data?.model || ep.id)}
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#94a3b8' }}>
                    {String(ep.data?.model || ep.type)} • {String(ep.data?.site || 'Default Site')}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '9.5px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(168, 85, 247, 0.25)',
                    color: '#e9d5ff',
                    fontWeight: 600,
                  }}
                >
                  {wavelengthSpeed} Link
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
            No endpoints connected yet. Drag links from any chassis on the canvas to attach to this transport network.
          </div>
        )}
      </div>
    </div>
  );
};
