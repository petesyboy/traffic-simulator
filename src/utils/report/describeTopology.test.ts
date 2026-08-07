import { describe, it, expect } from 'vitest';
import {
  buildTopologyStats,
  describeMapConditions,
  describeFilterNode,
  describeGigaSmartAction,
  describeInputNode,
  describeGigaStreamNode,
  describeToolNode,
} from './describeTopology';
import { NODE_TYPES, ACTION_TYPES, CONFIG_TYPES } from '../../constants/nodeTypes';
import type {
  CustomNode,
  TrafficStream,
  MapCondition,
  FilterNodeData,
  GigaSmartNodeData,
  InputNodeData,
  GigaStreamNodeData,
  ToolNodeData,
} from '../../store/types';

const node = (id: string, type: string, data: Record<string, unknown>): CustomNode =>
  ({
    id,
    type,
    position: { x: 0, y: 0 },
    data,
  }) as CustomNode;

const stream = (overrides: Partial<TrafficStream>): TrafficStream => ({
  id: overrides.id || 'ts1',
  name: overrides.name || 'Stream',
  sourceNodeId: overrides.sourceNodeId || 'n1',
  vlan: overrides.vlan || '',
  ipSrc: overrides.ipSrc || '',
  ipDst: overrides.ipDst || '',
  portSrc: overrides.portSrc || '',
  portDst: overrides.portDst || '',
  protocol: overrides.protocol || 'TCP',
  bandwidth: overrides.bandwidth ?? 0,
  active: overrides.active ?? true,
});

describe('buildTopologyStats', () => {
  it('counts TAP and SPAN inputs via the .startsWith(CONFIG_TYPES.X) convention, not exact match', () => {
    const nodes: CustomNode[] = [
      node('i1', NODE_TYPES.INPUT, { label: 'Tap 1', configType: CONFIG_TYPES.TAP }),
      node('i2', NODE_TYPES.INPUT, { label: 'Tap 2 secondary', configType: `${CONFIG_TYPES.TAP} - Secondary` }),
      node('i3', NODE_TYPES.INPUT, { label: 'Span 1', configType: CONFIG_TYPES.SPAN }),
      node('i4', NODE_TYPES.INPUT, { label: 'Erspan 1', configType: CONFIG_TYPES.ERSPAN }),
    ];
    const stats = buildTopologyStats(nodes, [], []);
    expect(stats.inputCounts.tap).toBe(2);
    expect(stats.inputCounts.span).toBe(1);
    expect(stats.inputCounts.erspan).toBe(1);
    expect(stats.inputCounts.total).toBe(4);
  });

  it('counts GigaSMART actions across standalone gigaSmartNode and embedded gigaSmartApps on hardware/tool nodes', () => {
    const nodes: CustomNode[] = [
      node('g1', NODE_TYPES.GIGASMART, { label: 'Dedup', actionType: ACTION_TYPES.DEDUPLICATION }),
      node('h1', NODE_TYPES.HARDWARE, {
        label: 'HC1',
        model: 'GigaVUE-HC1',
        gigaSmartApps: [{ label: 'app', actionType: ACTION_TYPES.SSL_DECRYPT }],
      }),
      node('t1', NODE_TYPES.TOOL, {
        label: 'GSA',
        toolName: 'GSA',
        gigaSmartApps: [{ label: 'app2', actionType: ACTION_TYPES.SSL_DECRYPT }],
      }),
    ];
    const stats = buildTopologyStats(nodes, [], []);
    expect(stats.gigaSmartActionCounts[ACTION_TYPES.DEDUPLICATION]).toBe(1);
    expect(stats.gigaSmartActionCounts[ACTION_TYPES.SSL_DECRYPT]).toBe(2);
  });

  it('counts chassis by model, tool/map/filter counts, and aggregates traffic stream bandwidth', () => {
    const nodes: CustomNode[] = [
      node('h1', NODE_TYPES.HARDWARE, { label: 'HC1 a', model: 'GigaVUE-HC1' }),
      node('h2', NODE_TYPES.HARDWARE, { label: 'HC1 b', model: 'GigaVUE-HC1' }),
      node('h3', NODE_TYPES.HARDWARE, { label: 'TA25', model: 'GigaVUE-TA25E' }),
      node('m1', NODE_TYPES.MAP, { label: 'Map 1', conditions: [] }),
      node('f1', NODE_TYPES.FILTER, { label: 'Filter 1', configType: CONFIG_TYPES.VLAN_FILTER }),
      node('t1', NODE_TYPES.TOOL, { label: 'Splunk', toolName: 'Splunk' }),
    ];
    const streams = [stream({ id: 's1', bandwidth: 500 }), stream({ id: 's2', bandwidth: 1500 })];
    const stats = buildTopologyStats(nodes, [], streams);
    expect(stats.chassisCounts['GigaVUE-HC1']).toBe(2);
    expect(stats.chassisCounts['GigaVUE-TA25E']).toBe(1);
    expect(stats.mapNodeCount).toBe(1);
    expect(stats.filterNodeCount).toBe(1);
    expect(stats.toolCount).toBe(1);
    expect(stats.trafficStreamCount).toBe(2);
    expect(stats.totalBandwidthMbps).toBe(2000);
    expect(stats.totalBandwidthLabel).toBe('2.00 Gbps');
  });
});

describe('describeMapConditions', () => {
  it('returns the pass-all sentence when there are no conditions', () => {
    expect(describeMapConditions([])).toBe('Traffic Map: Pass All (No filters)');
  });

  it('describes a single condition', () => {
    const conditions: MapCondition[] = [{ field: 'vlan', value: '100', action: 'pass' }];
    expect(describeMapConditions(conditions)).toBe('Traffic Map (Filtering Rules):\n• VLAN = 100 -> PASS');
  });

  it('describes multiple conditions with AND/OR prefixes and PASS/DROP actions', () => {
    const conditions: MapCondition[] = [
      { field: 'vlan', value: '100', action: 'pass' },
      { field: 'portdst', value: '443', action: 'drop', logic: 'AND' },
      { field: 'ipsrc', value: '10.0.0.0/8', action: 'pass', logic: 'OR' },
    ];
    expect(describeMapConditions(conditions)).toBe(
      'Traffic Map (Filtering Rules):\n' +
        '• VLAN = 100 -> PASS\n' +
        '• AND DST PORT = 443 -> DROP\n' +
        '• OR SRC IP = 10.0.0.0/8 -> PASS',
    );
  });
});

describe('describeFilterNode', () => {
  it('describes a VLAN filter', () => {
    const data = { configType: CONFIG_TYPES.VLAN_FILTER, vlanIds: '100,200' } as FilterNodeData;
    expect(describeFilterNode(data)).toBe('VLAN Filter:\n• VLAN IDs: 100,200\n• Action: PASS matching / DROP others');
  });

  it('describes an IP subnet filter', () => {
    const data = { configType: CONFIG_TYPES.IP_FILTER, ipSubnet: '10.0.0.0/8' } as FilterNodeData;
    expect(describeFilterNode(data)).toBe('IP Filter:\n• Subnet: 10.0.0.0/8\n• Action: PASS matching / DROP others');
  });

  it('describes a port filter', () => {
    const data = { configType: CONFIG_TYPES.PORT_FILTER, ports: '80,443' } as FilterNodeData;
    expect(describeFilterNode(data)).toBe(
      'Port Filter:\n• Port numbers: 80,443\n• Action: PASS matching / DROP others',
    );
  });

  it('falls back to a generic message when no criteria are set', () => {
    const data = { configType: 'Traffic Map' } as unknown as FilterNodeData;
    expect(describeFilterNode(data)).toBe('Filter: No criteria set');
  });
});

describe('describeGigaSmartAction', () => {
  it('describes deduplication', () => {
    expect(describeGigaSmartAction({ actionType: ACTION_TYPES.DEDUPLICATION } as GigaSmartNodeData)).toBe(
      'Action: Drop',
    );
  });

  it('describes packet slicing with the configured slice size', () => {
    expect(
      describeGigaSmartAction({ actionType: ACTION_TYPES.PACKET_SLICING, sliceSize: 64 } as GigaSmartNodeData),
    ).toBe('Action: Slice (64B)');
  });

  it('describes header stripping', () => {
    expect(describeGigaSmartAction({ actionType: ACTION_TYPES.HEADER_STRIP } as GigaSmartNodeData)).toBe(
      'Action: Strip',
    );
  });

  it('describes a metadata action by its output format', () => {
    expect(
      describeGigaSmartAction({
        actionType: ACTION_TYPES.APP_METADATA,
        metadataFormat: 'JSON',
      } as GigaSmartNodeData),
    ).toBe('Format: JSON');
  });

  it('falls back to a generic action label for anything else', () => {
    expect(describeGigaSmartAction({ actionType: ACTION_TYPES.SSL_DECRYPT } as GigaSmartNodeData)).toBe(
      'Action: SSL Decrypt',
    );
  });
});

describe('describeInputNode', () => {
  it.each([
    [CONFIG_TYPES.SPAN, 'SPAN Input Port'],
    [CONFIG_TYPES.TAP, 'TAP Hardware Device'],
    [CONFIG_TYPES.ERSPAN, 'ERSPAN Tunnel Input'],
    [CONFIG_TYPES.EAST_WEST, 'East/West Traffic Source'],
    [CONFIG_TYPES.VMWARE, 'VMWare Virtual Estate'],
    ['Unknown', 'Network Input'],
  ])('labels configType %s as %s', (configType, expected) => {
    expect(describeInputNode({ configType } as InputNodeData)).toBe(expected);
  });
});

describe('describeGigaStreamNode', () => {
  it('describes the load-balancing configuration', () => {
    const data = { algorithm: 'Hash-Based', linkCount: 4 } as GigaStreamNodeData;
    expect(describeGigaStreamNode(data)).toBe(
      'GigaStream Load Balancer: distributes traffic across 4 links using Hash-Based.',
    );
  });

  it('falls back to sensible defaults when unset', () => {
    const data = {} as GigaStreamNodeData;
    expect(describeGigaStreamNode(data)).toBe(
      'GigaStream Load Balancer: distributes traffic across 2 links using Round Robin.',
    );
  });
});

describe('describeToolNode', () => {
  it('describes a tool with an ingest limit', () => {
    const data = { toolName: 'Splunk', expectedFormat: 'packets', ingestLimitMbps: 1000 } as ToolNodeData;
    expect(describeToolNode(data)).toBe('Splunk: receives packets traffic (ingest limit 1.00 Gbps).');
  });

  it('describes a tool with no ingest limit set', () => {
    const data = { toolName: 'Vectra', expectedType: 'metadata' } as ToolNodeData;
    expect(describeToolNode(data)).toBe('Vectra: receives metadata traffic.');
  });
});
