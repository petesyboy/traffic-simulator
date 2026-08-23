import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import {
  ReactFlow,
  useReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  Panel,
  type Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import { useStore, type CustomNode } from '../store/store';
import type { GigaSmartNodeData } from '../store/types';
import { InputNode, FilterNode, ToolNode, MapNode, GigaStreamNode, GigaSmartNode, GroupNode, HardwareNode } from './nodes';
import { NODE_TYPES, CONFIG_TYPES } from '../constants/nodeTypes';
import { isActionSupportedOnNode, areActionsCompatible } from '../constants/gigaSmartRules';
import { isMetadataEdge, calculateAnimationDuration } from '../utils/graphUtils';
import { isAutoTrayModel } from '../utils/trayModels';
import { FederatedEnclosures } from './canvas/FederatedEnclosures';
import { FederatedDashboard } from './canvas/FederatedDashboard';
import { GroupingBanner } from './canvas/GroupingBanner';
import { EdgeBanner } from './canvas/EdgeBanner';

import { ParallelEdge } from './CustomEdges';

const nodeTypes = {
  [NODE_TYPES.INPUT]:      InputNode,
  [NODE_TYPES.FILTER]:     FilterNode,
  [NODE_TYPES.TOOL]:       ToolNode,
  [NODE_TYPES.MAP]:        MapNode,
  [NODE_TYPES.GIGASTREAM]: GigaStreamNode,
  [NODE_TYPES.GIGASMART]:  GigaSmartNode,
  [NODE_TYPES.GROUP]:      GroupNode,
  [NODE_TYPES.HARDWARE]:   HardwareNode,
};

const edgeTypes = {
  default: ParallelEdge,
};

const CanvasArea: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  
  const {
    draggedNodeType, nodes, edges, activeEdges, blockedEdges, 
    encryptedEdges, decryptedEdges, edgeMetrics, edgeEncryptedMbps, isRunning,
    showGrid, snapToGrid, snapAllNodesToGrid, tidyLayout, exportDiagramMode,
    setExportDiagramMode, onNodesChange, onEdgesChange, onConnect,
    addNode, addTrafficStream, setSelectedNodeId, fitViewTrigger, fitViewNodeIds,
    zoomToNodeId, zoomToNodeTrigger,
    advancedMode, updateNodeData, setEdges, pushHistory
  } = useStore();

  const { screenToFlowPosition, fitView } = useReactFlow();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (fitViewNodeIds && fitViewNodeIds.length > 0) {
        fitView({
          nodes: fitViewNodeIds.map((id) => ({ id })),
          padding: 0.08,
          maxZoom: 3.5,
          duration: 0,
        });
      } else {
        fitView({ padding: 0.08, maxZoom: 2.0, duration: 0 });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [fitViewTrigger, fitViewNodeIds, fitView]);

  useEffect(() => {
    if (!zoomToNodeId) return;
    const timer = setTimeout(() => {
      fitView({ nodes: [{ id: zoomToNodeId }], padding: 0.15, maxZoom: 2.5, duration: 400 });
    }, 100);
    return () => clearTimeout(timer);
  }, [zoomToNodeTrigger, zoomToNodeId, fitView]);

  const styledEdges = edges.map((edge) => {
    const isActive = activeEdges.includes(edge.id);
    const isBlocked = blockedEdges.includes(edge.id);
    const isEncrypted = encryptedEdges.includes(edge.id);
    const isDecrypted = decryptedEdges.includes(edge.id);
    
    const srcNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);

    const isMetadata = isMetadataEdge(edge, nodes, edges);

    let className = '';
    let animated = false;
    
    const encryptedMbps = (edgeEncryptedMbps || {})[edge.id] || 0;
    const totalMbps = (edgeMetrics || {})[edge.id] || 0;
    const isMixed = isEncrypted && isDecrypted && encryptedMbps > 0 && (totalMbps - encryptedMbps) > 0.5;

    if (isRunning) {
      if (isBlocked) className = 'blocked-flow';
      else if (isActive) {
        if (isMixed) className = 'active-flow mixed-flow';
        else if (isEncrypted) className = 'active-flow encrypted-flow';
        else if (isDecrypted) className = 'active-flow decrypted-flow';
        else className = isMetadata ? 'metadata-flow' : 'active-flow';
        animated = true;
      }
    }

    // Only group edges sharing the same source handle as "parallel" links -
    // a node with two distinct output handles (e.g. the GSA's packet "out"
    // and metadata "metadata-out") that both happen to target the same node
    // isn't load-balancing, it's two different traffic types on one target,
    // so those shouldn't be labelled "Link 1/2" as if they were interchangeable.
    const parallelEdges = edges.filter(e => e.source === edge.source && e.target === edge.target && e.sourceHandle === edge.sourceHandle);
    const totalParallel = parallelEdges.length;
    const parallelIndex = parallelEdges.findIndex(e => e.id === edge.id);

    let label = edge.label;
    if (srcNode?.type === 'gigaSmartNode' && 
        (srcNode.data?.actionType === 'Application Metadata' || srcNode.data?.actionType === 'AMX' || srcNode.data?.actionType === 'AMI')) {
      label = `${srcNode.data?.metadataFormat || 'CEF'} Metadata`;
    }

    if (totalParallel > 1) {
      const linkPrefix = `Link ${parallelIndex + 1}/${totalParallel}`;
      label = label ? `${linkPrefix} | ${label}` : linkPrefix;
    }

    const srcTool = (srcNode?.data?.toolName as string) || '';
    const tgtConfig = (targetNode?.data?.configType as string) || '';
    const srcConfig = (srcNode?.data?.configType as string) || '';
    const tgtTool = (targetNode?.data?.toolName as string) || '';

    if (srcTool === 'Splunk' && (tgtConfig === 'Objects' || tgtConfig === 'Storage Tool')) {
      className = isMetadata ? 'reverse-metadata-flow' : 'reverse-flow';
      animated = true;
    } else if ((srcConfig === 'Objects' || srcConfig === 'Storage Tool') && tgtTool === 'Splunk') {
      className = isMetadata ? 'metadata-flow' : 'active-flow';
      animated = true;
    }
    
    const bps = (edgeMetrics || {})[edge.id];
    if (isRunning && bps !== undefined && bps > 0) {
      const throughputLabel = bps >= 1000 ? `${(bps / 1000).toFixed(1)} Gbps` : `${bps.toFixed(0)} Mbps`;
      label = label ? `${label} | ${throughputLabel}` : throughputLabel;
    }
    
    if (isRunning && isActive) {
      if (isMixed && totalMbps > 0) {
        const encPct = Math.round((encryptedMbps / totalMbps) * 100);
        label = `🔒 ${encPct}% blind spot | 🔓 ${100 - encPct}% visible`;
      } else if (isEncrypted) {
        label = `🔒 ${label}`;
      } else if (isDecrypted) {
        label = `🔓 ${label}`;
      }
    }

    let stroke = '#007cff';
    if (isRunning) {
      if (isActive) {
        if (isMixed) stroke = '#FF8C00';
        else if (isEncrypted) stroke = '#FF8C00';
        else if (isDecrypted) stroke = '#448AFF';
        else stroke = isMetadata ? '#ff9800' : '#00e5ff';
      } else if (isBlocked) stroke = '#ef5350';
    }
    if ((srcTool === 'Splunk' && (tgtConfig === 'Objects' || tgtConfig === 'Storage Tool')) || ((srcConfig === 'Objects' || srcConfig === 'Storage Tool') && tgtTool === 'Splunk')) stroke = isMetadata ? '#ff9800' : '#00e5ff';

    let style: React.CSSProperties = { stroke, strokeWidth: hoveredEdgeId === edge.id ? '4px' : '1.5px', strokeDasharray: '4, 3' };
    if (isRunning && bps !== undefined && bps > 0) style.animationDuration = calculateAnimationDuration(bps);

    if (hoveredEdgeId === edge.id) {
      const isInsertHover = draggedNodeType === NODE_TYPES.GIGASMART || draggedNodeType === NODE_TYPES.GIGASTREAM;
      style = { ...style, stroke: isInsertHover ? '#ff9800' : '#00e5ff', strokeWidth: isInsertHover ? '5px' : '4px', filter: isInsertHover ? 'drop-shadow(0px 0px 10px #ff9800)' : 'drop-shadow(0px 0px 8px #00e5ff)' };
    }
    
    // Spread the stored data through rather than replacing it - it carries the
    // edge's port assignments (portLinks), which would otherwise be wiped on
    // every render.
    return { ...edge, className, type: 'default', data: { ...edge.data, parallelIndex, totalParallel }, animated: hoveredEdgeId === edge.id ? true : animated, label, style, labelStyle: { fill: (isEncrypted || isMixed) ? '#FF8C00' : (isDecrypted ? '#448AFF' : (isMetadata ? '#ff9800' : '#00e5ff')), fontSize: '9px', fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 'bold' }, labelBgStyle: { fill: '#121212', fillOpacity: 0.95, stroke: '#2a2a2a', strokeWidth: 1 } };
  });

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const canInterposeOnEdge = draggedNodeType === NODE_TYPES.GIGASTREAM || (draggedNodeType === NODE_TYPES.GIGASMART && !advancedMode);
    if (canInterposeOnEdge) {
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      let foundEdgeId: string | null = null;
      for (const edge of edges) {
        const srcNode = nodes.find(n => n.id === edge.source), targetNode = nodes.find(n => n.id === edge.target);
        if (!srcNode || !targetNode || (srcNode.type === NODE_TYPES.HARDWARE && targetNode.type === NODE_TYPES.HARDWARE)) continue;
        const srcW = srcNode.measured?.width || srcNode.width || 170, srcH = srcNode.measured?.height || srcNode.height || 75;
        const ax = srcNode.position.x + srcW, ay = srcNode.position.y + srcH / 2;
        const targetH = targetNode.measured?.height || targetNode.height || 75, bx = targetNode.position.x, by = targetNode.position.y + targetH / 2;
        const px = position.x, py = position.y, dx = bx - ax, dy = by - ay, lenSq = dx * dx + dy * dy;
        const t = lenSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq)) : 0;
        const cx = ax + t * dx, cy = ay + t * dy, distSq = (px - cx) * (px - cx) + (py - cy) * (py - cy);
        if (Math.sqrt(distSq) < 80) { foundEdgeId = edge.id; break; }
      }
      setHoveredEdgeId(foundEdgeId);
    } else if (hoveredEdgeId !== null) {
      setHoveredEdgeId(null);
    }
  }, [draggedNodeType, edges, nodes, screenToFlowPosition, advancedMode, hoveredEdgeId]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const rawData = event.dataTransfer.getData('application/reactflow');
    if (!rawData) return;
    const { type, label, initialData } = JSON.parse(rawData);
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });

    if (advancedMode && type === NODE_TYPES.GIGASMART) {
      const targetNode = nodes.find(n => {
        if (n.type !== 'hardwareNode') return false;
        const w = n.measured?.width || n.width || 400, h = n.measured?.height || n.height || 200;
        return (position.x >= n.position.x - w / 2 && position.x <= n.position.x + w / 2 && position.y >= n.position.y - h / 2 && position.y <= n.position.y + h / 2) ||
               (position.x >= n.position.x && position.x <= n.position.x + w && position.y >= n.position.y && position.y <= n.position.y + h);
      });
      if (targetNode && String(targetNode.data?.model || '').includes('HC')) {
        const actionType = initialData?.actionType || 'Deduplication', chassisModel = String(targetNode.data?.model || '');
        const installedModules = Object.values((targetNode.data?.installedBoards as Record<string, string>) || {});
        if (!isActionSupportedOnNode(actionType, chassisModel, installedModules)) { alert(`GigaSMART action '${actionType}' is not supported on the currently installed modules in this ${chassisModel} chassis.`); return; }
        const apps = targetNode.data.gigaSmartApps || [];
        const incompatibleApp = apps.find(
          (a: GigaSmartNodeData) =>
            !areActionsCompatible(actionType, a.actionType, undefined, chassisModel, installedModules).compatible,
        );
        if (incompatibleApp) {
          const comp = areActionsCompatible(actionType, incompatibleApp.actionType, undefined, chassisModel, installedModules);
          alert(`🚫 COMBINATION REFUSED: ${comp.reason}`);
          return;
        }
        updateNodeData(targetNode.id, { gigaSmartApps: [...apps, { id: `gs-${Date.now()}`, label, actionType, dedupRate: 20, metadataFormat: 'CEF' }] });
      } else alert(advancedMode && !nodes.some(n => n.type === 'hardwareNode' && String(n.data?.model || '').includes('HC')) ? "GigaSMART requires a GigaVUE-HC series node. Please add a GigaVUE-HC node to the canvas first." : "In Advanced Mode, GigaSMART applications must be dropped directly onto a GigaVUE-HC series appliance.");
      return;
    }

    const mergedData = { ...initialData };
    let labelToUse = label;
    if (type === NODE_TYPES.INPUT) {
      let maxIndex = 0;
      nodes.forEach(n => { if (n.type === NODE_TYPES.INPUT) { const m = String(n.data?.label || '').match(/(?:TAP\s+|Port\s+|Tunnel\s+|Traffic\s+|Estate\s+)(\d+)/i); if (m) maxIndex = Math.max(maxIndex, parseInt(m[1], 10)); } });
      const nIdx = maxIndex + 1;
      if (initialData?.configType === 'Network Tap' || initialData?.configType === 'Virtual TAP' || initialData?.configType === CONFIG_TYPES.TAP) labelToUse = `Network TAP ${nIdx}`;
      else if (initialData?.configType === 'SPAN Port' || initialData?.configType === CONFIG_TYPES.SPAN) labelToUse = `SPAN Port ${nIdx}`;
      else if (initialData?.configType === CONFIG_TYPES.ERSPAN) labelToUse = `ERSPAN Tunnel ${nIdx}`;
      else if (initialData?.configType === CONFIG_TYPES.EAST_WEST) labelToUse = `East/West Traffic ${nIdx}`;
      else if (initialData?.configType === CONFIG_TYPES.VMWARE || initialData?.configType === 'GigaVUE-VM') labelToUse = `VMWare Estate ${nIdx}`;
    } else if (type === NODE_TYPES.HARDWARE) {
      let maxIndex = 0;
      const baseModel = String(initialData?.model || initialData?.label || 'Node');
      nodes.forEach(n => { if (n.type === NODE_TYPES.HARDWARE) { const nodeBaseModel = String(n.data?.model || n.data?.label || 'Node'); if (nodeBaseModel === baseModel) { const m = String(n.data?.label || '').match(new RegExp(`^${baseModel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+#?(\\d+)$`, 'i')); if (m) maxIndex = Math.max(maxIndex, parseInt(m[1], 10)); else if (String(n.data?.label) === baseModel) maxIndex = Math.max(maxIndex, 1); } } });
      if (maxIndex > 0) labelToUse = `${baseModel} #${maxIndex + 1}`;
    }

    if (initialData?.actionType === 'Deduplication' && mergedData.dedupRate === undefined) { mergedData.dedupRate = Math.floor(Math.random() * 41) + 10; mergedData.lastDedupUpdate = Date.now(); }
    // The GSA is a Gigamon appliance, not a customer-supplied tool, so it's excluded here -
    // ToolNodePanel gives it its own Gigamon-optic default instead (see defaultIngestOptic).
    if (type === 'toolNode' && initialData?.configType === 'Packet Tool' && initialData?.toolName !== 'GigaSMART Appliance' && mergedData.ingestOptic === undefined) { mergedData.ingestOptic = 'Customer Supplied Optic'; mergedData.ingestOpticQty = '1'; }

    let edgeToInterpose: Edge | null = null;
    if (type === NODE_TYPES.GIGASTREAM || type === NODE_TYPES.GIGASMART) {
      for (const edge of edges) {
        const srcNode = nodes.find(n => n.id === edge.source), targetNode = nodes.find(n => n.id === edge.target);
        if (!srcNode || !targetNode || (srcNode.type === NODE_TYPES.HARDWARE && targetNode.type === NODE_TYPES.HARDWARE)) continue;
        const srcW = srcNode.measured?.width || srcNode.width || 170, srcH = srcNode.measured?.height || srcNode.height || 75;
        const ax = srcNode.position.x + srcW, ay = srcNode.position.y + srcH / 2;
        const targetH = targetNode.measured?.height || targetNode.height || 75, bx = targetNode.position.x, by = targetNode.position.y + targetH / 2;
        const px = position.x, py = position.y, dx = bx - ax, dy = by - ay, lenSq = dx * dx + dy * dy;
        const t = lenSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq)) : 0;
        const cx = ax + t * dx, cy = ay + t * dy, distSq = (px - cx) * (px - cx) + (py - cy) * (py - cy);
        if (Math.sqrt(distSq) < 80) { edgeToInterpose = edge; break; }
      }
    }

    const newNode: CustomNode = { id: uuidv4(), type, position, data: { label: labelToUse, configType: mergedData.configType || labelToUse, ...mergedData } };
    addNode(newNode);

    if (edgeToInterpose) {
      const leftEdge = { id: `e-${uuidv4()}`, source: edgeToInterpose.source, sourceHandle: edgeToInterpose.sourceHandle, target: newNode.id, targetHandle: 'in' };
      const rightEdge = { id: `e-${uuidv4()}`, source: newNode.id, sourceHandle: 'out', target: edgeToInterpose.target, targetHandle: edgeToInterpose.targetHandle };
      setEdges(edges.filter(e => e.id !== edgeToInterpose.id).concat(leftEdge, rightEdge));
    }
    setHoveredEdgeId(null);

    if (type === NODE_TYPES.INPUT || (type === NODE_TYPES.HARDWARE && String(newNode.data?.model || '').includes('TAP'))) {
      let speedLimitMbps: number;
      if (type === NODE_TYPES.INPUT) { const m = String(newNode.data?.portSpeed || '').match(/(\d+)G/i); speedLimitMbps = m ? parseInt(m[1], 10) * 1000 : Number(newNode.data.linkSpeed || 10000); }
      else { const m = String(newNode.data?.model || ''); speedLimitMbps = m.includes('25') ? 25000 : (m.includes('40') ? 40000 : (m.includes('100') ? 100000 : (m.includes('400') ? 400000 : 10000))); }
      const tappedLinksCount = type === NODE_TYPES.HARDWARE ? ((newNode.data?.tappedLinksCount as number) ?? 1) : 1;
      const numStreamsToCreate = Math.min(tappedLinksCount, 4), profiles = [{ name: 'Web Traffic', port: '443', proto: 'tcp' }, { name: 'DB Sync Flow', port: '5432', proto: 'tcp' }, { name: 'App Services API', port: '8080', proto: 'tcp' }, { name: 'DNS Queries Query', port: '53', proto: 'udp' }, { name: 'Video Streaming Media', port: '5004', proto: 'udp' }, { name: 'VoIP Signaling', port: '5060', proto: 'udp' }, { name: 'Encrypted VPN Tunnel', port: '500', proto: 'udp' }, { name: 'ICMP Diagnostics', port: '0', proto: 'icmp' }];
      for (let i = 0; i < numStreamsToCreate; i++) {
        const profile = profiles[(Math.floor(Math.random() * profiles.length) + i) % profiles.length], pt = ['low', 'medium', 'high'][Math.floor(Math.random() * 3)];
        let bw = pt === 'low' ? [10, 50, 100, 250, 500][Math.floor(Math.random() * 5)] : (pt === 'medium' ? [1000, 2000, 5000][Math.floor(Math.random() * 3)] : Math.floor(speedLimitMbps * (0.3 + Math.random() * 0.45)));
        if (bw > speedLimitMbps) bw = Math.floor(speedLimitMbps * 0.75);
        const sub = Math.floor(Math.random() * 254) + 1, vlan = String(Math.floor(Math.random() * 900) + 100);
        const gLabel = bw >= 1000 ? `${(bw / 1000).toFixed(1).replace('.0', '')} Gbps` : `${bw} Mbps`;
        addTrafficStream({ id: `t-${uuidv4()}`, name: numStreamsToCreate > 1 ? `${labelToUse} - Link ${i + 1} - ${profile.name} (${gLabel})` : `${labelToUse} - ${profile.name} (${gLabel})`, sourceNodeId: newNode.id, vlan, ipSrc: `192.168.${sub}.25`, ipDst: `10.10.${sub}.5`, portSrc: String(Math.floor(Math.random() * 50000) + 1024), portDst: profile.port, protocol: profile.proto, bandwidth: bw, active: true, drift: 1, lastDriftUpdate: 0 });
      }
    }
  }, [screenToFlowPosition, addNode, addTrafficStream, nodes, advancedMode, updateNodeData, edges, setEdges]);

  const onSelectionChange = useCallback(({ nodes }: { nodes: CustomNode[] }) => setSelectedNodeId(nodes.length === 1 ? nodes[0].id : null), [setSelectedNodeId]);

  // Checkpoint once at the start of a drag gesture (not per-pixel) so undo reverts
  // the whole move in one step rather than only its last increment.
  const onNodeDragStart = useCallback(() => pushHistory(), [pushHistory]);
  
  const selectedInputCount = nodes.filter(n => n.selected && n.type === 'inputNode').length;
  const selectedGroupCount = nodes.filter(n => n.selected && n.type === 'groupNode').length;
  const selectedEdges = edges.filter(e => e.selected);

  // TAP-M100T/M200T/M202ULT trays are auto-generated placement aids for Rack
  // View only (see traySync.ts) - they're real nodes so save/load and rack
  // placement keep working, but never appear on the canvas diagram itself.
  const canvasNodes = useMemo(
    () => nodes.filter(n => !(n.type === 'hardwareNode' && isAutoTrayModel(String(n.data?.model || '')))),
    [nodes],
  );

  return (
    <div className="canvas-wrapper" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={canvasNodes} edges={styledEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        onDrop={onDrop} onDragOver={onDragOver} onDragLeave={() => setHoveredEdgeId(null)}
        onSelectionChange={onSelectionChange} onNodeDragStart={onNodeDragStart}
        onNodeDoubleClick={(_, node) => { const s = useStore.getState(); s.setGlowingNodeId(s.glowingNodeId === node.id ? null : node.id); }}
        onPaneClick={() => useStore.getState().setGlowingNodeId(null)}
        deleteKeyCode={['Backspace', 'Delete']} nodeOrigin={[0.5, 0.5]} snapToGrid={snapToGrid} snapGrid={[15, 15]}
      >
        {showGrid && <Background variant={BackgroundVariant.Lines} color="rgba(255,255,255,0.06)" gap={15} size={1} />}
        <Controls />
        <Panel position="bottom-left" style={{ margin: '0 0 10px 48px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={snapAllNodesToGrid} title="Align all nodes to the nearest grid points" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, background: '#1e1e1e', border: '1px solid #333', borderRadius: '4px', color: '#00e5ff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.5)', transition: 'all 0.2s ease' }}><span>🧲</span> Snap All to Grid</button>
          <button onClick={tidyLayout} title="Re-arrange the whole topology into clean left-to-right columns by pipeline stage, so nodes of the same kind line up" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, background: '#1e1e1e', border: '1px solid #333', borderRadius: '4px', color: '#00e5ff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.5)', transition: 'all 0.2s ease' }}><span>📐</span> Tidy Layout</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1e1e1e', border: '1px solid #333', borderRadius: '4px', padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: exportDiagramMode ? '#00e5ff' : '#ccc', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.5)', userSelect: 'none', transition: 'all 0.2s ease' }}>
            <input type="checkbox" checked={exportDiagramMode} onChange={(e) => setExportDiagramMode(e.target.checked)} style={{ cursor: 'pointer', accentColor: '#00e5ff' }} /> Export Diagram Ready Mode
          </label>
        </Panel>
      </ReactFlow>

      <FederatedEnclosures nodes={nodes} edges={edges} onShowDashboard={() => setShowDashboard(true)} />
      {(selectedInputCount >= 2 || selectedGroupCount >= 1) && <GroupingBanner selectedInputCount={selectedInputCount} selectedGroupCount={selectedGroupCount} />}
      {selectedEdges.length > 0 && <EdgeBanner selectedEdges={selectedEdges} onDelete={() => onEdgesChange(selectedEdges.map(e => ({ id: e.id, type: 'remove' })))} topOffset={selectedInputCount >= 2 || selectedGroupCount >= 1} />}
      {showDashboard && <FederatedDashboard onClose={() => setShowDashboard(false)} />}
    </div>
  );
};

export default CanvasArea;
