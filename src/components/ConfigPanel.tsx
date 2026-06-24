import React, { useState, useEffect } from 'react';
import { useStore, type MapCondition } from '../store/store';
import { NODE_TYPES, CONFIG_TYPES, ACTION_TYPES } from '../constants/nodeTypes';

// Import sub-panels
import { FormGroup, LiveMetrics } from './config-panels/LiveMetrics';
import { DashboardPanel } from './config-panels/DashboardPanel';
import { HardwareNodePanel } from './config-panels/HardwareNodePanel';
import { InputNodePanel } from './config-panels/InputNodePanel';
import { FilterNodePanel } from './config-panels/FilterNodePanel';
import { MapNodePanel } from './config-panels/MapNodePanel';
import { GigaSmartPanel } from './config-panels/GigaSmartPanel';
import { ToolNodePanel } from './config-panels/ToolNodePanel';

const ConfigPanel: React.FC = () => {
  const selectedNodeId = useStore((state) => state.selectedNodeId);
  const nodes          = useStore((state) => state.nodes);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const nodeMetrics    = useStore((state) => state.nodeMetrics);
  const isRunning      = useStore((state) => state.isRunning);

  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (selectedNodeId) {
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

    if (key === 'actionType' && val === ACTION_TYPES.DEDUPLICATION && selectedNode.data?.dedupRate === undefined) {
      updates.dedupRate = Math.floor(Math.random() * 41) + 10;
      updates.lastDedupUpdate = Date.now();
    }

    if (key === 'erspanId') {
      updates.erspanId = parseInt(val, 10) || 10;
    }

    if (key === 'sliceSize') {
      updates.sliceSize = parseInt(val, 10) || 128;
    }

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

  const collapseToggle = (
    <button
      onClick={() => setIsCollapsed(!isCollapsed)}
      className="config-panel-toggle"
      title={isCollapsed ? 'Expand Panel' : 'Collapse Panel'}
    >
      {isCollapsed ? '◀' : '▶'}
    </button>
  );

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

          <FormGroup label="Node Label">
            <input
              type="text"
              value={(selectedNode.data?.label as string) || ''}
              onChange={handleLabelChange}
            />
          </FormGroup>

          {selectedNode.type === NODE_TYPES.GROUP && (
            <div style={{ padding: '12px', background: 'rgba(0, 229, 255, 0.05)', borderRadius: '6px', border: '1px solid rgba(0, 229, 255, 0.15)', fontSize: '12px', color: '#00e5ff', marginBottom: '15px' }}>
              📦 <b>Port Group Node</b>
              <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                This group represents a Port Group, bundling multiple input ports together. Connecting the output handle of this group to a Traffic Map automatically maps all nested input ports to that map.
              </p>
            </div>
          )}

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

          {isRunning && selectedNodeMetric && (
            <LiveMetrics nodeType={selectedNode.type || ''} metrics={selectedNodeMetric} />
          )}
        </div>
      )}
    </aside>
  );
};

export default ConfigPanel;