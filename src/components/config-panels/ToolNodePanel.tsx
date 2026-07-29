import React, { useState } from 'react';
import { useStore, type CustomNode, type NodeMetrics } from '../../store/store';
import type { BaseNodeData, GigaSmartNodeData } from '../../store/types';
import { CONFIG_TYPES, ACTION_TYPES } from '../../constants/nodeTypes';
import { isPacketToolConfig } from '../../utils/simulation/utils';
import { getDefaultIngestLimitMbps, getToolConnectivity, getToolApplianceModel } from '../../constants/toolIngestLimits';
import { formatBandwidth } from '../../utils/format';
import { FormGroup } from './LiveMetrics';
import { MetadataEventViewer } from '../MetadataEventViewer';
import { GigaSmartAppsPanel } from './hardware';

// Every GigaSMART application the physical appliance is capable of running.
// A fresh appliance only ships with AMI (see Sidebar.tsx), but the rest can be
// added here as optional apps — this is the full catalogue "add" offers.
const GSA_APP_CATALOGUE: { actionType: string; label: string; defaults?: Partial<GigaSmartNodeData> }[] = [
  { actionType: ACTION_TYPES.DEDUPLICATION, label: 'Deduplication', defaults: { dedupRate: 20 } },
  { actionType: ACTION_TYPES.APPLICATION_FILTERING_INTELLIGENCE, label: 'Application Filtering Intelligence' },
  { actionType: ACTION_TYPES.AMI, label: 'Application Metadata Intelligence', defaults: { metadataFormat: 'CEF', metadataRate: 1.5 } },
  { actionType: ACTION_TYPES.AMX, label: 'Application Metadata Exporter', defaults: { metadataFormat: 'CEF', metadataRate: 1.5 } },
  { actionType: ACTION_TYPES.APP_VIS, label: 'Application Visualization' },
];

interface ToolNodePanelProps {
  node: CustomNode;
  onGenericChange: (key: string, val: string) => void;
  updateNodeData: (nodeId: string, data: Partial<BaseNodeData>) => void;
  isRunning: boolean;
  metrics?: NodeMetrics;
}

export const ToolNodePanel: React.FC<ToolNodePanelProps> = ({
  node,
  onGenericChange,
  updateNodeData,
  isRunning,
  metrics
}) => {
  const configType = (node.data?.configType as string) || CONFIG_TYPES.PACKET_TOOL;
  const isMetadataTool = configType === CONFIG_TYPES.METADATA_TOOL;
  const isStorageTool = configType === CONFIG_TYPES.STORAGE_TOOL;
  const isPacketTool = isPacketToolConfig(configType);
  const isGigaSmartAppliance = (node.data?.toolName as string) === 'GigaSMART Appliance';
  // Gigamon has no input on the optics used by a customer's own packet-consuming tools,
  // so those default to customer-supplied rather than a Gigamon-quoted optic.
  const defaultIngestOptic = isPacketTool ? 'Customer Supplied Optic' : '';
  const nodes = useStore((state) => state.nodes);
  const uniqueSites = Array.from(new Set(nodes.map(n => n.data?.site).filter(s => typeof s === 'string' && s.trim() !== ''))) as string[];
  const advancedMode = useStore((state) => state.advancedMode);
  const autoScaleToolForFeed = useStore((state) => state.autoScaleToolForFeed);

  const toolName = (node.data?.toolName as string) || '';
  const storedIngestLimit = node.data?.ingestLimitMbps as number | undefined;
  const effectiveIngestLimit = (typeof storedIngestLimit === 'number' && storedIngestLimit > 0)
    ? storedIngestLimit
    : getDefaultIngestLimitMbps(toolName);

  // Raw string kept in local state so a mid-edit "" or partial number doesn't
  // get eagerly clamped back to the last valid value — parsing is deferred to blur.
  // Resynced during render (not an effect) when the selected node changes, matching
  // the pattern ConfigPanel.tsx uses for its own selected-node-changed reset.
  const [prevNodeId, setPrevNodeId] = useState(node.id);
  const [ingestLimitStr, setIngestLimitStr] = useState(String(effectiveIngestLimit));
  if (node.id !== prevNodeId) {
    setPrevNodeId(node.id);
    setIngestLimitStr(String(effectiveIngestLimit));
  }

  const commitIngestLimit = () => {
    const parsed = parseInt(ingestLimitStr, 10);
    const finalValue = (!isNaN(parsed) && parsed > 0) ? parsed : effectiveIngestLimit;
    setIngestLimitStr(String(finalValue));
    onGenericChange('ingestLimitMbps', String(finalValue));
  };

  const applianceModel = getToolApplianceModel(toolName);
  const connectivity = getToolConnectivity(toolName);

  const gigaSmartApps = (node.data?.gigaSmartApps as GigaSmartNodeData[]) || [];
  const installedActionTypes = new Set(gigaSmartApps.map((app) => app.actionType));
  const availableAppsToAdd = GSA_APP_CATALOGUE.filter((app) => !installedActionTypes.has(app.actionType));
  const [selectedAppToAdd, setSelectedAppToAdd] = useState('');
  if (node.id !== prevNodeId) {
    setSelectedAppToAdd('');
  }

  const handleAddApp = () => {
    const catalogueEntry = availableAppsToAdd.find((app) => app.actionType === selectedAppToAdd) || availableAppsToAdd[0];
    if (!catalogueEntry) return;
    // A slug of the action type is a stable, unique-enough id here since
    // availableAppsToAdd already excludes any actionType already installed.
    const idSlug = catalogueEntry.actionType.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newApp: GigaSmartNodeData = {
      id: `gsa-app-${idSlug}`,
      configType: 'GigaSMART',
      actionType: catalogueEntry.actionType,
      label: catalogueEntry.label,
      ...catalogueEntry.defaults,
    };
    updateNodeData(node.id, { gigaSmartApps: [...gigaSmartApps, newApp] });
    setSelectedAppToAdd('');
  };

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

      {isPacketTool && (
        <FormGroup label="Ingest Rate Limit (Mbps)">
          <input
            type="text"
            inputMode="numeric"
            value={ingestLimitStr}
            onChange={(e) => setIngestLimitStr(e.target.value)}
            onBlur={commitIngestLimit}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '3px' }}>
            ≈ {formatBandwidth(effectiveIngestLimit)}
            {storedIngestLimit === undefined && toolName && ` — default for ${toolName}${applianceModel ? ` (${applianceModel})` : ''}, editable`}
          </div>
          {connectivity.length > 0 && (
            <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.5' }}>
              Typical connectivity:
              <ul style={{ margin: '2px 0 0 0', paddingLeft: '16px' }}>
                {connectivity.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          )}
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

      {isGigaSmartAppliance && (
        <div className="panel-section">
          <h3 className="text-base font-semibold mb-2">🎯 GigaSMART Pipeline</h3>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: '1.4' }}>
            A fresh appliance defaults to AMI only, to keep this simple while
            the feature beds in. Dedup, AFI, AMX, and AppViz are all functions
            the real appliance also performs — add any of them below.
          </div>
          <GigaSmartAppsPanel selectedNode={node} updateNodeData={updateNodeData} />
          {availableAppsToAdd.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
              <select
                value={selectedAppToAdd || availableAppsToAdd[0].actionType}
                onChange={(e) => setSelectedAppToAdd(e.target.value)}
                style={{ flex: 1, fontSize: '11px', padding: '4px' }}
              >
                {availableAppsToAdd.map((app) => (
                  <option key={app.actionType} value={app.actionType}>{app.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddApp}
                style={{
                  padding: '4px 10px',
                  background: 'rgba(255, 152, 0, 0.15)',
                  border: '1px solid rgba(255, 152, 0, 0.4)',
                  borderRadius: '3px',
                  color: '#ffb74d',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                + Add
              </button>
            </div>
          )}
        </div>
      )}

      {advancedMode && isPacketTool && !isGigaSmartAppliance && (
        <FormGroup label="Advanced: Capacity Planning">
          <button
            type="button"
            onClick={() => {
              const result = autoScaleToolForFeed(node.id);
              window.alert(result.message);
            }}
            style={{
              width: '100%',
              padding: '6px',
              background: '#2b2b2b',
              border: '1px dashed #ff9800',
              borderRadius: '4px',
              color: '#ff9800',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🧮 Auto-Scale to Match Feed
          </button>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '3px' }}>
            Duplicates this tool behind a load balancer until enough instances exist to absorb its current feed at {formatBandwidth(effectiveIngestLimit)} each. Requires the simulation to be running and exactly one upstream connection.
          </div>
        </FormGroup>
      )}

      {(isMetadataTool || isStorageTool) && (
        <MetadataEventViewer selectedNode={node} />
      )}
    </>
  );
};
