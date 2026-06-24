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
  
  const items = generateBom(nodes, edges, globalLicenseMode, globalTermDuration);
  const validationErrors = validateConfiguration(nodes, edges);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '24px', width: '900px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,0,0,0.8)' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#ffb74d' }}>Bill of Materials (BOM)</h3>
        
        {validationErrors.length > 0 && (
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
          {items.length === 0 ? (
            <div style={{ color: '#aaa', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No hardware nodes tracked in the current layout.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #444' }}>
                  <th style={{ padding: '8px', color: '#888' }}>Type</th>
                  <th style={{ padding: '8px', color: '#888' }}>SKU</th>
                  <th style={{ padding: '8px', color: '#888' }}>Description</th>
                  <th style={{ padding: '8px', color: '#888', textAlign: 'right' }}>Term (Mo)</th>
                  <th style={{ padding: '8px', color: '#888', textAlign: 'right' }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #333' }}>
                    <td style={{ padding: '8px', color: '#ccc' }}>{item.type}</td>
                    <td style={{ padding: '8px', color: '#00e5ff', fontFamily: 'monospace', fontWeight: 'bold' }}>{item.sku}</td>
                    <td style={{ padding: '8px', color: '#aaa', maxWidth: '350px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.description}>{item.description}</td>
                    <td style={{ padding: '8px', color: '#fff', textAlign: 'right' }}>{item.term || '-'}</td>
                    <td style={{ padding: '8px', color: '#fff', textAlign: 'right' }}>{item.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '8px' }}>
          <button onClick={() => {
            const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
            const csv = ['Type,SKU,Description,Term(Months),Qty']
              .concat(items.map(i => `${escapeCsv(i.type)},${escapeCsv(i.sku)},${escapeCsv(i.description)},${i.term || ''},${i.qty}`))
              .join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'bom.csv';
            a.click();
          }} style={{ padding: '7px 16px', background: 'rgba(0,229,255,0.2)', border: '1px solid rgba(0,229,255,0.5)', color: '#00e5ff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
            Export CSV
          </button>
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
}

const Header: React.FC<HeaderProps> = ({ onSaveClick, onLoadClick }) => {
  // Subscribe to exactly the state slices we need
  const isRunning      = useStore((state) => state.isRunning);
  const simulationSpeed = useStore((state) => state.simulationSpeed);
  const toggleSimulation  = useStore((state) => state.toggleSimulation);
  const setSimulationSpeed = useStore((state) => state.setSimulationSpeed);
  const clearCanvas    = useStore((state) => state.clearCanvas);
  const loadDemo       = useStore((state) => state.loadDemo);
  const advancedMode   = useStore((state) => state.advancedMode);
  const setAdvancedModeUnlocked = useStore((state) => state.setAdvancedModeUnlocked);
  const nodes          = useStore((state) => state.nodes);
  const edges          = useStore((state) => state.edges);

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
      setAdvancedModeUnlocked(true);
      setLogoClicks([]);
    }
  };

  const handleClearRequest = () => setShowClearConfirm(true);
  const handleClearConfirm  = () => { clearCanvas(); setShowClearConfirm(false); };
  const handleClearCancel   = () => setShowClearConfirm(false);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img 
                src="./gigamon-logo.png" 
                alt="Gigamon" 
                style={{ height: '18px', display: 'block', objectFit: 'contain', cursor: 'pointer' }} 
                onClick={handleLogoClick}
              />
              <span className="brand-logo" style={{ color: 'var(--text-secondary)', textShadow: 'none', fontWeight: 500, fontSize: '13px' }}>Flow Mapping Example</span>
              <span className="build-number">
                v{(() => {
                  const parts = pkg.version.split('.');
                  if (parts.length >= 3) {
                    return parts[2] === '0' ? `${parts[0]}.${parts[1]}` : `${parts[0]}.${parts[1]}${parts[2]}`;
                  }
                  return pkg.version;
                })()}
              </span>
            </div>
            <div className="tab monitoring-session active">Monitoring Session</div>
          </div>

          <div className="header-controls">
            {/* Simulation run / pause + speed selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRight: '1px solid var(--border-color)', paddingRight: '12px', marginRight: '12px' }}>
              <button
                onClick={toggleSimulation}
                className={`sim-btn ${isRunning ? 'running' : ''}`}
              >
                {isRunning ? '⏸ Pause' : '▶ Run Simulation'}
              </button>

              {/* Speed selector is only relevant while the simulation is running */}
              {isRunning && (
                <select
                  value={simulationSpeed}
                  onChange={(e) => setSimulationSpeed(Number(e.target.value))}
                  className="sim-speed-select"
                >
                  <option value={1}>1x Speed</option>
                  <option value={2}>2x Speed</option>
                  <option value={5}>5x Speed</option>
                  <option value={10}>10x Speed</option>
                </select>
              )}
            </div>

            {advancedMode && (() => {
              const validationErrors = validateConfiguration(nodes, edges);
              const hasErrors = validationErrors.length > 0;
              return (
                <button 
                  className="header-btn" 
                  style={{ 
                    background: hasErrors ? 'rgba(239, 83, 80, 0.2)' : 'rgba(255, 152, 0, 0.2)', 
                    color: hasErrors ? '#ef5350' : '#ffb74d', 
                    borderColor: hasErrors ? 'rgba(239, 83, 80, 0.5)' : 'rgba(255, 152, 0, 0.5)' 
                  }} 
                  onClick={() => setShowBom(true)}
                >
                  📋 View BOM{hasErrors ? ' (⚠️ Attention)' : ''}
                </button>
              );
            })()}

            {/* Save button now opens the multi-slot modal in App.tsx */}
            <button className="header-btn primary" onClick={onSaveClick}>
              💾 Save Layout
            </button>
            <button className="header-btn secondary" onClick={onLoadClick}>
              📂 Load Layout
            </button>
            <button className="header-btn secondary" onClick={loadDemo}>
              🔄 Reset Demo
            </button>
            <button className="header-btn secondary" onClick={() => setShowSettings(true)}>
              ⚙️ Project Settings
            </button>
            {/* Clear opens our custom confirm modal instead of window.confirm() */}
            <button onClick={handleClearRequest} className="header-btn danger">
              🗑️ Clear
            </button>
          </div>
        </header>
      </div>
    </>
  );
};

export default Header;