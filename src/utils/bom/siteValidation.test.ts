import { describe, it, expect } from 'vitest';
import { detectMixedSiteAssignment } from './siteValidation';
import { type CustomNode, type HardwareNodeData, type InputNodeData, type MapNodeData } from '../../store/types';
import { NODE_TYPES } from '../../constants/nodeTypes';

describe('detectMixedSiteAssignment', () => {
  it('returns hasMixedSites: false when canvas is empty', () => {
    const result = detectMixedSiteAssignment([]);
    expect(result.hasMixedSites).toBe(false);
    expect(result.taggedSites).toHaveLength(0);
    expect(result.taggedNodes).toHaveLength(0);
    expect(result.untaggedNodes).toHaveLength(0);
  });

  it('returns hasMixedSites: false when all equipment is untagged', () => {
    const nodes: CustomNode[] = [
      {
        id: 'node-1',
        type: NODE_TYPES.HARDWARE,
        position: { x: 0, y: 0 },
        data: { model: 'GigaVUE-HC2' } as HardwareNodeData,
      },
      {
        id: 'node-2',
        type: NODE_TYPES.HARDWARE,
        position: { x: 100, y: 0 },
        data: { model: 'GigaVUE-TA100' } as HardwareNodeData,
      },
    ];

    const result = detectMixedSiteAssignment(nodes);
    expect(result.hasMixedSites).toBe(false);
    expect(result.untaggedNodes).toHaveLength(2);
    expect(result.taggedNodes).toHaveLength(0);
  });

  it('returns hasMixedSites: false when all equipment has site tags assigned', () => {
    const nodes: CustomNode[] = [
      {
        id: 'node-1',
        type: NODE_TYPES.HARDWARE,
        position: { x: 0, y: 0 },
        data: { model: 'GigaVUE-HC2', site: 'London DC' } as HardwareNodeData,
      },
      {
        id: 'node-2',
        type: NODE_TYPES.HARDWARE,
        position: { x: 100, y: 0 },
        data: { model: 'GigaVUE-TA100', site: 'Manchester DC' } as HardwareNodeData,
      },
    ];

    const result = detectMixedSiteAssignment(nodes);
    expect(result.hasMixedSites).toBe(false);
    expect(result.taggedNodes).toHaveLength(2);
    expect(result.untaggedNodes).toHaveLength(0);
    expect(result.taggedSites).toEqual(['London DC', 'Manchester DC']);
  });

  it('returns hasMixedSites: true when some equipment is tagged and some is untagged', () => {
    const nodes: CustomNode[] = [
      {
        id: 'node-1',
        type: NODE_TYPES.HARDWARE,
        position: { x: 0, y: 0 },
        data: { model: 'GigaVUE-HC2', label: 'Core Aggregator', site: 'London Datacentre' } as HardwareNodeData,
      },
      {
        id: 'node-2',
        type: NODE_TYPES.HARDWARE,
        position: { x: 100, y: 0 },
        data: { model: 'GigaVUE-TA100', label: 'Edge Leaf' } as HardwareNodeData, // untagged
      },
    ];

    const result = detectMixedSiteAssignment(nodes);
    expect(result.hasMixedSites).toBe(true);
    expect(result.taggedSites).toEqual(['London Datacentre']);
    expect(result.taggedNodes).toHaveLength(1);
    expect(result.taggedNodes[0].label).toBe('Core Aggregator');
    expect(result.untaggedNodes).toHaveLength(1);
    expect(result.untaggedNodes[0].label).toBe('Edge Leaf');
  });

  it('ignores auto-generated tray nodes when evaluating site consistency', () => {
    const nodes: CustomNode[] = [
      {
        id: 'node-1',
        type: NODE_TYPES.HARDWARE,
        position: { x: 0, y: 0 },
        data: { model: 'GigaVUE-HC2', site: 'Datacentre Alpha' } as HardwareNodeData,
      },
      {
        id: 'node-tray',
        type: NODE_TYPES.HARDWARE,
        position: { x: 50, y: 50 },
        data: { model: 'TAP-M200T' } as HardwareNodeData, // Auto tray
      },
    ];

    // Since node-tray is an auto-created tray model, it should not count as unassigned user equipment
    const result = detectMixedSiteAssignment(nodes);
    expect(result.hasMixedSites).toBe(false);
    expect(result.taggedNodes).toHaveLength(1);
    expect(result.untaggedNodes).toHaveLength(0);
  });

  it('detects mixed tagging across hardware and input nodes', () => {
    const nodes: CustomNode[] = [
      {
        id: 'in-1',
        type: NODE_TYPES.INPUT,
        position: { x: 0, y: 0 },
        data: { label: 'DC WAN Tap', configType: 'Network Tap', site: 'Paris DC' } as InputNodeData,
      },
      {
        id: 'hw-1',
        type: NODE_TYPES.HARDWARE,
        position: { x: 100, y: 0 },
        data: { model: 'GigaVUE-HC3', label: 'Aggregation Chassis' } as HardwareNodeData, // untagged
      },
      {
        id: 'map-1',
        type: NODE_TYPES.MAP,
        position: { x: 200, y: 0 },
        data: { label: 'Traffic Map', configType: 'Traffic Map', conditions: [] } as MapNodeData, // logical node, not equipment
      },
    ];

    const result = detectMixedSiteAssignment(nodes);
    expect(result.hasMixedSites).toBe(true);
    expect(result.taggedSites).toEqual(['Paris DC']);
    expect(result.taggedNodes).toHaveLength(1);
    expect(result.taggedNodes[0].label).toBe('DC WAN Tap');
    expect(result.untaggedNodes).toHaveLength(1);
    expect(result.untaggedNodes[0].label).toBe('Aggregation Chassis');
  });

  it('ignores untagged custom tools, packet tools, and third-party probes (e.g. Ericsson probes)', () => {
    const nodes: CustomNode[] = [
      {
        id: 'hw-1',
        type: NODE_TYPES.HARDWARE,
        position: { x: 0, y: 0 },
        data: { model: 'GigaVUE-HC3', label: 'Primary HC3', site: 'Site A' } as HardwareNodeData,
      },
      {
        id: 'hw-2',
        type: NODE_TYPES.HARDWARE,
        position: { x: 100, y: 0 },
        data: { model: 'GigaVUE-TA25E', label: 'Leaf TA25E', site: 'Site B' } as HardwareNodeData,
      },
      {
        id: 'probe-1',
        type: NODE_TYPES.TOOL,
        position: { x: 200, y: 0 },
        data: { label: 'Ericsson Probe 1', configType: 'Packet Tool' } as unknown as CustomNode['data'], // untagged probe
      },
      {
        id: 'probe-2',
        type: NODE_TYPES.TOOL,
        position: { x: 200, y: 100 },
        data: { label: 'Ericsson Probe 2', configType: 'Packet Tool' } as unknown as CustomNode['data'], // untagged probe
      },
    ];

    const result = detectMixedSiteAssignment(nodes);
    // All physical Gigamon hardware is tagged (Site A, Site B) - untagged probes must not trigger warning
    expect(result.hasMixedSites).toBe(false);
    expect(result.untaggedNodes).toHaveLength(0);
    expect(result.taggedNodes).toHaveLength(2);
    expect(result.taggedSites).toEqual(['Site A', 'Site B']);
  });
});
