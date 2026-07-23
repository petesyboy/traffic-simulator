import React, { useState } from 'react';
import { useStore, type CustomNode, type NodeMetrics } from '../../store/store';
import { CONFIG_TYPES } from '../../constants/nodeTypes';
import { formatBytes } from '../../utils/format';
import { FormGroup } from './LiveMetrics';
import { MetadataEventViewer } from '../MetadataEventViewer';

interface ToolNodePanelProps {
  node: CustomNode;
  onGenericChange: (key: string, val: string) => void;
  isRunning: boolean;
  metrics?: NodeMetrics;
}

export const ToolNodePanel: React.FC<ToolNodePanelProps> = ({ 
  node, 
  onGenericChange, 
  isRunning, 
  metrics 
}) => {
  const configType = (node.data?.configType as string) || CONFIG_TYPES.PACKET_TOOL;
  const isMetadataTool = configType === CONFIG_TYPES.METADATA_TOOL;
  const isStorageTool = configType === CONFIG_TYPES.STORAGE_TOOL;
  const [showEstimates, setShowEstimates] = useState(false);
  const nodes = useStore((state) => state.nodes);
  const uniqueSites = Array.from(new Set(nodes.map(n => n.data?.site).filter(s => typeof s === 'string' && s.trim() !== ''))) as string[];

  return (
    <>
      <FormGroup label="Site Assignment (Optional)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {uniqueSites.length > 0 && (
            <select
              value={uniqueSites.includes(node.data?.site as string) ? (node.data?.site as string) : 'custom'}
              onChange={(e) => {
                if (e.target.value !== 'custom') {
                  onGenericChange('site', e.target.value);
                } else {
                  onGenericChange('site', '');
                }
              }}
              style={{ width: '100%', boxSizing: 'border-box' }}
            >
              <option value="custom">-- Type New Site --</option>
              {uniqueSites.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {(!uniqueSites.includes(node.data?.site as string)) && (
            <input 
              type="text" 
              placeholder="e.g. Datacenter London" 
              value={(node.data?.site as string) || ''} 
              onChange={(e) => onGenericChange('site', e.target.value)} 
              style={{ width: '100%', boxSizing: 'border-box' }} 
            />
          )}
        </div>
      </FormGroup>

      <FormGroup label="Tool Class">
        <select
          value={configType}
          onChange={(e) => onGenericChange('configType', e.target.value)}
        >
          <option value={CONFIG_TYPES.PACKET_TOOL}>Packet Consuming Tool</option>
          <option value={CONFIG_TYPES.METADATA_TOOL}>Metadata Consuming Tool</option>
          <option value={CONFIG_TYPES.STORAGE_TOOL}>Objects</option>
        </select>
      </FormGroup>

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

      <FormGroup label="Ingest Optic Type">
        <select
          value={(node.data?.ingestOptic as string) || ''}
          onChange={(e) => onGenericChange('ingestOptic', e.target.value)}
        >
          <option value="">-- No Optic (Direct Cable) --</option>
          <option value="1G Copper">1G Copper</option>
          <option value="1G Multimode SX">1G Multimode SX</option>
          <option value="1G Singlemode LX">1G Singlemode LX</option>
          <option value="10G Multimode SR">10G Multimode SR</option>
          <option value="10G Singlemode LR">10G Singlemode LR</option>
          <option value="25G Multimode SR">25G Multimode SR</option>
          <option value="25G Singlemode LR">25G Singlemode LR</option>
          <option value="40G Multimode SR4">40G Multimode SR4</option>
          <option value="40G Singlemode LR4">40G Singlemode LR4</option>
          <option value="100G Multimode SR4">100G Multimode SR4</option>
          <option value="100G Singlemode LR4">100G Singlemode LR4</option>
          <option value="Customer Supplied Optic">Customer Supplied Optic</option>
        </select>
      </FormGroup>

      {(node.data?.ingestOptic as string) && (
        <FormGroup label="Ingest Optic Quantity">
          <select
            value={(node.data?.ingestOpticQty as string) || '1'}
            onChange={(e) => onGenericChange('ingestOpticQty', e.target.value)}
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="4">4</option>
            <option value="8">8</option>
            <option value="12">12</option>
            <option value="16">16</option>
          </select>
        </FormGroup>
      )}

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
            : isRunning && metrics && metrics.rxMbps > 0
            ? `✓ Receiving matching traffic (${node.data?.receivedFormat || 'Expected class'})`
            : '✓ Idle (No Traffic)'}
        </div>
      </FormGroup>

      {isRunning && (isMetadataTool || isStorageTool) && metrics && metrics.rxMbps > 0 && (
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
                <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{formatBytes(metrics.rxMbps * 10800000000)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Weekly (est.):</span>
                <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{formatBytes(metrics.rxMbps * 10800000000 * 7)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Monthly (est.):</span>
                <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{formatBytes(metrics.rxMbps * 10800000000 * 30)}</span>
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: '9px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                * Based on current ingestion rate. Estimates assume 24/7 operation at this bandwidth.
              </p>
            </div>
          )}
        </div>
      )}

      {(isMetadataTool || isStorageTool) && (
        <MetadataEventViewer selectedNode={node} />
      )}
    </>
  );
};
