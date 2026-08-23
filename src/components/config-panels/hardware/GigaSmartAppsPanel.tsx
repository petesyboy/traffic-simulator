import React from 'react';
import type { CustomNode } from '../../../store/store';
import type { BaseNodeData, HardwareNodeData, GigaSmartNodeData } from '../../../store/types';
import { areActionsCompatible, getAvailableEngines } from '../../../constants/gigaSmartRules';

interface GigaSmartAppsPanelProps {
  selectedNode: CustomNode;
  updateNodeData: (nodeId: string, data: Partial<BaseNodeData>) => void;
}

export const GigaSmartAppsPanel: React.FC<GigaSmartAppsPanelProps> = ({ selectedNode, updateNodeData }) => {
  const hwData = selectedNode.data as HardwareNodeData;
  const gigaSmartApps: GigaSmartNodeData[] = hwData.gigaSmartApps || [];
  // The 5G mobile protocol decoding add-on (SMT-GSA110-AMI-5G-100G-*) is only
  // a real SKU on the GigaSMART Appliance - not on an HC's onboard AMI.
  const isGsa = selectedNode.type === 'toolNode' && selectedNode.data?.toolName === 'GigaSMART Appliance';

  if (gigaSmartApps.length === 0) {
    return (
      <div style={{ fontSize: '12px', color: '#aaa', padding: '16px 0', textAlign: 'center' }}>
        No GigaSMART applications dropped on this hardware.
      </div>
    );
  }

  const handleUpdateApp = (idx: number, patch: Partial<GigaSmartNodeData>) => {
    const newApps = [...gigaSmartApps];
    newApps[idx] = { ...newApps[idx], ...patch } as GigaSmartNodeData;
    updateNodeData(selectedNode.id, { gigaSmartApps: newApps });
  };

  const handleMoveApp = (idx: number, direction: 'up' | 'down') => {
    const newApps = [...gigaSmartApps];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newApps.length) return;
    [newApps[swapIdx], newApps[idx]] = [newApps[idx], newApps[swapIdx]];
    updateNodeData(selectedNode.id, { gigaSmartApps: newApps });
  };

  const handleRemoveApp = (idx: number) => {
    const newApps = [...gigaSmartApps];
    newApps.splice(idx, 1);
    updateNodeData(selectedNode.id, { gigaSmartApps: newApps });
  };

  const model = String(hwData.model || '').trim();
  const installedBoards = Object.values(hwData.installedBoards || {});
  const engines = getAvailableEngines(model, installedBoards);
  const engineCount = engines.length;

  let incompatibilityPrompt: string | null = null;
  if (gigaSmartApps.length >= 2 && engineCount < 2) {
    for (let i = 0; i < gigaSmartApps.length; i++) {
      for (let j = i + 1; j < gigaSmartApps.length; j++) {
        const actionA = (gigaSmartApps[i] as Record<string, unknown>).actionType as string || '';
        const actionB = (gigaSmartApps[j] as Record<string, unknown>).actionType as string || '';
        const comp = areActionsCompatible(actionA, actionB, engineCount, model, installedBoards);
        if (!comp.compatible) {
          incompatibilityPrompt = comp.reason || null;
          break;
        }
      }
      if (incompatibilityPrompt) break;
    }
  }

  return (
    <div className="panel-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 className="text-base font-semibold m-0">🧠 GigaSMART Pipeline</h3>
      </div>

      {incompatibilityPrompt && (
        <div style={{ marginBottom: '12px', padding: '8px 10px', background: 'rgba(255, 171, 0, 0.1)', border: '1px solid rgba(255, 171, 0, 0.35)', borderRadius: '4px', color: '#ffb300', fontSize: '11px', lineHeight: '1.4' }}>
          ⚠️ <strong>Single-Operation Combination:</strong> {incompatibilityPrompt}
        </div>
      )}

      {/* App Cards */}
      {gigaSmartApps.map((app, idx) => {
        const actionType = (app as Record<string, unknown>).actionType as string || '';
        return (
          <div key={(app as Record<string, unknown>).id as string || idx} style={{ background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '10px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ background: '#333', color: '#aaa', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                  {idx + 1}
                </div>
                <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>{(app as Record<string, unknown>).label as string || actionType}</span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => handleMoveApp(idx, 'up')}
                  disabled={idx === 0}
                  style={{ background: '#222', color: idx === 0 ? '#444' : '#ccc', border: '1px solid #444', borderRadius: '3px', cursor: idx === 0 ? 'not-allowed' : 'pointer', padding: '2px 6px', fontSize: '10px' }}
                  title="Move Up"
                >▲</button>
                <button
                  onClick={() => handleMoveApp(idx, 'down')}
                  disabled={idx === gigaSmartApps.length - 1}
                  style={{ background: '#222', color: idx === gigaSmartApps.length - 1 ? '#444' : '#ccc', border: '1px solid #444', borderRadius: '3px', cursor: idx === gigaSmartApps.length - 1 ? 'not-allowed' : 'pointer', padding: '2px 6px', fontSize: '10px' }}
                  title="Move Down"
                >▼</button>
                <button
                  onClick={() => handleRemoveApp(idx)}
                  style={{ background: '#300', color: '#f55', border: '1px solid #500', borderRadius: '3px', cursor: 'pointer', padding: '2px 6px', fontSize: '10px', marginLeft: '4px' }}
                  title="Remove Pipeline Stage"
                >✕</button>
              </div>
            </div>

            {/* Deduplication config */}
            {(actionType === 'Deduplication' || actionType === 'Dedup') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '11px', color: '#ccc' }}>Estimated Deduplication Rate (%)</label>
                <input type="range" min={0} max={100} value={(app as Record<string, unknown>).dedupRate as number ?? 20} onChange={e => handleUpdateApp(idx, { dedupRate: Number(e.target.value) })} style={{ width: '100%' }} />
                <div style={{ fontSize: '11px', color: '#00e5ff', textAlign: 'right' }}>{(app as Record<string, unknown>).dedupRate as number ?? 20}% Duplicate Drops</div>

                <label style={{ fontSize: '11px', color: '#ccc', marginTop: '4px' }}>Drift Profile</label>
                <select
                  value={(app as Record<string, unknown>).dedupDriftProfile as string || 'volatile'}
                  onChange={e => handleUpdateApp(idx, { dedupDriftProfile: e.target.value })}
                  style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}
                >
                  <option value="volatile">Volatile (Swings +/-5%)</option>
                  <option value="stable">Stable (Swings +/-2%)</option>
                  <option value="static">Static (No Drift)</option>
                </select>
              </div>
            )}

            {/* AMI/AMX Metadata config */}
            {(actionType === 'Application Metadata' || actionType === 'AMX' || actionType === 'AMI') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: '#ccc' }}>Metadata Output Format</label>
                <select value={app.metadataFormat || 'CEF'} onChange={e => handleUpdateApp(idx, { metadataFormat: e.target.value as 'CEF' | 'JSON' })} style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}>
                  <option value="CEF">CEF (Common Event Format)</option>
                  <option value="JSON">JSON</option>
                </select>

                <label style={{ fontSize: '11px', color: '#ccc', marginTop: '4px' }}>Metadata Generation Rate (%)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="range"
                    min={1}
                    max={6}
                    step={0.5}
                    value={(app as Record<string, unknown>).metadataRate !== undefined ? (app as Record<string, unknown>).metadataRate as number : (actionType === 'Application Metadata' ? 3 : 1.5)}
                    onChange={e => handleUpdateApp(idx, { metadataRate: Number(e.target.value) })}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', minWidth: '35px', textAlign: 'right', color: '#00e5ff', fontWeight: 'bold' }}>
                    {(app as Record<string, unknown>).metadataRate !== undefined ? (app as Record<string, unknown>).metadataRate as number : (actionType === 'Application Metadata' ? 3 : 1.5)}%
                  </span>
                </div>

                {isGsa && actionType === 'AMI' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#ccc', marginTop: '4px' }}>
                    <input
                      type="checkbox"
                      checked={!!app.gsa5gDecode}
                      onChange={e => handleUpdateApp(idx, { gsa5gDecode: e.target.checked })}
                    />
                    5G Mobile Protocol Decoding add-on
                  </label>
                )}
              </div>
            )}

            {/* Packet Slicing config */}
            {actionType === 'Packet Slicing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '11px', color: '#ccc' }}>Packet Slice Size (Bytes)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="range"
                    min={64}
                    max={1518}
                    value={(app as Record<string, unknown>).sliceSize as number ?? 128}
                    onChange={e => handleUpdateApp(idx, { sliceSize: Number(e.target.value) })}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#00e5ff', minWidth: '40px', textAlign: 'right', fontWeight: 'bold' }}>
                    {(app as Record<string, unknown>).sliceSize as number ?? 128}B
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#80cbc4', lineHeight: '1.3' }}>
                  Retains headers, truncating payload. Downstream bandwidth reduced by: <strong style={{ color: '#00e5ff' }}>{Math.round((1 - (((app as Record<string, unknown>).sliceSize as number ?? 128) / 1518)) * 100)}%</strong>
                </div>
              </div>
            )}

            {/* AFI / AppViz — currently modeled as a pass-through */}
            {(actionType === 'Application Filtering Intelligence' || actionType === 'Application Visualization') && (
              <div style={{ fontSize: '11px', color: '#aaa' }}>
                {actionType}: pass-through in this simulation (filtering/visualization behavior not yet modeled).
              </div>
            )}

            {/* Header Stripping config */}
            {(actionType === 'Header Stripping' || actionType === 'Header/Trailer Remove') && (() => {
              const protocol = (app.headerStripProtocol as string) || 'VXLAN';
              const protocolSavings: Record<string, number> = { VXLAN: 5, MPLS: 1.5, VLAN: 0.8, ERSPAN: 4.5, 'GTP-U': 4, Custom: 6 };
              const savings = protocolSavings[protocol] ?? 5;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '11px', color: '#ccc' }}>Encapsulation Header to Strip</label>
                  <select
                    value={protocol}
                    onChange={e => handleUpdateApp(idx, { headerStripProtocol: e.target.value as 'VXLAN' | 'MPLS' | 'VLAN' | 'ERSPAN' | 'GTP-U' | 'Custom' })}
                    style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}
                  >
                    <option value="VXLAN">VXLAN (50B Tunnel &amp; Ethernet)</option>
                    <option value="MPLS">MPLS (Label Stack)</option>
                    <option value="VLAN">VLAN / QinQ (802.1Q Tags)</option>
                    <option value="ERSPAN">ERSPAN / GRE (42B Tunnel)</option>
                    <option value="GTP-U">GTP-U (40B Mobile Tunnel)</option>
                    <option value="Custom">Custom Header Stripping</option>
                  </select>
                  <div style={{ padding: '6px', background: 'rgba(0, 229, 255, 0.05)', border: '1px solid rgba(0, 229, 255, 0.2)', borderRadius: '4px', fontSize: '10px', color: '#80cbc4' }}>
                    📦 Strips outer <strong>[{protocol}]</strong> header (~{savings}% bandwidth offload). Recalculates L3/L4 checksums for downstream tools.
                  </div>
                </div>
              );
            })()}

            {/* GTP Flow Filtering config */}
            {actionType === 'GTP Flow Filtering' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '11px', color: '#ccc' }}>Subscriber IMSI / APN Filter</label>
                <input
                  type="text"
                  placeholder="e.g. 310410*, IMS, Corporate"
                  value={app.gtpImsiFilter || ''}
                  onChange={e => handleUpdateApp(idx, { gtpImsiFilter: e.target.value })}
                  style={{ fontSize: '11px', padding: '4px 6px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}
                />
                <div style={{ padding: '6px', background: 'rgba(0, 145, 234, 0.08)', border: '1px solid rgba(0, 145, 234, 0.25)', borderRadius: '4px', fontSize: '10px', color: '#00e5ff' }}>
                  📶 Correlates GTP-C (signalling) with GTP-U (user tunnels). Pins sessions statefully across tool ports.
                </div>
              </div>
            )}

            {/* GTP Flow Sampling config — the sample rate decides the BOM's licensing:
                per Gigamon's KB, 0% or 100% needs GTPMAX alone, anything in between
                also needs a FlowVUE entitlement on the same card. */}
            {actionType === 'GTP Flow Sampling' && (() => {
              const pct = (app as Record<string, unknown>).gtpSamplePercent as number ?? 100;
              const needsFlowVue = pct > 0 && pct < 100;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '11px', color: '#ccc' }}>GTP Flow Sample Rate (%)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={pct}
                      onChange={e => handleUpdateApp(idx, { gtpSamplePercent: Number(e.target.value) })}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#00e5ff', minWidth: '35px', textAlign: 'right', fontWeight: 'bold' }}>
                      {pct}%
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#80cbc4', lineHeight: '1.3' }}>
                    {needsFlowVue
                      ? 'Licensing: GTPMAX + FlowVUE (any rate strictly between 0% and 100% needs both entitlements on this card).'
                      : 'Licensing: GTPMAX only (0% or 100% sampling doesn\'t need a separate FlowVUE entitlement).'}
                  </div>
                </div>
              );
            })()}

            {/* GTP Whitelisting */}
            {actionType === 'GTP Whitelisting' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: '#ccc' }}>VIP Subscriber IMSI Whitelist</label>
                <input
                  type="text"
                  placeholder="e.g. 310410*, VIP-Users"
                  value={app.gtpImsiFilter || ''}
                  onChange={e => handleUpdateApp(idx, { gtpImsiFilter: e.target.value })}
                  style={{ fontSize: '11px', padding: '4px 6px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}
                />
                <div style={{ fontSize: '10px', color: '#80cbc4', lineHeight: '1.3' }}>
                  Licensing: GTPMAX + FlowVUE (GTP whitelisting always needs both entitlements on this card).
                </div>
              </div>
            )}

            {/* Default — no additional config */}
            {actionType !== 'Deduplication' &&
              actionType !== 'Dedup' &&
              actionType !== 'Application Metadata' &&
              actionType !== 'AMX' &&
              actionType !== 'AMI' &&
              actionType !== 'Packet Slicing' &&
              actionType !== 'Header Stripping' &&
              actionType !== 'Header/Trailer Remove' &&
              actionType !== 'Application Filtering Intelligence' &&
              actionType !== 'Application Visualization' &&
              actionType !== 'GTP Flow Filtering' &&
              actionType !== 'GTP Flow Sampling' &&
              actionType !== 'GTP Whitelisting' && (
              <div style={{ fontSize: '11px', color: '#aaa' }}>
                No additional configuration required for {actionType}.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
