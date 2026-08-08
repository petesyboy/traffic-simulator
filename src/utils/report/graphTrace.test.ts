import { describe, it, expect } from 'vitest';
import { getUpstreamNodes, getDownstreamNodes, traceToTerminalInputs, traceToTerminalOutputs } from './graphTrace';
import { NODE_TYPES } from '../../constants/nodeTypes';
import type { CustomNode } from '../../store/types';
import type { Edge } from '@xyflow/react';

const node = (id: string, type: string, label = id): CustomNode =>
  ({
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label },
  }) as CustomNode;

const edge = (id: string, source: string, target: string): Edge => ({ id, source, target });

describe('getUpstreamNodes / getDownstreamNodes', () => {
  const nodes = [node('a', NODE_TYPES.INPUT), node('b', NODE_TYPES.MAP), node('c', NODE_TYPES.TOOL)];
  const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')];

  it('returns direct one-hop sources', () => {
    expect(getUpstreamNodes('b', nodes, edges).map((n) => n.id)).toEqual(['a']);
    expect(getUpstreamNodes('a', nodes, edges)).toEqual([]);
  });

  it('returns direct one-hop targets', () => {
    expect(getDownstreamNodes('b', nodes, edges).map((n) => n.id)).toEqual(['c']);
    expect(getDownstreamNodes('c', nodes, edges)).toEqual([]);
  });
});

describe('traceToTerminalInputs / traceToTerminalOutputs', () => {
  it('resolves a multi-hop chain: input -> map -> gigasmart -> tool', () => {
    const nodes = [
      node('in1', NODE_TYPES.INPUT),
      node('map1', NODE_TYPES.MAP),
      node('gsm1', NODE_TYPES.GIGASMART),
      node('tool1', NODE_TYPES.TOOL),
    ];
    const edges = [edge('e1', 'in1', 'map1'), edge('e2', 'map1', 'gsm1'), edge('e3', 'gsm1', 'tool1')];

    expect(traceToTerminalInputs('gsm1', nodes, edges).map((n) => n.id)).toEqual(['in1']);
    expect(traceToTerminalOutputs('map1', nodes, edges).map((n) => n.id)).toEqual(['tool1']);
  });

  it('returns every branch when one input feeds two tools', () => {
    const nodes = [
      node('in1', NODE_TYPES.INPUT),
      node('map1', NODE_TYPES.MAP),
      node('tool1', NODE_TYPES.TOOL),
      node('tool2', NODE_TYPES.TOOL),
    ];
    const edges = [edge('e1', 'in1', 'map1'), edge('e2', 'map1', 'tool1'), edge('e3', 'map1', 'tool2')];

    const outputs = traceToTerminalOutputs('in1', nodes, edges)
      .map((n) => n.id)
      .sort();
    expect(outputs).toEqual(['tool1', 'tool2']);
  });

  it('dedupes when two paths converge on the same terminal node', () => {
    const nodes = [
      node('in1', NODE_TYPES.INPUT),
      node('in2', NODE_TYPES.INPUT),
      node('map1', NODE_TYPES.MAP),
      node('tool1', NODE_TYPES.TOOL),
    ];
    const edges = [edge('e1', 'in1', 'map1'), edge('e2', 'in2', 'map1'), edge('e3', 'map1', 'tool1')];

    expect(
      traceToTerminalInputs('tool1', nodes, edges)
        .map((n) => n.id)
        .sort(),
    ).toEqual(['in1', 'in2']);
  });

  it('returns an empty array (no crash / no infinite loop) when there is no path to any terminal', () => {
    const nodes = [node('map1', NODE_TYPES.MAP), node('filt1', NODE_TYPES.FILTER)];
    const edges = [edge('e1', 'map1', 'filt1')];

    expect(traceToTerminalInputs('filt1', nodes, edges)).toEqual([]);
    expect(traceToTerminalOutputs('map1', nodes, edges)).toEqual([]);
  });

  it('does not loop forever on a cyclic graph', () => {
    const nodes = [node('a', NODE_TYPES.MAP), node('b', NODE_TYPES.FILTER)];
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')];

    expect(traceToTerminalOutputs('a', nodes, edges)).toEqual([]);
  });

  it('counts a TAP modelled as its own hardwareNode as a traffic origin alongside a SPAN inputNode', () => {
    // Regression: a TAP wired directly to a chassis hardwareNode (rather than
    // a logical inputNode) used to be silently dropped from "Traffic
    // originates from" tracing, making a report claim all traffic came from
    // the SPAN input alone.
    const nodes: CustomNode[] = [
      node('span1', NODE_TYPES.INPUT),
      { ...node('tap1', NODE_TYPES.HARDWARE), data: { label: 'TAP1', model: 'TAP-M253T' } } as CustomNode,
      node('hc1', NODE_TYPES.HARDWARE, 'HC1'),
      node('tool1', NODE_TYPES.TOOL),
    ];
    const edges = [edge('e1', 'span1', 'hc1'), edge('e2', 'tap1', 'hc1'), edge('e3', 'hc1', 'tool1')];

    const origins = traceToTerminalInputs('tool1', nodes, edges)
      .map((n) => n.id)
      .sort();
    expect(origins).toEqual(['span1', 'tap1']);
  });

  it('does not treat a TAP-tray hardwareNode as a traffic origin', () => {
    const nodes: CustomNode[] = [
      { ...node('tray1', NODE_TYPES.HARDWARE), data: { label: 'Tray', model: 'TAP-M100T' } } as CustomNode,
      node('tool1', NODE_TYPES.TOOL),
    ];
    const edges = [edge('e1', 'tray1', 'tool1')];

    expect(traceToTerminalInputs('tool1', nodes, edges)).toEqual([]);
  });
});
