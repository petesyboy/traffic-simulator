import React from 'react';
import type { CustomNode } from '../../../store/store';
import type { BaseNodeData, HardwareNodeData, GigaSmartNodeData } from '../../../store/types';

interface GigaSmartAppsPanelProps {
  selectedNode: CustomNode;
  updateNodeData: (nodeId: string, data: Partial<BaseNodeData>) => void;
}

export const GigaSmartAppsPanel: React.FC<GigaSmartAppsPanelProps> = ({ selectedNode, updateNodeData }) => {
  const hwData = selectedNode.data as HardwareNodeData;
  const gigaSmartApps: GigaSmartNodeData[] = hwData.gigaSmartApps || [];

  if (gigaSmartApps.length === 0) {
    return (
      <div style={{ fontSize: '12px', color: '#aaa', padding: '16px 0', textAlign: 'center' }}>
        No GigaSMART applications dropped on this hardware.
      </div>
    );
  }

  // Engine Load Calculation
  const getEngineLoad = (actionType: string) => {
    if (actionType.includes('Decapsulation')) return 40;
    if (actionType.includes('Slicing')) return 20;
    if (actionType.includes('Masking')) return 30;
    if (actionType.includes('Dedup')) return 50;
    if (actionType.includes('NetFlow')) return 60;
    if (actionType.includes('Metadata') || actionType.includes('AMI')) return 80;
    return 30;
  };

  const totalLoad = gigaSmartApps.reduce((acc, app) => acc + getEngineLoad(app.actionType as string || ''), 0);
  const maxSinglePassLoad = 100;
  const isMultiPass = totalLoad > maxSinglePassLoad;

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, fontSize: '13px', color: '#ffb74d' }}>GigaSMART Pipeline</h4>
      </div>

      {/* Engine Load Bar */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '6px' }}>
          Engine Load: {totalLoad} / {maxSinglePassLoad}
        </div>
        <div style={{ width: '100%', background: '#222', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, (totalLoad / maxSinglePassLoad) * 100)}%`, background: isMultiPass ? '#f44336' : '#4caf50', height: '100%' }} />
        </div>
        {isMultiPass && (
          <div style={{ marginTop: '6px', padding: '6px', background: '#300', border: '1px solid #600', borderRadius: '4px', fontSize: '10px', color: '#f88', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
            <span>⚠️</span>
            <span><strong>Hardware limit exceeded.</strong> Engaging multi-pass loopback. Effective throughput will be halved.</span>
          </div>
        )}
      </div>

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

            {/* Default — no additional config */}
            {actionType !== 'Deduplication' && actionType !== 'Dedup' && actionType !== 'Application Metadata' && actionType !== 'AMX' && actionType !== 'AMI' && actionType !== 'Packet Slicing' && (
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
