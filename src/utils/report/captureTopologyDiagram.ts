/**
 * captureTopologyDiagram.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Captures the ReactFlow canvas as a PNG data URL. Shared by the header's PNG
 * screenshot export and the PDF report's embedded topology diagram, so both
 * use the exact same capture options.
 */
import { toPng } from 'html-to-image';

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
  if (originalView !== 'canvas') {
    useStore.getState().setActiveView('canvas');
  }
  useStore.setState((s) => ({ fitViewTrigger: s.fitViewTrigger + 1 }));

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
  }
}
