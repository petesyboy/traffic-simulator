import { describe, it, expect } from 'vitest';
import { generateBom } from '../bomEngine';
import { type CustomNode, type TrafficStream } from '../../store/types';
import { CONFIG_TYPES } from '../../constants/nodeTypes';
import { calculateSimulationStep } from '../simulation';
import { runGigaSmartApps } from './gigaSmartAppsPipeline';

describe('GigaSMART Tunnel Decapsulation on HC units', () => {
  describe('Licensing resolution', () => {
    it('requires Tunnelling licence on HC1 for ERSPAN decapsulation', () => {
      const hc1Node: CustomNode = {
        id: 'hc1-1',
        type: 'hardwareNode',
        position: { x: 0, y: 0 },
        data: {
          label: 'GigaVUE-HC1',
          configType: 'Hardware',
          model: 'GigaVUE-HC1',
          sku: 'GVS-HC101-HW',
          gigaSmartApps: [
            {
              id: 'app-erspan-decap',
              label: 'Tunnel Decapsulation',
              actionType: 'ERSPAN Tunnel Decapsulation',
              tunnelMode: 'ERSPAN Decapsulation',
              erspanType: 'Type II',
            },
          ],
        },
      };

      const htlBom = generateBom([hc1Node], [], 'HTL', '36', 'US');
      expect(htlBom.find(r => r.sku === 'SMT-HC1-GEN2-TUN-SW-TM')).toBeDefined();

      const perpBom = generateBom([hc1Node], [], 'Perpetual', '12', 'US');
      expect(perpBom.find(r => r.sku === 'SMT-HC1-TUN')).toBeDefined();
    });

    it('requires Tunnelling licence on HC1 for VXLAN, L2GRE, and IP tunnel decapsulation', () => {
      const hc1Node: CustomNode = {
        id: 'hc1-vxlan',
        type: 'hardwareNode',
        position: { x: 0, y: 0 },
        data: {
          label: 'GigaVUE-HC1',
          configType: 'Hardware',
          model: 'GigaVUE-HC1',
          sku: 'GVS-HC101-HW',
          gigaSmartApps: [
            {
              id: 'app-vxlan',
              label: 'Tunnel Decapsulation',
              actionType: 'VXLAN Tunnel Decapsulation',
              tunnelMode: 'VXLAN Decapsulation',
            },
          ],
        },
      };

      const perpBom = generateBom([hc1Node], [], 'Perpetual', '12', 'US');
      expect(perpBom.find(r => r.sku === 'SMT-HC1-TUN')).toBeDefined();
    });

    it('requires Advanced Tunnelling on HC3 for ERSPAN decapsulation (Types II & III)', () => {
      const hc3Node: CustomNode = {
        id: 'hc3-erspan',
        type: 'hardwareNode',
        position: { x: 0, y: 0 },
        data: {
          label: 'GigaVUE-HC3',
          configType: 'Hardware',
          model: 'GigaVUE-HC3',
          sku: 'GVS-HC301-HW',
          gigaSmartApps: [
            {
              id: 'app-erspan-hc3',
              label: 'Tunnel Decapsulation',
              actionType: 'ERSPAN Tunnel Decapsulation',
              tunnelMode: 'ERSPAN Decapsulation',
              erspanType: 'Type III',
            },
          ],
        },
      };

      const htlBom = generateBom([hc3Node], [], 'HTL', '36', 'US');
      expect(htlBom.find(r => r.sku === 'SMT-HC3-GEN3-TUN-SW-TM')).toBeDefined();

      const perpBom = generateBom([hc3Node], [], 'Perpetual', '12', 'US');
      expect(perpBom.find(r => r.sku === 'SMT-HC3-GEN3-TUN')).toBeDefined();
    });

    it('includes VXLAN, L2GRE, IP tunnel, and Custom tunnel decapsulation in base licence on HC3', () => {
      const hc3Node: CustomNode = {
        id: 'hc3-base-decap',
        type: 'hardwareNode',
        position: { x: 0, y: 0 },
        data: {
          label: 'GigaVUE-HC3',
          configType: 'Hardware',
          model: 'GigaVUE-HC3',
          sku: 'GVS-HC301-HW',
          gigaSmartApps: [
            {
              id: 'app-vxlan-hc3',
              label: 'Tunnel Decapsulation',
              actionType: 'VXLAN Tunnel Decapsulation',
              tunnelMode: 'VXLAN Decapsulation',
            },
            {
              id: 'app-l2gre-hc3',
              label: 'Tunnel Decapsulation',
              actionType: 'L2GRE Tunnel Decapsulation',
              tunnelMode: 'L2GRE Decapsulation',
            },
            {
              id: 'app-ip-hc3',
              label: 'Tunnel Decapsulation',
              actionType: 'IP Tunnel Decapsulation',
              tunnelMode: 'IP Tunnel Decapsulation',
            },
            {
              id: 'app-custom-hc3',
              label: 'Tunnel Decapsulation',
              actionType: 'Custom Tunnel Decapsulation',
              tunnelMode: 'Custom Tunnel Decapsulation',
            },
          ],
        },
      };

      const perpBom = generateBom([hc3Node], [], 'Perpetual', '12', 'US');
      // No extra Advanced Tunnelling licence should be generated for these standard decap functions on HC3
      expect(perpBom.find(r => r.sku === 'SMT-HC3-GEN3-TUN')).toBeUndefined();
    });

    it('requires Advanced Tunnelling on HC3 when tunnel encapsulation is requested', () => {
      const hc3Node: CustomNode = {
        id: 'hc3-encap',
        type: 'hardwareNode',
        position: { x: 0, y: 0 },
        data: {
          label: 'GigaVUE-HC3',
          configType: 'Hardware',
          model: 'GigaVUE-HC3',
          sku: 'GVS-HC301-HW',
          gigaSmartApps: [
            {
              id: 'app-vxlan-encap',
              label: 'VXLAN Encapsulation',
              actionType: 'VXLAN Tunnel Encapsulation',
              tunnelMode: 'VXLAN Encapsulation',
            },
          ],
        },
      };

      const perpBom = generateBom([hc3Node], [], 'Perpetual', '12', 'US');
      expect(perpBom.find(r => r.sku === 'SMT-HC3-GEN3-TUN')).toBeDefined();
    });
  });

  describe('Traffic Decapsulation & Pipeline execution', () => {
    it('strips ERSPAN encapsulation overhead and restores inner payload metadata', () => {
      const stream: TrafficStream = {
        id: 'stream-erspan-1',
        name: 'ERSPAN Feed',
        sourceNodeId: 'node-erspan-src',
        vlan: '100',
        ipSrc: '192.168.10.5',
        ipDst: '192.168.10.100',
        portSrc: '50000',
        portDst: '0',
        protocol: 'gre',
        bandwidth: 1000,
        active: true,
        isEncapsulated: true,
        encapsulationType: 'ERSPAN',
        erspanType: 'Type II',
        tunnelId: 10,
        tunnelDestIp: '192.168.10.100',
        innerIpSrc: '10.0.0.25',
        innerIpDst: '172.16.1.50',
        innerPortSrc: '49152',
        innerPortDst: '80',
        innerProtocol: 'tcp',
      };

      const nodeMetric = {
        rxMbps: 0,
        txMbps: 0,
        rxPackets: 0,
        txPackets: 0,
        droppedPackets: 0,
        gigaSmartDroppedMbps: 0,
      };

      const result = runGigaSmartApps(
        stream,
        [
          {
            label: 'Tunnel Decapsulation',
            configType: 'Tunneling',
            actionType: 'ERSPAN Tunnel Decapsulation',
            tunnelMode: 'ERSPAN Decapsulation',
            erspanType: 'Type II',
          },
        ],
        nodeMetric
      );

      // Verify outer overhead was stripped (~4.5% reduction for ERSPAN 42B overhead)
      expect(result.forwardStream.bandwidth).toBeCloseTo(955, 0);
      expect(nodeMetric.gigaSmartDroppedMbps).toBeCloseTo(45, 0);

      // Verify stream is no longer encapsulated and inner payload is restored
      expect(result.forwardStream.isEncapsulated).toBe(false);
      expect(result.forwardStream.isDecapsulated).toBe(true);
      expect(result.forwardStream.ipSrc).toBe('10.0.0.25');
      expect(result.forwardStream.ipDst).toBe('172.16.1.50');
      expect(result.forwardStream.portDst).toBe('80');
      expect(result.forwardStream.protocol).toBe('tcp');
    });

    it('routes decapsulated ERSPAN traffic through FlowMap to sensor tools', () => {
      const erspanSourceNode: CustomNode = {
        id: 'node-erspan-source',
        type: 'inputNode',
        position: { x: 0, y: 0 },
        data: {
          label: 'ERSPAN Tunnel Source',
          configType: CONFIG_TYPES.ERSPAN,
          erspanType: 'Type II',
          erspanId: 10,
          erspanSrcIp: '192.168.10.5',
          erspanDestIp: '192.168.10.100',
          linkSpeed: 10000,
        },
      };

      const hcChassisNode: CustomNode = {
        id: 'node-hc-chassis',
        type: 'hardwareNode',
        position: { x: 200, y: 0 },
        data: {
          label: 'GigaVUE-HC3',
          configType: 'Hardware',
          model: 'GigaVUE-HC3',
          gigaSmartApps: [
            {
              id: 'gs-decap',
              label: 'Tunnel Decapsulation',
              actionType: 'ERSPAN Tunnel Decapsulation',
              tunnelMode: 'ERSPAN Decapsulation',
              erspanType: 'Type II',
            },
          ],
        },
      };

      const flowMapNode: CustomNode = {
        id: 'node-map',
        type: 'mapNode',
        position: { x: 400, y: 0 },
        data: {
          label: 'HTTP Web Traffic Map',
          configType: CONFIG_TYPES.TRAFFIC_MAP,
          conditions: [
            { logic: 'AND', field: 'protocol', value: 'tcp' },
            { logic: 'AND', field: 'portdst', value: '80' },
          ],
        },
      };

      const sensorToolNode: CustomNode = {
        id: 'node-tool',
        type: 'toolNode',
        position: { x: 600, y: 0 },
        data: {
          label: 'ExtraHop Sensor',
          configType: CONFIG_TYPES.PACKET_TOOL,
          toolName: 'ExtraHop',
        },
      };

      const edges = [
        { id: 'e1', source: 'node-erspan-source', target: 'node-hc-chassis' },
        { id: 'e2', source: 'node-hc-chassis', target: 'node-map' },
        { id: 'e3', source: 'node-map', target: 'node-tool' },
      ];

      const trafficStream: TrafficStream = {
        id: 'stream-erspan-web',
        name: 'ERSPAN Web Stream',
        sourceNodeId: 'node-erspan-source',
        vlan: '100',
        ipSrc: '192.168.10.5',
        ipDst: '192.168.10.100',
        portSrc: '49152',
        portDst: '0',
        protocol: 'gre',
        bandwidth: 1000,
        active: true,
        isEncapsulated: true,
        encapsulationType: 'ERSPAN',
        erspanType: 'Type II',
        tunnelId: 10,
        tunnelDestIp: '192.168.10.100',
        innerIpSrc: '192.168.1.50',
        innerIpDst: '10.0.0.10',
        innerPortSrc: '54321',
        innerPortDst: '80',
        innerProtocol: 'tcp',
      };

      const result = calculateSimulationStep(
        [erspanSourceNode, hcChassisNode, flowMapNode, sensorToolNode],
        edges,
        [trafficStream]
      );

      // Verify traffic successfully reached the downstream sensor tool through the FlowMap
      expect(result.metrics['node-tool'].rxMbps).toBeGreaterThan(900);
      expect(result.deliveredStreamIds).toContain('stream-erspan-web');
      expect(result.activeEdges).toContain('e3');
    });
  });
});
