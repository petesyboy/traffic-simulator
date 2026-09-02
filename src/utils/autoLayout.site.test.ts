import { describe, it, expect } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { CustomNode } from '../store/types';
import { computeTidyLayout } from './autoLayout';

const node = (id: string, x: number, y: number, site?: string, overrides: Partial<CustomNode> = {}): CustomNode =>
  ({
    id,
    type: 'inputNode',
    position: { x, y },
    data: { label: id, site },
    ...overrides,
  }) as CustomNode;

const edge = (source: string, target: string): Edge => ({ id: `${source}-${target}`, source, target });

describe('computeTidyLayout — Site-Aware Multi-Site Layout', () => {
  it('groups equipment by data centre and separates them into non-overlapping vertical bands', () => {
    // Recreate a topology like the user's screenshot:
    // DC3: 4 SPAN ports -> TA25E
    // DC2: 4 SPAN ports -> TA200E
    // DC1: 2 SPAN ports -> TA200E -> HC1-Plus -> Tool
    // With cross-site links from DC3 TA25E -> DC1 HC1-Plus and DC2 TA200E -> DC1 HC1-Plus
    const nodes: CustomNode[] = [
      // DC3
      node('dc3-span1', 0, 0, 'DC3'),
      node('dc3-span2', 0, 50, 'DC3'),
      node('dc3-span3', 0, 100, 'DC3'),
      node('dc3-span4', 0, 150, 'DC3'),
      node('dc3-ta25', 100, 50, 'DC3', { type: 'hardwareNode' }),

      // DC2
      node('dc2-span1', 0, 300, 'DC2'),
      node('dc2-span2', 0, 350, 'DC2'),
      node('dc2-span3', 0, 400, 'DC2'),
      node('dc2-span4', 0, 450, 'DC2'),
      node('dc2-ta200', 100, 350, 'DC2', { type: 'hardwareNode' }),

      // DC1
      node('dc1-span1', 0, 600, 'DC1'),
      node('dc1-span2', 0, 650, 'DC1'),
      node('dc1-ta200', 100, 600, 'DC1', { type: 'hardwareNode' }),
      node('dc1-hc1p', 200, 600, 'DC1', { type: 'hardwareNode' }),
      node('dc1-tool', 300, 600, 'DC1', { type: 'toolNode' }),
    ];

    const edges: Edge[] = [
      // DC3 internal
      edge('dc3-span1', 'dc3-ta25'),
      edge('dc3-span2', 'dc3-ta25'),
      edge('dc3-span3', 'dc3-ta25'),
      edge('dc3-span4', 'dc3-ta25'),

      // DC2 internal
      edge('dc2-span1', 'dc2-ta200'),
      edge('dc2-span2', 'dc2-ta200'),
      edge('dc2-span3', 'dc2-ta200'),
      edge('dc2-span4', 'dc2-ta200'),

      // DC1 internal
      edge('dc1-span1', 'dc1-ta200'),
      edge('dc1-span2', 'dc1-ta200'),
      edge('dc1-ta200', 'dc1-hc1p'),
      edge('dc1-hc1p', 'dc1-tool'),

      // Inter-site links to DC1 core aggregation
      edge('dc3-ta25', 'dc1-hc1p'),
      edge('dc2-ta200', 'dc1-hc1p'),
    ];

    const result = computeTidyLayout(nodes, edges);

    const posMap = new Map(result.map((n) => [n.id, n.position]));

    // Find vertical bounds (minY, maxY) for each data centre
    const dc3Ys = result.filter((n) => n.data?.site === 'DC3').map((n) => n.position.y);
    const dc2Ys = result.filter((n) => n.data?.site === 'DC2').map((n) => n.position.y);
    const dc1Ys = result.filter((n) => n.data?.site === 'DC1').map((n) => n.position.y);

    const maxDc3Y = Math.max(...dc3Ys);
    const minDc2Y = Math.min(...dc2Ys), maxDc2Y = Math.max(...dc2Ys);
    const minDc1Y = Math.min(...dc1Ys);

    // DC3 and DC2 are upstream of DC1, so DC3 and DC2 sit above DC1
    expect(maxDc3Y).toBeLessThan(minDc2Y);
    expect(maxDc2Y).toBeLessThan(minDc1Y);

    // Check horizontal column alignment:
    // In DC3, all SPANs share the same column X, and TA25 is strictly downstream
    const dc3SpanX = posMap.get('dc3-span1')!.x;
    expect(posMap.get('dc3-span2')!.x).toBe(dc3SpanX);
    expect(posMap.get('dc3-span3')!.x).toBe(dc3SpanX);
    expect(posMap.get('dc3-span4')!.x).toBe(dc3SpanX);
    expect(posMap.get('dc3-ta25')!.x).toBeGreaterThan(dc3SpanX);

    // In DC2, all SPANs share the same column X, and TA200 is strictly downstream
    const dc2SpanX = posMap.get('dc2-span1')!.x;
    expect(dc2SpanX).toBe(dc3SpanX); // Aligned to global Col 0
    expect(posMap.get('dc2-ta200')!.x).toBeGreaterThan(dc2SpanX);

    // In DC1, SPANs -> TA200 -> HC1-Plus -> Tool follow strictly increasing X coordinates
    const dc1SpanX = posMap.get('dc1-span1')!.x;
    const dc1TaX = posMap.get('dc1-ta200')!.x;
    const dc1Hc1pX = posMap.get('dc1-hc1p')!.x;
    const dc1ToolX = posMap.get('dc1-tool')!.x;

    expect(dc1SpanX).toBe(dc3SpanX); // Aligned to global Col 0
    expect(dc1TaX).toBe(posMap.get('dc3-ta25')!.x); // Aligned to global Col 1
    expect(dc1Hc1pX).toBeGreaterThan(dc1TaX); // Col 2
    expect(dc1ToolX).toBeGreaterThan(dc1Hc1pX); // Col 3

    // Inter-site links from DC3 TA25 and DC2 TA200 flow forward (left-to-right) into DC1 HC1-Plus
    expect(posMap.get('dc3-ta25')!.x).toBeLessThan(posMap.get('dc1-hc1p')!.x);
    expect(posMap.get('dc2-ta200')!.x).toBeLessThan(posMap.get('dc1-hc1p')!.x);
  });

  it('infers site for an unassigned node when it only connects to equipment in that site', () => {
    const nodes: CustomNode[] = [
      node('dc1-in', 0, 0, 'DC1'),
      node('dc1-tool', 200, 0, 'DC1', { type: 'toolNode' }),
      // Unassigned node connected only to DC1
      node('dc1-tap', 100, 0, undefined, { type: 'hardwareNode' }),

      // Second site so multi-site layout activates
      node('dc2-in', 0, 300, 'DC2'),
      node('dc2-tool', 200, 300, 'DC2', { type: 'toolNode' }),
    ];

    const edges: Edge[] = [
      edge('dc1-in', 'dc1-tap'),
      edge('dc1-tap', 'dc1-tool'),
      edge('dc2-in', 'dc2-tool'),
    ];

    const result = computeTidyLayout(nodes, edges);
    const posMap = new Map(result.map((n) => [n.id, n.position]));

    const dc1InY = posMap.get('dc1-in')!.y;
    const dc1TapY = posMap.get('dc1-tap')!.y;
    const dc2InY = posMap.get('dc2-in')!.y;

    // The unassigned TAP should be clustered with DC1, not pushed into DC2
    expect(Math.abs(dc1TapY - dc1InY)).toBeLessThan(Math.abs(dc2InY - dc1InY));
  });

  it('is idempotent for multi-site topologies', () => {
    const nodes: CustomNode[] = [
      node('dc1-in', 0, 0, 'DC1'),
      node('dc1-ta', 100, 0, 'DC1', { type: 'hardwareNode' }),
      node('dc2-in', 0, 200, 'DC2'),
      node('dc2-ta', 100, 200, 'DC2', { type: 'hardwareNode' }),
    ];
    const edges: Edge[] = [
      edge('dc1-in', 'dc1-ta'),
      edge('dc2-in', 'dc2-ta'),
    ];

    const once = computeTidyLayout(nodes, edges);
    const twice = computeTidyLayout(once, edges);

    once.forEach((n, i) => {
      expect(twice[i].position).toEqual(n.position);
    });
  });
});
