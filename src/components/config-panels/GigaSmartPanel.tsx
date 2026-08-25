import React from 'react';
import { useStore, type CustomNode } from '../../store/store';
import { ACTION_TYPES, isMetadataAction, isDedupAction } from '../../constants/nodeTypes';
import { FormGroup } from './LiveMetrics';
import { MetadataEventViewer } from '../MetadataEventViewer';

interface GigaSmartPanelProps {
  node: CustomNode;
  onGenericChange: (key: string, val: string) => void;
}

export const GigaSmartPanel: React.FC<GigaSmartPanelProps> = ({ node, onGenericChange }) => {
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

  const advancedMode = useStore((state) => state.advancedMode);

  return (
    <>
      {advancedMode && !hasConnectedHc && (
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
          <option value={ACTION_TYPES.HEADER_STRIP}>Header Stripping (VXLAN/MPLS/VLAN/GTP-U)</option>
          <option value={ACTION_TYPES.IP_FLOWVUE}>IP FlowVUE (Subscriber Sampling)</option>
          <option value={ACTION_TYPES.GTP_FLOW_FILTERING}>GTP Flow Filtering &amp; Correlation</option>
          <option value={ACTION_TYPES.GTP_WHITELISTING}>GTP Whitelisting (VIP Subscribers)</option>
          <option value={ACTION_TYPES.GTP_FLOW_SAMPLING}>GTP Flow Sampling</option>
          <option value="Load Balancing (Stateless)">Load Balancing (Stateless)</option>
          <option value="Load Balancing (Stateful)">Load Balancing (Stateful)</option>
          <option value={ACTION_TYPES.MASKING}>Masking</option>
          <option value={ACTION_TYPES.AMX}>AMX</option>
          <option value={ACTION_TYPES.AMI}>AMI</option>
          <option value={ACTION_TYPES.PCAPNG}>Pcapng</option>
          <option value={ACTION_TYPES.SBI_5G}>5G-SBI</option>
          <option value={ACTION_TYPES.PACKET_SLICING}>Packet Slicing (Fixed Truncation)</option>
          <option value={ACTION_TYPES.ADVANCED_FLOW_SLICING}>Advanced Flow Slicing (Dynamic Flow Slicing)</option>
          <option value={ACTION_TYPES.SSL_DECRYPT}>SSL Decrypt</option>
        </select>
      </FormGroup>

      {/* ─── Header Stripping Configuration & Visualiser ─── */}
      {(actionType === ACTION_TYPES.HEADER_STRIP || actionType === ACTION_TYPES.HEADER_TRAILER_REMOVE) && (() => {
        const protocol = (node.data?.headerStripProtocol as string) || 'VXLAN';
        const protocolOverheads: Record<string, { bytes: number; percent: number; desc: string }> = {
          VXLAN: { bytes: 50, percent: 5, desc: 'Outer IP (20B) + UDP (8B) + VXLAN (8B) + Inner Eth (14B)' },
          MPLS: { bytes: 8, percent: 1.5, desc: 'MPLS Label Stack (2 labels × 4B)' },
          VLAN: { bytes: 4, percent: 0.8, desc: '802.1Q / QinQ VLAN tag' },
          ERSPAN: { bytes: 42, percent: 4.5, desc: 'Outer IP (20B) + GRE (8B) + ERSPAN Type II/III (14B)' },
          'GTP-U': { bytes: 40, percent: 4, desc: 'Outer IP (20B) + UDP (8B) + GTP-U Header (12B)' },
          Custom: { bytes: 60, percent: 6, desc: 'User-specified header de-encapsulation' },
        };
        const activeInfo = protocolOverheads[protocol] || protocolOverheads.VXLAN;

        return (
          <>
            <FormGroup label="Encapsulation Header to Strip">
              <select
                value={protocol}
                onChange={(e) => onGenericChange('headerStripProtocol', e.target.value)}
              >
                <option value="VXLAN">VXLAN (Cloud &amp; Data Centre Overlay)</option>
                <option value="MPLS">MPLS (Label Stack)</option>
                <option value="VLAN">VLAN / QinQ (802.1Q / 802.1ad Tags)</option>
                <option value="ERSPAN">ERSPAN / GRE (Remote SPAN Tunnel)</option>
                <option value="GTP-U">GTP-U (Mobile Carrier User Plane Tunnel)</option>
                <option value="Custom">Custom Header Stripping</option>
              </select>
            </FormGroup>

            {/* Visual Packet Anatomy Diagram */}
            <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#00e5ff', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>📦 Packet Anatomy Transformation</span>
                <span style={{ color: '#81c784' }}>~{activeInfo.percent}% Offload</span>
              </div>

              {/* Before Stripping */}
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '3px' }}>Ingress (Encapsulated):</div>
              <div style={{ display: 'flex', gap: '2px', height: '22px', fontSize: '9px', marginBottom: '10px', textAlign: 'center', lineHeight: '22px' }}>
                <div style={{ flex: 1.5, background: 'rgba(239, 83, 80, 0.25)', border: '1px dashed #ef5350', color: '#ef9a9a', borderRadius: '3px 0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  [{protocol}]
                </div>
                <div style={{ flex: 1.5, background: '#1e3a5f', border: '1px solid #007cff', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Inner IP
                </div>
                <div style={{ flex: 1.2, background: '#1e3a5f', border: '1px solid #007cff', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  L4
                </div>
                <div style={{ flex: 3.5, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', borderRadius: '0 3px 3px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Payload
                </div>
              </div>

              {/* After Stripping */}
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '3px' }}>Egress to Tools (Normalised):</div>
              <div style={{ display: 'flex', gap: '2px', height: '22px', fontSize: '9px', textAlign: 'center', lineHeight: '22px' }}>
                <div style={{ flex: 1.5, background: '#1e3a5f', border: '1px solid #25b34b', color: '#a5d6a7', borderRadius: '3px 0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Standard IP
                </div>
                <div style={{ flex: 1.2, background: '#1e3a5f', border: '1px solid #25b34b', color: '#a5d6a7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  TCP/UDP
                </div>
                <div style={{ flex: 4.5, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', borderRadius: '0 3px 3px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Original Payload
                </div>
              </div>

              <div style={{ fontSize: '10px', color: '#80cbc4', marginTop: '10px', lineHeight: '1.4' }}>
                💡 <strong>Tool Offload:</strong> Removes {activeInfo.bytes}B of overhead per packet ({activeInfo.desc}) and recalculates L3/L4 checksums. Downstream tools receive clean frames without decapsulation overhead.
              </div>
            </div>
          </>
        );
      })()}

      {/* ─── GTP Call Correlation & Flow Intelligence ─── */}
      {(actionType === ACTION_TYPES.GTP_FLOW_FILTERING ||
        actionType === ACTION_TYPES.GTP_WHITELISTING ||
        actionType === ACTION_TYPES.GTP_FLOW_SAMPLING ||
        actionType === ACTION_TYPES.IP_FLOWVUE) && (() => {
        const samplePct = (node.data?.gtpSamplePercent as number) ?? (actionType === ACTION_TYPES.GTP_FLOW_SAMPLING ? 10 : 100);
        const isWhitelisting = actionType === ACTION_TYPES.GTP_WHITELISTING;
        const isSampling = actionType === ACTION_TYPES.GTP_FLOW_SAMPLING || actionType === ACTION_TYPES.IP_FLOWVUE;
        const needsFlowVue = isSampling && samplePct > 0 && samplePct < 100;

        return (
          <>
            {/* Correlation State Visualiser */}
            <div style={{ padding: '12px', background: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-default)', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#00e5ff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📶 GTP Correlation Architecture</span>
                <span style={{ fontSize: '9.5px', color: '#81c784', background: 'rgba(76,175,80,0.15)', padding: '2px 6px', borderRadius: '3px' }}>Stateful</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: 'rgba(0,145,234,0.1)', borderRadius: '4px', border: '1px solid rgba(0,145,234,0.25)' }}>
                  <span style={{ fontWeight: 'bold', color: '#00e5ff', minWidth: '70px' }}>Control (GTP-C):</span>
                  <span style={{ color: '#ccc' }}>IMSI / IMEI / MSISDN ➔ TEID Table Mapping</span>
                </div>
                <div style={{ textAlign: 'center', color: '#00e5ff', fontSize: '11px', lineHeight: '1' }}>⮁ Correlated in Real-Time ⮁</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: 'rgba(0,200,83,0.1)', borderRadius: '4px', border: '1px solid rgba(0,200,83,0.25)' }}>
                  <span style={{ fontWeight: 'bold', color: '#81c784', minWidth: '70px' }}>User (GTP-U):</span>
                  <span style={{ color: '#ccc' }}>Data Tunnels with TEID ➔ Subscriber Session Pinned</span>
                </div>
              </div>
            </div>

            {/* Whitelisting Filter Config */}
            {isWhitelisting && (
              <FormGroup label="Target Subscriber IMSI Filter">
                <input
                  type="text"
                  placeholder="e.g. 310410*, 23415*, VIP-Subscribers"
                  value={(node.data?.gtpImsiFilter as string) || ''}
                  onChange={(e) => onGenericChange('gtpImsiFilter', e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', background: '#1c1c1c', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '11px' }}
                />
                <div style={{ fontSize: '10px', color: '#80cbc4', marginTop: '4px', lineHeight: '1.3' }}>
                  Forwards 100% of packets for whitelisted subscribers; discards background carrier traffic.
                </div>
              </FormGroup>
            )}

            {/* Flow Sampling Slider */}
            {isSampling && (
              <FormGroup label="Subscriber Sampling Rate (%)">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={samplePct}
                    onChange={(e) => onGenericChange('gtpSamplePercent', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', minWidth: '40px', textAlign: 'right', color: '#00e5ff', fontWeight: 'bold' }}>
                    {samplePct}%
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#80cbc4', marginTop: '4px', lineHeight: '1.3' }}>
                  Samples <strong style={{ color: '#00e5ff' }}>{samplePct}% of subscribers</strong> with 100% of their individual packets preserved (stateful session sampling).
                </div>
              </FormGroup>
            )}

            {/* Licensing & KB rules notification */}
            <div style={{ padding: '8px 10px', background: 'rgba(255,213,79,0.08)', borderRadius: '4px', border: '1px solid rgba(255,213,79,0.25)', fontSize: '10px', color: '#ffd54f', marginTop: '10px', lineHeight: '1.35' }}>
              <strong>Licensing Entitlement:</strong>{' '}
              {isWhitelisting
                ? 'GTPMAX + FlowVUE (GTP Whitelisting requires both licenses on this GigaSMART card).'
                : needsFlowVue
                ? 'GTPMAX + FlowVUE (Sampling rate between 1% and 99% requires both entitlements).'
                : 'GTPMAX (Standard full inspection).'
              }
            </div>
          </>
        );
      })()}

      {(actionType === 'Load Balancing (Stateless)' || actionType === 'Load Balancing (Stateful)') && (
        <FormGroup label="Load Balancing Method">
          <select
            value={(node.data?.algorithm as string) || 'Round Robin'}
            onChange={(e) => onGenericChange('algorithm', e.target.value)}
          >
            <option value="Round Robin">Round Robin (Split Traffic)</option>
            <option value="L4 Hash">L4 Hash (IP/Port Flow Preserve)</option>
          </select>
        </FormGroup>
      )}

      {isMetadataAction(actionType) && (
        <>
          <FormGroup label="Output Metadata Format">
            <select
              value={(node.data?.metadataFormat as string) || 'CEF'}
              onChange={(e) => onGenericChange('metadataFormat', e.target.value)}
            >
              <option value="CEF">CEF (Common Event Format)</option>
              <option value="JSON">JSON format</option>
            </select>
          </FormGroup>
          <FormGroup label="Metadata Generation Rate (%)">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="range"
                min={1}
                max={6}
                step={0.5}
                value={(node.data?.metadataRate as number) !== undefined ? (node.data?.metadataRate as number) : (actionType === ACTION_TYPES.APP_METADATA ? 3 : 1.5)}
                onChange={(e) => onGenericChange('metadataRate', e.target.value)}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: '11px', fontFamily: 'monospace', minWidth: '45px', textAlign: 'right', color: '#00e5ff', fontWeight: 'bold' }}>
                {((node.data?.metadataRate as number) !== undefined ? (node.data?.metadataRate as number) : (actionType === ACTION_TYPES.APP_METADATA ? 3 : 1.5))}%
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#80cbc4', marginTop: '4px', lineHeight: '1.3' }}>
              Specifies the metadata output traffic size as a percentage of input traffic (typically 1% to 6%).
            </div>
          </FormGroup>
          <MetadataEventViewer selectedNode={node} />
        </>
      )}

      {isDedupAction(actionType) && (
        <>
          <FormGroup label="Deduplication Rate">
            <div style={{ padding: '8px', background: 'rgba(0, 145, 234, 0.1)', borderRadius: '4px', border: '1px solid rgba(0, 145, 234, 0.2)', fontSize: '13px', fontWeight: 'bold', color: '#00e5ff' }}>
              {node.data?.dedupRate !== undefined
                ? `${Math.round(node.data.dedupRate as number)}%`
                : 'Initializing...'}
            </div>
          </FormGroup>
          <FormGroup label="Drift Profile">
            <select
              value={(node.data?.dedupDriftProfile as string) || 'volatile'}
              onChange={(e) => onGenericChange('dedupDriftProfile', e.target.value)}
            >
              <option value="volatile">Volatile (Swings +/-5%)</option>
              <option value="stable">Stable (Swings +/-2%)</option>
              <option value="static">Static (No Drift)</option>
            </select>
          </FormGroup>
        </>
      )}

      {(actionType === ACTION_TYPES.PACKET_SLICING || actionType === ACTION_TYPES.ADVANCED_FLOW_SLICING) && (
        <FormGroup label={actionType === ACTION_TYPES.ADVANCED_FLOW_SLICING ? 'Flow Slice Size (Bytes)' : 'Packet Slice Size (Bytes)'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="range"
              min={64}
              max={1518}
              value={(node.data?.sliceSize as number) || 128}
              onChange={(e) => onGenericChange('sliceSize', e.target.value)}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: '11px', fontFamily: 'monospace', minWidth: '45px', textAlign: 'right', color: '#00e5ff', fontWeight: 'bold' }}>
              {node.data?.sliceSize || 128}B
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#80cbc4', marginTop: '4px', lineHeight: '1.3' }}>
            Retains headers, truncating payload bytes. Downstream bandwidth reduced by: <strong style={{ color: '#00e5ff' }}>{Math.round((1 - ((node.data?.sliceSize as number || 128) / 1518)) * 100)}%</strong>
          </div>
        </FormGroup>
      )}

      {actionType === ACTION_TYPES.SSL_DECRYPT && (
        <FormGroup label="Decryption Rate (%)">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={(node.data?.decryptionRate as number) ?? 60}
              onChange={(e) => onGenericChange('decryptionRate', e.target.value)}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: '11px', fontFamily: 'monospace', minWidth: '45px', textAlign: 'right', color: '#00e5ff', fontWeight: 'bold' }}>
              {((node.data?.decryptionRate as number) ?? 60)}%
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#80cbc4', marginTop: '4px', lineHeight: '1.3' }}>
            The percentage of encrypted traffic to decrypt. The remainder will pass through still encrypted.
          </div>
        </FormGroup>
      )}
    </>
  );
};
