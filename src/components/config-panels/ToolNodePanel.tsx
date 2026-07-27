import React from 'react';
import { useStore, type CustomNode, type NodeMetrics } from '../../store/store';
import { CONFIG_TYPES } from '../../constants/nodeTypes';
import { isPacketToolConfig } from '../../utils/simulation/utils';
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
  const isPacketTool = isPacketToolConfig(configType);
  // Gigamon has no input on the optics used by a customer's own packet-consuming tools,
  // so those default to customer-supplied rather than a Gigamon-quoted optic.
  const defaultIngestOptic = isPacketTool ? 'Customer Supplied Optic' : '';
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
          value={(node.data?.ingestOptic as string) || defaultIngestOptic}
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

      {(isMetadataTool || isStorageTool) && (
        <MetadataEventViewer selectedNode={node} />
      )}
    </>
  );
};
