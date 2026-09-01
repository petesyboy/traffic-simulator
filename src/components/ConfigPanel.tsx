import React, { useEffect, useState } from 'react';
import { useStore, type MapCondition } from '../store/store';
import { NODE_TYPES, CONFIG_TYPES, ACTION_TYPES } from '../constants/nodeTypes';

// Import sub-panels
import { FormGroup, LiveMetrics } from './config-panels/LiveMetrics';
import { isBreakoutPanelModel } from '../utils/hardwareUtils';
import { DashboardPanel } from './config-panels/DashboardPanel';
import { HardwareNodePanel } from './config-panels/HardwareNodePanel';
import { InputNodePanel } from './config-panels/InputNodePanel';
import { FilterNodePanel } from './config-panels/FilterNodePanel';
import { MapNodePanel } from './config-panels/MapNodePanel';
import { GigaSmartPanel } from './config-panels/GigaSmartPanel';
import { ToolNodePanel } from './config-panels/ToolNodePanel';
import { LinkDetailPanel } from './config-panels/LinkDetailPanel';

const ConfigPanel: React.FC = () => {
  const selectedNodeId = useStore((state) => state.selectedNodeId);
  const nodes          = useStore((state) => state.nodes);
  const edges          = useStore((state) => state.edges);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const nodeMetrics    = useStore((state) => state.nodeMetrics);
  const isRunning      = useStore((state) => state.isRunning);
  const panelTextScale = useStore((state) => state.panelTextScale);
  const advancedMode   = useStore((state) => state.advancedMode);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [width, setWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);

  const selectedEdges = edges.filter((e) => e.selected);
  const selectedEdgeId = selectedEdges.length > 0 ? selectedEdges[0].id : null;

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // The panel sits on the right edge, so its handle drags from the left -
      // width grows as the cursor moves further from the right edge of the window.
      const newWidth = Math.max(320, Math.min(700, window.innerWidth - e.clientX));
      setWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // In Standard (simple) mode, respect a manual collapse — only Advanced Mode
  // auto-expands the panel when a new node or link is selected. Adjusted during render
  // (rather than in an effect) to avoid an extra commit-and-rerender pass.
  const [prevSelectedNodeId, setPrevSelectedNodeId] = useState(selectedNodeId);
  const [prevSelectedEdgeId, setPrevSelectedEdgeId] = useState(selectedEdgeId);
  const [prevAdvancedMode, setPrevAdvancedMode] = useState(advancedMode);
  if (selectedNodeId !== prevSelectedNodeId || selectedEdgeId !== prevSelectedEdgeId || advancedMode !== prevAdvancedMode) {
    setPrevSelectedNodeId(selectedNodeId);
    setPrevSelectedEdgeId(selectedEdgeId);
    setPrevAdvancedMode(advancedMode);
    if ((selectedNodeId || selectedEdgeId) && advancedMode) {
      setIsCollapsed(false);
    }
  }

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

    if (key === 'ingestLimitMbps') {
      updates.ingestLimitMbps = parseInt(val, 10) || undefined;
    }

    if (key === 'tappedLinksCount') {
      updates.tappedLinksCount = parseInt(val, 10) || 1;
    }

    if (key === 'linkCount') {
      updates.linkCount = parseInt(val, 10) || 2;
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

  const resizeHandle = !isCollapsed && (
    <div
      onMouseDown={handleResizeMouseDown}
      className={`config-panel-resize-handle ${isResizing ? 'resizing' : ''}`}
      title="Drag to resize configuration panel"
    />
  );

  if (!selectedNodeId || !selectedNode) {
    if (selectedEdges.length > 0) {
      return (
        <aside
          className={`config-panel ${isCollapsed ? 'collapsed' : ''}`}
          style={{
            width: isCollapsed ? '0px' : `${width}px`,
            padding: '0px',
            borderLeft: isCollapsed ? 'none' : '1px solid var(--border-color)',
            position: 'relative',
            overflow: 'visible',
            transition: isResizing ? 'none' : 'width 0.3s ease, padding 0.3s ease, border-color 0.3s ease',
            flexShrink: 0,
            zoom: panelTextScale,
          }}
        >
          {collapseToggle}
          {resizeHandle}
          {!isCollapsed && <LinkDetailPanel selectedEdge={selectedEdges[0]} selectedEdges={selectedEdges} />}
        </aside>
      );
    }

    return (
      <aside
        className={`config-panel ${isCollapsed ? 'collapsed' : ''}`}
        style={{
          width: isCollapsed ? '0px' : `${width}px`,
          padding: '0px',
          borderLeft: isCollapsed ? 'none' : '1px solid var(--border-color)',
          position: 'relative',
          overflow: 'visible',
          transition: isResizing ? 'none' : 'width 0.3s ease, padding 0.3s ease, border-color 0.3s ease',
          flexShrink: 0,
          zoom: panelTextScale,
        }}
      >
        {collapseToggle}
        {resizeHandle}
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
        width: isCollapsed ? '0px' : `${width}px`,
        padding: '0px',
        borderLeft: isCollapsed ? 'none' : '1px solid var(--border-color)',
        position: 'relative',
        overflow: 'visible',
        transition: isResizing ? 'none' : 'width 0.3s ease, padding 0.3s ease, border-color 0.3s ease',
        flexShrink: 0,
        zoom: panelTextScale,
      }}
    >
      {collapseToggle}
      {resizeHandle}

      {!isCollapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', height: '100%', padding: '16px', overflowY: 'auto', boxSizing: 'border-box' }}>
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
              <FormGroup label="Load Balanced Links (Count)">
                <select
                  value={String((selectedNode.data?.linkCount as number) || 2)}
                  onChange={(e) => handleGenericChange('linkCount', e.target.value)}
                >
                  <option value="2">2 Links</option>
                  <option value="3">3 Links</option>
                  <option value="4">4 Links</option>
                  <option value="8">8 Links</option>
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
                updateNodeData={updateNodeData}
                isRunning={isRunning}
                metrics={selectedNodeMetric}
              />
            </div>
          )}
          {(selectedNode.type === NODE_TYPES.MAP || configType === CONFIG_TYPES.TRAFFIC_MAP) && (
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

          {isRunning && selectedNodeMetric && !isBreakoutPanelModel(String(selectedNode.data?.model || '')) && (
            <LiveMetrics nodeType={selectedNode.type || ''} metrics={selectedNodeMetric} />
          )}
        </div>
      )}
    </aside>
  );
};

export default ConfigPanel;