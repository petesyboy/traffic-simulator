import { describe, it, expect } from 'vitest';
import { matchesVlan, matchesIp, matchesPort, evaluateMapConditions, calculateSimulationStep } from './simulation';
import { type TrafficStream, type CustomNode } from '../store/store';

describe('Simulation Utils', () => {
  describe('matchesVlan', () => {
    it('should match a single VLAN', () => {
      expect(matchesVlan('100', '100')).toBe(true);
      expect(matchesVlan('100', '200')).toBe(false);
    });

    it('should match multiple VLANs in a comma-separated list', () => {
      expect(matchesVlan('100', '100, 200, 300')).toBe(true);
      expect(matchesVlan('200', '100, 200, 300')).toBe(true);
      expect(matchesVlan('400', '100, 200, 300')).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(matchesVlan(' 100 ', ' 100, 200 ')).toBe(true);
    });
  });

  describe('matchesIp', () => {
    it('should match exact IP', () => {
      expect(matchesIp('192.168.1.1', '192.168.1.1')).toBe(true);
    });

    it('should match subnet prefix', () => {
      expect(matchesIp('192.168.1.50', '192.168.1.0/24')).toBe(true);
    });
  });

  describe('matchesPort', () => {
    it('should match a single port', () => {
      expect(matchesPort('80', '80')).toBe(true);
      expect(matchesPort('80', '443')).toBe(false);
    });

    it('should match multiple ports', () => {
      expect(matchesPort('443', '80, 443, 8080')).toBe(true);
    });
  });

  describe('evaluateMapConditions', () => {
    const stream: TrafficStream = {
      id: 't1',
      name: 'Test',
      sourceNodeId: 'n1',
      vlan: '100',
      ipSrc: '192.168.1.1',
      ipDst: '10.0.0.1',
      portSrc: '12345',
      portDst: '80',
      protocol: 'tcp',
      bandwidth: 100,
      active: true,
    };

    it('should pass if no conditions are provided', () => {
      expect(evaluateMapConditions(stream, [])).toBe(true);
      expect(evaluateMapConditions(stream, undefined)).toBe(true);
    });

    it('should evaluate pass conditions correctly', () => {
      expect(evaluateMapConditions(stream, [{ field: 'protocol', value: 'tcp', action: 'pass' }])).toBe(true);
      expect(evaluateMapConditions(stream, [{ field: 'protocol', value: 'udp', action: 'pass' }])).toBe(false);
    });

    it('should evaluate drop conditions correctly', () => {
      expect(evaluateMapConditions(stream, [{ field: 'vlan', value: '100', action: 'drop' }])).toBe(false);
      expect(evaluateMapConditions(stream, [{ field: 'vlan', value: '200', action: 'drop' }])).toBe(true);
    });
  });

  describe('calculateSimulationStep VLAN 999 TAP override', () => {
    it('should force a TAP Device node linkSpeed to 40 Gbps if it hosts a VLAN 999 stream', () => {
      const nodes: CustomNode[] = [
        {
          id: 'tap-node-vlan-999',
          type: 'inputNode',
          position: { x: 0, y: 0 },
          data: { label: 'TAP Device', configType: 'TAP Device', linkSpeed: 1000 },
        },
      ];

      const streams: TrafficStream[] = [
        {
          id: 'vlan-999-stream',
          name: 'VLAN 999 Flow',
          sourceNodeId: 'tap-node-vlan-999',
          vlan: '999',
          ipSrc: '10.0.0.1',
          ipDst: '10.0.0.2',
          portSrc: '80',
          portDst: '80',
          protocol: 'tcp',
          bandwidth: 35000,
          active: true,
        },
      ];

      const result = calculateSimulationStep(nodes, [], streams);

      expect(result.nodeDataPatches['tap-node-vlan-999']).toBeDefined();
      expect(result.nodeDataPatches['tap-node-vlan-999'].linkSpeed).toBe(40000);
      expect(nodes[0].data.linkSpeed).toBe(40000);
    });

    it('should not force a SPAN Port node linkSpeed to 40 Gbps even if it hosts a VLAN 999 stream', () => {
      const nodes: CustomNode[] = [
        {
          id: 'span-node-vlan-999',
          type: 'inputNode',
          position: { x: 0, y: 0 },
          data: { label: 'SPAN Port', configType: 'SPAN Port', linkSpeed: 1000 },
        },
      ];

      const streams: TrafficStream[] = [
        {
          id: 'vlan-999-stream',
          name: 'VLAN 999 Flow',
          sourceNodeId: 'span-node-vlan-999',
          vlan: '999',
          ipSrc: '10.0.0.1',
          ipDst: '10.0.0.2',
          portSrc: '80',
          portDst: '80',
          protocol: 'tcp',
          bandwidth: 35000,
          active: true,
        },
      ];

      const result = calculateSimulationStep(nodes, [], streams);

      expect(result.nodeDataPatches['span-node-vlan-999']).toBeUndefined();
      expect(nodes[0].data.linkSpeed).toBe(1000);
    });
  });

  describe('GigaSMART hardware node routing', () => {
    it('should route only scaled metadata to Metadata Tools and only packet streams to Packet Tools', () => {
      const nodes: CustomNode[] = [
        {
          id: 'tap-1',
          type: 'inputNode',
          position: { x: 0, y: 0 },
          data: { label: 'TAP', configType: 'TAP', linkSpeed: 40000 },
        },
        {
          id: 'hc-1',
          type: 'hardwareNode',
          position: { x: 200, y: 0 },
          data: {
            label: 'HC Chassis',
            configType: 'HC',
            model: 'GigaVUE-HC1',
            gigaSmartApps: [
              {
                id: 'app-ami',
                label: 'Application Metadata',
                actionType: 'Application Metadata',
                metadataFormat: 'CEF',
              }
            ]
          },
        },
        {
          id: 'splunk-1',
          type: 'toolNode',
          position: { x: 400, y: -100 },
          data: { label: 'Splunk', configType: 'Metadata Tool', toolName: 'Splunk' },
        },
        {
          id: 'vectra-1',
          type: 'toolNode',
          position: { x: 400, y: 100 },
          data: { label: 'Vectra', configType: 'Packet Tool', toolName: 'Vectra' },
        },
      ];

      const edges = [
        { id: 'e-tap-hc', source: 'tap-1', target: 'hc-1' },
        { id: 'e-hc-splunk', source: 'hc-1', target: 'splunk-1' },
        { id: 'e-hc-vectra', source: 'hc-1', target: 'vectra-1' },
      ];

      const streams = [
        {
          id: 'stream-1',
          name: 'Traffic Flow',
          sourceNodeId: 'tap-1',
          vlan: '100',
          ipSrc: '10.0.0.1',
          ipDst: '10.0.0.2',
          portSrc: '80',
          portDst: '80',
          protocol: 'tcp',
          bandwidth: 10000, // 10 Gbps
          active: true,
        },
      ];

      const result = calculateSimulationStep(nodes, edges, streams);

      // Splunk (Metadata Tool) should receive only CEF metadata (3% of 10G = 300 Mbps)
      expect(result.edgeMetrics['e-hc-splunk']).toBe(300);
      
      // Vectra (Packet Tool) should receive only raw packets (10G = 10000 Mbps)
      expect(result.edgeMetrics['e-hc-vectra']).toBe(10000);
    });
  });
});
