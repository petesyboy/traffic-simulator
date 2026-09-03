import { describe, it, expect } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { CustomNode } from '../store/types';
import { computeTidyLayout, optimizeDwdmEdgeHandles } from './autoLayout';

const node = (id: string, x: number, y: number, site?: string, overrides: Record<string, any> = {}): CustomNode =>
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

    const maxDc3Y = Math.max(...dc3Ys);
    const minDc2Y = Math.min(...dc2Ys);

    // DC3 and DC2 are upstream of DC1, so DC3 and DC2 sit on the West side stacked vertically,
    // and DC1 sits downstream on the East side
    expect(maxDc3Y).toBeLessThan(minDc2Y);

    // Check horizontal column alignment within each site's local coordinate space:
    // In DC3, all SPANs share the same column X, and TA25 is strictly downstream
    const dc3SpanX = posMap.get('dc3-span1')!.x;
    expect(posMap.get('dc3-span2')!.x).toBe(dc3SpanX);
    expect(posMap.get('dc3-span3')!.x).toBe(dc3SpanX);
    expect(posMap.get('dc3-span4')!.x).toBe(dc3SpanX);
    expect(posMap.get('dc3-ta25')!.x).toBeGreaterThan(dc3SpanX);

    // In DC2, all SPANs share the same column X, and TA200 is strictly downstream
    const dc2SpanX = posMap.get('dc2-span1')!.x;
    expect(posMap.get('dc2-span2')!.x).toBe(dc2SpanX);
    expect(posMap.get('dc2-span3')!.x).toBe(dc2SpanX);
    expect(posMap.get('dc2-span4')!.x).toBe(dc2SpanX);
    expect(posMap.get('dc2-ta200')!.x).toBeGreaterThan(dc2SpanX);

    // In DC1, SPANs -> TA200 -> HC1-Plus -> Tool follow strictly increasing local X coordinates
    const dc1SpanX = posMap.get('dc1-span1')!.x;
    const dc1TaX = posMap.get('dc1-ta200')!.x;
    const dc1Hc1pX = posMap.get('dc1-hc1p')!.x;
    const dc1ToolX = posMap.get('dc1-tool')!.x;

    expect(posMap.get('dc1-span2')!.x).toBe(dc1SpanX);
    expect(dc1TaX).toBeGreaterThan(dc1SpanX);
    expect(dc1Hc1pX).toBeGreaterThan(dc1TaX);
    expect(dc1ToolX).toBeGreaterThan(dc1Hc1pX);

    // DC1 is downstream on the East side, so DC1 sits to the right of upstream West sites
    expect(dc1SpanX).toBeGreaterThan(posMap.get('dc3-ta25')!.x);
    expect(dc1SpanX).toBeGreaterThan(posMap.get('dc2-ta200')!.x);
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

  it('positions DWDM network hub in central channel between West and East sites without overlapping site enclosures', () => {
    // 3 data centres (DC3, DC2, DC1) interconnected via a central DWDM transport network
    const nodes: CustomNode[] = [
      // DC3
      node('dc3-in', 0, 0, 'DC3'),
      node('dc3-ta', 100, 0, 'DC3', { type: 'hardwareNode' }),

      // DC2
      node('dc2-in', 0, 300, 'DC2'),
      node('dc2-ta', 100, 300, 'DC2', { type: 'hardwareNode' }),

      // DC1
      node('dc1-in', 0, 600, 'DC1'),
      node('dc1-hc', 200, 600, 'DC1', { type: 'hardwareNode' }),

      // DWDM Optical Transport Network (connects DC3 & DC2 to DC1)
      node('dwdm-ring', 150, 400, undefined, {
        type: 'dwdmNetworkNode',
        width: 280,
        height: 135,
        data: { label: 'DWDM Transport Network', wavelengthSpeed: '100G', protectionMode: 'Protected Ring (1+1)' },
      }),
    ];

    const edges: Edge[] = [
      edge('dc3-in', 'dc3-ta'),
      edge('dc2-in', 'dc2-ta'),
      edge('dc1-in', 'dc1-hc'),

      // Cross-site WAN connections through DWDM
      edge('dc3-ta', 'dwdm-ring'),
      edge('dc2-ta', 'dwdm-ring'),
      edge('dwdm-ring', 'dc1-hc'),
    ];

    const result = computeTidyLayout(nodes, edges);
    const posMap = new Map(result.map((n) => [n.id, n.position]));

    const dwdmX = posMap.get('dwdm-ring')!.x;
    const dwdmY = posMap.get('dwdm-ring')!.y;
    const dwdmWidth = 280;
    const dwdmHeight = 135;
    const dwdmBottom = dwdmY + dwdmHeight;

    // Upstream sites (DC3, DC2) sit West of DWDM; downstream site (DC1) sits East of DWDM
    const westMaxX = Math.max(
      posMap.get('dc3-ta')!.x + 220,
      posMap.get('dc2-ta')!.x + 220,
    );
    const eastMinX = Math.min(posMap.get('dc1-in')!.x, posMap.get('dc1-hc')!.x);

    expect(dwdmX).toBeGreaterThanOrEqual(westMaxX);
    expect(dwdmX + dwdmWidth).toBeLessThanOrEqual(eastMinX);

    // Verify 2D non-overlap with all site enclosures
    ['DC3', 'DC2', 'DC1'].forEach((site) => {
      const siteNodes = result.filter((n) => n.data?.site === site);
      const siteMinX = Math.min(...siteNodes.map((n) => n.position.x));
      const siteMaxX = Math.max(...siteNodes.map((n) => n.position.x + 220));
      const siteMinY = Math.min(...siteNodes.map((n) => n.position.y));
      const siteMaxY = Math.max(...siteNodes.map((n) => n.position.y + 80));

      const overlapsX = Math.max(dwdmX, siteMinX) < Math.min(dwdmX + dwdmWidth, siteMaxX);
      const overlapsY = Math.max(dwdmY, siteMinY) < Math.min(dwdmBottom, siteMaxY);
      expect(overlapsX && overlapsY).toBe(false);
    });

    // Idempotency with DWDM hub present
    const twice = computeTidyLayout(result, edges);
    result.forEach((n, i) => {
      expect(twice[i].position).toEqual(n.position);
    });
  });

  it('confines flow direction propagation to its own site without bleeding through DWDM hub', () => {
    const nodes: CustomNode[] = [
      // DC3: locked RTL on a tool node
      node('dc3-tap', 0, 0, 'DC3'),
      node('dc3-ta', 100, 0, 'DC3', { type: 'hardwareNode' }),
      node('dc3-tool', 200, 0, 'DC3', {
        type: 'toolNode',
        data: { flowDirection: 'rtl', flowDirectionLocked: true, site: 'DC3' },
      }),

      // DWDM hub
      node('dwdm-ring', 300, 100, undefined, {
        type: 'dwdmNetworkNode',
        width: 280,
        height: 135,
      }),

      // DC1: unconfigured flow direction (should remain LTR, not infected by DC3's RTL)
      node('dc1-tap', 0, 300, 'DC1'),
      node('dc1-ta', 100, 300, 'DC1', { type: 'hardwareNode' }),
    ];

    const edges: Edge[] = [
      edge('dc3-tap', 'dc3-ta'),
      edge('dc3-ta', 'dc3-tool'),
      edge('dc3-ta', 'dwdm-ring'),
      edge('dwdm-ring', 'dc1-ta'),
      edge('dc1-tap', 'dc1-ta'),
    ];

    const result = computeTidyLayout(nodes, edges);
    const dc1Tap = result.find((n) => n.id === 'dc1-tap')!;
    const dc1Ta = result.find((n) => n.id === 'dc1-ta')!;

    // DC1 TAP (source) must remain to the left of DC1 TA (downstream)
    expect(dc1Tap.position.x).toBeLessThan(dc1Ta.position.x);
    // DC1 must not have flowDirection set to RTL
    expect(dc1Tap.data?.flowDirection).not.toBe('rtl');
  });

  it('greedily balances sites by node count on bidirectional DWDM rings', () => {
    // 3 sites on a bidirectional ring: DC1 has 14 nodes, DC2 has 7 nodes, DC3 has 7 nodes
    const nodes: CustomNode[] = [];
    const edges: Edge[] = [];

    // DC1 (14 nodes)
    for (let i = 0; i < 14; i++) {
      nodes.push(node(`dc1-n${i}`, 0, i * 40, 'DC1'));
    }
    // DC2 (7 nodes)
    for (let i = 0; i < 7; i++) {
      nodes.push(node(`dc2-n${i}`, 100, i * 40, 'DC2'));
    }
    // DC3 (7 nodes)
    for (let i = 0; i < 7; i++) {
      nodes.push(node(`dc3-n${i}`, 200, i * 40, 'DC3'));
    }

    const dwdm = node('dwdm-ring', 150, 0, undefined, {
      type: 'dwdmNetworkNode',
      width: 280,
      height: 135,
    });
    nodes.push(dwdm);

    // Bidirectional connections between all sites and DWDM
    ['dc1-n0', 'dc2-n0', 'dc3-n0'].forEach((chassisId) => {
      edges.push(edge(chassisId, 'dwdm-ring'));
      edges.push(edge('dwdm-ring', chassisId));
    });

    const result = computeTidyLayout(nodes, edges);
    const posMap = new Map(result.map((n) => [n.id, n.position]));

    const dc1X = posMap.get('dc1-n0')!.x;
    const dwdmX = posMap.get('dwdm-ring')!.x;
    const dc2X = posMap.get('dc2-n0')!.x;
    const dc3X = posMap.get('dc3-n0')!.x;

    // DC1 (14 nodes) is placed West of DWDM
    expect(dc1X).toBeLessThan(dwdmX);
    // DC2 (7 nodes) and DC3 (7 nodes) are placed East of DWDM (14 vs 14 balance)
    expect(dc2X).toBeGreaterThan(dwdmX);
    expect(dc3X).toBeGreaterThan(dwdmX);
  });

  it('correctly derives column rank for bidirectional rings without collapsing to column 0', () => {
    // Bidirectional ring where DC1 chassis connects to DWDM and DWDM connects back to DC1 chassis
    const nodes: CustomNode[] = [
      node('dc2-ta', 100, 0, 'DC2', { type: 'hardwareNode' }),
      node('dc1-ta', 100, 300, 'DC1', { type: 'hardwareNode' }),
      node('dwdm-ring', 0, 0, undefined, {
        type: 'dwdmNetworkNode',
        width: 280,
        height: 135,
        data: { label: 'DWDM Ring' },
      }),
    ];

    const edges: Edge[] = [
      edge('dc2-ta', 'dwdm-ring'),
      edge('dwdm-ring', 'dc2-ta'),
      edge('dc1-ta', 'dwdm-ring'),
      edge('dwdm-ring', 'dc1-ta'),
    ];

    const result = computeTidyLayout(nodes, edges);
    const posMap = new Map(result.map((n) => [n.id, n.position]));

    const dc1X = posMap.get('dc1-ta')!.x;
    const dc2X = posMap.get('dc2-ta')!.x;
    const dwdmX = posMap.get('dwdm-ring')!.x;

    // DWDM is positioned in the central channel between the two peer sites without collapsing or colliding
    expect(Math.min(dc1X, dc2X)).toBeLessThan(dwdmX);
    expect(Math.max(dc1X, dc2X)).toBeGreaterThan(dwdmX);
  });

  it('assigns directional handles on DWDM node based on relative node geometry', () => {
    const dwdm = node('dwdm', 200, 300, undefined, {
      type: 'dwdmNetworkNode',
      width: 280,
      height: 135,
    });
    // Node clearly above DWDM
    const aboveNode = node('above', 200, 50, 'DC3', { type: 'hardwareNode' });
    // Node clearly below DWDM
    const belowNode = node('below', 200, 600, 'DC1', { type: 'hardwareNode' });
    // Node clearly to the left of DWDM
    const leftNode = node('left', 0, 300, 'DC2', { type: 'hardwareNode' });
    // Node clearly to the right of DWDM
    const rightNode = node('right', 600, 300, 'DC1', { type: 'hardwareNode' });

    const edges: Edge[] = [
      edge('above', 'dwdm'),
      edge('below', 'dwdm'),
      edge('left', 'dwdm'),
      edge('dwdm', 'right'),
      edge('dwdm', 'above'),
    ];

    const optimized = optimizeDwdmEdgeHandles([dwdm, aboveNode, belowNode, leftNode, rightNode], edges);
    const edgeMap = new Map(optimized.map((e) => [e.id, e]));

    // Incoming from above enters top handle
    expect(edgeMap.get('above-dwdm')?.targetHandle).toBe('in-top');
    // Incoming from below enters bottom handle
    expect(edgeMap.get('below-dwdm')?.targetHandle).toBe('in-bottom');
    // Incoming from left enters left handle
    expect(edgeMap.get('left-dwdm')?.targetHandle).toBe('in-left');
    // Outgoing to right leaves from right handle
    expect(edgeMap.get('dwdm-right')?.sourceHandle).toBe('out-right');
    // Outgoing to above leaves from top handle
    expect(edgeMap.get('dwdm-above')?.sourceHandle).toBe('out-top');
  });

  it('keeps site-assigned DWDM gateway inside its site and ranks it downstream of local chassis', () => {
    const nodes: CustomNode[] = [
      node('dc1-span', 0, 0, 'DC1'),
      node('dc1-ta', 100, 0, 'DC1', { type: 'hardwareNode' }),
      node('dc1-dwdm', 200, 0, 'DC1', { type: 'dwdmNetworkNode' }),
      node('dc2-span', 0, 200, 'DC2'),
      node('dc2-ta', 100, 200, 'DC2', { type: 'hardwareNode' }),
      node('dc2-dwdm', 200, 200, 'DC2', { type: 'dwdmNetworkNode' }),
    ];
    const edges: Edge[] = [
      edge('dc1-span', 'dc1-ta'),
      edge('dc1-ta', 'dc1-dwdm'),
      edge('dc2-span', 'dc2-ta'),
      edge('dc2-ta', 'dc2-dwdm'),
      edge('dc1-dwdm', 'dc2-dwdm'),
    ];

    const result = computeTidyLayout(nodes, edges);
    const posMap = new Map(result.map((n) => [n.id, n.position]));

    // dc1-dwdm ranks downstream of dc1-ta
    expect(posMap.get('dc1-dwdm')!.x).toBeGreaterThan(posMap.get('dc1-ta')!.x);
    expect(posMap.get('dc1-ta')!.x).toBeGreaterThan(posMap.get('dc1-span')!.x);

    // dc2-dwdm ranks downstream of dc2-ta
    expect(posMap.get('dc2-dwdm')!.x).toBeGreaterThan(posMap.get('dc2-ta')!.x);
    expect(posMap.get('dc2-ta')!.x).toBeGreaterThan(posMap.get('dc2-span')!.x);
  });

  it('lays out 3 interconnected sites with per-site DWDM gateways in a 2D triangular topology', () => {
    // Top-centre DC3, bottom-left DC1, bottom-right DC2
    const nodes: CustomNode[] = [
      // DC3 placed highest up
      node('dc3-span', 200, 50, 'DC3'),
      node('dc3-ta', 300, 50, 'DC3', { type: 'hardwareNode' }),
      node('dc3-dwdm', 400, 50, 'DC3', { type: 'dwdmNetworkNode' }),

      // DC1 placed lower-left
      node('dc1-span', 0, 400, 'DC1'),
      node('dc1-ta', 100, 400, 'DC1', { type: 'hardwareNode' }),
      node('dc1-dwdm', 200, 400, 'DC1', { type: 'dwdmNetworkNode' }),

      // DC2 placed lower-right
      node('dc2-span', 500, 400, 'DC2'),
      node('dc2-ta', 600, 400, 'DC2', { type: 'hardwareNode' }),
      node('dc2-dwdm', 700, 400, 'DC2', { type: 'dwdmNetworkNode' }),
    ];

    const edges: Edge[] = [
      // Intra-site feeds
      edge('dc3-span', 'dc3-ta'),
      edge('dc3-ta', 'dc3-dwdm'),
      edge('dc1-span', 'dc1-ta'),
      edge('dc1-ta', 'dc1-dwdm'),
      edge('dc2-span', 'dc2-ta'),
      edge('dc2-ta', 'dc2-dwdm'),

      // Inter-site DWDM triangle
      edge('dc3-dwdm', 'dc1-dwdm'),
      edge('dc1-dwdm', 'dc2-dwdm'),
      edge('dc2-dwdm', 'dc3-dwdm'),
    ];

    const result = computeTidyLayout(nodes, edges);
    const posMap = new Map(result.map((n) => [n.id, n.position]));

    // DC3 is North (top): its Y coordinate is strictly less than DC1 and DC2
    const dc3Y = posMap.get('dc3-span')!.y;
    const dc1Y = posMap.get('dc1-span')!.y;
    const dc2Y = posMap.get('dc2-span')!.y;

    expect(dc3Y).toBeLessThan(dc1Y);
    expect(dc3Y).toBeLessThan(dc2Y);

    // DC1 (South-West) is strictly to the left of DC2 (South-East)
    const dc1SpanX = posMap.get('dc1-span')!.x;
    const dc2SpanX = posMap.get('dc2-span')!.x;
    expect(dc1SpanX).toBeLessThan(dc2SpanX);

    // DC1 and DC2 sit on the bottom row at the same Y level
    expect(dc1Y).toBe(dc2Y);

    // Test handle optimization for the triangular DWDM mesh
    const optimized = optimizeDwdmEdgeHandles(result, edges);
    const edgeMap = new Map(optimized.map((e) => [e.id, e]));

    // DC1 DWDM to DC2 DWDM runs left-to-right across the bottom
    expect(edgeMap.get('dc1-dwdm-dc2-dwdm')?.sourceHandle).toBe('out-right');
    expect(edgeMap.get('dc1-dwdm-dc2-dwdm')?.targetHandle).toBe('in-left');
  });
});
