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
import skusData from '../constants/skus.json';
import { resolveNodeSkus } from '../utils/skuResolver';

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
  const projectLicenseMode = useStore(state => state.projectLicenseMode);

  // Calculate TAP link requirements and total optics
  const incomingTapEdges = edges.filter(e => e.target === node.id);
  let tappedLinks = 0;
  incomingTapEdges.forEach(e => {
    const sourceNode = nodes.find(n => n.id === e.source);
    if (sourceNode?.data?.model?.includes('TAP')) {
      tappedLinks += (sourceNode.data.tappedLinksCount as number) ?? 1;
    }
  });

  const totalOptics = installedOptics.reduce((sum, opt) => sum + opt.qty, 0);

  const [selectedOpticBoard, setSelectedOpticBoard] = useState('');
  const [selectedOptic, setSelectedOptic] = useState('');
  const [qtyStr, setQtyStr] = useState('1');
  const [errorMsg, setErrorMsg] = useState('');
  const [termDurationStr, setTermDurationStr] = useState((node.data?.termDurationOverride as string) || '');
  const [activeTab, setActiveTab] = useState<'general'|'optics'|'apps'>('general');
  
  const disableDcWarnings = useStore(state => state.disableDcWarnings);

  const handleTermBlur = () => {
    if (!termDurationStr) {
      updateNodeData(node.id, { termDurationOverride: undefined });
      return;
    }
    let parsed = parseInt(termDurationStr, 10);
    if (isNaN(parsed) || parsed < 1) parsed = 1;
    if (parsed > 120) parsed = 120;
    setTermDurationStr(parsed.toString());
    updateNodeData(node.id, { termDurationOverride: parsed.toString() });
  };

  const handlePowerChange = (power: string) => {
    if (power === 'DC' && !disableDcWarnings) {
      const confirm = window.confirm("You have selected a DC-powered appliance. Are you sure you need DC power?");
      if (!confirm) {
        updateNodeData(node.id, { powerSupply: 'AC' });
        return;
      }
    }
    updateNodeData(node.id, { powerSupply: power });
  };

  let details: any = null;

  if (model?.includes('TAP')) details = hardwareCatalogue.taps.find(t => t.sku === sku);
  else if (model?.includes('TA')) details = hardwareCatalogue.ta_series.find(t => t.sku === sku);
  else if (model?.includes('HC')) details = hardwareCatalogue.hc_series.find(t => t.sku === sku);

  const supportedBoards = getSupportedBoards(model || '', node.data?.portCapacity as string);
  
  // Determine available boards for optics: Main board / Base Ports + explicitly installed slot boards
  const availableOpticBoards = supportedBoards.filter(b => 
    b.board.toLowerCase().includes('main') || 
    b.board.toLowerCase().includes('base') || 
    Object.values(installedBoards).includes(b.board)
  );

  const activeOpticBoardObj = availableOpticBoards.length === 1 
    ? availableOpticBoards[0] 
    : availableOpticBoards.find(b => b.board === selectedOpticBoard);

  const getOpticSpeed = (opticName: string): '1G' | '10G' | '25G' | '40G' | '100G' | 'Unknown' => {
    const name = opticName.toUpperCase();
    if (name.includes('100G') || name.startsWith('Q28-')) return '100G';
    if (name.includes('40G') || name.startsWith('QSF-')) return '40G';
    if (name.includes('25G') || name.startsWith('SFP-55')) return '25G';
    if (name.includes('10G') || name.startsWith('SFP-53')) return '10G';
    if (name.includes('1G') || name.startsWith('SFP-50')) return '1G';
    return 'Unknown';
  };

  const getBoardCageCapacities = (boardName: string, isPlus: boolean): {
    ports1G: number;
    ports10G: number;
    ports25G: number;
    ports40G: number;
    ports100G: number;
  } => {
    const caps = { ports1G: 0, ports10G: 0, ports25G: 0, ports40G: 0, ports100G: 0 };
    const name = boardName.toLowerCase();
    const modelLower = String(model || '').toLowerCase();
    
    if (modelLower.includes('ta25')) {
      caps.ports100G = 8;
      caps.ports40G = 8;
      caps.ports25G = 48;
      caps.ports10G = 48;
      caps.ports1G = 48;
    } else if (name.includes('main') || name.includes('base ports') || name.includes('hc1-x12g4') || name.includes('hc1p-c04x08')) {
      if (isPlus) {
        caps.ports100G = 4;
        caps.ports40G = 4;
        caps.ports25G = 8;
        caps.ports10G = 8;
        caps.ports1G = 8;
      } else {
        caps.ports10G = 12;
        caps.ports1G = 16;
      }
    } else if (name.includes('bps-hc1-d25a24') || name.includes('d25a24')) {
      caps.ports10G = 24;
      caps.ports1G = 24;
    } else if (name.includes('prt-hc1-x12') || name.includes('x12')) {
      caps.ports10G = 12;
      caps.ports1G = 12;
    } else if (name.includes('prt-hc1-q04x08') || name.includes('q04x08')) {
      if (isPlus) {
        caps.ports100G = 4;
        caps.ports40G = 4;
        caps.ports25G = 8;
        caps.ports10G = 8;
        caps.ports1G = 8;
      } else {
        caps.ports40G = 4;
        caps.ports10G = 8;
        caps.ports1G = 8;
      }
    }
    return caps;
  };

  let total100G = 0, total40G = 0, total25G = 0, total10G = 0, total1G = 0;
  const isPlus = String(model || '').includes('Plus');

  availableOpticBoards.forEach(b => {
    const caps = getBoardCageCapacities(b.board, isPlus);
    total100G += caps.ports100G;
    total40G += caps.ports40G;
    total25G += caps.ports25G;
    total10G += caps.ports10G;
    total1G += caps.ports1G;
  });

  let used100G = 0, used40G = 0, used25G = 0, used10G = 0, used1G = 0;
  installedOptics.forEach(opt => {
    const speed = getOpticSpeed(opt.optic);
    if (speed === '100G') used100G += opt.qty;
    else if (speed === '40G') used40G += opt.qty;
    else if (speed === '25G') used25G += opt.qty;
    else if (speed === '10G') used10G += opt.qty;
    else if (speed === '1G') used1G += opt.qty;
  });

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
    const validation = validateOptic(model, targetBoard, selectedOptic, node.data?.portCapacity as string);
    if (!validation.valid) {
      setErrorMsg(validation.message || 'Invalid optic combination.');
      return;
    }

    let qty = parseInt(qtyStr);
    if (isNaN(qty) || qty < 1) qty = 1;

    const newOpticObj = { board: targetBoard, optic: selectedOptic, qty };
    const newOptics = [...installedOptics, newOpticObj];
    updateNodeData(node.id, { optics: newOptics });
    setSelectedOptic('');
    setQtyStr('1');
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

  const resolved = resolveNodeSkus({ ...node.data, model, sku }, projectLicenseMode); // trigger HMR

  const tabStyle = { padding: '6px 12px', fontSize: '11px', fontWeight: 'bold' as const, border: 'none', borderRadius: '4px', cursor: 'pointer' };

  return (
    <>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', borderBottom: '1px solid #333', paddingBottom: '8px', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('general')} style={{ ...tabStyle, background: activeTab === 'general' ? '#333' : 'transparent', color: activeTab === 'general' ? '#fff' : '#888' }}>General</button>
        <button onClick={() => setActiveTab('optics')} style={{ ...tabStyle, background: activeTab === 'optics' ? '#333' : 'transparent', color: activeTab === 'optics' ? '#fff' : '#888' }}>Optics</button>
        {node.data.gigaSmartApps && Array.isArray(node.data.gigaSmartApps) && node.data.gigaSmartApps.length > 0 && (
          <button onClick={() => setActiveTab('apps')} style={{ ...tabStyle, background: activeTab === 'apps' ? '#333' : 'transparent', color: activeTab === 'apps' ? '#fff' : '#888' }}>GigaSMART Apps</button>
        )}
      </div>

      {/* ── GENERAL TAB ── */}
      <div style={{ display: activeTab === 'general' ? 'block' : 'none' }}>
        <div className="config-card">
          <h3>⚙️ Hardware Specifications</h3>
          {details ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
              <div><strong>Model:</strong> {details.model}</div>
              <div><strong>Hardware SKU:</strong> {resolved.hwSku}</div>
              {skusData[resolved.hwSku as keyof typeof skusData] && (
                <div style={{ background: 'rgba(255, 152, 0, 0.08)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255, 152, 0, 0.2)', marginTop: '4px', marginBottom: '6px', fontSize: '11px', color: '#ffe0b2', lineHeight: '1.4' }}>
                  <strong>Hardware Description:</strong> {skusData[resolved.hwSku as keyof typeof skusData]}
                </div>
              )}
              {resolved.swSku && (
                <>
                  <div style={{ marginTop: '4px' }}><strong>Software SKU:</strong> {resolved.swSku}</div>
                  {skusData[resolved.swSku as keyof typeof skusData] && (
                    <div style={{ background: 'rgba(0, 229, 255, 0.08)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(0, 229, 255, 0.2)', marginTop: '4px', marginBottom: '6px', fontSize: '11px', color: '#e0f7fa', lineHeight: '1.4' }}>
                      <strong>Software Description:</strong> {skusData[resolved.swSku as keyof typeof skusData]}
                    </div>
                  )}
                </>
              )}
              {details.ru && <div><strong>Form Factor:</strong> {details.ru} RU</div>}
              {details.power && <div><strong>Power:</strong> {details.power}</div>}
              {details.fans !== undefined && <div><strong>Fans:</strong> {details.fans}</div>}
              {details.airflow && <div><strong>Airflow:</strong> {details.airflow}</div>}
              {details.ports !== undefined && <div><strong>Base Ports:</strong> {details.ports}</div>}
              {details.base_ports !== undefined && <div><strong>Base Ports:</strong> {details.base_ports}</div>}
              {details.module_slots !== undefined && <div><strong>Module Slots:</strong> {details.module_slots}</div>}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: '#aaa' }}>Specs not found for {sku}.</div>
          )}
        </div>

        {!model?.includes('TAP') && (
          <div className="config-card" style={{ marginTop: '16px' }}>
            <h3>🔧 Appliance Configuration</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>License Mode Override</label>
                <select value={(node.data?.licenseModeOverride as string) || 'default'} onChange={(e) => updateNodeData(node.id, { licenseModeOverride: e.target.value })} style={{ width: '100%' }}>
                  <option value="default">Project Default</option>
                  <option value="HTL">Hybrid Term Licensing (HTL)</option>
                  <option value="Perpetual">Perpetual</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Term Duration (Months)</label>
                <input type="number" placeholder="Project Default" value={termDurationStr} onChange={(e) => setTermDurationStr(e.target.value)} onBlur={handleTermBlur} style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Power Supply</label>
                <select value={(node.data?.powerSupply as string) || 'AC'} onChange={(e) => handlePowerChange(e.target.value)} style={{ width: '100%' }}>
                  <option value="AC">AC Power</option>
                  <option value="DC">DC Power</option>
                </select>
              </div>
              {model?.includes('TA') && (
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Software Port Capacity</label>
                  {model.includes('TA400') ? (
                    <select value={(node.data?.portCapacity as string) || 'Full'} onChange={(e) => updateNodeData(node.id, { portCapacity: e.target.value })} style={{ width: '100%' }}>
                      <option value="Full">32 x 400Gb ports</option>
                      <option value="100G">32 x 100Gb ports</option>
                    </select>
                  ) : (
                    <select value={(node.data?.portCapacity as string) || 'Full'} onChange={(e) => updateNodeData(node.id, { portCapacity: e.target.value })} style={{ width: '100%' }}>
                      <option value="Full">Full Capacity</option>
                      <option value="Half">Half Capacity</option>
                      <option value="Quarter">Quarter Capacity</option>
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {model?.includes('TAP') && (() => {
          const maxLinks = details?.max_links || 6;
          return (
            <div style={{ borderTop: '1px solid rgba(255, 152, 0, 0.2)', paddingTop: '10px', marginTop: '16px', marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>TAP Settings</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '11px', color: '#ccc' }}>Tapped Links:</label>
                <select value={node.data.tappedLinksCount ?? 1} onChange={e => updateNodeData(node.id, { tappedLinksCount: parseInt(e.target.value) })} style={{ width: '60px', fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}>
                  {Array.from({ length: maxLinks }, (_, i) => i + 1).map(num => <option key={num} value={num}>{num}</option>)}
                </select>
              </div>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>Specifies the number of links this TAP is monitoring (1-{maxLinks}).</div>
              {(() => {
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
                    <div style={{ fontSize: '11px', color: '#fff', marginTop: '4px' }}>{numLinks} link(s) × {maxSpeedStr} = <strong>{totalSpeed}G Total</strong></div>
                    <div style={{ fontSize: '9px', color: '#aaa', marginTop: '2px' }}>(Based on {maxSpeedStr} optics detected in {targetNode.data.model as string})</div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {!model?.includes('TAP') && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', marginTop: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#ffb74d' }}>Traffic Map Filter Rules</h4>
            <MapNodePanel node={node} onConditionChange={onConditionChange} onAddCondition={onAddCondition} onRemoveCondition={onRemoveCondition} />
          </div>
        )}
      </div>

      {/* ── OPTICS TAB ── */}
      <div style={{ display: activeTab === 'optics' ? 'block' : 'none' }}>
        {renderModuleSlots()}

        {!model?.includes('TAP') && (total100G > 0 || total40G > 0 || total25G > 0 || total10G > 0 || total1G > 0) && (
          <div style={{ borderTop: '1px solid rgba(255, 152, 0, 0.2)', paddingTop: '10px', marginTop: '10px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>Chassis Cage Capacity</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', textAlign: 'center', background: '#111', padding: '8px', borderRadius: '4px', border: '1px solid #333' }}>
              {total100G > 0 && <div><div style={{ color: '#888', fontWeight: 'bold', fontSize: '10px' }}>100G</div><div style={{ color: used100G > total100G ? '#ef5350' : '#fff', fontSize: '11px', marginTop: '2px', fontFamily: 'monospace' }}>{used100G}/{total100G}</div></div>}
              {total40G > 0 && <div><div style={{ color: '#888', fontWeight: 'bold', fontSize: '10px' }}>40G</div><div style={{ color: used40G > total40G ? '#ef5350' : '#fff', fontSize: '11px', marginTop: '2px', fontFamily: 'monospace' }}>{used40G}/{total40G}</div></div>}
              {total25G > 0 && <div><div style={{ color: '#888', fontWeight: 'bold', fontSize: '10px' }}>25G</div><div style={{ color: used25G > total25G ? '#ef5350' : '#fff', fontSize: '11px', marginTop: '2px', fontFamily: 'monospace' }}>{used25G}/{total25G}</div></div>}
              {total10G > 0 && <div><div style={{ color: '#888', fontWeight: 'bold', fontSize: '10px' }}>10G</div><div style={{ color: used10G > total10G ? '#ef5350' : '#fff', fontSize: '11px', marginTop: '2px', fontFamily: 'monospace' }}>{used10G}/{total10G}</div></div>}
              {total1G > 0 && <div><div style={{ color: '#888', fontWeight: 'bold', fontSize: '10px' }}>1G</div><div style={{ color: used1G > total1G ? '#ef5350' : '#fff', fontSize: '11px', marginTop: '2px', fontFamily: 'monospace' }}>{used1G}/{total1G}</div></div>}
            </div>
          </div>
        )}

        {!model?.includes('TAP') && (
          <div style={{ borderTop: '1px solid rgba(255, 152, 0, 0.2)', paddingTop: '10px', marginTop: '10px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>Optics Deployment Status</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#111', padding: '10px', borderRadius: '4px', border: '1px solid #333', fontSize: '11px', color: '#ccc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Deployed Optics:</span>
                <strong style={{ color: '#00e5ff', fontFamily: 'monospace' }}>{totalOptics}</strong>
              </div>
              {tappedLinks > 0 && (() => {
                const unterminated = Math.max(0, tappedLinks - Math.floor(totalOptics / 2));
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #222', paddingTop: '6px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Tapped Links Terminated:</span>
                      <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{Math.min(tappedLinks, Math.floor(totalOptics / 2))} / {tappedLinks}</strong>
                    </div>
                    {unterminated > 0 && <div style={{ color: '#ef5350', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}><span>⚠️ {unterminated} tapped link(s) lack optics for termination ({unterminated * 2} optic(s) missing)</span></div>}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {availableOpticBoards.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(255, 152, 0, 0.2)', paddingTop: '10px', marginTop: '10px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>Install Optics</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {availableOpticBoards.length > 1 ? (
                <select value={selectedOpticBoard} onChange={e => { setSelectedOpticBoard(e.target.value); setSelectedOptic(''); setErrorMsg(''); }} style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}>
                  <option value="">-- Select Target Cage --</option>
                  {availableOpticBoards.map(b => <option key={b.board} value={b.board}>{b.board}</option>)}
                </select>
              ) : (
                <div style={{ fontSize: '11px', color: '#aaa', padding: '4px 0' }}>Target Cage: <strong style={{ color: '#fff' }}>{availableOpticBoards[0]?.board || 'Base Ports'}</strong></div>
              )}
              <select value={selectedOptic} onChange={e => { setSelectedOptic(e.target.value); setErrorMsg(''); }} style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }} disabled={availableOpticBoards.length === 0 || (availableOpticBoards.length > 1 && !selectedOpticBoard)}>
                <option value="">-- Select Optic --</option>
                {activeOpticBoardObj?.supportedOptics.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label style={{ fontSize: '11px', color: '#ccc' }}>Qty:</label>
                <input type="number" min={1} value={qtyStr} onChange={e => setQtyStr(e.target.value)} style={{ width: '40px', fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }} />
                <button onClick={handleAddOptic} style={{ flex: 1, padding: '4px 8px', background: 'rgba(255, 152, 0, 0.2)', border: '1px solid rgba(255, 152, 0, 0.4)', borderRadius: '3px', color: '#ffb74d', fontSize: '11px', cursor: 'pointer' }}>Add Optic</button>
              </div>
              {errorMsg && <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(239, 83, 80, 0.1)', border: '1px solid rgba(239, 83, 80, 0.3)', borderRadius: '4px', color: '#ef5350', fontSize: '11px', whiteSpace: 'pre-wrap' }}>⚠️ {errorMsg}</div>}
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
                      <button onClick={() => handleRemoveOptic(i)} style={{ background: 'none', border: 'none', color: '#ef5350', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }} title="Remove Optic">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(() => {
              const toolsReached = new Set<string>();
              const visited = new Set<string>();
              const queue = [node.id];
              visited.add(node.id);
              while (queue.length > 0) {
                const currentId = queue.shift()!;
                const outbound = edges.filter(e => e.source === currentId);
                outbound.forEach(e => {
                  if (!visited.has(e.target)) {
                    visited.add(e.target);
                    const targetNode = nodes.find(n => n.id === e.target);
                    if (targetNode) {
                      if (targetNode.type === 'toolNode') toolsReached.add(targetNode.id);
                      else if (targetNode.type !== 'hardwareNode') queue.push(e.target);
                    }
                  }
                });
              }
              const numToolLinks = toolsReached.size;
              const requiredTapOptics = tappedLinks * 2;
              const totalRequiredOptics = requiredTapOptics + numToolLinks;

              if (totalOptics < requiredTapOptics) {
                return <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(255, 152, 0, 0.1)', border: '1px solid rgba(255, 152, 0, 0.3)', borderRadius: '4px', color: '#ffb74d', fontSize: '11px' }}><strong>⚠️ Attention:</strong> You have <strong>{tappedLinks}</strong> connected TAP link(s). Every tapped link produces two outputs. Therefore, a minimum of <strong>{requiredTapOptics}</strong> optics must be installed.</div>;
              } else if (numToolLinks > 0 && totalOptics < totalRequiredOptics) {
                const diff = totalRequiredOptics - totalOptics;
                return <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(0, 150, 136, 0.1)', border: '1px solid rgba(0, 150, 136, 0.3)', borderRadius: '4px', color: '#80cbc4', fontSize: '11px' }}><strong>💡 Suggestion:</strong> You have <strong>{numToolLinks}</strong> tool output(s). You need to install at least <strong>{diff}</strong> more optic(s) to support the tools.</div>;
              }
              return null;
            })()}
          </div>
        )}
      </div>

      {/* ── GIGASMART APPS TAB ── */}
      <div style={{ display: activeTab === 'apps' ? 'block' : 'none' }}>
        {node.data.gigaSmartApps && Array.isArray(node.data.gigaSmartApps) && node.data.gigaSmartApps.length > 0 ? (
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#ffb74d' }}>GigaSMART Applications</h4>
            {node.data.gigaSmartApps.map((app: any, idx: number) => (
              <div key={app.id || idx} style={{ background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '10px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>{app.label || app.actionType}</span>
                </div>
                
                {(app.actionType === 'Deduplication' || app.actionType === 'Dedup') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: '#ccc' }}>Estimated Deduplication Rate (%)</label>
                    <input type="range" min={0} max={100} value={app.dedupRate ?? 20} onChange={e => {
                        const newApps = [...(node.data.gigaSmartApps as any[])];
                        newApps[idx] = { ...newApps[idx], dedupRate: Number(e.target.value) };
                        updateNodeData(node.id, { gigaSmartApps: newApps });
                      }} style={{ width: '100%' }} />
                    <div style={{ fontSize: '11px', color: '#00e5ff', textAlign: 'right' }}>{app.dedupRate ?? 20}% Duplicate Drops</div>
                  </div>
                )}
                
                {(app.actionType === 'Application Metadata' || app.actionType === 'AMX' || app.actionType === 'AMI') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: '#ccc' }}>Metadata Output Format</label>
                    <select value={app.metadataFormat || 'CEF'} onChange={e => {
                        const newApps = [...(node.data.gigaSmartApps as any[])];
                        newApps[idx] = { ...newApps[idx], metadataFormat: e.target.value };
                        updateNodeData(node.id, { gigaSmartApps: newApps });
                      }} style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}>
                      <option value="CEF">CEF (Common Event Format)</option>
                      <option value="JSON">JSON</option>
                    </select>
                  </div>
                )}
                
                {app.actionType !== 'Deduplication' && app.actionType !== 'Dedup' && app.actionType !== 'Application Metadata' && app.actionType !== 'AMX' && app.actionType !== 'AMI' && (
                  <div style={{ fontSize: '11px', color: '#aaa' }}>
                    No additional configuration required for {app.actionType}.
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: '#aaa', padding: '16px 0', textAlign: 'center' }}>
            No GigaSMART applications dropped on this hardware.
          </div>
        )}
      </div>
    </>
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

  const projectLicenseMode = useStore((state) => state.projectLicenseMode);
  const setProjectLicenseMode = useStore((state) => state.setProjectLicenseMode);
  const defaultTermDuration = useStore((state) => state.defaultTermDuration);
  const setDefaultTermDuration = useStore((state) => state.setDefaultTermDuration);
  const disableDcWarnings = useStore((state) => state.disableDcWarnings);
  const setDisableDcWarnings = useStore((state) => state.setDisableDcWarnings);

  // Aggregate ingest (from inputNodes or TAP hardware nodes)
  let totalIngest = 0;
  let totalDedupDrops = 0;
  let totalFilterDrops = 0;
  
  nodes.forEach((n) => {
    const metric = nodeMetrics[n.id];
    if (!metric) return;
    
    totalDedupDrops += metric.dedupDroppedBps || 0;
    totalFilterDrops += metric.filterDroppedBps || 0;
    
    if (
      n.type === NODE_TYPES.INPUT ||
      (n.type === NODE_TYPES.HARDWARE && typeof n.data?.model === 'string' && n.data.model.includes('TAP'))
    ) {
      totalIngest += metric.txBps;
    }
  });

  const totalEgress = uniqueEgressBps;

  const reductionRaw     = Math.max(0, totalIngest - totalEgress);
  const reductionPercent = totalIngest > 0 ? (reductionRaw / totalIngest) * 100 : 0;

  // Handle Term Duration blur for validation
  const handleTermBlur = () => {
    let parsed = parseInt(defaultTermDuration, 10);
    if (isNaN(parsed) || parsed < 1) parsed = 1;
    if (parsed > 120) parsed = 120;
    setDefaultTermDuration(parsed.toString());
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '320px', height: '100%', padding: '20px', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div>
        <h2 style={{ fontSize: '13px', margin: 0, paddingBottom: '8px' }}>Global Pipeline Dashboard</h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
          Real-time visibility into the entire network visibility fabric.
        </p>
      </div>

      <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Project Settings
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormGroup label="Default License Mode">
            <select
              value={projectLicenseMode}
              onChange={(e) => setProjectLicenseMode(e.target.value as 'HTL' | 'Perpetual')}
            >
              <option value="HTL">Hybrid Term Licensing (HTL)</option>
              <option value="Perpetual">Perpetual</option>
            </select>
          </FormGroup>
          <FormGroup label="Default Term Duration (Months)">
            <input 
              type="number" 
              min="1" 
              max="120" 
              value={defaultTermDuration} 
              onChange={(e) => setDefaultTermDuration(e.target.value)} 
              onBlur={handleTermBlur}
            />
          </FormGroup>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="checkbox" 
              checked={disableDcWarnings} 
              onChange={(e) => setDisableDcWarnings(e.target.checked)} 
              id="disableDcWarnings"
            />
            <label htmlFor="disableDcWarnings" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Disable DC Power Warnings
            </label>
          </div>
        </div>
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
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div>Deduped: {formatBandwidth(totalDedupDrops)} ({formatPackets(totalDedupDrops * 250)})</div>
              <div>Filtered: {formatBandwidth(totalFilterDrops)} ({formatPackets(totalFilterDrops * 250)})</div>
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

      {/* Port speed (affects traffic capacity label and linkSpeed) */}
      {(configType === CONFIG_TYPES.SPAN || configType === CONFIG_TYPES.TAP || configType === CONFIG_TYPES.ERSPAN || configType === CONFIG_TYPES.EAST_WEST || configType === CONFIG_TYPES.VMWARE) && (
        <FormGroup label="Port Speed">
          <select
            value={(node.data?.portSpeed as string) || '10G'}
            onChange={(e) => onGenericChange('portSpeed', e.target.value)}
          >
            <option value="1G">1 Gbps</option>
            <option value="10G">10 Gbps</option>
            <option value="25G">25 Gbps</option>
            <option value="40G">40 Gbps</option>
            <option value="100G">100 Gbps</option>
            <option value="400G">400 Gbps</option>
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
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);

  // Trace upstream from this GigaSMART node to find a GigaVUE-HC chassis
  let hasConnectedHc = false;
  const visited = new Set<string>();
  const queue = [node.id];
  visited.add(node.id);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const incoming = edges.filter(e => e.target === currentId);
    incoming.forEach(e => {
      if (!visited.has(e.source)) {
        visited.add(e.source);
        const sourceNode = nodes.find(n => n.id === e.source);
        if (sourceNode) {
          if (sourceNode.type === 'hardwareNode' && String(sourceNode.data?.model || '').includes('HC')) {
            hasConnectedHc = true;
          } else if (sourceNode.type !== 'hardwareNode') {
            queue.push(e.source);
          }
        }
      }
    });
    if (hasConnectedHc) break;
  }

  return (
    <>
      {!hasConnectedHc && (
        <div style={{ marginBottom: '12px', padding: '8px', background: 'rgba(239, 83, 80, 0.1)', border: '1px solid rgba(239, 83, 80, 0.3)', borderRadius: '4px', color: '#ef5350', fontSize: '11px', whiteSpace: 'pre-wrap' }}>
          ⚠️ GigaSMART functions are only supported on GigaVUE-HC series nodes. Please connect this GigaSMART node downstream of an HC chassis.
        </div>
      )}
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

    // Sync portSpeed (string) to linkSpeed (numeric Mbps)
    if (key === 'portSpeed') {
      let speedMbps = 10000; // default 10G
      if (val === '1G') speedMbps = 1000;
      else if (val === '10G') speedMbps = 10000;
      else if (val === '25G') speedMbps = 25000;
      else if (val === '40G') speedMbps = 40000;
      else if (val === '100G') speedMbps = 100000;
      else if (val === '400G') speedMbps = 400000;
      updates.linkSpeed = speedMbps;
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
            <div className="config-card">
              <h3>📥 Port Configuration</h3>
              <InputNodePanel node={selectedNode} onGenericChange={handleGenericChange} />
            </div>
          )}
          {selectedNode.type === NODE_TYPES.FILTER && (
            <div className="config-card">
              <h3>🛡️ Tunnel Filter Configuration</h3>
              <FilterNodePanel node={selectedNode} onGenericChange={handleGenericChange} />
            </div>
          )}
          {selectedNode.type === NODE_TYPES.GIGASTREAM && (
            <div className="config-card">
              <h3>⚖️ Load Balancing</h3>
              <FormGroup label="Load Balancing Algorithm">
                <select
                  value={(selectedNode.data?.algorithm as string) || 'Round Robin'}
                  onChange={(e) => handleGenericChange('algorithm', e.target.value)}
                >
                  <option value="Round Robin">Round Robin (Even Split)</option>
                  <option value="L4 Hash">L4 Hash (Five-Tuple hash)</option>
                </select>
              </FormGroup>
            </div>
          )}
          {selectedNode.type === NODE_TYPES.GIGASMART && (
            <div className="config-card">
              <h3>⚡ GigaSMART Configuration</h3>
              <GigaSmartPanel node={selectedNode} onGenericChange={handleGenericChange} />
            </div>
          )}
          {selectedNode.type === NODE_TYPES.TOOL && (
            <div className="config-card">
              <h3>📊 Tool Endpoint Configuration</h3>
              <ToolNodePanel
                node={selectedNode}
                onGenericChange={handleGenericChange}
                isRunning={isRunning}
                metrics={selectedNodeMetric}
              />
            </div>
          )}
          {configType === CONFIG_TYPES.TRAFFIC_MAP && (
            <div className="config-card">
              <h3>🗺️ Traffic Map Configuration</h3>
              <MapNodePanel
                node={selectedNode}
                onConditionChange={handleConditionChange}
                onAddCondition={handleAddCondition}
                onRemoveCondition={handleRemoveCondition}
              />
            </div>
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