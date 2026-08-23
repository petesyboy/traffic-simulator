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

      // 2. Downstream/upstream nodes closely connected to this site's nodes
      edges.forEach((e) => {
        if (siteNodeIds.has(e.source)) siteNodeIds.add(e.target);
        if (siteNodeIds.has(e.target)) siteNodeIds.add(e.source);
      });

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

export async function captureTopologyDiagramPng(): Promise<string> {
  const element = document.querySelector('.react-flow') as HTMLElement | null;
  if (!element) throw new Error('Canvas not found — switch to Canvas View before capturing a diagram.');

  return toPng(element, {
    backgroundColor: '#121212',
    cacheBust: true,
    filter: (node) => {
      if (
        node.classList?.contains('react-flow__controls') ||
        node.classList?.contains('react-flow__panel') ||
        node.classList?.contains('config-panel-toggle')
      ) {
        return false;
      }
      return true;
    },
  });
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

  if (originalView !== 'canvas') {
    useStore.getState().setActiveView('canvas');
  }
  // Ensure Export Diagram Ready Mode is turned on so descriptions and value propositions are included
  useStore.getState().setExportDiagramMode(true);
  useStore.setState((s) => ({ fitViewNodeIds: null, fitViewTrigger: s.fitViewTrigger + 1 }));

  // Wait for the view switch to mount CanvasArea, its own 100ms fitView timer,
  // and the fitView pan/zoom transition before capturing. A fixed delay is used
  // instead of requestAnimationFrame — rAF callbacks are throttled/suspended
  // while the tab is backgrounded, which would stall report generation
  // indefinitely if the user switches away while it's running.
  await new Promise((resolve) => setTimeout(resolve, 600));

  try {
    return await captureTopologyDiagramPng();
  } finally {
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

  if (originalView !== 'canvas') {
    useStore.getState().setActiveView('canvas');
  }
  useStore.getState().setExportDiagramMode(true);
  useStore.setState((s) => ({
    fitViewNodeIds: nodeIds,
    fitViewTrigger: s.fitViewTrigger + 1,
  }));

  await new Promise((resolve) => setTimeout(resolve, 500));

  try {
    return await captureTopologyDiagramPng();
  } finally {
    useStore.setState((s) => ({
      fitViewNodeIds: null,
      fitViewTrigger: s.fitViewTrigger + 1,
    }));
    if (originalView !== 'canvas') {
      useStore.getState().setActiveView(originalView);
    }
    useStore.getState().setExportDiagramMode(originalExportDiagramMode);
  }
}
