import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactFlowProvider } from '@xyflow/react';
import { SiteEnclosures } from './SiteEnclosures';
import type { CustomNode } from '../../store/types';

// Mock xyflow's useReactFlow to return deterministic bounding box
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    useReactFlow: () => ({
      getNodesBounds: (nodes: CustomNode[]) => {
        if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
        const xs = nodes.map((n) => n.position.x);
        const ys = nodes.map((n) => n.position.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        return { x: minX, y: minY, width: maxX - minX + 200, height: maxY - minY + 100 };
      },
    }),
  };
});

describe('SiteEnclosures', () => {
  it('renders nothing when enabled is false', () => {
    const nodes: CustomNode[] = [
      { id: '1', type: 'hardwareNode', position: { x: 0, y: 0 }, data: { label: 'TA25E', site: 'DC1' } } as CustomNode,
    ];
    const html = renderToStaticMarkup(
      <ReactFlowProvider>
        <SiteEnclosures nodes={nodes} enabled={false} />
      </ReactFlowProvider>
    );
    expect(html).toBe('');
  });

  it('renders nothing when no nodes have a site tag', () => {
    const nodes: CustomNode[] = [
      { id: '1', type: 'hardwareNode', position: { x: 0, y: 0 }, data: { label: 'TA25E' } } as CustomNode,
    ];
    const html = renderToStaticMarkup(
      <ReactFlowProvider>
        <SiteEnclosures nodes={nodes} enabled={true} />
      </ReactFlowProvider>
    );
    expect(html).toBe('');
  });

  it('renders styled data centre enclosures with British English labels and device counts', () => {
    const nodes: CustomNode[] = [
      { id: '1', type: 'hardwareNode', position: { x: 50, y: 50 }, data: { label: 'TA25E', site: 'DC3' } } as CustomNode,
      { id: '2', type: 'inputNode', position: { x: 0, y: 50 }, data: { label: 'SPAN 1', site: 'DC3' } } as CustomNode,
      { id: '3', type: 'hardwareNode', position: { x: 50, y: 300 }, data: { label: 'TA200E', site: 'DC1' } } as CustomNode,
    ];

    const html = renderToStaticMarkup(
      <ReactFlowProvider>
        <SiteEnclosures nodes={nodes} enabled={true} />
      </ReactFlowProvider>
    );

    // Verify British English spelling "Data Centre"
    expect(html).toContain('Data Centre: DC3');
    expect(html).toContain('Data Centre: DC1');
    expect(html).toContain('2 devices');
    expect(html).toContain('1 device');
    expect(html).toContain('site-enclosure');
    expect(html).toContain('site-enclosure-header');
  });
});
