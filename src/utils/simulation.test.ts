import { describe, it, expect } from 'vitest';
import { matchesVlan, matchesIp, matchesPort, evaluateMapConditions, calculateSimulationStep } from './simulation';
import { type TrafficStream, type CustomNode } from '../store/store';
import { generateBom } from './bomEngine';

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

    it('should forward metadata from standalone GigaSMART Application Metadata node to metadata tool', () => {
      const nodes: CustomNode[] = [
        {
          id: 'tap-1',
          type: 'inputNode',
          position: { x: 0, y: 0 },
          data: { label: 'TAP', configType: 'TAP', linkSpeed: 10000 },
        },
        {
          id: 'gs-1',
          type: 'gigaSmartNode',
          position: { x: 200, y: 0 },
          data: {
            label: 'Application Metadata',
            configType: 'GigaSMART',
            actionType: 'Application Metadata',
            metadataFormat: 'CEF',
            metadataRate: 3
          },
        },
        {
          id: 'splunk-1',
          type: 'toolNode',
          position: { x: 400, y: 0 },
          data: { label: 'Splunk', configType: 'Metadata Tool', toolName: 'Splunk' },
        }
      ];

      const edges = [
        { id: 'e-tap-gs', source: 'tap-1', target: 'gs-1' },
        { id: 'e-gs-splunk', source: 'gs-1', target: 'splunk-1' },
      ];

      const streams: TrafficStream[] = [
        {
          id: 'stream-1',
          name: 'Traffic Flow',
          sourceNodeId: 'tap-1',
          vlan: '100',
          bandwidth: 10000, // 10G
          active: true,
          ipSrc: '10.0.0.1',
          ipDst: '10.0.0.2',
          portSrc: '12345',
          portDst: '80',
          protocol: 'tcp'
        }
      ];

      const result = calculateSimulationStep(nodes, edges, streams);
      
      // Splunk (Metadata Tool) should receive 10000 * 3% = 300 Mbps of CEF metadata
      expect(result.metrics['splunk-1']).toBeDefined();
      expect(result.metrics['splunk-1'].rxBps).toBe(300);
    });

    it('should forward metadata from standalone GigaSMART node to S3 Storage Tool', () => {
      const nodes: CustomNode[] = [
        {
          id: 'tap-1',
          type: 'inputNode',
          position: { x: 0, y: 0 },
          data: { label: 'TAP', configType: 'TAP', linkSpeed: 10000 },
        },
        {
          id: 'gs-1',
          type: 'gigaSmartNode',
          position: { x: 200, y: 0 },
          data: {
            label: 'Application Metadata',
            configType: 'GigaSMART',
            actionType: 'Application Metadata',
            metadataFormat: 'CEF',
            metadataRate: 3
          },
        },
        {
          id: 's3-1',
          type: 'toolNode',
          position: { x: 400, y: 0 },
          data: { label: 'S3 Storage', configType: 'Storage Tool', toolName: 'S3' },
        }
      ];

      const edges = [
        { id: 'e-tap-gs', source: 'tap-1', target: 'gs-1' },
        { id: 'e-gs-s3', source: 'gs-1', target: 's3-1' },
      ];

      const streams: TrafficStream[] = [
        {
          id: 'stream-1',
          name: 'Traffic Flow',
          sourceNodeId: 'tap-1',
          vlan: '100',
          bandwidth: 10000,
          active: true,
          ipSrc: '10.0.0.1',
          ipDst: '10.0.0.2',
          portSrc: '12345',
          portDst: '80',
          protocol: 'tcp'
        }
      ];

      const result = calculateSimulationStep(nodes, edges, streams);
      expect(result.metrics['s3-1']).toBeDefined();
      expect(result.metrics['s3-1'].rxBps).toBe(300);
    });

    it('should forward packet streams to ExtraHop Tool when configured as ExtraHop configType', () => {
      const nodes: CustomNode[] = [
        {
          id: 'tap-1',
          type: 'inputNode',
          position: { x: 0, y: 0 },
          data: { label: 'TAP', configType: 'TAP', linkSpeed: 10000 },
        },
        {
          id: 'extrahop-1',
          type: 'toolNode',
          position: { x: 200, y: 0 },
          data: { label: 'ExtraHop Tool', configType: 'ExtraHop', toolName: 'ExtraHop' },
        }
      ];

      const edges = [
        { id: 'e-tap-eh', source: 'tap-1', target: 'extrahop-1' },
      ];

      const streams: TrafficStream[] = [
        {
          id: 'stream-1',
          name: 'Traffic Flow',
          sourceNodeId: 'tap-1',
          vlan: '100',
          bandwidth: 10000,
          active: true,
          ipSrc: '10.0.0.1',
          ipDst: '10.0.0.2',
          portSrc: '12345',
          portDst: '80',
          protocol: 'tcp'
        }
      ];

      const result = calculateSimulationStep(nodes, edges, streams);
      expect(result.metrics['extrahop-1']).toBeDefined();
      expect(result.metrics['extrahop-1'].rxBps).toBe(10000);
    });

    it('should forward traffic correctly to custom tools with different input formats', () => {
      const nodes: CustomNode[] = [
        {
          id: 'tap-1',
          type: 'inputNode',
          position: { x: 0, y: 0 },
          data: { label: 'TAP', configType: 'TAP', linkSpeed: 10000 },
        },
        {
          id: 'gs-1',
          type: 'gigaSmartNode',
          position: { x: 200, y: 0 },
          data: {
            label: 'Application Metadata',
            configType: 'GigaSMART',
            actionType: 'Application Metadata',
            metadataFormat: 'JSON',
            metadataRate: 5
          },
        },
        {
          id: 'custom-packet-1',
          type: 'toolNode',
          position: { x: 200, y: 100 },
          data: { label: 'Custom Packet Consumer', configType: 'Packet Tool', toolName: 'Custom Packet Consumer', expectedType: 'packet' },
        },
        {
          id: 'custom-metadata-1',
          type: 'toolNode',
          position: { x: 400, y: 0 },
          data: { label: 'Custom AMI Consumer', configType: 'Metadata Tool', toolName: 'Custom AMI Consumer', expectedType: 'metadata' },
        },
        {
          id: 'custom-objects-1',
          type: 'toolNode',
          position: { x: 400, y: 100 },
          data: { label: 'Custom Objects Store', configType: 'Objects', toolName: 'Custom Objects Store', expectedType: 'objects' },
        }
      ];

      const edges = [
        { id: 'e-tap-gs', source: 'tap-1', target: 'gs-1' },
        { id: 'e-tap-pkt', source: 'tap-1', target: 'custom-packet-1' },
        { id: 'e-gs-meta', source: 'gs-1', target: 'custom-metadata-1' },
        { id: 'e-gs-obj', source: 'gs-1', target: 'custom-objects-1' },
      ];

      const streams: TrafficStream[] = [
        {
          id: 'stream-1',
          name: 'Traffic Flow',
          sourceNodeId: 'tap-1',
          vlan: '100',
          bandwidth: 10000,
          active: true,
          ipSrc: '10.0.0.1',
          ipDst: '10.0.0.2',
          portSrc: '1234',
          portDst: '80',
          protocol: 'tcp'
        }
      ];

      const result = calculateSimulationStep(nodes, edges, streams);
      
      // Custom packet tool gets the packet stream (10000 Mbps)
      expect(result.metrics['custom-packet-1']).toBeDefined();
      expect(result.metrics['custom-packet-1'].rxBps).toBe(10000);

      // Custom metadata tool gets the metadata stream (5% of 10000 = 500 Mbps)
      expect(result.metrics['custom-metadata-1']).toBeDefined();
      expect(result.metrics['custom-metadata-1'].rxBps).toBe(500);

      // Custom objects tool gets the metadata stream (5% of 10000 = 500 Mbps)
      expect(result.metrics['custom-objects-1']).toBeDefined();
      expect(result.metrics['custom-objects-1'].rxBps).toBe(500);
    });

    it('should split/load balance traffic evenly across connected tools', () => {
      const nodes: CustomNode[] = [
        {
          id: 'input-1',
          type: 'inputNode',
          position: { x: 0, y: 0 },
          data: { label: 'Port 1', configType: 'Network Port', linkSpeed: 10000 },
        },
        {
          id: 'gs-1',
          type: 'gigaStreamNode',
          position: { x: 200, y: 0 },
          data: { label: 'Load Balancer', configType: 'Load Balancing', algorithm: 'Round Robin' },
        },
        {
          id: 'tool-1',
          type: 'toolNode',
          position: { x: 400, y: -50 },
          data: { label: 'Tool 1', configType: 'Packet Tool' },
        },
        {
          id: 'tool-2',
          type: 'toolNode',
          position: { x: 400, y: 50 },
          data: { label: 'Tool 2', configType: 'Packet Tool' },
        },
      ];

      const edges = [
        { id: 'e-in-gs', source: 'input-1', target: 'gs-1' },
        { id: 'e-gs-t1', source: 'gs-1', target: 'tool-1' },
        { id: 'e-gs-t2', source: 'gs-1', target: 'tool-2' },
      ];

      const streams = [
        {
          id: 'stream-1',
          name: 'Test Stream',
          sourceNodeId: 'input-1',
          bandwidth: 6000,
          vlan: '100',
          active: true,
          ipSrc: '10.0.0.1',
          ipDst: '10.0.0.2',
          portSrc: '1234',
          portDst: '80',
          protocol: 'tcp',
        }
      ];

      const result = calculateSimulationStep(nodes, edges, streams);
      expect(result.metrics['gs-1'].rxBps).toBe(6000);
      expect(result.metrics['gs-1'].txBps).toBe(6000);

      // Tool 1 and Tool 2 should get 3000 Mbps each
      expect(result.metrics['tool-1'].rxBps).toBe(3000);
      expect(result.metrics['tool-2'].rxBps).toBe(3000);

      // Verify edge metrics
      expect(result.edgeMetrics['e-in-gs']).toBe(6000);
      expect(result.edgeMetrics['e-gs-t1']).toBe(3000);
      expect(result.edgeMetrics['e-gs-t2']).toBe(3000);
    });

    it('should route stream fully to one edge when algorithm is L4 Hash', () => {
      const nodes: CustomNode[] = [
        {
          id: 'input-1',
          type: 'inputNode',
          position: { x: 0, y: 0 },
          data: { label: 'Port 1', configType: 'Network Port', linkSpeed: 10000 },
        },
        {
          id: 'gs-1',
          type: 'gigaStreamNode',
          position: { x: 200, y: 0 },
          data: { label: 'Load Balancer', configType: 'Load Balancing', algorithm: 'L4 Hash' },
        },
        {
          id: 'tool-1',
          type: 'toolNode',
          position: { x: 400, y: -50 },
          data: { label: 'Tool 1', configType: 'Packet Tool' },
        },
        {
          id: 'tool-2',
          type: 'toolNode',
          position: { x: 400, y: 50 },
          data: { label: 'Tool 2', configType: 'Packet Tool' },
        },
      ];

      const edges = [
        { id: 'e-in-gs', source: 'input-1', target: 'gs-1' },
        { id: 'e-gs-t1', source: 'gs-1', target: 'tool-1' },
        { id: 'e-gs-t2', source: 'gs-1', target: 'tool-2' },
      ];

      const streams = [
        {
          id: 'stream-1',
          name: 'Test Stream',
          sourceNodeId: 'input-1',
          bandwidth: 6000,
          ipSrc: '10.0.0.1',
          ipDst: '10.0.0.2',
          portSrc: '1234',
          portDst: '80',
          protocol: 'tcp',
          vlan: '100',
          active: true,
        }
      ];

      const result = calculateSimulationStep(nodes, edges, streams);
      expect(result.metrics['gs-1'].rxBps).toBe(6000);

      // Verify that one tool gets the full 6000 Mbps and the other gets 0
      const rx1 = result.metrics['tool-1'].rxBps;
      const rx2 = result.metrics['tool-2'].rxBps;
      expect((rx1 === 6000 && rx2 === 0) || (rx1 === 0 && rx2 === 6000)).toBe(true);

      // Check corresponding edge metrics
      const edge1 = result.edgeMetrics['e-gs-t1'] || 0;
      const edge2 = result.edgeMetrics['e-gs-t2'] || 0;
      expect((edge1 === 6000 && edge2 === 0) || (edge1 === 0 && edge2 === 6000)).toBe(true);
    });

    it('should only route metadata stream to storage tool in advanced mode when metadata is generated by GigaSMART app', () => {
      const nodes: CustomNode[] = [
        {
          id: 'chassis-1',
          type: 'hardwareNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'GigaVUE-HC1-Plus',
            model: 'GigaVUE-HC1-Plus',
            configType: 'Chassis',
            gigaSmartApps: [
              {
                id: 'ami-app',
                actionType: 'Application Metadata',
                metadataFormat: 'JSON',
                metadataRate: 5,
              }
            ]
          }
        },
        {
          id: 'storage-1',
          type: 'toolNode',
          position: { x: 250, y: 0 },
          data: {
            label: 'S3 Object Storage',
            configType: 'Objects'
          }
        }
      ];

      const edges = [
        { id: 'e-ch-st', source: 'chassis-1', target: 'storage-1' }
      ];

      const streams = [
        {
          id: 'stream-1',
          name: 'Traffic Flow',
          sourceNodeId: 'chassis-1',
          bandwidth: 10000,
          ipSrc: '10.0.0.1',
          ipDst: '10.0.0.2',
          portSrc: '1234',
          portDst: '80',
          protocol: 'tcp',
          vlan: '100',
          active: true,
        }
      ];

      const result = calculateSimulationStep(nodes, edges, streams);
      expect(result.metrics['chassis-1'].txBps).toBe(10500);
      
      // S3 should only receive the 5% metadata stream (500 Mbps), not the main 10000 Mbps stream
      expect(result.metrics['storage-1'].rxBps).toBe(500);
      expect(result.edgeMetrics['e-ch-st']).toBe(500);
    });
  });

  describe('BOM Engine Baseline Optics', () => {
    it('should automatically suggest SFP-532 for MM TAP connected to GigaVUE-HC1', () => {
      const nodes: CustomNode[] = [
        {
          id: 'tap-1',
          type: 'hardwareNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'TAP-M251T',
            configType: 'TAP',
            model: 'TAP-M251T',
            sku: 'TAP-M251T',
            tappedLinksCount: 3,
            tappedLinkOptic: 'SFP-532 (10G SFP+ SR)',
          },
        },
        {
          id: 'hc-1',
          type: 'hardwareNode',
          position: { x: 200, y: 0 },
          data: {
            label: 'HC1 Chassis',
            configType: 'HC',
            model: 'GigaVUE-HC1',
          },
        },
      ];

      const edges = [
        { id: 'e-tap-hc', source: 'tap-1', target: 'hc-1' },
      ];

      const bom = generateBom(nodes, edges, 'Perpetual', '36');
      
      // Should suggest SFP-532T (or SFP-532) with quantity = 3 links * 2 = 6
      const sfp532Row = bom.find(row => row.sku === 'SFP-532T' || row.sku === 'SFP-532');
      expect(sfp532Row).toBeDefined();
      expect(sfp532Row?.qty).toBe(6);
    });

    it('should suggest Q28-502T for TA25E linked to HC1 Plus', () => {
      const nodes: CustomNode[] = [
        {
          id: 'ta-1',
          type: 'hardwareNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'TA25E',
            configType: 'TA',
            model: 'GigaVUE-TA25E',
          },
        },
        {
          id: 'hc-1',
          type: 'hardwareNode',
          position: { x: 200, y: 0 },
          data: {
            label: 'HC1 Plus',
            configType: 'HC',
            model: 'GigaVUE-HC1-Plus',
          },
        },
      ];

      const edges = [
        { id: 'e-ta-hc', source: 'ta-1', target: 'hc-1' },
      ];

      const bom = generateBom(nodes, edges, 'Perpetual', '36');

      // Both support 100G, so should suggest Q28-502T (or Q28-502)
      // Since TA25E rules list Q28-502T (100G QSFP28 SR4), and HC1-Plus rules list Q28-502T as well:
      const q28502tRow = bom.find(row => row.sku === 'Q28-502T' || row.sku === 'Q28-502');
      expect(q28502tRow).toBeDefined();
      // Should suggest 1 for TA25E and 1 for HC1-Plus = 2 total
      expect(q28502tRow?.qty).toBe(2);
    });

    it('should suggest region-based power supply cords (US, EU, UK) and DC cords', () => {
      const nodes: CustomNode[] = [
        {
          id: 'hc-1',
          type: 'hardwareNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'HC1',
            configType: 'HC',
            model: 'GigaVUE-HC1',
            powerSupply: 'AC'
          },
        },
        {
          id: 'ta-1',
          type: 'hardwareNode',
          position: { x: 200, y: 0 },
          data: {
            label: 'TA25E',
            configType: 'TA',
            model: 'GigaVUE-TA25E',
            powerSupply: 'DC'
          },
        }
      ];

      // US Region
      const bomUS = generateBom(nodes, [], 'HTL', '36', 'US');
      const usCord = bomUS.find(r => r.sku === 'PCD-00001');
      const dcCordUS = bomUS.find(r => r.sku === 'PCD-00051');
      expect(usCord?.qty).toBe(2);
      expect(dcCordUS?.qty).toBe(2);

      // EU Region
      const bomEU = generateBom(nodes, [], 'HTL', '36', 'EU');
      const euCord = bomEU.find(r => r.sku === 'PCD-00003');
      expect(euCord?.qty).toBe(2);

      // UK Region
      const bomUK = generateBom(nodes, [], 'HTL', '36', 'UK');
      const ukCord = bomUK.find(r => r.sku === 'PCD-00005');
      expect(ukCord?.qty).toBe(2);
    });

    it('should suggest upgrade license for TA400 when capacity is set to Upgrade', () => {
      const nodes: CustomNode[] = [
        {
          id: 'ta-1',
          type: 'hardwareNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'TA400E',
            configType: 'TA',
            model: 'GigaVUE-TA400E',
            portCapacity: 'Upgrade'
          },
        }
      ];

      // Perpetual
      const bomPerpetual = generateBom(nodes, [], 'Perpetual', '36');
      const upgradeRowPerp = bomPerpetual.find(r => r.sku === 'UPG-TAC40EA');
      expect(upgradeRowPerp).toBeDefined();
      expect(upgradeRowPerp?.qty).toBe(1);

      // HTL Term
      const bomHTL = generateBom(nodes, [], 'HTL', '36');
      const upgradeRowHTL = bomHTL.find(r => r.sku === 'UPG-TAC40EA-SW-TM');
      expect(upgradeRowHTL).toBeDefined();
      expect(upgradeRowHTL?.qty).toBe(1);
    });
  });
});
