/**
 * captureTopologyDiagram.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Captures the ReactFlow canvas as a PNG data URL. Shared by the header's PNG
 * screenshot export and the PDF report's embedded topology diagram, so both
 * use the exact same capture options.
 */
import { toPng } from 'html-to-image';
import type { CustomNode } from '../../store/types';
import type { Edge } from '@xyflow/react';
import { isAutoTrayModel } from '../trayModels';
import { autoSpaceNodesForExport } from '../autoLayout';

export interface SiteDiagramPartition {
  siteName: string;
  nodeIds: string[];
}

export interface DiagramSplitJudgement {
  shouldSplit: boolean;
  reason?: string;
  partitions: SiteDiagramPartition[];
}

/**
 * Analyses diagram complexity and physical sites to judge whether a single
 * diagram will suffer from illegibility (text too small when scaled to A4)
 * and should be split into dedicated high-resolution per-site diagrams.
 */
export function detectDiagramSplitting(
  nodes: CustomNode[],
  edges: Edge[],
): DiagramSplitJudgement {
  const visibleNodes = nodes.filter(
    (n) => !(n.type === 'hardwareNode' && isAutoTrayModel(String(n.data?.model || ''))),
  );

  // Extract explicit physical sites
  const explicitSites = Array.from(
    new Set(
      visibleNodes
        .map((n) => (n.data?.site as string || '').trim())
        .filter(Boolean),
    ),
  );

  if (explicitSites.length >= 2) {
    const partitions: SiteDiagramPartition[] = [];

    explicitSites.forEach((siteName) => {
      const siteNodeIds = new Set<string>();

      // 1. Direct nodes assigned to this site
      visibleNodes.forEach((n) => {
        if ((n.data?.site as string || '').trim() === siteName) {
          siteNodeIds.add(n.id);
        }
      });

      // 2. Iteratively expand downstream/upstream nodes belonging to this site
      let expanded = true;
      while (expanded) {
        expanded = false;
        edges.forEach((e) => {
          const srcNode = visibleNodes.find((n) => n.id === e.source);
          const tgtNode = visibleNodes.find((n) => n.id === e.target);
          if (siteNodeIds.has(e.source) && tgtNode && !siteNodeIds.has(e.target)) {
            const tgtSite = (tgtNode.data?.site as string || '').trim();
            if (!tgtSite || tgtSite === siteName) {
              siteNodeIds.add(e.target);
              expanded = true;
            }
          }
          if (siteNodeIds.has(e.target) && srcNode && !siteNodeIds.has(e.source)) {
            const srcSite = (srcNode.data?.site as string || '').trim();
            if (!srcSite || srcSite === siteName) {
              siteNodeIds.add(e.source);
              expanded = true;
            }
          }
        });
      }

      partitions.push({
        siteName,
        nodeIds: Array.from(siteNodeIds),
      });
    });

    return {
      shouldSplit: true,
      reason: `Multi-site topology with ${explicitSites.length} physical sites detected. Splitting into focused per-site sub-diagrams ensures all text, port cages, and descriptions remain clear and legible.`,
      partitions,
    };
  }

  return {
    shouldSplit: false,
    partitions: [],
  };
}

export async function captureTopologyDiagramPng(
  allowedNodeIds?: Set<string>,
  allowedEdgeIds?: Set<string>,
): Promise<string> {
  const element = document.querySelector('.react-flow') as HTMLElement | null;
  if (!element) throw new Error('Canvas not found — switch to Canvas View before capturing a diagram.');

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const bgColor = isLight ? '#ffffff' : '#121212';

  return toPng(element, {
    backgroundColor: bgColor,
    cacheBust: true,
    pixelRatio: 3,
    filter: (domNode) => {
      if (
        domNode.classList?.contains('react-flow__controls') ||
        domNode.classList?.contains('react-flow__panel') ||
        domNode.classList?.contains('config-panel-toggle')
      ) {
        return false;
      }

      if (allowedNodeIds) {
        // Filter out nodes from other sites/partitions
        if (domNode.classList?.contains('react-flow__node')) {
          const id = domNode.getAttribute('data-id');
          if (id && !allowedNodeIds.has(id)) {
            return false;
          }
        }
        // Filter out edges not connecting within this partition
        if (domNode.classList?.contains('react-flow__edge')) {
          const edgeId =
            domNode.getAttribute('data-id') ||
            domNode.getAttribute('data-testid')?.replace(/^rf__edge-/, '');
          if (edgeId && allowedEdgeIds && !allowedEdgeIds.has(edgeId)) {
            return false;
          }
        }
      }

      return true;
    },
  });
}

import { isTapNode, isToolNode, buildClusterNode, collapseClusterNode } from '../clusterUtils';
import { NODE_TYPES } from '../../constants/nodeTypes';

/**
 * Prepares the canvas topology for high-resolution diagram screenshots:
 * 1. Collapses any existing expanded TAP or Tool cluster nodes into compact stacks.
 * 2. If there are more than 4 unclustered TAP modules, groups them into a collapsed TAP stack.
 * 3. If there are more than 4 unclustered Tool nodes, groups them into a collapsed Tool stack.
 * 4. Auto-spaces nodes vertically in columns to eliminate description box overlaps.
 */
export function prepareTopologyForDiagramCapture(
  nodes: CustomNode[],
  edges: Edge[],
): { nodes: CustomNode[]; edges: Edge[] } {
  let currentNodes = [...nodes];
  let currentEdges = [...edges];

  // 1. Collapse any existing cluster nodes that are currently in expanded state
  currentNodes.forEach((node) => {
    if (node.type === NODE_TYPES.CLUSTER && node.data?.isCollapsed === false) {
      const res = collapseClusterNode(node, currentNodes, currentEdges);
      currentNodes = res.nodes;
      currentEdges = res.edges;
    }
  });

  // 2. Check for unclustered visible TAP nodes (> 4)
  const visibleTaps = currentNodes.filter((n) => !n.hidden && isTapNode(n) && !n.data?.clusterId);
  if (visibleTaps.length > 4) {
    const { clusterNode, updatedNodes, updatedEdges } = buildClusterNode(visibleTaps, currentEdges, 'tap');
    const updatedIds = new Set(updatedNodes.map((n) => n.id));
    const restNodes = currentNodes.filter((n) => !updatedIds.has(n.id));
    currentNodes = [clusterNode, ...restNodes, ...updatedNodes];
    currentEdges = updatedEdges;
  }

  // 3. Check for unclustered visible Tool nodes (> 4)
  const visibleTools = currentNodes.filter((n) => !n.hidden && isToolNode(n) && !n.data?.clusterId);
  if (visibleTools.length > 4) {
    const { clusterNode, updatedNodes, updatedEdges } = buildClusterNode(visibleTools, currentEdges, 'tool');
    const updatedIds = new Set(updatedNodes.map((n) => n.id));
    const restNodes = currentNodes.filter((n) => !updatedIds.has(n.id));
    currentNodes = [clusterNode, ...restNodes, ...updatedNodes];
    currentEdges = updatedEdges;
  }

  // 4. Auto-space nodes vertically in columns to eliminate any description box overlaps
  currentNodes = autoSpaceNodesForExport(currentNodes);

  return { nodes: currentNodes, edges: currentEdges };
}

/**
 * Report-specific capture flow: makes sure the whole topology is framed and
 * visible in Canvas View before capturing, then restores whatever view the
 * user was on. Uses the store's imperative API (not hooks) so it can be
 * called from a plain async handler rather than needing to live inside a
 * component that's rendered under `<ReactFlowProvider>`.
 */
export async function captureTopologyDiagramForReport(): Promise<string> {
  // Imported lazily to avoid a circular import between store.ts and utils used by components.
  const { useStore } = await import('../../store/store');

  const originalView = useStore.getState().activeView;
  const originalExportDiagramMode = useStore.getState().exportDiagramMode;
  const originalNodes = useStore.getState().nodes;
  const originalEdges = useStore.getState().edges;

  if (originalView !== 'canvas') {
    useStore.getState().setActiveView('canvas');
  }
  // Ensure Export Diagram Ready Mode is turned on so descriptions and value propositions are included
  useStore.getState().setExportDiagramMode(true);

  // Auto-collapse TAPs and Tools (>4) into stacks and space nodes for diagram export
  const { nodes: preparedNodes, edges: preparedEdges } = prepareTopologyForDiagramCapture(originalNodes, originalEdges);
  useStore.setState((s) => ({
    nodes: preparedNodes,
    edges: preparedEdges,
    fitViewNodeIds: null,
    fitViewTrigger: s.fitViewTrigger + 1,
  }));

  // Wait for the view switch to mount CanvasArea, its own 100ms fitView timer,
  // and the fitView pan/zoom transition before capturing. A fixed delay is used
  // instead of requestAnimationFrame — rAF callbacks are throttled/suspended
  // while the tab is backgrounded, which would stall report generation
  // indefinitely if the user switches away while it's running.
  await new Promise((resolve) => setTimeout(resolve, 600));

  try {
    return await captureTopologyDiagramPng();
  } finally {
    useStore.setState({ nodes: originalNodes, edges: originalEdges });
    if (originalView !== 'canvas') {
      useStore.getState().setActiveView(originalView);
    }
    useStore.getState().setExportDiagramMode(originalExportDiagramMode);
  }
}

/**
 * Captures a zoomed-in, focused sub-diagram for a specific site or cluster of nodes.
 */
export async function captureSiteTopologyDiagramForReport(nodeIds: string[]): Promise<string> {
  const { useStore } = await import('../../store/store');

  const originalView = useStore.getState().activeView;
  const originalExportDiagramMode = useStore.getState().exportDiagramMode;
  const originalNodes = useStore.getState().nodes;
  const originalEdges = useStore.getState().edges;

  if (originalView !== 'canvas') {
    useStore.getState().setActiveView('canvas');
  }
  useStore.getState().setExportDiagramMode(true);

  const { nodes: preparedNodes, edges: preparedEdges } = prepareTopologyForDiagramCapture(originalNodes, originalEdges);

  // Re-map allowed node IDs in case individual nodes were clustered
  const allowedNodeIds = new Set<string>();
  nodeIds.forEach((id) => {
    const node = preparedNodes.find((n) => n.id === id);
    if (node) {
      if (node.hidden && node.data?.clusterId) {
        allowedNodeIds.add(node.data.clusterId as string);
      } else {
        allowedNodeIds.add(id);
      }
    }
  });

  useStore.setState((s) => ({
    nodes: preparedNodes,
    edges: preparedEdges,
    fitViewNodeIds: Array.from(allowedNodeIds),
    fitViewTrigger: s.fitViewTrigger + 1,
  }));

  const allowedEdgeIds = new Set(
    preparedEdges
      .filter((e) => allowedNodeIds.has(e.source) && allowedNodeIds.has(e.target))
      .map((e) => e.id),
  );

  await new Promise((resolve) => setTimeout(resolve, 600));

  try {
    return await captureTopologyDiagramPng(allowedNodeIds, allowedEdgeIds);
  } finally {
    useStore.setState((s) => ({
      nodes: originalNodes,
      edges: originalEdges,
      fitViewNodeIds: null,
      fitViewTrigger: s.fitViewTrigger + 1,
    }));
    if (originalView !== 'canvas') {
      useStore.getState().setActiveView(originalView);
    }
    useStore.getState().setExportDiagramMode(originalExportDiagramMode);
  }
}
