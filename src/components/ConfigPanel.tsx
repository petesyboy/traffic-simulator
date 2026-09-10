import React, { useEffect, useState } from 'react';
import { useStore, type MapCondition } from '../store/store';
import type { ClusterNodeData } from '../store/types';
import { NODE_TYPES, CONFIG_TYPES, ACTION_TYPES, SUPPORTED_TAP_OPTICS } from '../constants/nodeTypes';
import { isTapNode, isToolNode } from '../utils/clusterUtils';
import { TOOL_INGEST_PROFILES } from '../constants/toolIngestLimits';

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
import { DwdmNetworkPanel } from './config-panels/DwdmNetworkPanel';
import { FlowDirectionControl } from './config-panels/FlowDirectionControl';
import { sharedFlowDirection } from '../utils/flowDirection';

const ConfigPanel: React.FC = () => {
  const selectedNodeId = useStore((state) => state.selectedNodeId);
  const nodes          = useStore((state) => state.nodes);
  const edges          = useStore((state) => state.edges);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const updateMultipleNodesData = useStore((state) => state.updateMultipleNodesData);
  const createCluster  = useStore((state) => state.createCluster);
  const toggleClusterCollapse = useStore((state) => state.toggleClusterCollapse);
  const dissolveCluster = useStore((state) => state.dissolveCluster);
  const setNodeFlowDirection = useStore((state) => state.setNodeFlowDirection);
  const setSelectionFlowDirection = useStore((state) => state.setSelectionFlowDirection);
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
  const multiSelectedNodes = nodes.filter((n) => n.selected && !n.hidden);

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

    // More than one node selected: the per-type panels below edit a single node,
    // but the settings that are meaningful across a mixed selection belong here
    // rather than only on the canvas toolbar.
    if (multiSelectedNodes.length > 1) {
      const allSelectedTaps = multiSelectedNodes.every(isTapNode);
      const allSelectedTools = multiSelectedNodes.every(isToolNode);
      const someSelectedTaps = multiSelectedNodes.some(isTapNode);
      const someSelectedTools = multiSelectedNodes.some(isToolNode);
      const uniqueSites = Array.from(new Set(nodes.map(n => n.data?.site).filter(s => typeof s === 'string' && (s as string).trim() !== ''))) as string[];
      const sharedSite = Array.from(new Set(multiSelectedNodes.map(n => (n.data?.site as string) || ''))).length === 1
        ? (multiSelectedNodes[0].data?.site as string) || ''
        : '';

      const handleBatchSiteChange = (newSite: string) => {
        updateMultipleNodesData(multiSelectedNodes.map(n => n.id), { site: newSite });
      };

      const handleBatchTapOptic = (opticVal: string) => {
        const tapNodes = multiSelectedNodes.filter(isTapNode);
        if (tapNodes.length === 0) return;
        updateMultipleNodesData(tapNodes.map(n => n.id), {
          tappedLinkOptic: opticVal,
          tappedLinkAllocations: [{ qty: (tapNodes[0].data?.tappedLinksCount as number) || 1, optic: opticVal, toolOptic: opticVal }],
        });
      };

      const handleBatchTapLinks = (linksCount: number) => {
        const tapNodes = multiSelectedNodes.filter(isTapNode);
        if (tapNodes.length === 0) return;
        tapNodes.forEach((tn) => {
          const currentOptic = (tn.data?.tappedLinkOptic as string) || 'SFP-532';
          updateNodeData(tn.id, {
            tappedLinksCount: linksCount,
            tappedLinkAllocations: [{ qty: linksCount, optic: currentOptic, toolOptic: currentOptic }],
          });
        });
      };

      const handleBatchToolName = (name: string) => {
        const toolNodes = multiSelectedNodes.filter(isToolNode);
        if (toolNodes.length === 0) return;
        const defaultLimit = TOOL_INGEST_PROFILES[name]?.ingestLimitMbps || 10000;
        updateMultipleNodesData(toolNodes.map(n => n.id), {
          toolName: name,
          ingestLimitMbps: defaultLimit,
        });
      };

      const handleBatchToolIngestLimit = (limitMbps: number) => {
        const toolNodes = multiSelectedNodes.filter(isToolNode);
        if (toolNodes.length === 0) return;
        updateMultipleNodesData(toolNodes.map(n => n.id), {
          ingestLimitMbps: limitMbps,
        });
      };

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
              <div>
                <h2 style={{ margin: '0 0 4px 0' }}>{multiSelectedNodes.length} Nodes Selected</h2>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Batch modify common properties across all selected items.
                </p>
              </div>

              {/* Site / Data Centre Assignment */}
              <div className="config-card">
                <h3>🏢 Location / Data Centre</h3>
                <p style={{ margin: '2px 0 8px 0', fontSize: '10px', color: 'var(--text-secondary)' }}>
                  Assign all {multiSelectedNodes.length} selected nodes to a datacentre location.
                </p>
                <datalist id="existing-sites-multiselect-list">
                  {uniqueSites.map(s => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <input
                  type="text"
                  list="existing-sites-multiselect-list"
                  placeholder="e.g. DC1 / Site A / Main Hall"
                  value={sharedSite}
                  onChange={(e) => handleBatchSiteChange(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {/* TAP Batch Controls */}
              {(allSelectedTaps || someSelectedTaps) && (
                <div className="config-card">
                  <h3>⚡ TAP Settings ({multiSelectedNodes.filter(isTapNode).length} TAPs)</h3>
                  <p style={{ margin: '2px 0 8px 0', fontSize: '10px', color: 'var(--text-secondary)' }}>
                    Apply transceiver speed and link allocation to all selected TAP modules.
                  </p>
                  <FormGroup label="Tapped Link Speed / Optic">
                    <select
                      value={((multiSelectedNodes.find(isTapNode)?.data?.tappedLinkOptic as string) || 'SFP-532').split(' ')[0]}
                      onChange={(e) => handleBatchTapOptic(e.target.value)}
                    >
                      {SUPPORTED_TAP_OPTICS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </FormGroup>
                  <FormGroup label="Tapped Links Count">
                    <select
                      value={String((multiSelectedNodes.find(isTapNode)?.data?.tappedLinksCount as number) || 1)}
                      onChange={(e) => handleBatchTapLinks(parseInt(e.target.value, 10))}
                    >
                      {[1, 2, 3, 4, 5, 6].map(num => (
                        <option key={num} value={num}>{num} Link{num > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </FormGroup>
                  {allSelectedTaps && (
                    <button
                      className="btn btn-secondary"
                      style={{ width: '100%', fontSize: '11px', padding: '6px 10px', marginTop: '6px' }}
                      onClick={() => createCluster(multiSelectedNodes.map(n => n.id), 'tap')}
                    >
                      📦 Group into TAP Stack
                    </button>
                  )}
                </div>
              )}

              {/* Tool Batch Controls */}
              {(allSelectedTools || someSelectedTools) && (
                <div className="config-card">
                  <h3>🛠️ Tool Settings ({multiSelectedNodes.filter(isToolNode).length} Tools)</h3>
                  <p style={{ margin: '2px 0 8px 0', fontSize: '10px', color: 'var(--text-secondary)' }}>
                    Batch configure tool identity and ingest capacity across selected tools.
                  </p>
                  <FormGroup label="Tool Type">
                    <select
                      value={(multiSelectedNodes.find(isToolNode)?.data?.toolName as string) || 'Ericsson Probe'}
                      onChange={(e) => handleBatchToolName(e.target.value)}
                    >
                      {Object.keys(TOOL_INGEST_PROFILES).map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                      <option value="Packet Tool">Generic Packet Tool</option>
                    </select>
                  </FormGroup>
                  <FormGroup label="Ingest Capacity (Gbps)">
                    <select
                      value={String(Math.round(((multiSelectedNodes.find(isToolNode)?.data?.ingestLimitMbps as number) || 10000) / 1000))}
                      onChange={(e) => handleBatchToolIngestLimit(parseInt(e.target.value, 10) * 1000)}
                    >
                      <option value="1">1 Gbps</option>
                      <option value="2">2 Gbps</option>
                      <option value="10">10 Gbps</option>
                      <option value="20">20 Gbps</option>
                      <option value="25">25 Gbps</option>
                      <option value="40">40 Gbps</option>
                      <option value="50">50 Gbps</option>
                      <option value="100">100 Gbps</option>
                      <option value="400">400 Gbps</option>
                    </select>
                  </FormGroup>
                  {allSelectedTools && (
                    <button
                      className="btn btn-secondary"
                      style={{ width: '100%', fontSize: '11px', padding: '6px 10px', marginTop: '6px' }}
                      onClick={() => createCluster(multiSelectedNodes.map(n => n.id), 'tool')}
                    >
                      📦 Group into Tool Stack
                    </button>
                  )}
                </div>
              )}

              <FormGroup label="Flow Direction">
                <FlowDirectionControl
                  current={sharedFlowDirection(multiSelectedNodes)}
                  onChange={setSelectionFlowDirection}
                  hint={
                    <>
                      Applies to all {multiSelectedNodes.length} selected nodes at once. Nothing is
                      highlighted when the selection is mixed. Shortcut: <b>M</b> flips each one instead.
                    </>
                  }
                />
              </FormGroup>

              <div className="config-card">
                <h3>📋 Selected Nodes</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {multiSelectedNodes.slice(0, 12).map((n) => (
                    <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(n.data?.label as string) || n.id}
                      </span>
                      <span style={{ color: n.data?.flowDirectionLocked ? 'var(--accent-cyan, #00e5ff)' : 'var(--text-secondary)', flexShrink: 0 }}>
                        {n.data?.site ? `[${n.data.site}] ` : ''}{n.data?.flowDirectionLocked ? ((n.data?.flowDirection as string) === 'rtl' ? '← RTL' : '→ LTR') : 'Auto'}
                      </span>
                    </div>
                  ))}
                  {multiSelectedNodes.length > 12 && (
                    <div style={{ fontStyle: 'italic' }}>+{multiSelectedNodes.length - 12} more</div>
                  )}
                </div>
              </div>
            </div>
          )}
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

          {/* Mirrors this node's ingress/egress handles. Needed for hub layouts
              where sites sit to the right of a central transport node and so read
              right-to-left. The DWDM node already has handles on all four sides. */}
          {selectedNode.type !== NODE_TYPES.DWDM_NETWORK && (
            <FormGroup label="Flow Direction">
              <FlowDirectionControl
                current={sharedFlowDirection([selectedNode])}
                onChange={(direction) => setNodeFlowDirection(selectedNode.id, direction)}
                hint={
                  <>
                    Swaps which side this node&apos;s input and output handles sit on. Auto hands the
                    choice back to Tidy Layout. Shortcut: <b>M</b> mirrors the selection.
                  </>
                }
              />
            </FormGroup>
          )}

          {selectedNode.type === NODE_TYPES.GROUP && (
            <div style={{ padding: '12px', background: 'rgba(0, 229, 255, 0.05)', borderRadius: '6px', border: '1px solid rgba(0, 229, 255, 0.15)', fontSize: '12px', color: '#00e5ff', marginBottom: '15px' }}>
              📦 <b>Port Group Node</b>
              <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                This group represents a Port Group, bundling multiple input ports together. Connecting the output handle of this group to a Traffic Map automatically maps all nested input ports to that map.
              </p>
            </div>
          )}

          {selectedNode.type === NODE_TYPES.CLUSTER && (() => {
            const cData = selectedNode.data as unknown as ClusterNodeData;
            const isToolCluster = cData?.clusterType === 'tool';
            const memberIds = cData?.memberNodeIds || [];
            const memberNodes = nodes.filter((n) => memberIds.includes(n.id));

            const handleClusterTapOptic = (opticVal: string) => {
              if (memberIds.length === 0) return;
              updateMultipleNodesData(memberIds, {
                tappedLinkOptic: opticVal,
                tappedLinkAllocations: [{ qty: (memberNodes[0]?.data?.tappedLinksCount as number) || 1, optic: opticVal, toolOptic: opticVal }],
              });
            };

            const handleClusterTapLinks = (linksCount: number) => {
              if (memberIds.length === 0) return;
              memberNodes.forEach((tn) => {
                const currentOptic = (tn.data?.tappedLinkOptic as string) || 'SFP-532';
                updateNodeData(tn.id, {
                  tappedLinksCount: linksCount,
                  tappedLinkAllocations: [{ qty: linksCount, optic: currentOptic, toolOptic: currentOptic }],
                });
              });
            };

            const handleClusterToolName = (name: string) => {
              if (memberIds.length === 0) return;
              const defaultLimit = TOOL_INGEST_PROFILES[name]?.ingestLimitMbps || 10000;
              updateMultipleNodesData(memberIds, {
                toolName: name,
                ingestLimitMbps: defaultLimit,
              });
            };

            const handleClusterToolIngestLimit = (limitMbps: number) => {
              if (memberIds.length === 0) return;
              updateMultipleNodesData(memberIds, {
                ingestLimitMbps: limitMbps,
              });
            };

            return (
              <div className="config-card">
                <h3>{isToolCluster ? '🛠️ Tool Cluster Group' : '⚡ TAP Module Cluster'}</h3>
                <p style={{ margin: '4px 0 12px 0', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {(cData?.summary?.count || memberIds.length || 0)} stacked modules grouped together.
                </p>

                <FormGroup label="Site Assignment (Optional)">
                  <datalist id="existing-sites-cluster-list">
                    {Array.from(new Set(nodes.map(n => n.data?.site).filter(s => typeof s === 'string' && (s as string).trim() !== ''))).map(s => (
                      <option key={s as string} value={s as string} />
                    ))}
                  </datalist>
                  <input 
                    type="text" 
                    list="existing-sites-cluster-list"
                    placeholder="e.g. DC1 / Site A / Main Hall"
                    value={(selectedNode.data?.site as string) || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { site: e.target.value })}
                    className="form-input"
                  />
                </FormGroup>

                {!isToolCluster && (
                  <>
                    <FormGroup label="Member Link Speed / Optic">
                      <select
                        value={((memberNodes[0]?.data?.tappedLinkOptic as string) || 'SFP-532').split(' ')[0]}
                        onChange={(e) => handleClusterTapOptic(e.target.value)}
                      >
                        {SUPPORTED_TAP_OPTICS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </FormGroup>
                    <FormGroup label="Tapped Links per Module">
                      <select
                        value={String((memberNodes[0]?.data?.tappedLinksCount as number) || 1)}
                        onChange={(e) => handleClusterTapLinks(parseInt(e.target.value, 10))}
                      >
                        {[1, 2, 3, 4, 5, 6].map(num => (
                          <option key={num} value={num}>{num} Link{num > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </FormGroup>
                  </>
                )}

                {isToolCluster && (
                  <>
                    <FormGroup label="Member Tool Type">
                      <select
                        value={(memberNodes[0]?.data?.toolName as string) || 'Ericsson Probe'}
                        onChange={(e) => handleClusterToolName(e.target.value)}
                      >
                        {Object.keys(TOOL_INGEST_PROFILES).map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                        <option value="Packet Tool">Generic Packet Tool</option>
                      </select>
                    </FormGroup>
                    <FormGroup label="Ingest Capacity per Tool (Gbps)">
                      <select
                        value={String(Math.round(((memberNodes[0]?.data?.ingestLimitMbps as number) || 10000) / 1000))}
                        onChange={(e) => handleClusterToolIngestLimit(parseInt(e.target.value, 10) * 1000)}
                      >
                        <option value="1">1 Gbps</option>
                        <option value="2">2 Gbps</option>
                        <option value="10">10 Gbps</option>
                        <option value="20">20 Gbps</option>
                        <option value="25">25 Gbps</option>
                        <option value="40">40 Gbps</option>
                        <option value="50">50 Gbps</option>
                        <option value="100">100 Gbps</option>
                        <option value="400">400 Gbps</option>
                      </select>
                    </FormGroup>
                  </>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, fontSize: '11px', padding: '6px 10px' }}
                    onClick={() => toggleClusterCollapse(selectedNode.id)}
                  >
                    {cData?.isCollapsed !== false ? '⤢ Expand Stack' : '⤡ Collapse Stack'}
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ flex: 1, fontSize: '11px', padding: '6px 10px' }}
                    onClick={() => dissolveCluster(selectedNode.id)}
                  >
                    Ungroup Stack
                  </button>
                </div>
              </div>
            );
          })()}

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
          {(selectedNode.type === NODE_TYPES.DWDM_NETWORK || configType === CONFIG_TYPES.DWDM_NETWORK) && (
            <div className="config-card">
              <h3>🌐 Optical Transport Configuration</h3>
              <DwdmNetworkPanel node={selectedNode} onGenericChange={handleGenericChange} />
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