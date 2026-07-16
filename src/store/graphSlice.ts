import { 
  addEdge, 
  applyNodeChanges, 
  applyEdgeChanges, 
  type Connection, 
  type Edge, 
  type NodeChange, 
  type EdgeChange 
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { type StateCreator } from 'zustand';
import { type RFState, type CustomNode, type AnyNodeData, type HardwareNodeData, type InputNodeData } from './types';
import { syncSplunkLabels, performDuplicateSolution, initialNodes, initialEdges } from './storeHelpers';
import { syncOpticsOnTapConnection } from '../utils/bomEngine';
import { NODE_TYPES } from '../constants/nodeTypes';

export interface GraphSlice {
  nodes: CustomNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  glowingNodeId: string | null;
  draggedNodeType: string | null;
  showGrid: boolean;
  snapToGrid: boolean;
  exportDiagramMode: boolean;
  fitViewTrigger: number;

  onNodesChange: (changes: NodeChange<CustomNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setEdges: (edges: Edge[]) => void;
  setDraggedNodeType: (type: string | null) => void;
  addNode: (node: CustomNode) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setGlowingNodeId: (nodeId: string | null) => void;
  updateNodeData: (nodeId: string, data: Partial<AnyNodeData>) => void;
  setShowGrid: (show: boolean) => void;
  setSnapToGrid: (snap: boolean) => void;
  setExportDiagramMode: (val: boolean) => void;
  snapAllNodesToGrid: () => void;
  clearCanvas: () => void;
  groupSelectedNodes: () => void;
  ungroupGroup: (groupId: string) => void;
  duplicateSolution: (newSiteName: string) => void;
}

export const createGraphSlice: StateCreator<RFState, [], [], GraphSlice> = (set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  selectedNodeId: null,
  glowingNodeId: null,
  draggedNodeType: null,
  showGrid: true,
  snapToGrid: false,
  exportDiagramMode: false,
  fitViewTrigger: 0,

  onNodesChange: (changes) => {
    let nextNodes = applyNodeChanges<CustomNode>(changes, get().nodes);
    const deletedNodeIds = changes
      .filter((c) => c.type === 'remove')
      .map((c) => (c as { id: string }).id);

    const deletedGroupNodeIds = deletedNodeIds.filter((id) => id.includes('group'));

    if (deletedGroupNodeIds.length > 0) {
      nextNodes = nextNodes.map((node) => {
        if (node.parentId && deletedGroupNodeIds.includes(node.parentId)) {
          const parentNode = get().nodes.find((n) => n.id === node.parentId);
          const parentX = parentNode?.position.x || 0;
          const parentY = parentNode?.position.y || 0;

          return {
            ...node,
            parentId: undefined,
            position: {
              x: node.position.x + parentX,
              y: node.position.y + parentY,
            },
            extent: undefined,
          };
        }
        return node;
      });
    }

    if (deletedNodeIds.length > 0) {
      const nextTraffic = get().trafficStreams.filter(
        (s) => !deletedNodeIds.includes(s.sourceNodeId)
      );
      set({ nodes: nextNodes, trafficStreams: nextTraffic });
    } else {
      set({ nodes: nextNodes });
    }
  },

  onEdgesChange: (changes) => {
    const nextEdges = applyEdgeChanges(changes, get().edges);
    let syncedNodes = syncSplunkLabels(get().nodes, nextEdges);
    syncedNodes = syncOpticsOnTapConnection(syncedNodes, nextEdges);
    set({ edges: nextEdges, nodes: syncedNodes });
  },

  onConnect: (connection) => {
    const nodeA = get().nodes.find(n => n.id === connection.source);
    const nodeB = get().nodes.find(n => n.id === connection.target);
    if (!nodeA || !nodeB) return;

    // Block TA appliances from connecting directly to a GigaSMART node — TAs have no GigaSMART engine.
    if (nodeB.type === NODE_TYPES.GIGASMART && nodeA.type === 'hardwareNode') {
      const model = String((nodeA.data as HardwareNodeData)?.model || '');
      const modelLower = model.toLowerCase();
      const hasGigaSmartEngine = modelLower.includes('hc1') || modelLower.includes('hc3') || modelLower.includes('hct');
      if (!hasGigaSmartEngine) {
        window.alert(`🚫 CONNECTION REFUSED: ${model || 'This appliance'} is a Traffic Aggregator and does not have a GigaSMART engine. GigaSMART functions (dedup, slicing, SSL decrypt, etc.) require a GigaVUE-HC series chassis.`);
        return;
      }
    }

    if (nodeA.data?.site && nodeB.data?.site && nodeA.data.site !== nodeB.data.site) {
      window.alert(`⚠️ WARNING: You are connecting a node in Site "${nodeA.data.site}" to a node in Site "${nodeB.data.site}". Cross-site links require long-haul optical connections (e.g. dark fiber). Ensure this is intentional.`);
    }

    const sourceNode = (nodeA.type === 'hardwareNode' && String((nodeA.data as HardwareNodeData)?.model || '').includes('TAP')) || (nodeA.type === 'inputNode' && (nodeA.data as InputNodeData)?.configType === 'Network Tap') ? nodeA : ((nodeB.type === 'hardwareNode' && String((nodeB.data as HardwareNodeData)?.model || '').includes('TAP')) || (nodeB.type === 'inputNode' && (nodeB.data as InputNodeData)?.configType === 'Network Tap') ? nodeB : null);
    const targetNode = sourceNode === nodeA ? nodeB : (sourceNode === nodeB ? nodeA : null);

    if (sourceNode && targetNode && targetNode.type === 'hardwareNode' && (String((targetNode.data as HardwareNodeData)?.model || '').includes('HC') || String((targetNode.data as HardwareNodeData)?.model || '').includes('TA'))) {
      const srcData = sourceNode.data as HardwareNodeData & InputNodeData;
      const tgtData = targetNode.data as HardwareNodeData;
      const tapSku = String(srcData.sku || '');
      const tapModel = String(srcData.model || '');
      const targetModel = String(tgtData.model || '');
      
      const isCopperTap = tapSku.includes('ATX') || tapModel.toLowerCase().includes('copper') || String(srcData.tappedLinkOptic || '').toLowerCase().includes('copper');
      
      if (isCopperTap && (targetModel.includes('TA200') || targetModel.includes('TA400'))) {
        window.alert(`🚫 CONNECTION REFUSED: ${targetModel} appliances do not support Copper (10GBASE-T / 1000BASE-T) transceivers due to power and thermal constraints.`);
        return;
      }

      const isSMTap = tapSku.includes('253') || tapSku.includes('273') || tapSku.includes('453') || tapModel.toLowerCase().includes('single-mode') || tapModel.toLowerCase().includes('sm') || tapModel.includes('253T') || tapModel.includes('273T') || tapModel.includes('453T');
      const defaultOptic = isSMTap ? 'SFP-533' : 'SFP-532';
      let selectedOpticVal = (srcData.tappedLinkOptic as string) || defaultOptic;
      if (String(srcData.model || '').includes('TAP-M506T') || String(srcData.sku || '').includes('TAP-M506T')) selectedOpticVal = 'QSB-523T';

      if (selectedOpticVal.includes('SFP') && (targetModel.includes('TA200') || targetModel.includes('TA400'))) {
        window.alert(`🚫 CONNECTION REFUSED: ${targetModel} appliances only feature high-speed QSFP+/QSFP28 cages.`);
        return;
      }
      
      const tapFiber = isSMTap ? 'Singlemode' : 'Multimode';
      const installedOptics = (tgtData.optics as { board: string, optic: string, qty: number }[]) || [];
      let mmCount = 0, smCount = 0;
      installedOptics.forEach(opt => {
        const name = opt.optic.toUpperCase();
        if (name.includes('SR') || name.includes('SX') || name.includes('SWDM') || name.includes('FX')) mmCount += opt.qty;
        else if (name.includes('LR') || name.includes('LX') || name.includes('ER') || name.includes('PLR') || name.includes('DR1') || name.includes('CWDM') || name.includes('FR')) smCount += opt.qty;
      });

      const requiredOptics = ((srcData.tappedLinksCount as number) ?? 1) * 2;
      let msg = '';
      if (tapFiber === 'Multimode' && mmCount < requiredOptics) msg = `Suggested and installed ${requiredOptics - mmCount} x ${selectedOpticVal} multi-mode optics in ${targetModel} to support the connection from ${srcData.label || 'TAP'}.`;
      else if (tapFiber === 'Singlemode' && smCount < requiredOptics) msg = `Suggested and installed ${requiredOptics - smCount} x ${selectedOpticVal} single-mode optics in ${targetModel} to support the connection from ${srcData.label || 'TAP'}.`;
      if (msg) set({ sidebarMessage: msg });
    }

    const isDuplicate = get().edges.some(
      (e) =>
        e.source === connection.source &&
        e.target === connection.target &&
        e.sourceHandle === connection.sourceHandle &&
        e.targetHandle === connection.targetHandle
    );
    if (isDuplicate) return;

    const nextEdges = addEdge({ ...connection, id: `e-${uuidv4()}` }, get().edges);
    set({ edges: nextEdges, nodes: syncOpticsOnTapConnection(syncSplunkLabels(get().nodes, nextEdges), nextEdges) });
  },

  setEdges: (edges) => set({ edges, nodes: syncOpticsOnTapConnection(syncSplunkLabels(get().nodes, edges), edges) }),
  setDraggedNodeType: (type) => set({ draggedNodeType: type }),
  addNode: (node) => set({ nodes: [...get().nodes, node] }),
  setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),
  setGlowingNodeId: (nodeId) => set({ glowingNodeId: nodeId }),
  updateNodeData: (nodeId, data) => {
    const updatedNodes = get().nodes.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node);
    let syncedNodes = syncSplunkLabels(updatedNodes, get().edges);
    if (data.optics === undefined) syncedNodes = syncOpticsOnTapConnection(syncedNodes, get().edges);
    set({ nodes: syncedNodes });
  },
  setShowGrid: (show) => set({ showGrid: show }),
  setSnapToGrid: (snap) => set({ snapToGrid: snap }),
  setExportDiagramMode: (val) => set({ exportDiagramMode: val }),
  snapAllNodesToGrid: () => set({ nodes: get().nodes.map((node) => ({ ...node, position: { x: Math.round(node.position.x / 15) * 15, y: Math.round(node.position.y / 15) * 15 } })) }),
  clearCanvas: () => set({ nodes: [], edges: [], selectedNodeId: null, isRunning: false, activeEdges: [], blockedEdges: [], encryptedEdges: [], decryptedEdges: [], trafficStreams: [], deliveredStreams: [], uniqueEgressMbps: 0 }),
  groupSelectedNodes: () => {
    const selectedNodes = get().nodes.filter((n) => n.selected && n.type === NODE_TYPES.INPUT);
    if (selectedNodes.length < 2) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    selectedNodes.forEach((node) => { const { x, y } = node.position; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); });
    const pX = minX - 25, pY = minY - 45, gId = `group-${uuidv4()}`;
    const groupNode: CustomNode = { id: gId, type: 'groupNode', position: { x: pX, y: pY }, style: { width: (maxX - minX) + 220, height: (maxY - minY) + 145 }, data: { label: 'Port Group', configType: 'Port Group' } };
    const updatedNodes = get().nodes.map((node) => (node.selected && node.type === NODE_TYPES.INPUT) ? { ...node, parentId: gId, position: { x: node.position.x - pX, y: node.position.y - pY }, extent: 'parent' as const, selected: false } : node);
    set({ nodes: [groupNode, ...updatedNodes] });
  },
  ungroupGroup: (groupId) => {
    const parentNode = get().nodes.find((n) => n.id === groupId);
    if (!parentNode) return;
    const { x: pX, y: pY } = parentNode.position;
    let updatedNodes = get().nodes.map((node) => node.parentId === groupId ? { ...node, parentId: undefined, position: { x: node.position.x + pX, y: node.position.y + pY }, extent: undefined } : node).filter((n) => n.id !== groupId);
    const updatedEdges = get().edges.filter((edge) => edge.source !== groupId && edge.target !== groupId);
    set({ nodes: syncSplunkLabels(updatedNodes, updatedEdges), edges: updatedEdges, selectedNodeId: get().selectedNodeId === groupId ? null : get().selectedNodeId });
  },
  duplicateSolution: (newSiteName) => {
    const result = performDuplicateSolution(newSiteName, get().nodes, get().edges, get().trafficStreams);
    if (result) set({ nodes: result.nodes, edges: result.edges, trafficStreams: result.trafficStreams, fitViewTrigger: get().fitViewTrigger + 1 });
  },
});
