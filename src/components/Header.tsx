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
import { NODE_TYPES } from '../constants/nodeTypes';
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

// ─── BOM Modal ────────────────────────────────────────────────────────────────

const BomModal: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const nodes = useStore((state) => state.nodes);
  
  // Aggregate hardware nodes and their optics
  const bom: Record<string, { model: string; sku: string; qty: number; type: string }> = {};
  
  let stdTapCount = 0;
  let ultTapCount = 0;

  nodes.forEach(n => {
    if (n.type === NODE_TYPES.HARDWARE) {
      const sku = (n.data?.sku as string) || 'UNKNOWN-SKU';
      const model = (n.data?.model as string) || 'Hardware';
      
      // Filter out any stray chassis that might have been added before we hid them
      if (['TAP-M100T', 'TAP-M200T', 'TAP-M202ULT'].includes(sku)) return;

      if (!bom[sku]) bom[sku] = { model, sku, qty: 0, type: 'Appliance/TAP' };
      bom[sku].qty += 1;
      
      if (sku.includes('TAP')) {
        if (sku.includes('ULT')) ultTapCount += 1;
        else stdTapCount += 1;
      }

      const optics = (n.data?.optics as { board: string, optic: string, qty: number }[]) || [];
      optics.forEach(opt => {
        const optKey = `OPTIC-${opt.optic}`;
        if (!bom[optKey]) bom[optKey] = { model: opt.optic, sku: opt.optic, qty: 0, type: 'Optic/Transceiver' };
        bom[optKey].qty += opt.qty;
      });

      const installedBoards = (n.data?.installedBoards as Record<string, string>) || {};
      Object.values(installedBoards).forEach(boardName => {
        const boardKey = `BOARD-${boardName}`;
        if (!bom[boardKey]) bom[boardKey] = { model: boardName, sku: boardName, qty: 0, type: 'Module/Board' };
        bom[boardKey].qty += 1;
      });
    }
  });

  if (stdTapCount > 0) {
    const m200t_qty = Math.floor(stdTapCount / 6);
    const remainder = stdTapCount % 6;
    let m100t_qty = 0;
    let extra_m200t_qty = 0;

    if (remainder >= 4) {
      extra_m200t_qty = 1;
    } else if (remainder > 0) {
      m100t_qty = 1;
    }

    if (m200t_qty + extra_m200t_qty > 0) {
      bom['TAP-M200T'] = { model: 'TAP-M200T', sku: 'TAP-M200T', qty: m200t_qty + extra_m200t_qty, type: 'Appliance/TAP (Chassis)' };
    }
    if (m100t_qty > 0) {
      bom['TAP-M100T'] = { model: 'TAP-M100T', sku: 'TAP-M100T', qty: m100t_qty, type: 'Appliance/TAP (Chassis)' };
    }
  }

  if (ultTapCount > 0) {
    const m202ult_qty = Math.ceil(ultTapCount / 2);
    bom['TAP-M202ULT'] = { model: 'TAP-M202ULT', sku: 'TAP-M202ULT', qty: m202ult_qty, type: 'Appliance/TAP (Chassis)' };
  }
  
  const items = Object.values(bom).sort((a, b) => a.type.localeCompare(b.type) || a.model.localeCompare(b.model));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '24px', width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,0,0,0.8)' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#ffb74d' }}>Bill of Materials (BOM)</h3>
        
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
          {items.length === 0 ? (
            <div style={{ color: '#aaa', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No hardware nodes tracked in the current layout.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #444' }}>
                  <th style={{ padding: '8px', color: '#888' }}>Type</th>
                  <th style={{ padding: '8px', color: '#888' }}>Model</th>
                  <th style={{ padding: '8px', color: '#888' }}>SKU</th>
                  <th style={{ padding: '8px', color: '#888', textAlign: 'right' }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #333' }}>
                    <td style={{ padding: '8px', color: '#ccc' }}>{item.type}</td>
                    <td style={{ padding: '8px', color: '#fff', fontWeight: 'bold' }}>{item.model}</td>
                    <td style={{ padding: '8px', color: '#00e5ff', fontFamily: 'monospace' }}>{item.sku}</td>
                    <td style={{ padding: '8px', color: '#fff', textAlign: 'right' }}>{item.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '8px' }}>
          <button onClick={() => {
            const csv = ['Type,Model,SKU,Qty'].concat(items.map(i => `"${i.type}","${i.model}","${i.sku}",${i.qty}`)).join('\n');
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
  const trafficStreams  = useStore((state) => state.trafficStreams);  // for active stream count
  const toggleSimulation  = useStore((state) => state.toggleSimulation);
  const setSimulationSpeed = useStore((state) => state.setSimulationSpeed);
  const clearCanvas    = useStore((state) => state.clearCanvas);
  const loadDemo       = useStore((state) => state.loadDemo);
  const advancedMode   = useStore((state) => state.advancedMode);

  // Local UI state for the toast and confirm modal
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showBom, setShowBom] = useState(false);

  const handleClearRequest = () => setShowClearConfirm(true);
  const handleClearConfirm  = () => { clearCanvas(); setShowClearConfirm(false); };
  const handleClearCancel   = () => setShowClearConfirm(false);

  const activeStreamsCount = trafficStreams.filter((s) => s.active).length;

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

      <div className="header-wrapper">
        {/* ── Top Brand Bar ── */}
        <header className="header-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span className="brand-logo">Gigamon Flow Mapping Example</span>
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

            {advancedMode && (
              <button className="header-btn" style={{ background: 'rgba(255, 152, 0, 0.2)', color: '#ffb74d', borderColor: 'rgba(255, 152, 0, 0.5)' }} onClick={() => setShowBom(true)}>
                📋 View BOM
              </button>
            )}

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
            {/* Clear opens our custom confirm modal instead of window.confirm() */}
            <button onClick={handleClearRequest} className="header-btn danger">
              🗑️ Clear
            </button>
          </div>
        </header>

        {/* ── Sub-Header: breadcrumb + live stats ── */}
        <div className="header-sub">
          <div className="session-title-area">
            <span className="session-icon">☁️</span>
            <span className="session-name-label">Test</span>
          </div>

          <div className="header-stats-indicator">
            <span>Active Ingress Port Loads: <b>{activeStreamsCount} / {trafficStreams.length}</b></span>
          </div>
        </div>
      </div>
    </>
  );
};

export default Header;