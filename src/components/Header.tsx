/**
 * Header.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The top application bar.  Contains the simulation run/pause control, speed
 * selector, save/reset/clear actions, and a breadcrumb/status sub-row.
 *
 * CHANGES (refactor/code-quality-improvements)
 * ─────────────────────────────────────────────
 * • `edges` is now subscribed via a Zustand selector instead of being read
 *   with `useStore.getState()` inside the click handler.  Using getState()
 *   inside a handler is fine functionally, but subscribing via a selector
 *   is the idiomatic pattern and makes the dependency explicit to React.
 * • `alert()` replaced with an in-app toast notification (see Toast below).
 * • `window.confirm()` replaced with an in-app modal confirmation.
 */

import React, { useState } from 'react';
import { useStore } from '../store/store';
import pkg from '../../package.json';
import { toPng } from 'html-to-image';

// ─── Toast notification ───────────────────────────────────────────────────────


// ─── Confirm dialog ───────────────────────────────────────────────────────────

/**
 * Inline confirmation modal — replaces `window.confirm()`.
 * Rendered inline so it respects the app's dark theme.
 */
const ConfirmModal: React.FC<{
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ message, onConfirm, onCancel }) => (
  <div style={{
    position: 'fixed',
    inset: 0,
    zIndex: 10000,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(3px)',
  }}>
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '24px',
      width: '320px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#e0e0e0', lineHeight: '1.5' }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{ padding: '7px 16px', background: '#2a2a2a', border: '1px solid #444', color: '#aaa', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          style={{ padding: '7px 16px', background: 'rgba(239,83,80,0.2)', border: '1px solid rgba(239,83,80,0.5)', color: '#ff5252', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
        >
          Clear Canvas
        </button>
      </div>
    </div>
  </div>
);

const ProjectSettingsModal: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const projectLicenseMode = useStore((state) => state.projectLicenseMode);
  const setProjectLicenseMode = useStore((state) => state.setProjectLicenseMode);
  const defaultTermDuration = useStore((state) => state.defaultTermDuration);
  const setDefaultTermDuration = useStore((state) => state.setDefaultTermDuration);
  const projectRegion = useStore((state) => state.projectRegion);
  const setProjectRegion = useStore((state) => state.setProjectRegion);
  const disableDcWarnings = useStore((state) => state.disableDcWarnings);
  const setDisableDcWarnings = useStore((state) => state.setDisableDcWarnings);
  const showGrid = useStore((state) => state.showGrid);
  const setShowGrid = useStore((state) => state.setShowGrid);
  const snapToGrid = useStore((state) => state.snapToGrid);
  const setSnapToGrid = useStore((state) => state.setSnapToGrid);

  const handleTermBlur = () => {
    let parsed = parseInt(defaultTermDuration, 10);
    if (isNaN(parsed) || parsed < 1) parsed = 1;
    if (parsed > 120) parsed = 120;
    setDefaultTermDuration(parsed.toString());
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10000,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(3px)',
    }}>
      <div style={{
        background: '#161616',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '24px',
        width: '320px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <h3 style={{ margin: 0, fontSize: '14px', color: '#ff9800', fontWeight: 'bold' }}>⚙️ Project Settings</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' }}>Default License Mode</label>
            <select
              value={projectLicenseMode}
              onChange={(e) => setProjectLicenseMode(e.target.value as 'HTL' | 'Perpetual')}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: '#121212',
                border: '1px solid #2d2d2d',
                borderRadius: '4px',
                color: '#e0e0e0',
                fontSize: '12px',
                outline: 'none'
              }}
            >
              <option value="HTL">Hybrid Term Licensing (HTL)</option>
              <option value="Perpetual">Perpetual</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' }}>Hardware Deployment Region</label>
            <select
              value={projectRegion}
              onChange={(e) => setProjectRegion(e.target.value as 'US' | 'EU' | 'UK')}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: '#121212',
                border: '1px solid #2d2d2d',
                borderRadius: '4px',
                color: '#e0e0e0',
                fontSize: '12px',
                outline: 'none'
              }}
            >
              <option value="US">North America (US)</option>
              <option value="EU">Europe (EU)</option>
              <option value="UK">United Kingdom (UK)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' }}>Default Term Duration (Months)</label>
            <input 
              type="number" 
              min="1" 
              max="120" 
              value={defaultTermDuration} 
              onChange={(e) => setDefaultTermDuration(e.target.value)} 
              onBlur={handleTermBlur}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: '#121212',
                border: '1px solid #2d2d2d',
                borderRadius: '4px',
                color: '#e0e0e0',
                fontSize: '12px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <input 
              type="checkbox" 
              checked={disableDcWarnings} 
              onChange={(e) => setDisableDcWarnings(e.target.checked)} 
              id="modalDisableDcWarnings"
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="modalDisableDcWarnings" style={{ fontSize: '12px', color: '#ccc', cursor: 'pointer' }}>
              Disable DC Power Warnings
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <input 
              type="checkbox" 
              checked={showGrid} 
              onChange={(e) => setShowGrid(e.target.checked)} 
              id="modalShowGrid"
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="modalShowGrid" style={{ fontSize: '12px', color: '#ccc', cursor: 'pointer' }}>
              Show Background Grid
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <input 
              type="checkbox" 
              checked={snapToGrid} 
              onChange={(e) => setSnapToGrid(e.target.checked)} 
              id="modalSnapToGrid"
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="modalSnapToGrid" style={{ fontSize: '12px', color: '#ccc', cursor: 'pointer' }}>
              Snap Nodes to Grid
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px',
              background: '#2a2a2a',
              border: '1px solid #444',
              color: '#aaa',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

import { generateBom, validateConfiguration } from '../utils/bomEngine';

const BomModal: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);
  const globalLicenseMode = useStore((state) => state.projectLicenseMode);
  const globalTermDuration = useStore((state) => state.defaultTermDuration);
  const globalRegion = useStore((state) => state.projectRegion);
  const currentScenarioName = useStore((state) => state.currentScenarioName);
  
  const [activeTab, setActiveTab] = useState<'bom' | 'physical'>('bom');
  const [bomViewMode, setBomViewMode] = useState<'site' | 'master'>('site');
  
  const items = generateBom(nodes, edges, globalLicenseMode, globalTermDuration, globalRegion, true);
  const validationErrors = validateConfiguration(nodes, edges);

  // Compute physical stats
  let totalRU = 0;
  let totalPower = 0;
  let totalHeat = 0;
  let totalWeight = 0;
  
  const physicalItems: {
    name: string;
    qty: number;
    ru: string;
    dimensions: string;
    weight: string;
    power: string;
    heat: string;
    airflow: string;
  }[] = [];

  const hwNodes = nodes.filter(n => n.type === 'hardwareNode');
  const tray100 = items.find(i => i.sku === 'TAP-M100T')?.qty || 0;
  const tray200 = items.find(i => i.sku === 'TAP-M200T' || i.sku === 'TAP-M200')?.qty || 0;
  const trayUlt = items.find(i => i.sku === 'TAP-M200ULT' || i.sku === 'TAP-M202ULT')?.qty || 0;

  if (tray100 > 0) {
    physicalItems.push({
      name: 'TAP-M100T Chassis Tray (1/2 RU)',
      qty: tray100,
      ru: `${tray100 * 0.5} RU`,
      dimensions: '0.81 in x 17.3 in x 6.10 in',
      weight: `${(tray100 * 3.3).toFixed(1)} lbs (${(tray100 * 1.5).toFixed(1)} kg)`,
      power: '0 W',
      heat: '0 BTU/hr',
      airflow: 'Passive'
    });
    totalRU += tray100 * 0.5;
    totalWeight += tray100 * 3.3;
  }

  if (tray200 > 0) {
    physicalItems.push({
      name: 'TAP-M200T Chassis Tray (1 RU)',
      qty: tray200,
      ru: `${tray200 * 1} RU`,
      dimensions: '1.72 in x 17.3 in x 6.10 in',
      weight: `${(tray200 * 3.8).toFixed(1)} lbs (${(tray200 * 1.7).toFixed(1)} kg)`,
      power: '0 W',
      heat: '0 BTU/hr',
      airflow: 'Passive'
    });
    totalRU += tray200 * 1;
    totalWeight += tray200 * 3.8;
  }

  if (trayUlt > 0) {
    physicalItems.push({
      name: 'TAP-M202ULT Unidirectional Chassis Tray (1 RU)',
      qty: trayUlt,
      ru: `${trayUlt * 1} RU`,
      dimensions: '1.72 in x 17.3 in x 6.10 in',
      weight: `${(trayUlt * 3.8).toFixed(1)} lbs (${(trayUlt * 1.7).toFixed(1)} kg)`,
      power: '0 W',
      heat: '0 BTU/hr',
      airflow: 'Passive'
    });
    totalRU += trayUlt * 1;
    totalWeight += trayUlt * 3.8;
  }

  hwNodes.forEach(node => {
    const model = String(node.data?.model || '').toUpperCase();
    const label = (node.data?.label as string) || model;
    
    if (model.includes('TAP') && !model.includes('TAP-M')) {
      const isAC = !String(node.data?.powerSupply || '').includes('DC');
      const pwr = isAC ? 337 : 308;
      const btu = isAC ? 1149 : 1050;
      physicalItems.push({
        name: `${label} (${model})`,
        qty: 1,
        ru: '1 RU',
        dimensions: '1.72 in x 17.3 in x 6.10 in',
        weight: '4.5 lbs (2.0 kg)',
        power: `${pwr} W`,
        heat: `${btu} BTU/hr`,
        airflow: 'Side-to-Side'
      });
      totalRU += 1;
      totalWeight += 4.5;
      totalPower += pwr;
      totalHeat += btu;
    } else if (model.includes('TA25')) {
      physicalItems.push({
        name: `${label} (TA25E)`,
        qty: 1,
        ru: '1 RU',
        dimensions: '1.75 in x 17.32 in x 19.25 in',
        weight: '19.0 lbs (8.62 kg)',
        power: '400 W',
        heat: '1365 BTU/hr',
        airflow: 'Front-to-Rear'
      });
      totalRU += 1;
      totalWeight += 19.0;
      totalPower += 400;
      totalHeat += 1365;
    } else if (model.includes('TA200')) {
      const isE = model.includes('TA200E');
      const pwr = isE ? 800 : 1069;
      const btu = isE ? 2730 : 3645;
      physicalItems.push({
        name: `${label} (${isE ? 'TA200E' : 'TA200'})`,
        qty: 1,
        ru: '2 RU',
        dimensions: '3.48 in x 17.32 in x 21.25 in',
        weight: '33.6 lbs (15.24 kg)',
        power: `${pwr} W`,
        heat: `${btu} BTU/hr`,
        airflow: 'Front-to-Rear'
      });
      totalRU += 2;
      totalWeight += 33.6;
      totalPower += pwr;
      totalHeat += btu;
    } else if (model.includes('TA400')) {
      physicalItems.push({
        name: `${label} (TA400E)`,
        qty: 1,
        ru: '1 RU',
        dimensions: '1.75 in x 17.32 in x 23.23 in',
        weight: '26.12 lbs (11.85 kg)',
        power: '1294 W',
        heat: '4412 BTU/hr',
        airflow: 'Front-to-Rear'
      });
      totalRU += 1;
      totalWeight += 26.12;
      totalPower += 1294;
      totalHeat += 4412;
    } else if (model.includes('HCT')) {
      physicalItems.push({
        name: `${label} (GigaVUE-HCT)`,
        qty: 1,
        ru: '1 RU',
        dimensions: '1.75 in x 8.4 in x 12.5 in',
        weight: '5.8 lbs (2.63 kg)',
        power: '286 W',
        heat: '975 BTU/hr',
        airflow: 'Front-to-Rear'
      });
      totalRU += 1;
      totalWeight += 5.8;
      totalPower += 286;
      totalHeat += 975;
    } else if (model.includes('HC1-PLUS') || model.includes('HC1P')) {
      physicalItems.push({
        name: `${label} (GigaVUE-HC1-Plus)`,
        qty: 1,
        ru: '1 RU',
        dimensions: '1.70 in x 17.0 in x 23.0 in',
        weight: '33.8 lbs (15.36 kg)',
        power: '650 W',
        heat: '2216 BTU/hr',
        airflow: 'Front-to-Rear'
      });
      totalRU += 1;
      totalWeight += 33.8;
      totalPower += 650;
      totalHeat += 2216;
    } else if (model.includes('HC1') && !model.includes('HC1-PLUS') && !model.includes('HC1P')) {
      physicalItems.push({
        name: `${label} (GigaVUE-HC1)`,
        qty: 1,
        ru: '1 RU',
        dimensions: '1.75 in x 17.26 in x 19.5 in',
        weight: '20.88 lbs (9.47 kg)',
        power: '360 W',
        heat: '1227.6 BTU/hr',
        airflow: 'Front-to-Rear'
      });
      totalRU += 1;
      totalWeight += 20.88;
      totalPower += 360;
      totalHeat += 1227.6;
    } else if (model.includes('HC3')) {
      physicalItems.push({
        name: `${label} (GigaVUE-HC3)`,
        qty: 1,
        ru: '3 RU',
        dimensions: '5.25 in x 17.26 in x 29.1 in',
        weight: '88.0 lbs (40.00 kg)',
        power: '2000 W',
        heat: '6824.3 BTU/hr',
        airflow: 'Front-to-Rear'
      });
      totalRU += 3;
      totalWeight += 88.0;
      totalPower += 2000;
      totalHeat += 6824.3;
    }
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '24px', width: '920px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,0,0,0.8)' }}>
        
        {/* Modal Header & Tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', marginBottom: '16px', paddingBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              onClick={() => setActiveTab('bom')}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === 'bom' ? '#ffb74d' : '#888',
                borderBottom: activeTab === 'bom' ? '2px solid #ffb74d' : 'none',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              📋 Bill of Materials
            </button>
            <button
              onClick={() => setActiveTab('physical')}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === 'physical' ? '#ffb74d' : '#888',
                borderBottom: activeTab === 'physical' ? '2px solid #ffb74d' : 'none',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              ⚡ Physical Rack & Deployment Report
            </button>
          </div>
          <span style={{ fontSize: '12px', color: '#666' }}>{currentScenarioName || 'Layout'} specs</span>
        </div>

        {validationErrors.length > 0 && activeTab === 'bom' && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(239, 83, 80, 0.08)', border: '1px solid rgba(239, 83, 80, 0.3)', borderRadius: '6px', color: '#ef5350' }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⚠️ Configuration Attention Required (Not 100% Valid Configuration)
            </h4>
            <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#aaa', lineHeight: '1.4' }}>
              The current canvas configuration has unresolved errors. This bill of materials may be incomplete or invalid:
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {validationErrors.map((err, i) => (
                <li key={i} style={{ color: '#ffb74d' }}>{err.message}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
          {activeTab === 'bom' ? (() => {
            if (items.length === 0) {
              return <div style={{ color: '#aaa', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No hardware nodes tracked in the current layout.</div>;
            }

            const masterBomItems = Object.values(items.reduce((acc, item) => {
              if (!acc[item.sku]) {
                acc[item.sku] = { ...item, qty: 0 };
              }
              acc[item.sku].qty += item.qty;
              return acc;
            }, {} as Record<string, typeof items[0]>) || {});

            // Group items by site, then by nodeId
            const siteGroups: Record<string, Record<string, typeof items>> = {};
            items.forEach(item => {
              const siteKey = item.site || 'Global / Unassigned';
              const nodeKey = item.nodeId || 'global';
              if (!siteGroups[siteKey]) siteGroups[siteKey] = {};
              if (!siteGroups[siteKey][nodeKey]) siteGroups[siteKey][nodeKey] = [];
              siteGroups[siteKey][nodeKey].push(item);
            });

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button 
                    onClick={() => setBomViewMode('site')}
                    style={{
                      background: bomViewMode === 'site' ? '#ff9800' : '#333',
                      color: bomViewMode === 'site' ? '#fff' : '#aaa',
                      border: 'none',
                      padding: '6px 16px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    By Site Breakdown
                  </button>
                  <button 
                    onClick={() => setBomViewMode('master')}
                    style={{
                      background: bomViewMode === 'master' ? '#ff9800' : '#333',
                      color: bomViewMode === 'master' ? '#fff' : '#aaa',
                      border: 'none',
                      padding: '6px 16px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    Master BOM (Aggregated)
                  </button>
                </div>

                {bomViewMode === 'master' ? (
                  <div style={{ border: '1px solid #444', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ background: '#333', padding: '10px 16px', borderBottom: '2px solid #555', fontWeight: 'bold', fontSize: '14px', color: '#fff' }}>
                      Master BOM (All Sites)
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #444', background: '#1a1a1a' }}>
                          <th style={{ padding: '8px', color: '#888' }}>Type</th>
                          <th style={{ padding: '8px', color: '#888' }}>SKU</th>
                          <th style={{ padding: '8px', color: '#888' }}>Description</th>
                          <th style={{ padding: '8px', color: '#888', textAlign: 'right' }}>Term (Mo)</th>
                          <th style={{ padding: '8px', color: '#888', textAlign: 'right' }}>Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {masterBomItems.map((item, i) => (
                          <tr key={i} style={{ borderBottom: i === masterBomItems.length - 1 ? 'none' : '1px solid #333' }}>
                            <td style={{ padding: '8px', color: '#ccc' }}>{item.type}</td>
                            <td style={{ padding: '8px', color: '#00e5ff', fontFamily: 'monospace', fontWeight: 'bold' }}>{item.sku}</td>
                            <td style={{ padding: '8px', color: '#aaa' }}>{item.description}</td>
                            <td style={{ padding: '8px', color: '#fff', textAlign: 'right' }}>{item.term || '-'}</td>
                            <td style={{ padding: '8px', color: '#fff', textAlign: 'right', fontWeight: 'bold' }}>{item.qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  Object.entries(siteGroups).map(([siteKey, nodeGroups]) => (
                  <div key={siteKey} style={{ border: '1px solid #444', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ background: '#333', padding: '10px 16px', borderBottom: '2px solid #555', fontWeight: 'bold', fontSize: '14px', color: '#fff' }}>
                      Site: {siteKey}
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #444', background: '#1a1a1a' }}>
                          <th style={{ padding: '8px', color: '#888' }}>Type</th>
                          <th style={{ padding: '8px', color: '#888' }}>SKU</th>
                          <th style={{ padding: '8px', color: '#888' }}>Description</th>
                          <th style={{ padding: '8px', color: '#888', textAlign: 'right' }}>Term (Mo)</th>
                          <th style={{ padding: '8px', color: '#888', textAlign: 'right' }}>Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(nodeGroups).map(([nodeId, groupItems]) => {
                          const nodeInfo = nodes.find(n => n.id === nodeId);
                          const nodeLabel = nodeInfo ? `${nodeInfo.data?.label || ''} (${nodeInfo.data?.model || ''})` : (nodeId === 'global' ? 'Global Accessories & Dependencies' : 'System Components');
                          
                          return (
                            <React.Fragment key={nodeId}>
                              {/* Group Header Row */}
                              <tr style={{ borderBottom: '1px solid #333', background: '#222' }}>
                                <td colSpan={5} style={{ padding: '6px 8px', color: '#ffb74d', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase' }}>
                                  {nodeLabel}
                                </td>
                              </tr>
                              {/* Group Items */}
                              {groupItems.map((item, i) => (
                                <tr key={`${nodeId}-${i}`} style={{ borderBottom: i === groupItems.length - 1 ? '2px solid #444' : '1px solid #333' }}>
                                  <td style={{ padding: '8px', color: '#ccc' }}>{item.type}</td>
                                  <td style={{ padding: '8px', color: '#00e5ff', fontFamily: 'monospace', fontWeight: 'bold' }}>{item.sku}</td>
                                  <td style={{ padding: '8px', color: '#aaa', maxWidth: '350px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.description}>{item.description}</td>
                                  <td style={{ padding: '8px', color: '#fff', textAlign: 'right' }}>{item.term || '-'}</td>
                                  <td style={{ padding: '8px', color: '#fff', textAlign: 'right' }}>{item.qty}</td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )))}
              </div>
            );
          })() : (
            physicalItems.length === 0 ? (
              <div style={{ color: '#aaa', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No physical hardware nodes found on the canvas.</div>
            ) : (
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #444' }}>
                      <th style={{ padding: '8px', color: '#888' }}>Hardware Node / Chassis</th>
                      <th style={{ padding: '8px', color: '#888', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '8px', color: '#888', textAlign: 'center' }}>Rack Space</th>
                      <th style={{ padding: '8px', color: '#888' }}>Dimensions (H x W x D)</th>
                      <th style={{ padding: '8px', color: '#888' }}>Weight</th>
                      <th style={{ padding: '8px', color: '#888', textAlign: 'right' }}>Max Power</th>
                      <th style={{ padding: '8px', color: '#888', textAlign: 'right' }}>Heat Output</th>
                      <th style={{ padding: '8px', color: '#888', textAlign: 'center' }}>Airflow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {physicalItems.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #333' }}>
                        <td style={{ padding: '8px', color: '#ffb74d', fontWeight: 'bold' }}>{item.name}</td>
                        <td style={{ padding: '8px', color: '#fff', textAlign: 'center' }}>{item.qty}</td>
                        <td style={{ padding: '8px', color: '#00e5ff', textAlign: 'center', fontWeight: 'bold' }}>{item.ru}</td>
                        <td style={{ padding: '8px', color: '#aaa', fontFamily: 'monospace' }}>{item.dimensions}</td>
                        <td style={{ padding: '8px', color: '#aaa' }}>{item.weight}</td>
                        <td style={{ padding: '8px', color: '#fff', textAlign: 'right', fontWeight: 'bold' }}>{item.power}</td>
                        <td style={{ padding: '8px', color: '#fff', textAlign: 'right' }}>{item.heat}</td>
                        <td style={{ padding: '8px', color: '#ccc', textAlign: 'center' }}>{item.airflow}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Physical Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginTop: '24px' }}>
                  <div style={{ background: '#222', border: '1px solid #333', borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Total Space Required</div>
                    <div style={{ fontSize: '20px', color: '#00e5ff', fontWeight: 'bold' }}>{totalRU.toFixed(1)} RU</div>
                  </div>
                  <div style={{ background: '#222', border: '1px solid #333', borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Total Est. Weight</div>
                    <div style={{ fontSize: '20px', color: '#a855f7', fontWeight: 'bold' }}>{totalWeight.toFixed(1)} lbs</div>
                    <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>{(totalWeight * 0.453592).toFixed(1)} kg</div>
                  </div>
                  <div style={{ background: '#222', border: '1px solid #333', borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Total Max Power</div>
                    <div style={{ fontSize: '20px', color: '#22c55e', fontWeight: 'bold' }}>{totalPower} W</div>
                  </div>
                  <div style={{ background: '#222', border: '1px solid #333', borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Total Heat Dissipation</div>
                    <div style={{ fontSize: '20px', color: '#ef4444', fontWeight: 'bold' }}>{totalHeat.toFixed(1)} BTU/hr</div>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '8px' }}>
          {activeTab === 'bom' ? (
            <button onClick={() => {
              const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
              const csv = ['Site,Type,SKU,Description,Term(Months),Qty']
                .concat(items.map(i => `${escapeCsv(i.site || 'Global / Unassigned')},${escapeCsv(i.type)},${escapeCsv(i.sku)},${escapeCsv(i.description)},${i.term || ''},${i.qty}`))
                .join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const cleanName = currentScenarioName 
                ? currentScenarioName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')
                : 'bom';
              a.download = `${cleanName}.csv`;
              a.click();
            }} style={{ padding: '7px 16px', background: 'rgba(0,229,255,0.2)', border: '1px solid rgba(0,229,255,0.5)', color: '#00e5ff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
              Export CSV
            </button>
          ) : (
            <button onClick={() => {
              const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
              const csv = ['Node/Chassis,Qty,Rack Space,Dimensions,Weight,Power,Heat,Airflow']
                .concat(physicalItems.map(p => `${escapeCsv(p.name)},${p.qty},${escapeCsv(p.ru)},${escapeCsv(p.dimensions)},${escapeCsv(p.weight)},${escapeCsv(p.power)},${escapeCsv(p.heat)},${escapeCsv(p.airflow)}`))
                .concat([`Total,${physicalItems.reduce((acc, p) => acc + p.qty, 0)},${totalRU} RU,-,${totalWeight} lbs,${totalPower} W,${totalHeat} BTU/hr,-`])
                .join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const cleanName = currentScenarioName 
                ? currentScenarioName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')
                : 'physical_deployment';
              a.download = `${cleanName}_deployment_report.csv`;
              a.click();
            }} style={{ padding: '7px 16px', background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.5)', color: '#22c55e', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
              Export Deployment CSV
            </button>
          )}
          <button onClick={onClose} style={{ padding: '7px 16px', background: '#2a2a2a', border: '1px solid #444', color: '#aaa', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Header component ─────────────────────────────────────────────────────────

interface HeaderProps {
  /** Called when the user clicks "Save Layout" — opens the save slot modal in App.tsx. */
  onSaveClick: () => void;
  /** Called when the user clicks "Load Layout" — opens the load slot modal in App.tsx. */
  onLoadClick: () => void;
  /** Called when the user clicks "Save to File" — directly triggers a file download. */
  onSaveFileClick: () => void;
  /** Called when the user selects a file to load. */
  onLoadFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const Header: React.FC<HeaderProps> = ({ onSaveClick, onLoadClick, onSaveFileClick, onLoadFileChange }) => {
  // Subscribe to exactly the state slices we need
  const isRunning      = useStore((state) => state.isRunning);
  const simulationSpeed = useStore((state) => state.simulationSpeed);
  const toggleSimulation  = useStore((state) => state.toggleSimulation);
  const setSimulationSpeed = useStore((state) => state.setSimulationSpeed);
  const clearCanvas    = useStore((state) => state.clearCanvas);
  const loadDemo       = useStore((state) => state.loadDemo);
  const advancedMode   = useStore((state) => state.advancedMode);
  const setAdvancedMode = useStore((state) => state.setAdvancedMode);
  const setAdvancedModeUnlocked = useStore((state) => state.setAdvancedModeUnlocked);
  const nodes          = useStore((state) => state.nodes);
  const edges          = useStore((state) => state.edges);
  const panelTextScale = useStore((state) => state.panelTextScale || 1.0);
  const setPanelTextScale = useStore((state) => state.setPanelTextScale);
  const currentScenarioName = useStore((state) => state.currentScenarioName);
  const projectRegion = useStore((state) => state.projectRegion);

  // Local UI state for the toast and confirm modal
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showBom, setShowBom] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [logoClicks, setLogoClicks] = useState<number[]>([]);

  const handleLogoClick = () => {
    const now = Date.now();
    const recentClicks = [...logoClicks, now].filter(t => now - t < 2000);
    setLogoClicks(recentClicks);
    if (recentClicks.length >= 4) {
      const nextMode = !advancedMode;
      setAdvancedMode(nextMode);
      setAdvancedModeUnlocked(nextMode);
      setLogoClicks([]);
    }
  };

  const handleClearRequest = () => setShowClearConfirm(true);
  const handleClearConfirm  = () => { clearCanvas(); setShowClearConfirm(false); };
  const handleClearCancel   = () => setShowClearConfirm(false);

  const handleExportScreenshot = () => {
    const element = document.querySelector('.react-flow') as HTMLElement;
    if (!element) return;
    
    toPng(element, {
      backgroundColor: '#121212',
      cacheBust: true,
      filter: (node) => {
        if (
          node.classList?.contains('react-flow__controls') || 
          node.classList?.contains('react-flow__panel') ||
          node.classList?.contains('config-panel-toggle')
        ) {
          return false;
        }
        return true;
      }
    })
      .then((dataUrl) => {
        const a = document.createElement('a');
        const filename = currentScenarioName 
          ? `${currentScenarioName} - export.png`
          : 'Flow Mapping Example - export.png';
        a.setAttribute('download', filename);
        a.setAttribute('href', dataUrl);
        a.click();
      })
      .catch((err) => {
        console.error('oops, something went wrong!', err);
      });
  };

  return (
    <>
      {showClearConfirm && (
        <ConfirmModal
          message="Are you sure you want to clear the canvas? All nodes, edges, and traffic streams will be removed."
          onConfirm={handleClearConfirm}
          onCancel={handleClearCancel}
        />
      )}

      {showBom && <BomModal onClose={() => setShowBom(false)} />}
      {showSettings && <ProjectSettingsModal onClose={() => setShowSettings(false)} />}

      <div className="header-wrapper">
        {/* ── Top Brand Bar ── */}
        <header className="header-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img 
                src="./gigamon-logo.png" 
                alt="Gigamon" 
                style={{ height: '18px', display: 'block', objectFit: 'contain', cursor: 'pointer' }} 
                onClick={handleLogoClick}
                title="Gigamon Traffic Simulator"
              />
              
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <span className="brand-logo" style={{ color: '#fff', textShadow: 'none', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{currentScenarioName || 'Untitled Project'}</span>
                  <img 
                    src={projectRegion === 'EU' ? 'https://flagcdn.com/eu.svg' : projectRegion === 'UK' ? 'https://flagcdn.com/gb.svg' : 'https://flagcdn.com/us.svg'} 
                    alt={projectRegion}
                    title={`Deployment Region: ${projectRegion}`}
                    onClick={() => setShowSettings(true)}
                    style={{ height: '10px', width: 'auto', borderRadius: '1px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                  />
                </span>
                <span style={{ fontSize: '9px', color: '#666', fontWeight: 500, letterSpacing: '0.02em' }}>
                  FLOW MAPPING DESIGNER
                  <a 
                    href={`https://github.com/petesyboy/traffic-simulator/releases/tag/v${pkg.version}`}
                    target="_blank"
                    rel="noreferrer"
                    title={`Build ${pkg.version}`}
                    style={{ marginLeft: '8px', color: '#444', textDecoration: 'none', cursor: 'pointer' }}
                  >
                    v{pkg.version}
                  </a>
                </span>
              </div>
            </div>
            <div className="tab monitoring-session active" style={{ height: '40px', display: 'flex', alignItems: 'center', borderBottom: '2px solid #007cff', color: advancedMode ? '#ff9800' : '#fff' }}>
              {advancedMode ? 'Expert Designer' : 'Standard View'}
            </div>
          </div>

          <div className="header-controls">
            {/* ── Group 1: Simulation ── */}
            <div className="control-group">
              <button
                onClick={toggleSimulation}
                className={`sim-btn ${isRunning ? 'running' : ''}`}
                style={{ minWidth: isRunning ? '80px' : '130px' }}
              >
                {isRunning ? '⏸ Pause' : '▶ Run Simulation'}
              </button>

              {isRunning && (
                <select
                  value={simulationSpeed}
                  onChange={(e) => setSimulationSpeed(Number(e.target.value))}
                  className="sim-speed-select"
                >
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={5}>5x</option>
                  <option value={10}>10x</option>
                </select>
              )}
            </div>

            {/* ── Group 2: Project / View ── */}
            <div className="control-group">
              {(advancedMode || nodes.some(n => n.type === 'hardwareNode')) && (() => {
                const validationErrors = validateConfiguration(nodes, edges);
                const hasErrors = validationErrors.length > 0;
                return (
                  <button 
                    className="header-btn" 
                    style={{ 
                      background: hasErrors ? 'rgba(239, 83, 80, 0.1)' : 'rgba(255, 152, 0, 0.1)', 
                      color: hasErrors ? '#ef5350' : '#ffb74d', 
                      borderColor: hasErrors ? 'rgba(239, 83, 80, 0.3)' : 'rgba(255, 152, 0, 0.3)' 
                    }} 
                    onClick={() => setShowBom(true)}
                    title={hasErrors ? 'Configuration errors detected' : 'View Bill of Materials'}
                  >
                    📋 BOM{hasErrors ? ' (⚠️)' : ''}
                  </button>
                );
              })()}

              <button className="header-btn" onClick={handleExportScreenshot} title="Export canvas to PNG">
                📸 Screenshot
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '8px' }}>
                <span style={{ fontSize: '9px', color: '#666', fontWeight: 700 }}>SIZE</span>
                <select
                  value={panelTextScale}
                  onChange={(e) => setPanelTextScale(Number(e.target.value))}
                  className="sim-speed-select"
                  style={{ width: '55px', height: '24px', padding: '0 4px' }}
                >
                  <option value={0.75}>75%</option>
                  <option value={0.85}>85%</option>
                  <option value={1.0}>100%</option>
                  <option value={1.15}>115%</option>
                  <option value={1.3}>130%</option>
                  <option value={1.5}>150%</option>
                </select>
              </div>
            </div>

            {/* ── Group 3: File Operations ── */}
            <div className="control-group">
              <button className="header-btn" onClick={onSaveFileClick} title="Save project to a .json file">
                💾 Save
              </button>
              <label className="header-btn" style={{ cursor: 'pointer', margin: 0 }} title="Load project from a .json file">
                📂 Load
                <input type="file" accept=".json" onChange={onLoadFileChange} style={{ display: 'none' }} />
              </label>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '4px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '6px' }}>
                <button className="header-btn" onClick={onSaveClick} style={{ padding: '5px 8px' }} title="Save to local browser slots">Slots Save</button>
                <button className="header-btn" onClick={onLoadClick} style={{ padding: '5px 8px' }} title="Load from local browser slots">Slots Load</button>
              </div>
            </div>

            {/* ── Group 4: System / Danger ── */}
            <div className="control-group">
              <button className="header-btn icon-only" onClick={() => setShowSettings(true)} title="Project Settings">
                ⚙️
              </button>
              <button className="header-btn icon-only" onClick={loadDemo} title="Reset to default demo layout">
                🔄
              </button>
              <button onClick={handleClearRequest} className="header-btn danger icon-only" title="Clear canvas">
                🗑️
              </button>
            </div>
          </div>
        </header>
      </div>
    </>
  );
};


export default Header;