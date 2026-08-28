import { describe, it, expect } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { CustomNode } from '../store/types';
import { computeTidyLayout, autoSpaceNodesForExport } from './autoLayout';

const node = (id: string, x: number, y: number, overrides: Partial<CustomNode> = {}): CustomNode =>
  ({
    id,
    type: 'inputNode',
    position: { x, y },
    data: { label: id },
    ...overrides,
  }) as CustomNode;

const edge = (source: string, target: string): Edge => ({ id: `${source}-${target}`, source, target });

describe('computeTidyLayout', () => {
  it('lines up a simple linear pipeline into strictly increasing columns', () => {
    const nodes = [node('in', 500, 500), node('map', 10, 900), node('tool', 900, 10)];
    const edges = [edge('in', 'map'), edge('map', 'tool')];
    const result = computeTidyLayout(nodes, edges);

    const x = Object.fromEntries(result.map((n) => [n.id, n.position.x]));
    expect(x.in).toBeLessThan(x.map);
    expect(x.map).toBeLessThan(x.tool);
  });

  it('puts same-stage nodes in the same column (identical x)', () => {
    // Two inputs both feeding the same map node are the same pipeline stage.
    const nodes = [node('in1', 0, 0), node('in2', 0, 500), node('map', 999, 0)];
    const edges = [edge('in1', 'map'), edge('in2', 'map')];
    const result = computeTidyLayout(nodes, edges);

    const x = Object.fromEntries(result.map((n) => [n.id, n.position.x]));
    expect(x.in1).toBe(x.in2);
    expect(x.in1).toBeLessThan(x.map);
  });

  it('does not overlap nodes stacked in the same column', () => {
    const nodes = [
      node('in1', 0, 0),
      node('in2', 0, 0),
      node('in3', 0, 0),
      node('tool', 999, 0),
    ];
    const edges = [edge('in1', 'tool'), edge('in2', 'tool'), edge('in3', 'tool')];
    const result = computeTidyLayout(nodes, edges);

    const ys = result
      .filter((n) => n.id.startsWith('in'))
      .map((n) => n.position.y)
      .sort((a, b) => a - b);
    // Every stacked node in the column must be a distinct y - no two on top of each other.
    expect(new Set(ys).size).toBe(ys.length);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i] - ys[i - 1]).toBeGreaterThan(0);
    }
  });

  it('places isolated (edgeless) nodes without crashing, at the leftmost column', () => {
    const nodes = [node('lonely', 300, 300)];
    const result = computeTidyLayout(nodes, []);
    expect(result[0].position.x).toBeGreaterThanOrEqual(0);
  });

  it('is safe against a cycle (e.g. two chassis cross-linked) instead of infinite-looping', () => {
    const nodes = [node('a', 0, 0), node('b', 0, 0)];
    const edges = [edge('a', 'b'), edge('b', 'a')];
    const result = computeTidyLayout(nodes, edges);
    expect(result).toHaveLength(2);
    expect(Number.isFinite(result[0].position.x)).toBe(true);
    expect(Number.isFinite(result[1].position.x)).toBe(true);
  });

  it('leaves grouped child nodes untouched - only the top-level parent moves', () => {
    const child = node('child', 5, 5, { parentId: 'group1', extent: 'parent' });
    const group = node('group1', 0, 0, { type: 'groupNode' });
    const tool = node('tool', 999, 0);
    const edges = [edge('child', 'tool')];
    const result = computeTidyLayout([group, child, tool], edges);

    const resultChild = result.find((n) => n.id === 'child')!;
    expect(resultChild.position).toEqual({ x: 5, y: 5 });
  });

  it('accounts for a wider node (e.g. a hardware chassis) so the next column never overlaps it', () => {
    const wide = node('chassis', 0, 0, { type: 'hardwareNode', measured: { width: 500, height: 100 } });
    const downstream = node('tool', 999, 0);
    const result = computeTidyLayout([wide, downstream], [edge('chassis', 'tool')]);

    const chassisX = result.find((n) => n.id === 'chassis')!.position.x;
    const toolX = result.find((n) => n.id === 'tool')!.position.x;
    expect(toolX).toBeGreaterThanOrEqual(chassisX + 500);
  });

  it('is idempotent - running it twice in a row produces the same layout', () => {
    const nodes = [node('in', 500, 500), node('map', 10, 900), node('tool', 900, 10)];
    const edges = [edge('in', 'map'), edge('map', 'tool')];
    const once = computeTidyLayout(nodes, edges);
    const twice = computeTidyLayout(once, edges);
    once.forEach((n, i) => {
      expect(twice[i].position).toEqual(n.position);
    });
  });
});

describe('autoSpaceNodesForExport', () => {
  it('automatically spaces vertically stacked nodes so descriptions never overlap', () => {
    const ta25_1 = node('ta25_1', 300, 100, {
      type: 'hardwareNode',
      data: { label: 'TA25 #1', model: 'GigaVUE-TA25E' } as unknown as CustomNode['data'],
    });
    const ta25_2 = node('ta25_2', 300, 180, {
      type: 'hardwareNode',
      data: { label: 'TA25 #2', model: 'GigaVUE-TA25E' } as unknown as CustomNode['data'],
    });

    const result = autoSpaceNodesForExport([ta25_1, ta25_2]);
    const pos1 = result.find((n) => n.id === 'ta25_1')!.position;
    const pos2 = result.find((n) => n.id === 'ta25_2')!.position;

    expect(pos1.y).toBe(100);
    // TA25E has height ~370px with description + 40px gap, so pos2.y should be >= 500px
    expect(pos2.y).toBeGreaterThanOrEqual(500);
  });

  it('spaces stacked cluster nodes and ensures adequate vertical breathing room', () => {
    const cluster1 = node('cluster1', 50, 100, {
      type: 'clusterNode',
      data: { label: '8x TAP Cluster', clusterType: 'tap' } as unknown as CustomNode['data'],
    });
    const cluster2 = node('cluster2', 50, 200, {
      type: 'clusterNode',
      data: { label: '4x Tool Cluster', clusterType: 'tool' } as unknown as CustomNode['data'],
    });

    const result = autoSpaceNodesForExport([cluster1, cluster2]);
    const pos1 = result.find((n) => n.id === 'cluster1')!.position;
    const pos2 = result.find((n) => n.id === 'cluster2')!.position;

    expect(pos1.y).toBe(100);
    expect(pos2.y).toBeGreaterThanOrEqual(440);
  });

  it('guarantees minimum horizontal gap between adjacent columns', () => {
    const tapCol = node('tap1', 50, 100, {
      type: 'clusterNode',
      data: { label: 'TAP Stack', clusterType: 'tap' } as unknown as CustomNode['data'],
    });
    const chassisCol = node('chassis1', 200, 100, {
      type: 'hardwareNode',
      data: { label: 'TA25E', model: 'GigaVUE-TA25E' } as unknown as CustomNode['data'],
    });

    const result = autoSpaceNodesForExport([tapCol, chassisCol]);
    const posTap = result.find((n) => n.id === 'tap1')!.position;
    const posChassis = result.find((n) => n.id === 'chassis1')!.position;

    // TAP cluster width (310) + horizontal gap (70) means chassis must start at >= 50 + 310 + 70 = 430
    expect(posChassis.x).toBeGreaterThanOrEqual(posTap.x + 310 + 70);
  });
});

