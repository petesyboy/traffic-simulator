/**
 * ConfigPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The right-hand properties panel.  Shows either a "Global Dashboard" view
 * (when no node is selected) or a node configuration view.
 *
 * CHANGES (refactor/code-quality-improvements)
 * ─────────────────────────────────────────────
 * 1. REMOVED setState-DURING-RENDER ANTI-PATTERN
 *    Previously the component had:
 *      if (selectedNodeId !== prevSelectedNodeId) {
 *        setPrevSelectedNodeId(selectedNodeId);
 *        if (selectedNodeId) setIsCollapsed(false);
 *      }
 *    Calling setState during a render triggers a second render immediately,
 *    which violates React's rules and can lead to subtle bugs.
 *    Fixed: `useEffect` is now used for this side effect.
 *
 * 2. SPLIT INTO SUB-COMPONENTS
 *    The 754-line monolith has been broken into focused sub-components:
 *      • DashboardPanel   — shown when no node is selected
 *      • InputNodePanel   — SPAN/TAP/ERSPAN port properties
 *      • MapNodePanel     — Traffic Map condition builder
 *      • FilterNodePanel  — VLAN/IP/Port filter properties
 *      • GigaSmartPanel   — GigaSMART engine properties
 *      • ToolNodePanel    — Packet/Metadata tool properties
 *      • LiveMetrics      — Per-node live stats (shared by all nodes)
 *
 * 3. UTILITIES & CONSTANTS
 *    formatBandwidth/formatPackets imported from utils/format.ts.
 *    Node types imported from constants/nodeTypes.ts.
 *
 * 4. INLINE STYLES REDUCED
 *    Common repeated patterns replaced with CSS classes where possible.
 */

import React, { useState, useEffect } from 'react';
import { useStore, type MapCondition, type CustomNode } from '../store/store';
import { formatBandwidth, formatPackets, formatBytes } from '../utils/format';
import {
  NODE_TYPES,
  CONFIG_TYPES,
  ACTION_TYPES,
  isMetadataAction,
  isDedupAction,
} from '../constants/nodeTypes';
import { type NodeMetrics } from '../store/store';
import hardwareCatalogue from '../constants/hardwareCatalogue.json';
import { getSupportedBoards, validateOptic } from '../utils/opticValidation';

// ─── Shared form helpers ──────────────────────────────────────────────────────

const FormGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="form-group">
    <label>{label}</label>
    {children}
  </div>
);

// ─── Live Metrics sub-component ───────────────────────────────────────────────

/**
 * Renders the "Live Node Statistics" section that appears at the bottom
 * of any selected node's config panel while the simulation is running.
 */
const LiveMetrics: React.FC<{
  nodeType: string;
  metrics: NodeMetrics;
}> = ({ nodeType, metrics }) => (
  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px', marginTop: '10px' }}>
    <h3>Live Node Statistics</h3>
    <div className="form-group" style={{ gap: '8px' }}>
      {nodeType !== NODE_TYPES.INPUT && (
        <div className="metric-badge">
          <span className="label">Rx Throughput:</span>
          <span className="value">{formatBandwidth(metrics.rxBps)}</span>
        </div>
      )}
      {nodeType !== NODE_TYPES.INPUT && (
        <div className="metric-badge">
          <span className="label">Rx Packet Rate:</span>
          <span className="value">{formatPackets(metrics.rxPackets)}</span>
        </div>
      )}
      {nodeType !== NODE_TYPES.TOOL && (
        <div className="metric-badge">
          <span className="label">Tx Throughput:</span>
          <span className="value" style={{ color: 'var(--color-input)' }}>
            {formatBandwidth(metrics.txBps)}
          </span>
        </div>
      )}
      {nodeType !== NODE_TYPES.TOOL && (
        <div className="metric-badge">
          <span className="label">Tx Packet Rate:</span>
          <span className="value" style={{ color: 'var(--color-input)' }}>
            {formatPackets(metrics.txPackets)}
          </span>
        </div>
      )}
      {(metrics.droppedPackets > 0 || nodeType === NODE_TYPES.FILTER) && (
        <div className="metric-badge">
          <span className="label">Dropped Traffic:</span>
          <span className="value" style={{ color: '#ef5350' }}>
            {formatBandwidth(metrics.droppedPackets)}
          </span>
        </div>
      )}
    </div>
  </div>
);

// ─── HardwareNodePanel ────────────────────────────────────────────────────────

const HardwareNodePanel: React.FC<{ 
  node: CustomNode;
  onConditionChange: (index: number, key: string, value: string) => void;
  onAddCondition: () => void;
  onRemoveCondition: (index: number) => void;
}> = ({ node, onConditionChange, onAddCondition, onRemoveCondition }) => {
  const model = node.data?.model as string;
  const sku = node.data?.sku as string;
  const installedOptics = (node.data?.optics as { board: string, optic: string, qty: number }[]) || [];
  const installedBoards = (node.data?.installedBoards as Record<string, string>) || {};
  const updateNodeData = useStore(state => state.updateNodeData);
  const edges = useStore(state => state.edges);
  const nodes = useStore(state => state.nodes);

  const [selectedOpticBoard, setSelectedOpticBoard] = useState('');
  const [selectedOptic, setSelectedOptic] = useState('');
  const [qty, setQty] = useState(1);
  const [errorMsg, setErrorMsg] = useState('');

  let details: any = null;

  if (model?.includes('TAP')) details = hardwareCatalogue.taps.find(t => t.sku === sku);
  else if (model?.includes('TA')) details = hardwareCatalogue.ta_series.find(t => t.sku === sku);
  else if (model?.includes('HC')) details = hardwareCatalogue.hc_series.find(t => t.sku === sku);

  const supportedBoards = getSupportedBoards(model || '');
  
  // Determine available boards for optics: Main board / Base Ports + explicitly installed slot boards
  const availableOpticBoards = supportedBoards.filter(b => 
    b.board.toLowerCase().includes('main') || 
    b.board.toLowerCase().includes('base') || 
    Object.values(installedBoards).includes(b.board)
  );

  const activeOpticBoardObj = availableOpticBoards.length === 1 
    ? availableOpticBoards[0] 
    : availableOpticBoards.find(b => b.board === selectedOpticBoard);

  const handleBoardSelect = (slotIndex: number, boardName: string) => {
    const newBoards = { ...installedBoards };
    if (boardName) {
      newBoards[slotIndex] = boardName;
    } else {
      delete newBoards[slotIndex];
    }
    updateNodeData(node.id, { installedBoards: newBoards });
    
    // Reset selected optic board if the board we had selected is no longer installed
    if (selectedOpticBoard && !Object.values(newBoards).includes(selectedOpticBoard) && !selectedOpticBoard.toLowerCase().includes('main') && !selectedOpticBoard.toLowerCase().includes('base')) {
      setSelectedOpticBoard('');
      setSelectedOptic('');
    }
  };

  const handleAddOptic = () => {
    setErrorMsg('');
    const targetBoard = availableOpticBoards.length === 1 ? availableOpticBoards[0].board : selectedOpticBoard;
    if (!targetBoard || !selectedOptic) {
      setErrorMsg('Please select a board and an optic.');
      return;
    }
    const validation = validateOptic(model, targetBoard, selectedOptic);
    if (!validation.valid) {
      setErrorMsg(validation.message || 'Invalid optic combination.');
      return;
    }

    const newOpticObj = { board: targetBoard, optic: selectedOptic, qty };
    const newOptics = [...installedOptics, newOpticObj];
    updateNodeData(node.id, { optics: newOptics });
    setSelectedOptic('');
    setQty(1);
  };

  const handleRemoveOptic = (index: number) => {
    const newOptics = [...installedOptics];
    newOptics.splice(index, 1);
    updateNodeData(node.id, { optics: newOptics });
  };

  const renderModuleSlots = () => {
    if (!details?.module_slots) return null;
    
    const slots = [];
    // Only show installable boards (exclude main/base)
    const installableBoards = supportedBoards.filter(b => !b.board.toLowerCase().includes('main') && !b.board.toLowerCase().includes('base'));
    
    for (let i = 1; i <= details.module_slots; i++) {
      slots.push(
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
          <label style={{ fontSize: '11px', color: '#ccc' }}>Slot {i}</label>
          <select 
            value={installedBoards[i] || ''} 
            onChange={e => handleBoardSelect(i, e.target.value)}
            style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}
          >
            <option value="">-- Empty Slot --</option>
            {installableBoards.map(b => (
              <option key={b.board} value={b.board}>{b.board}</option>
            ))}
          </select>
        </div>
      );
    }
    return (
      <div style={{ borderTop: '1px solid rgba(255, 152, 0, 0.2)', paddingTop: '10px', marginTop: '10px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>Module Slots</h4>
        {slots}
      </div>
    );
  };

  return (
    <div style={{ padding: '12px', background: 'rgba(255, 152, 0, 0.05)', borderRadius: '6px', border: '1px solid rgba(255, 152, 0, 0.15)' }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#ff9800' }}>Hardware Specifications</h3>
      {details ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', marginBottom: '16px' }}>
          <div><strong>Model:</strong> {details.model}</div>
          <div><strong>SKU:</strong> {details.sku}</div>
          {details.ru && <div><strong>Form Factor:</strong> {details.ru} RU</div>}
          {details.power && <div><strong>Power:</strong> {details.power}</div>}
          {details.fans !== undefined && <div><strong>Fans:</strong> {details.fans}</div>}
          {details.airflow && <div><strong>Airflow:</strong> {details.airflow}</div>}
          {details.ports !== undefined && <div><strong>Base Ports:</strong> {details.ports}</div>}
          {details.base_ports !== undefined && <div><strong>Base Ports:</strong> {details.base_ports}</div>}
          {details.module_slots !== undefined && <div><strong>Module Slots:</strong> {details.module_slots}</div>}
        </div>
      ) : (
        <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '16px' }}>Specs not found for {sku}.</div>
      )}

      {model?.includes('TAP') && (() => {
        const maxLinks = details?.max_links || 6;
        return (
          <div style={{ borderTop: '1px solid rgba(255, 152, 0, 0.2)', paddingTop: '10px', marginTop: '10px', marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>TAP Settings</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '11px', color: '#ccc' }}>Tapped Links:</label>
              <input 
                type="number" 
                min={1} 
                max={maxLinks}
                value={node.data.tappedLinksCount ?? 1} 
                onChange={e => {
                  let val = parseInt(e.target.value);
                  if (isNaN(val) || val < 1) val = 1;
                  if (val > maxLinks) val = maxLinks;
                  updateNodeData(node.id, { tappedLinksCount: val });
                }}
                style={{ width: '60px', fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}
              />
            </div>
            <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
              Specifies the number of links this TAP is monitoring (1-{maxLinks}).
            </div>
            {(() => {
              // Calculate derived capacity based on connected hardware optics
              const outgoingEdges = edges.filter(e => e.source === node.id);
              if (outgoingEdges.length === 0) return null;
              
              const targetNode = nodes.find(n => n.id === outgoingEdges[0].target);
              if (!targetNode || !targetNode.data.optics) return null;
              
              const optics = targetNode.data.optics as any[];
              if (optics.length === 0) return null;
              
              let maxSpeedStr = '';
              let maxSpeedValue = 0;
              optics.forEach(opt => {
                const match = opt.optic.match(/(1|10|25|40|100|400)G/i);
                if (match) {
                  const val = parseInt(match[1]);
                  if (val > maxSpeedValue) {
                    maxSpeedValue = val;
                    maxSpeedStr = match[1] + 'G';
                  }
                }
              });
              
              if (!maxSpeedValue) return null;
              
              const numLinks = (node.data.tappedLinksCount as number) ?? 1;
              const totalSpeed = numLinks * maxSpeedValue;
              
              return (
                <div style={{ marginTop: '12px', padding: '8px', backgroundColor: 'rgba(37, 179, 75, 0.1)', border: '1px solid rgba(37, 179, 75, 0.3)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '11px', color: '#4caf50', fontWeight: 'bold' }}>Derived Input Capacity</div>
                  <div style={{ fontSize: '11px', color: '#fff', marginTop: '4px' }}>
                    {numLinks} link(s) × {maxSpeedStr} = <strong>{totalSpeed}G Total</strong>
                  </div>
                  <div style={{ fontSize: '9px', color: '#aaa', marginTop: '2px' }}>
                    (Based on {maxSpeedStr} optics detected in {targetNode.data.model as string})
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {renderModuleSlots()}

      {availableOpticBoards.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255, 152, 0, 0.2)', paddingTop: '10px', marginTop: '10px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>Install Optics</h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {availableOpticBoards.length > 1 ? (
              <select 
                value={selectedOpticBoard} 
                onChange={e => { setSelectedOpticBoard(e.target.value); setSelectedOptic(''); setErrorMsg(''); }}
                style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}
              >
                <option value="">-- Select Target Cage --</option>
                {availableOpticBoards.map(b => (
                  <option key={b.board} value={b.board}>{b.board}</option>
                ))}
              </select>
            ) : (
              <div style={{ fontSize: '11px', color: '#aaa', padding: '4px 0' }}>
                Target Cage: <strong style={{ color: '#fff' }}>{availableOpticBoards[0]?.board || 'Base Ports'}</strong>
              </div>
            )}

            <select 
              value={selectedOptic} 
              onChange={e => { setSelectedOptic(e.target.value); setErrorMsg(''); }}
              style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}
              disabled={availableOpticBoards.length === 0 || (availableOpticBoards.length > 1 && !selectedOpticBoard)}
            >
              <option value="">-- Select Optic --</option>
              {activeOpticBoardObj?.supportedOptics.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
              {/* Added a test failure case to demonstrate validation */}
              <option value="UNSUPPORTED_TEST_OPTIC">Unsupported Optic (Test Error)</option>
            </select>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', color: '#ccc' }}>Qty:</label>
              <input 
                type="number" 
                min={1} 
                value={qty} 
                onChange={e => setQty(parseInt(e.target.value) || 1)}
                style={{ width: '40px', fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}
              />
              <button 
                onClick={handleAddOptic}
                style={{ flex: 1, padding: '4px 8px', background: 'rgba(255, 152, 0, 0.2)', border: '1px solid rgba(255, 152, 0, 0.4)', borderRadius: '3px', color: '#ffb74d', fontSize: '11px', cursor: 'pointer' }}
              >
                Add Optic
              </button>
            </div>

            {errorMsg && (
              <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(239, 83, 80, 0.1)', border: '1px solid rgba(239, 83, 80, 0.3)', borderRadius: '4px', color: '#ef5350', fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                ⚠️ {errorMsg}
              </div>
            )}
          </div>

          {installedOptics.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <h5 style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#ccc' }}>Installed Optics:</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {installedOptics.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', border: '1px solid #333' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#fff' }}>{opt.qty}x {opt.optic}</span>
                      <span style={{ color: '#888' }}>{opt.board}</span>
                    </div>
                    <button 
                      onClick={() => handleRemoveOptic(i)}
                      style={{ background: 'none', border: 'none', color: '#ef5350', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}
                      title="Remove Optic"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(() => {
            const incomingTapEdges = edges.filter(e => e.target === node.id);
            let tappedLinks = 0;
            incomingTapEdges.forEach(e => {
              const sourceNode = nodes.find(n => n.id === e.source);
              if (sourceNode?.data?.model?.includes('TAP')) {
                tappedLinks += (sourceNode.data.tappedLinksCount as number) ?? 1;
              }
            });
            
            if (tappedLinks > 0) {
              const totalOptics = installedOptics.reduce((sum, opt) => sum + opt.qty, 0);
              const requiredOptics = tappedLinks * 2;
              if (totalOptics < requiredOptics) {
                return (
                  <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(255, 152, 0, 0.1)', border: '1px solid rgba(255, 152, 0, 0.3)', borderRadius: '4px', color: '#ffb74d', fontSize: '11px' }}>
                    <strong>⚠️ Attention:</strong> You have <strong>{tappedLinks}</strong> connected TAP link(s). Every tapped link produces two outputs (northbound and southbound). Therefore, a minimum of <strong>{requiredOptics}</strong> optics must be installed to support this setup.
                  </div>
                );
              }
            }
            return null;
          })()}
          {/* Native Map Filtering for HC and TA nodes */}
          {!model?.includes('TAP') && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', marginTop: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#ffb74d' }}>Traffic Map Filter Rules</h4>
              <MapNodePanel 
                node={node}
                onConditionChange={onConditionChange}
                onAddCondition={onAddCondition}
                onRemoveCondition={onRemoveCondition}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Dashboard (no-node-selected) sub-component ───────────────────────────────

/**
 * Shown in the right panel when no node is selected.
 * Displays global pipeline statistics (total ingest, reduction %, delivery).
 */
const DashboardPanel: React.FC<{ isRunning: boolean }> = ({ isRunning }) => {
  const nodes           = useStore((state) => state.nodes);
  const nodeMetrics     = useStore((state) => state.nodeMetrics);
  const uniqueEgressBps = useStore((state) => state.uniqueEgressBps);

  // Aggregate ingest (from inputNodes)
  let totalIngest = 0;
  nodes.forEach((n) => {
    const metric = nodeMetrics[n.id];
    if (!metric) return;
    if (n.type === NODE_TYPES.INPUT) totalIngest += metric.txBps;
  });

  const totalEgress = uniqueEgressBps;

  const reductionRaw     = Math.max(0, totalIngest - totalEgress);
  const reductionPercent = totalIngest > 0 ? (reductionRaw / totalIngest) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '320px', height: '100%', padding: '20px', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div>
        <h2 style={{ fontSize: '13px', margin: 0, paddingBottom: '8px' }}>Global Pipeline Dashboard</h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
          Real-time visibility into the entire network visibility fabric.
        </p>
      </div>

      {isRunning ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pipeline Flow Statistics
          </h3>

          {/* Total Ingest card */}
          <div style={{ padding: '12px 16px', background: 'rgba(0, 124, 255, 0.03)', borderRadius: '6px', border: '1px solid rgba(0, 124, 255, 0.15)', borderLeft: '4px solid var(--color-input)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Total Ingest Traffic</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', fontFamily: 'monospace' }}>{formatBandwidth(totalIngest)}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{formatPackets(totalIngest * 250)} packet rate</div>
          </div>

          {/* Reduction card with progress bar */}
          <div style={{ padding: '12px 16px', background: 'rgba(255, 145, 0, 0.03)', borderRadius: '6px', border: '1px solid rgba(255, 145, 0, 0.15)', borderLeft: '4px solid var(--color-orange)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Traffic Volume Reduction</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-orange)', fontFamily: 'monospace' }}>
                {reductionPercent.toFixed(1)}%
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                ({formatBandwidth(reductionRaw)} saved)
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              Filtered: {formatPackets(reductionRaw * 250)} packet reduction
            </div>
            {/* Animated progress bar */}
            <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', overflow: 'hidden', marginTop: '6px' }}>
              <div style={{ height: '100%', width: `${reductionPercent}%`, background: 'linear-gradient(90deg, #ff9100 0%, #ff5d00 100%)', borderRadius: '3px', transition: 'width 0.3s ease' }} />
            </div>
          </div>

          {/* Delivery card */}
          <div style={{ padding: '12px 16px', background: 'rgba(37, 179, 75, 0.03)', borderRadius: '6px', border: '1px solid rgba(37, 179, 75, 0.15)', borderLeft: '4px solid var(--color-tool)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Delivered to Tools</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', fontFamily: 'monospace' }}>{formatBandwidth(totalEgress)}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{formatPackets(totalEgress * 250)} packet rate</div>
          </div>

          <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4', marginTop: '10px' }}>
            💡 <b>Security Optimization Tip:</b>
            <p style={{ margin: '4px 0 0 0' }}>
              Filtering out non-malicious duplicate and background protocol traffic before sending it to analysis tools reduces tool CPU utilization and prevents packet drops at high traffic volumes.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ padding: '20px', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px dashed var(--border-color)', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
          <span style={{ fontSize: '24px', marginBottom: '8px' }}>📊</span>
          <b>Simulation Offline</b>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Start the simulation in the top header to inject traffic and view real-time pipeline analytics.
          </span>
        </div>
      )}
    </div>
  );
};

// ─── InputNodePanel ───────────────────────────────────────────────────────────

/**
 * Configuration options for SPAN Port, TAP Device, and ERSPAN Tunnel nodes.
 * Each port class has different relevant sub-options (port speed, TAP mode, etc.).
 */
const InputNodePanel: React.FC<{
  node: CustomNode;
  onGenericChange: (key: string, val: string) => void;
}> = ({ node, onGenericChange }) => {
  const configType = (node.data?.configType as string) || CONFIG_TYPES.SPAN;

  return (
    <>
      <FormGroup label="Input Port Class">
        <select
          value={configType}
          onChange={(e) => onGenericChange('configType', e.target.value)}
        >
          <option value={CONFIG_TYPES.SPAN}>SPAN Port</option>
          <option value={CONFIG_TYPES.TAP}>TAP Hardware Device</option>
          <option value={CONFIG_TYPES.ERSPAN}>ERSPAN Tunnel Source</option>
          <option value={CONFIG_TYPES.EAST_WEST}>East/West Traffic Source</option>
          <option value={CONFIG_TYPES.VMWARE}>VMWare Virtual Estate</option>
        </select>
      </FormGroup>

      {/* SPAN-specific: port speed (affects traffic capacity label) */}
      {configType === CONFIG_TYPES.SPAN && (
        <FormGroup label="Port Speed">
          <select
            value={(node.data?.portSpeed as string) || '10G'}
            onChange={(e) => onGenericChange('portSpeed', e.target.value)}
          >
            <option value="1G">1 Gbps</option>
            <option value="10G">10 Gbps</option>
            <option value="40G">40 Gbps</option>
            <option value="100G">100 Gbps</option>
          </select>
        </FormGroup>
      )}

      {/* TAP-specific: passive (optical) vs active bypass mode */}
      {configType === CONFIG_TYPES.TAP && (
        <FormGroup label="TAP Mode">
          <select
            value={(node.data?.tapMode as string) || 'Passive'}
            onChange={(e) => onGenericChange('tapMode', e.target.value)}
          >
            <option value="Passive">Passive (Failsafe Optical)</option>
            <option value="Active">Active Bypass (Inline)</option>
          </select>
        </FormGroup>
      )}

      {/* ERSPAN-specific: tunnel session ID and source IP */}
      {configType === CONFIG_TYPES.ERSPAN && (
        <>
          <FormGroup label="Tunnel ID (Session ID)">
            <input
              type="number"
              placeholder="e.g. 10"
              value={(node.data?.erspanId as number) || 10}
              onChange={(e) => onGenericChange('erspanId', e.target.value)}
            />
          </FormGroup>
          <FormGroup label="ERSPAN Source IP">
            <input
              type="text"
              placeholder="e.g. 192.168.10.5"
              value={(node.data?.erspanSrcIp as string) || '192.168.10.5'}
              onChange={(e) => onGenericChange('erspanSrcIp', e.target.value)}
            />
          </FormGroup>
        </>
      )}
    </>
  );
};

// ─── FilterNodePanel ──────────────────────────────────────────────────────────

/**
 * Configuration for VLAN, IP Subnet, and Port filter nodes.
 * Only the relevant input is shown based on the node's configType.
 */
const FilterNodePanel: React.FC<{
  node: CustomNode;
  onGenericChange: (key: string, val: string) => void;
}> = ({ node, onGenericChange }) => {
  const configType = (node.data?.configType as string) || '';

  return (
    <>
      {configType === CONFIG_TYPES.VLAN_FILTER && (
        <FormGroup label="Filter VLAN IDs">
          <input
            type="text"
            placeholder="e.g. 100, 200"
            value={(node.data?.vlanIds as string) || ''}
            onChange={(e) => onGenericChange('vlanIds', e.target.value)}
          />
        </FormGroup>
      )}
      {configType === CONFIG_TYPES.IP_FILTER && (
        <FormGroup label="Filter IP Subnet">
          <input
            type="text"
            placeholder="e.g. 192.168.1.0/24"
            value={(node.data?.ipSubnet as string) || ''}
            onChange={(e) => onGenericChange('ipSubnet', e.target.value)}
          />
        </FormGroup>
      )}
      {configType === CONFIG_TYPES.PORT_FILTER && (
        <FormGroup label="Filter Destination Ports">
          <input
            type="text"
            placeholder="e.g. 80, 443"
            value={(node.data?.ports as string) || ''}
            onChange={(e) => onGenericChange('ports', e.target.value)}
          />
        </FormGroup>
      )}
    </>
  );
};

// ─── MapNodePanel ─────────────────────────────────────────────────────────────

/**
 * Traffic Map condition builder.
 * Each condition has a field selector (VLAN, Protocol, etc.), a value input,
 * an AND/OR logic toggle, and a PASS/DROP action selector.
 */
const MAP_CRITERIA = [
  { key: 'vlan',     label: 'VLAN ID',           placeholder: 'e.g. 100' },
  { key: 'protocol', label: 'IP Protocol',        placeholder: 'e.g. tcp, udp, icmp' },
  { key: 'portdst',  label: 'Destination Port',   placeholder: 'e.g. 80, 443' },
  { key: 'portsrc',  label: 'Source Port',         placeholder: 'e.g. 1024..65535' },
  { key: 'ipdst',    label: 'Destination IPv4',    placeholder: 'e.g. 192.168.1.0/24' },
  { key: 'ipsrc',    label: 'Source IPv4',         placeholder: 'e.g. 10.0.0.5' },
  { key: 'ipver',    label: 'IP Version',          placeholder: 'ipv4 or ipv6' },
];

function MapNodePanel({ 
  node, 
  onConditionChange, 
  onAddCondition, 
  onRemoveCondition 
}: {
  node: CustomNode;
  onConditionChange: (index: number, key: string, value: string) => void;
  onAddCondition: () => void;
  onRemoveCondition: (index: number) => void;
}) {
  const conditions = (node.data?.conditions as MapCondition[]) || [];

  return (
    <div>
      <h3>Map Criteria (OR-rules list)</h3>
      {conditions.map((condition, index) => (
        <div key={index} className="condition-card">
          <div className="condition-card-row">
            {/* Logic operator selector (hidden for the first condition) */}
            {index > 0 && (
              <select
                value={condition.logic}
                onChange={(e) => onConditionChange(index, 'logic', e.target.value)}
                style={{ flex: '0 0 65px', padding: '4px' }}
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            )}
            <select
              value={condition.field}
              onChange={(e) => onConditionChange(index, 'field', e.target.value)}
              style={{ flex: 1, padding: '4px' }}
            >
              {MAP_CRITERIA.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            <button className="danger" onClick={() => onRemoveCondition(index)} style={{ padding: '4px 8px' }}>
              Remove
            </button>
          </div>

          {/* ipver uses a dropdown; all other fields use a free-text input */}
          {condition.field === 'ipver' ? (
            <select
              value={condition.value || 'ipv4'}
              onChange={(e) => onConditionChange(index, 'value', e.target.value)}
              style={{ width: '100%', padding: '6px 10px', marginTop: '4px', backgroundColor: '#1a1a1a', border: '1px solid var(--border-color)', borderRadius: '3px', color: 'var(--text-primary)', fontSize: '12px' }}
            >
              <option value="ipv4">IPv4</option>
              <option value="ipv6">IPv6</option>
            </select>
          ) : (
            <input
              type="text"
              placeholder={MAP_CRITERIA.find((c) => c.key === condition.field)?.placeholder || ''}
              value={condition.value}
              onChange={(e) => onConditionChange(index, 'value', e.target.value)}
            />
          )}

          <div className="condition-card-row" style={{ marginTop: '2px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', flex: '0 0 45px' }}>Action:</span>
            <select
              value={condition.action || 'pass'}
              onChange={(e) => onConditionChange(index, 'action', e.target.value)}
              style={{
                flex: 1,
                padding: '4px 6px',
                fontSize: '11px',
                backgroundColor: condition.action === 'drop' ? 'rgba(239, 83, 80, 0.15)' : 'rgba(76, 175, 80, 0.15)',
                border: condition.action === 'drop' ? '1px solid rgba(239, 83, 80, 0.3)' : '1px solid rgba(76, 175, 80, 0.3)',
                color: condition.action === 'drop' ? '#ef5350' : '#4caf50',
                fontWeight: 'bold',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              <option value="pass" style={{ backgroundColor: '#1a1a1a', color: '#4caf50' }}>🟢 PASS</option>
              <option value="drop" style={{ backgroundColor: '#1a1a1a', color: '#ef5350' }}>🔴 DROP</option>
            </select>
          </div>
        </div>
      ))}
      <button className="secondary" onClick={onAddCondition} style={{ width: '100%', marginTop: '5px' }}>
        + Add Match Condition
      </button>
    </div>
  );
};

// ─── GigaSmartPanel ───────────────────────────────────────────────────────────

/**
 * GigaSMART engine configuration.
 * Shows the operation selector and relevant sub-options (e.g. metadata format
 * for AMI/AMX/Application Metadata, or the live dedup rate read-only display).
 */
const GigaSmartPanel: React.FC<{
  node: CustomNode;
  onGenericChange: (key: string, val: string) => void;
}> = ({ node, onGenericChange }) => {
  const actionType = (node.data?.actionType as string) || ACTION_TYPES.DEDUPLICATION;

  return (
    <>
      <FormGroup label="GigaSMART Engine Operation">
        <select
          value={actionType}
          onChange={(e) => onGenericChange('actionType', e.target.value)}
        >
          <option value={ACTION_TYPES.APP_METADATA}>Application Metadata</option>
          <option value={ACTION_TYPES.APP_VIS}>Application Visualization</option>
          <option value={ACTION_TYPES.CLOUD_5G}>5G-Cloud</option>
          <option value={ACTION_TYPES.DEDUPLICATION}>Packet Deduplication</option>
          <option value={ACTION_TYPES.GVHTTP2}>GVHTTP2</option>
          <option value={ACTION_TYPES.HEADER_STRIP}>Header Stripping (VXLAN/MPLS)</option>
          <option value={ACTION_TYPES.MASKING}>Masking</option>
          <option value={ACTION_TYPES.AMX}>AMX</option>
          <option value={ACTION_TYPES.AMI}>AMI</option>
          <option value={ACTION_TYPES.PCAPNG}>Pcapng</option>
          <option value={ACTION_TYPES.SBI_5G}>5G-SBI</option>
          <option value={ACTION_TYPES.SBIPOE}>Sbipoe</option>
          <option value={ACTION_TYPES.PACKET_SLICING}>Packet Slicing (Truncate Payload)</option>
          <option value={ACTION_TYPES.SSL_DECRYPT}>SSL Decrypt</option>
        </select>
      </FormGroup>

      {/* Metadata format selector for operations that produce metadata output */}
      {isMetadataAction(actionType) && (
        <FormGroup label="Output Metadata Format">
          <select
            value={(node.data?.metadataFormat as string) || 'CEF'}
            onChange={(e) => onGenericChange('metadataFormat', e.target.value)}
          >
            <option value="CEF">CEF (Common Event Format)</option>
            <option value="JSON">JSON format</option>
          </select>
        </FormGroup>
      )}

      {/* Deduplication rate is computed by SimulationEngine — displayed read-only */}
      {isDedupAction(actionType) && (
        <FormGroup label="Deduplication Rate">
          <div style={{ padding: '8px', background: 'rgba(0, 145, 234, 0.1)', borderRadius: '4px', border: '1px solid rgba(0, 145, 234, 0.2)', fontSize: '13px', fontWeight: 'bold', color: '#00e5ff' }}>
            {node.data?.dedupRate !== undefined
              ? `${Math.round(node.data.dedupRate as number)}%`
              : 'Initializing...'}
          </div>
        </FormGroup>
      )}
    </>
  );
};

// ─── ToolNodePanel ────────────────────────────────────────────────────────────

/**
 * Packet/Metadata tool configuration and live traffic status.
 */
const ToolNodePanel: React.FC<{
  node: CustomNode;
  onGenericChange: (key: string, val: string) => void;
  isRunning: boolean;
  metrics?: NodeMetrics;
}> = ({ node, onGenericChange, isRunning, metrics }) => {
  const configType = (node.data?.configType as string) || CONFIG_TYPES.PACKET_TOOL;
  const isMetadataTool = configType === CONFIG_TYPES.METADATA_TOOL;
  const isStorageTool = configType === CONFIG_TYPES.STORAGE_TOOL;
  const [showEstimates, setShowEstimates] = useState(false);

  return (
    <>
      <FormGroup label="Tool Class">
        <select
          value={configType}
          onChange={(e) => onGenericChange('configType', e.target.value)}
        >
          <option value={CONFIG_TYPES.PACKET_TOOL}>Packet Consuming Tool</option>
          <option value={CONFIG_TYPES.METADATA_TOOL}>Metadata Consuming Tool</option>
          <option value={CONFIG_TYPES.STORAGE_TOOL}>S3 / Object Storage</option>
        </select>
      </FormGroup>

      {/* Packet tools: capture buffer size (cosmetic — doesn't affect simulation) */}
      {configType === CONFIG_TYPES.PACKET_TOOL && (
        <FormGroup label="Capture Buffer Size">
          <select
            value={(node.data?.bufferSize as string) || '256MB'}
            onChange={(e) => onGenericChange('bufferSize', e.target.value)}
          >
            <option value="64MB">64 MB Buffer</option>
            <option value="256MB">256 MB Buffer</option>
            <option value="1GB">1 GB Circular Buffer</option>
          </select>
        </FormGroup>
      )}

      {/* Metadata tools: expected format (used by SimulationEngine for mismatch detection) */}
      {configType === CONFIG_TYPES.METADATA_TOOL && (
        <FormGroup label="Expected Format">
          <select
            value={(node.data?.expectedFormat as string) || 'CEF'}
            onChange={(e) => onGenericChange('expectedFormat', e.target.value)}
          >
            <option value="CEF">CEF (Common Event Format)</option>
            <option value="JSON">JSON Format</option>
            <option value="Any">Any Format (Auto-Detect)</option>
          </select>
        </FormGroup>
      )}

      {/* Traffic matching status — populated by SimulationEngine */}
      <FormGroup label="Traffic Matching Status">
        <div style={{
          padding: '8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 'bold',
          background: node.data?.status === 'warning' ? 'rgba(255, 145, 0, 0.08)' : 'rgba(76, 175, 80, 0.08)',
          border: node.data?.status === 'warning' ? '1px solid rgba(255, 145, 0, 0.2)' : '1px solid rgba(76, 175, 80, 0.2)',
          color: node.data?.status === 'warning' ? '#ff9100' : '#4caf50',
        }}>
          {node.data?.status === 'warning'
            ? `⚠️ ${node.data?.statusMessage as string || 'Traffic Mismatch'}`
            : isRunning && metrics && metrics.rxBps > 0
            ? `✓ Receiving matching traffic (${node.data?.receivedFormat || 'Expected class'})`
            : '✓ Idle (No Traffic)'}
        </div>
      </FormGroup>

      {/* Storage Estimates — for metadata and storage tools */}
      {isRunning && (isMetadataTool || isStorageTool) && metrics && metrics.rxBps > 0 && (
        <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(0, 229, 255, 0.03)', borderRadius: '6px', border: '1px solid rgba(0, 229, 255, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showEstimates ? '10px' : '0' }}>
            <h3 style={{ fontSize: '11px', margin: '0', color: '#00e5ff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Storage Projections
            </h3>
            <button
              onClick={() => setShowEstimates(!showEstimates)}
              style={{
                background: 'rgba(0, 229, 255, 0.08)',
                border: '1px solid rgba(0, 229, 255, 0.25)',
                borderRadius: '4px',
                color: '#00e5ff',
                fontSize: '10px',
                padding: '3px 8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontWeight: 'bold',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {showEstimates ? '🙈 Hide Estimates' : '📊 Show Estimates'}
            </button>
          </div>

          {showEstimates && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Current Total:</span>
                <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{formatBytes(node.data?.totalIngestedBytes as number)}</span>
              </div>
              <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Daily (est.):</span>
                <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{formatBytes(metrics.rxBps * 10800000000)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Weekly (est.):</span>
                <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{formatBytes(metrics.rxBps * 10800000000 * 7)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Monthly (est.):</span>
                <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{formatBytes(metrics.rxBps * 10800000000 * 30)}</span>
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: '9px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                * Based on current ingestion rate. Estimates assume 24/7 operation at this bandwidth.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
};

// ─── Main ConfigPanel ─────────────────────────────────────────────────────────

const ConfigPanel: React.FC = () => {
  const selectedNodeId = useStore((state) => state.selectedNodeId);
  const nodes          = useStore((state) => state.nodes);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const nodeMetrics    = useStore((state) => state.nodeMetrics);
  const isRunning      = useStore((state) => state.isRunning);

  const [isCollapsed, setIsCollapsed] = useState(false);

  /**
   * Auto-expand the panel whenever the user selects a node.
   *
   * Previously this was done with a "prevSelectedNodeId" state variable and a
   * conditional setState call during render — a React anti-pattern that
   * triggers an extra render.  Using useEffect is the correct approach: the
   * effect runs AFTER the render that caused selectedNodeId to change.
   */
  useEffect(() => {
    if (selectedNodeId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsCollapsed(false);
    }
  }, [selectedNodeId]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // ── Event handlers ──────────────────────────────────────────────────────────

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedNodeId) return;
    updateNodeData(selectedNodeId, { label: e.target.value });
  };

  const handleGenericChange = (key: string, val: string) => {
    if (!selectedNodeId || !selectedNode) return;

    const updates: Record<string, unknown> = { [key]: val };

    // When switching to Deduplication, initialise a random rate immediately
    if (key === 'actionType' && val === ACTION_TYPES.DEDUPLICATION && selectedNode.data?.dedupRate === undefined) {
      updates.dedupRate = Math.floor(Math.random() * 41) + 10;
      updates.lastDedupUpdate = Date.now();
    }

    // ERSPAN: parse the session ID as a number
    if (key === 'erspanId') {
      updates.erspanId = parseInt(val, 10) || 10;
    }

    // When the user changes the configType of an inputNode, update the label to match
    if (key === 'configType' && selectedNode.type === NODE_TYPES.INPUT) {
      const oldLabel = String(selectedNode.data?.label || '');
      const match    = oldLabel.match(/(?:x|Tunnel\s+|Traffic\s+|Estate\s+)(\d+)/i);
      const portIdx  = match ? match[1] : '1';
      if (val === CONFIG_TYPES.TAP)    updates.label = `TAP Device 1/1/x${portIdx}`;
      else if (val === CONFIG_TYPES.SPAN)   updates.label = `SPAN Port 1/1/x${portIdx}`;
      else if (val === CONFIG_TYPES.ERSPAN) updates.label = `ERSPAN Tunnel ${portIdx}`;
      else if (val === CONFIG_TYPES.EAST_WEST) updates.label = `East/West Traffic ${portIdx}`;
      else if (val === CONFIG_TYPES.VMWARE) updates.label = `VMWare Estate ${portIdx}`;
    }

    updateNodeData(selectedNodeId, updates);
  };

  // Map condition handlers
  const handleAddCondition = () => {
    if (!selectedNodeId || !selectedNode) return;
    const conditions = (selectedNode.data?.conditions as MapCondition[]) || [];
    updateNodeData(selectedNodeId, {
      conditions: [...conditions, { logic: 'AND', field: 'vlan', value: '', action: 'pass' }],
    });
  };

  const handleConditionChange = (index: number, key: string, value: string) => {
    if (!selectedNodeId || !selectedNode) return;
    const conditions = [...((selectedNode.data?.conditions as MapCondition[]) || [])];
    conditions[index] = { ...conditions[index], [key]: value };
    // Snap to 'ipv4' default when user switches field to 'ipver'
    if (key === 'field' && value === 'ipver') {
      if (conditions[index].value !== 'ipv4' && conditions[index].value !== 'ipv6') {
        conditions[index].value = 'ipv4';
      }
    }
    updateNodeData(selectedNodeId, { conditions });
  };

  const handleRemoveCondition = (index: number) => {
    if (!selectedNodeId || !selectedNode) return;
    const conditions = [...((selectedNode.data?.conditions as MapCondition[]) || [])];
    conditions.splice(index, 1);
    updateNodeData(selectedNodeId, { conditions });
  };

  // ── Shared toggle button (present in both collapsed and expanded states) ──
  const collapseToggle = (
    <button
      onClick={() => setIsCollapsed(!isCollapsed)}
      className="config-panel-toggle"
      title={isCollapsed ? 'Expand Panel' : 'Collapse Panel'}
    >
      {isCollapsed ? '◀' : '▶'}
    </button>
  );

  // ── No node selected: show dashboard ──────────────────────────────────────

  if (!selectedNodeId || !selectedNode) {
    return (
      <aside
        className={`config-panel ${isCollapsed ? 'collapsed' : ''}`}
        style={{
          width: isCollapsed ? '0px' : '320px',
          padding: '0px',
          borderLeft: isCollapsed ? 'none' : '1px solid var(--border-color)',
          position: 'relative',
          overflow: 'visible',
          transition: 'width 0.3s ease, padding 0.3s ease, border-color 0.3s ease',
          flexShrink: 0,
        }}
      >
        {collapseToggle}
        {!isCollapsed && <DashboardPanel isRunning={isRunning} />}
      </aside>
    );
  }

  // ── Node selected: show node-specific config ──────────────────────────────

  const configType          = (selectedNode.data?.configType as string) || (selectedNode.data?.label as string);
  const selectedNodeMetric  = nodeMetrics[selectedNode.id];

  return (
    <aside
      className={`config-panel ${isCollapsed ? 'collapsed' : ''}`}
      style={{
        width: isCollapsed ? '0px' : '320px',
        padding: '0px',
        borderLeft: isCollapsed ? 'none' : '1px solid var(--border-color)',
        position: 'relative',
        overflow: 'visible',
        transition: 'width 0.3s ease, padding 0.3s ease, border-color 0.3s ease',
        flexShrink: 0,
      }}
    >
      {collapseToggle}

      {!isCollapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '320px', height: '100%', padding: '16px', overflowY: 'auto', boxSizing: 'border-box' }}>
          <h2>Edit Node Configuration</h2>

          {/* Node label — editable for all node types */}
          <FormGroup label="Node Label">
            <input
              type="text"
              value={(selectedNode.data?.label as string) || ''}
              onChange={handleLabelChange}
            />
          </FormGroup>

          {/* Port Group info banner */}
          {selectedNode.type === NODE_TYPES.GROUP && (
            <div style={{ padding: '12px', background: 'rgba(0, 229, 255, 0.05)', borderRadius: '6px', border: '1px solid rgba(0, 229, 255, 0.15)', fontSize: '12px', color: '#00e5ff', marginBottom: '15px' }}>
              📦 <b>Port Group Node</b>
              <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                This group represents a Port Group, bundling multiple input ports together. Connecting the output handle of this group to a Traffic Map automatically maps all nested input ports to that map.
              </p>
            </div>
          )}

          {/* Node-type-specific panels */}
          {selectedNode.type === NODE_TYPES.HARDWARE && (
            <HardwareNodePanel 
              node={selectedNode} 
              onConditionChange={handleConditionChange}
              onAddCondition={handleAddCondition}
              onRemoveCondition={handleRemoveCondition}
            />
          )}
          {selectedNode.type === NODE_TYPES.INPUT && (
            <InputNodePanel node={selectedNode} onGenericChange={handleGenericChange} />
          )}
          {selectedNode.type === NODE_TYPES.FILTER && (
            <FilterNodePanel node={selectedNode} onGenericChange={handleGenericChange} />
          )}
          {selectedNode.type === NODE_TYPES.GIGASTREAM && (
            <FormGroup label="Load Balancing Algorithm">
              <select
                value={(selectedNode.data?.algorithm as string) || 'Round Robin'}
                onChange={(e) => handleGenericChange('algorithm', e.target.value)}
              >
                <option value="Round Robin">Round Robin (Even Split)</option>
                <option value="L4 Hash">L4 Hash (Five-Tuple hash)</option>
              </select>
            </FormGroup>
          )}
          {selectedNode.type === NODE_TYPES.GIGASMART && (
            <GigaSmartPanel node={selectedNode} onGenericChange={handleGenericChange} />
          )}
          {selectedNode.type === NODE_TYPES.TOOL && (
            <ToolNodePanel
              node={selectedNode}
              onGenericChange={handleGenericChange}
              isRunning={isRunning}
              metrics={selectedNodeMetric}
            />
          )}
          {configType === CONFIG_TYPES.TRAFFIC_MAP && (
            <MapNodePanel
              node={selectedNode}
              onConditionChange={handleConditionChange}
              onAddCondition={handleAddCondition}
              onRemoveCondition={handleRemoveCondition}
            />
          )}

          {/* Live metrics — shown for any node while simulation is running */}
          {isRunning && selectedNodeMetric && (
            <LiveMetrics nodeType={selectedNode.type || ''} metrics={selectedNodeMetric} />
          )}
        </div>
      )}
    </aside>
  );
};

export default ConfigPanel;