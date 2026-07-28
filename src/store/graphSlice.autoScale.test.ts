import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import type { CustomNode } from './types';
import type { Edge } from '@xyflow/react';
import { NODE_TYPES } from '../constants/nodeTypes';

const initialState = useStore.getState();

const makeMapNode = (id: string): CustomNode => ({
  id,
  type: NODE_TYPES.MAP,
  position: { x: 0, y: 0 },
  data: { label: 'Traffic Map', configType: 'Traffic Map' },
});

const makeToolNode = (id: string, ingestLimitMbps: number, position = { x: 300, y: 0 }): CustomNode => ({
  id,
  type: NODE_TYPES.TOOL,
  position,
  data: { label: 'FortiNDR', toolName: 'FortiNDR', configType: 'Packet Tool', expectedType: 'packet', ingestLimitMbps },
});

describe('autoScaleToolForFeed', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
  });

  it('inserts a load balancer and duplicates the tool enough times to absorb the feed', () => {
    const mapNode = makeMapNode('map-1');
    const toolNode = makeToolNode('tool-1', 20000); // 20 Gbps limit
    const edge: Edge = { id: 'e-map-tool', source: 'map-1', target: 'tool-1', sourceHandle: 'out', targetHandle: 'in' };
    useStore.setState({
      nodes: [mapNode, toolNode],
      edges: [edge],
      nodeMetrics: { 'tool-1': { rxMbps: 100000, txMbps: 0, rxPackets: 0, txPackets: 0, droppedPackets: 0 } },
    });

    const result = useStore.getState().autoScaleToolForFeed('tool-1');
    expect(result.ok).toBe(true);

    const { nodes, edges } = useStore.getState();
    // 100 Gbps feed / 20 Gbps limit = 5 instances required -> 4 duplicates + 1 load balancer added.
    expect(nodes).toHaveLength(2 + 1 + 4);
    expect(edges).toHaveLength(2 + 4); // map->LB, LB->original, LB->dup(x4)

    const loadBalancer = nodes.find((n) => n.type === NODE_TYPES.GIGASTREAM);
    expect(loadBalancer).toBeDefined();

    // The original map->tool edge should be gone, replaced by map->LB and LB->tool.
    expect(edges.find((e) => e.id === 'e-map-tool')).toBeUndefined();
    expect(edges.some((e) => e.source === 'map-1' && e.target === loadBalancer!.id)).toBe(true);
    expect(edges.some((e) => e.source === loadBalancer!.id && e.target === 'tool-1')).toBe(true);

    const duplicateTools = nodes.filter((n) => n.type === NODE_TYPES.TOOL && n.id !== 'tool-1');
    expect(duplicateTools).toHaveLength(4);
    duplicateTools.forEach((dup) => {
      expect(dup.data.toolName).toBe('FortiNDR');
      expect(dup.data.ingestLimitMbps).toBe(20000);
      expect(edges.some((e) => e.source === loadBalancer!.id && e.target === dup.id)).toBe(true);
    });
  });

  it('reuses an existing load balancer instead of stacking a second one', () => {
    const mapNode = makeMapNode('map-1');
    const lbNode: CustomNode = { id: 'lb-1', type: NODE_TYPES.GIGASTREAM, position: { x: 150, y: 0 }, data: { label: 'Load Balancer', configType: 'GigaStream', algorithm: 'Round Robin' } };
    const toolNode = makeToolNode('tool-1', 20000);
    const edges: Edge[] = [
      { id: 'e-map-lb', source: 'map-1', target: 'lb-1', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e-lb-tool', source: 'lb-1', target: 'tool-1', sourceHandle: 'out', targetHandle: 'in' },
    ];
    useStore.setState({
      nodes: [mapNode, lbNode, toolNode],
      edges,
      nodeMetrics: { 'tool-1': { rxMbps: 60000, txMbps: 0, rxPackets: 0, txPackets: 0, droppedPackets: 0 } },
    });

    const result = useStore.getState().autoScaleToolForFeed('tool-1');
    expect(result.ok).toBe(true);

    const state = useStore.getState();
    const loadBalancers = state.nodes.filter((n) => n.type === NODE_TYPES.GIGASTREAM);
    expect(loadBalancers).toHaveLength(1); // still just the one, reused
    expect(loadBalancers[0].id).toBe('lb-1');

    // 60 Gbps / 20 Gbps = 3 instances required -> 2 duplicates, no new/removed edges besides the 2 new dup links.
    const duplicateTools = state.nodes.filter((n) => n.type === NODE_TYPES.TOOL && n.id !== 'tool-1');
    expect(duplicateTools).toHaveLength(2);
    expect(state.edges).toHaveLength(2 + 2);
    expect(state.edges.find((e) => e.id === 'e-map-lb')).toBeDefined();
    expect(state.edges.find((e) => e.id === 'e-lb-tool')).toBeDefined();
  });

  it('refuses when the tool already has enough capacity', () => {
    const mapNode = makeMapNode('map-1');
    const toolNode = makeToolNode('tool-1', 100000);
    useStore.setState({
      nodes: [mapNode, toolNode],
      edges: [{ id: 'e1', source: 'map-1', target: 'tool-1', sourceHandle: 'out', targetHandle: 'in' }],
      nodeMetrics: { 'tool-1': { rxMbps: 50000, txMbps: 0, rxPackets: 0, txPackets: 0, droppedPackets: 0 } },
    });

    const nodesBefore = useStore.getState().nodes;
    const result = useStore.getState().autoScaleToolForFeed('tool-1');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/already has enough/i);
    expect(useStore.getState().nodes).toEqual(nodesBefore);
  });

  it('refuses when the simulation has not measured any traffic yet', () => {
    const mapNode = makeMapNode('map-1');
    const toolNode = makeToolNode('tool-1', 20000);
    useStore.setState({
      nodes: [mapNode, toolNode],
      edges: [{ id: 'e1', source: 'map-1', target: 'tool-1', sourceHandle: 'out', targetHandle: 'in' }],
      nodeMetrics: {},
    });

    const result = useStore.getState().autoScaleToolForFeed('tool-1');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/run the simulation first/i);
  });

  it('refuses when the tool has more than one upstream connection', () => {
    const mapNode = makeMapNode('map-1');
    const mapNode2 = makeMapNode('map-2');
    const toolNode = makeToolNode('tool-1', 20000);
    useStore.setState({
      nodes: [mapNode, mapNode2, toolNode],
      edges: [
        { id: 'e1', source: 'map-1', target: 'tool-1', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'e2', source: 'map-2', target: 'tool-1', sourceHandle: 'out', targetHandle: 'in-2' },
      ],
      nodeMetrics: { 'tool-1': { rxMbps: 100000, txMbps: 0, rxPackets: 0, txPackets: 0, droppedPackets: 0 } },
    });

    const result = useStore.getState().autoScaleToolForFeed('tool-1');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/exactly one upstream connection/i);
  });

  it('caps the number of instances added at 16', () => {
    const mapNode = makeMapNode('map-1');
    const toolNode = makeToolNode('tool-1', 1000); // 1 Gbps limit
    useStore.setState({
      nodes: [mapNode, toolNode],
      edges: [{ id: 'e1', source: 'map-1', target: 'tool-1', sourceHandle: 'out', targetHandle: 'in' }],
      nodeMetrics: { 'tool-1': { rxMbps: 1000000, txMbps: 0, rxPackets: 0, txPackets: 0, droppedPackets: 0 } }, // absurdly oversized feed
    });

    useStore.getState().autoScaleToolForFeed('tool-1');
    const duplicateTools = useStore.getState().nodes.filter((n) => n.type === NODE_TYPES.TOOL && n.id !== 'tool-1');
    expect(duplicateTools).toHaveLength(15); // capped at 16 total instances
  });

  it('is undoable', () => {
    const mapNode = makeMapNode('map-1');
    const toolNode = makeToolNode('tool-1', 20000);
    useStore.setState({
      nodes: [mapNode, toolNode],
      edges: [{ id: 'e1', source: 'map-1', target: 'tool-1', sourceHandle: 'out', targetHandle: 'in' }],
      nodeMetrics: { 'tool-1': { rxMbps: 100000, txMbps: 0, rxPackets: 0, txPackets: 0, droppedPackets: 0 } },
    });

    const nodesBefore = useStore.getState().nodes;
    const edgesBefore = useStore.getState().edges;
    useStore.getState().autoScaleToolForFeed('tool-1');
    expect(useStore.getState().nodes.length).toBeGreaterThan(nodesBefore.length);

    useStore.getState().undo();
    expect(useStore.getState().nodes).toEqual(nodesBefore);
    expect(useStore.getState().edges).toEqual(edgesBefore);
  });
});
