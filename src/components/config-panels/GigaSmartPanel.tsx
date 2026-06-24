import React from 'react';
import { useStore, type CustomNode } from '../../store/store';
import { ACTION_TYPES, isMetadataAction, isDedupAction } from '../../constants/nodeTypes';
import { FormGroup } from './LiveMetrics';

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

      {actionType === ACTION_TYPES.PACKET_SLICING && (
        <FormGroup label="Packet Slice Size (Bytes)">
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
    </>
  );
};
