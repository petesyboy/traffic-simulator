import { describe, it, expect } from 'vitest';
import type { Edge } from '@xyflow/react';
import type { CustomNode } from '../store/types';
import { computeTidyLayout } from './autoLayout';

const node = (id: string, x: number, y: number, data: Record<string, unknown> = {}): CustomNode =>
  ({ id, type: 'hardwareNode', position: { x, y }, data: { label: id, ...data } }) as CustomNode;

const edge = (source: string, target: string): Edge => ({ id: `${source}-${target}`, source, target });

const rtl = { flowDirection: 'rtl', flowDirectionLocked: true };
const ltr = { flowDirection: 'ltr', flowDirectionLocked: true };

/** tap -> map -> tool, the shape of the demo topology. */
const chain = (tapData = {}, mapData = {}, toolData = {}): { nodes: CustomNode[]; edges: Edge[] } => ({
  nodes: [node('tap', 0, 0, tapData), node('map', 100, 0, mapData), node('tool', 200, 0, toolData)],
  edges: [edge('tap', 'map'), edge('map', 'tool')],
});

const xs = (result: CustomNode[]) => new Map(result.map((n) => [n.id, n.position.x]));

describe('computeTidyLayout — flow direction', () => {
  it('lays an unmirrored chain out left to right', () => {
    const { nodes, edges } = chain();
    const x = xs(computeTidyLayout(nodes, edges));
    expect(x.get('tap')!).toBeLessThan(x.get('map')!);
    expect(x.get('map')!).toBeLessThan(x.get('tool')!);
  });

  it('lays a mirrored chain out right to left', () => {
    const { nodes, edges } = chain(rtl, rtl, rtl);
    const x = xs(computeTidyLayout(nodes, edges));
    // Sources on the right, tools on the left - the order the handles point in.
    expect(x.get('tap')!).toBeGreaterThan(x.get('map')!);
    expect(x.get('map')!).toBeGreaterThan(x.get('tool')!);
  });

  it('pulls unlocked neighbours of a mirrored node the same way round', () => {
    // Only the source is locked; the rest are on Auto and should follow, so
    // every link stays short instead of doubling back at the boundary.
    const { nodes, edges } = chain(rtl);
    const x = xs(computeTidyLayout(nodes, edges));
    expect(x.get('tap')!).toBeGreaterThan(x.get('map')!);
    expect(x.get('map')!).toBeGreaterThan(x.get('tool')!);
  });

  it('stops the spread at a node locked left-to-right', () => {
    const { nodes, edges } = chain(rtl, ltr);
    const x = xs(computeTidyLayout(nodes, edges));
    // The map is pinned, so it and the tool downstream of it stay left-to-right.
    expect(x.get('map')!).toBeLessThan(x.get('tool')!);
  });

  it('leaves a topology with no locked node exactly as before', () => {
    const { nodes, edges } = chain();
    const before = computeTidyLayout(nodes, edges);
    const after = computeTidyLayout(
      nodes.map((n) => ({ ...n, data: { ...n.data, flowDirection: 'ltr' } })),
      edges,
    );
    before.forEach((n, i) => expect(after[i].position).toEqual(n.position));
  });

  it('mirrors one branch without disturbing an unconnected left-to-right branch', () => {
    const nodes: CustomNode[] = [
      node('a-src', 0, 0, rtl),
      node('a-tool', 100, 0),
      node('b-src', 0, 300),
      node('b-tool', 100, 300),
    ];
    const edges: Edge[] = [edge('a-src', 'a-tool'), edge('b-src', 'b-tool')];

    const x = xs(computeTidyLayout(nodes, edges));

    expect(x.get('a-src')!).toBeGreaterThan(x.get('a-tool')!);
    expect(x.get('b-src')!).toBeLessThan(x.get('b-tool')!);
  });

  it('is idempotent with mirrored nodes present', () => {
    const { nodes, edges } = chain(rtl, rtl, rtl);
    const once = computeTidyLayout(nodes, edges);
    const twice = computeTidyLayout(once, edges);
    once.forEach((n, i) => expect(twice[i].position).toEqual(n.position));
  });

  it('mirrors the handles of the unlocked nodes it pulled across', () => {
    // A node placed on the mirrored side has to be drawn mirrored too, or its
    // links leave the wrong edge and double back to reach the next hop.
    const { nodes, edges } = chain(rtl);
    const result = computeTidyLayout(nodes, edges);
    const byId = new Map(result.map((n) => [n.id, n]));

    expect(byId.get('map')!.data.flowDirection).toBe('rtl');
    expect(byId.get('tool')!.data.flowDirection).toBe('rtl');
    // Pulled across, not pinned - a later tidy can still move them back.
    expect(byId.get('map')!.data.flowDirectionLocked).toBeUndefined();
  });

  it('clears the mirrored flag when a node is laid out left-to-right again', () => {
    const { nodes, edges } = chain(rtl);
    const mirrored = computeTidyLayout(nodes, edges);

    // Unlock the source and put it back to left-to-right.
    const unlocked = mirrored.map((n) =>
      n.id === 'tap' ? ({ ...n, data: { ...n.data, flowDirection: undefined, flowDirectionLocked: undefined } } as CustomNode) : n,
    );
    const result = computeTidyLayout(unlocked, edges);

    result.forEach((n) => expect(n.data.flowDirection).toBeUndefined());
  });

  it('leaves a locked node its owner mirrored alone', () => {
    const { nodes, edges } = chain(rtl, ltr);
    const byId = new Map(computeTidyLayout(nodes, edges).map((n) => [n.id, n]));
    expect(byId.get('tap')!.data.flowDirection).toBe('rtl');
    expect(byId.get('map')!.data.flowDirection).toBe('ltr');
  });
});
