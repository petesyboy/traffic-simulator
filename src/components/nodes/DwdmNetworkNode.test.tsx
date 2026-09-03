import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactFlowProvider } from '@xyflow/react';
import { DwdmNetworkNode } from './DwdmNetworkNode';
import type { CustomNode, HardwareNodeData, TrafficStream } from '../../store/types';
import { syncPortAssignments } from '../../utils/portSync';
import { calculateSimulationStep } from '../../utils/simulation';
import { NODE_TYPES, CONFIG_TYPES } from '../../constants/nodeTypes';

describe('DwdmNetworkNode', () => {
  it('renders optical transport network details with lambda symbol and no cloud icon', () => {
    const nodeData = {
      label: 'Metro Core DWDM Ring',
      configType: CONFIG_TYPES.DWDM_NETWORK,
      wavelengthSpeed: '100G',
      protectionMode: 'Protected Ring (1+1)',
      spanDistanceKm: 50,
      latencyMs: 2.5,
      carrierName: 'Carrier Wavelength Network',
    };

    const html = renderToStaticMarkup(
      <ReactFlowProvider>
        <DwdmNetworkNode
          {...({
            id: 'dwdm-1',
            data: nodeData,
            selected: false,
            type: NODE_TYPES.DWDM_NETWORK,
            zIndex: 1,
            isConnectable: true,
            positionAbsoluteX: 0,
            positionAbsoluteY: 0,
            dragging: false,
            draggable: true,
            selectable: true,
            deletable: true,
          } as any)}
        />
      </ReactFlowProvider>
    );

    // Verify key optical transport labels
    expect(html).toContain('Metro Core DWDM Ring');
    expect(html).toContain('λ');
    expect(html).toContain('100G Wavelength');
    expect(html).toContain('Protected Ring (1+1)');
    expect(html).toContain('Carrier Wavelength Network');
    expect(html).toContain('Span: 50 km (2.5 ms)');

    // Strictly ensure no cloud icon is rendered
    expect(html).not.toContain('☁️');
    expect(html).not.toContain('cloud');
  });

  it('allocates QSFP cages on TA200 when connected to a 100G DWDM transport network', () => {
    const dwdm: CustomNode = {
      id: 'dwdm-ring',
      type: NODE_TYPES.DWDM_NETWORK,
      position: { x: 400, y: 100 },
      data: {
        label: 'Metro DWDM Ring',
        configType: CONFIG_TYPES.DWDM_NETWORK,
        wavelengthSpeed: '100G',
      },
    } as CustomNode;

    const ta200: CustomNode = {
      id: 'dc1-ta200',
      type: NODE_TYPES.HARDWARE,
      position: { x: 100, y: 100 },
      data: {
        label: 'DC1 TA200',
        model: 'GigaVUE-TA200',
      } as HardwareNodeData,
    } as CustomNode;

    const nodes = [dwdm, ta200];
    const edges = syncPortAssignments(nodes, [
      { id: 'e1', source: 'dc1-ta200', target: 'dwdm-ring' },
      { id: 'e2', source: 'dc1-ta200', target: 'dwdm-ring' },
    ]);

    // Both redundant 100G links should land on QSFP cages (1/1/c1, 1/1/c2)
    expect(edges).toHaveLength(2);
    expect((edges[0].data as any)?.portLinks?.[0]?.sourcePortId).toBe('1/1/c1');
    expect((edges[1].data as any)?.portLinks?.[0]?.sourcePortId).toBe('1/1/c2');
  });

  it('allocates SFP cages on TA25E when connected to a 25G DWDM transport network', () => {
    const dwdm: CustomNode = {
      id: 'dwdm-ring',
      type: NODE_TYPES.DWDM_NETWORK,
      position: { x: 400, y: 100 },
      data: {
        label: 'Metro DWDM Ring',
        configType: CONFIG_TYPES.DWDM_NETWORK,
        wavelengthSpeed: '25G',
      },
    } as CustomNode;

    const ta25: CustomNode = {
      id: 'dc2-ta25',
      type: NODE_TYPES.HARDWARE,
      position: { x: 100, y: 100 },
      data: {
        label: 'DC2 TA25E',
        model: 'GigaVUE-TA25E',
      } as HardwareNodeData,
    } as CustomNode;

    const nodes = [dwdm, ta25];
    const edges = syncPortAssignments(nodes, [
      { id: 'e1', source: 'dc2-ta25', target: 'dwdm-ring' },
    ]);

    // 25G link lands on SFP cage (1/1/x1)
    expect(edges).toHaveLength(1);
    expect((edges[0].data as any)?.portLinks?.[0]?.sourcePortId).toBe('1/1/x1');
  });

  it('forwards simulation traffic across the DWDM transport network to destination nodes', () => {
    const sourceNode: CustomNode = {
      id: 'src-1',
      type: NODE_TYPES.INPUT,
      position: { x: 0, y: 0 },
      data: { label: 'DC1 Core SPAN', configType: CONFIG_TYPES.SPAN, linkSpeed: 100000 },
    } as CustomNode;

    const dwdm: CustomNode = {
      id: 'dwdm-wan',
      type: NODE_TYPES.DWDM_NETWORK,
      position: { x: 200, y: 0 },
      data: { label: 'DWDM Optical Mesh', configType: CONFIG_TYPES.DWDM_NETWORK, wavelengthSpeed: '100G' },
    } as CustomNode;

    const destNode: CustomNode = {
      id: 'dst-1',
      type: NODE_TYPES.TOOL,
      position: { x: 400, y: 0 },
      data: { label: 'DC2 Central Analytics', configType: CONFIG_TYPES.PACKET_TOOL, expectedType: 'packet' },
    } as CustomNode;

    const nodes = [sourceNode, dwdm, destNode];
    const edges = [
      { id: 'e1', source: 'src-1', target: 'dwdm-wan' },
      { id: 'e2', source: 'dwdm-wan', target: 'dst-1' },
    ];

    const stream: TrafficStream = {
      id: 'stream-1',
      name: 'Stream 1',
      sourceNodeId: 'src-1',
      vlan: '100',
      ipSrc: '10.0.0.1',
      ipDst: '10.0.0.2',
      portSrc: '443',
      portDst: '443',
      bandwidth: 40000,
      protocol: 'TCP',
      active: true,
    };

    const result = calculateSimulationStep(nodes, edges, [stream]);
    expect(result.metrics['dwdm-wan']).toBeDefined();
    expect(result.metrics['dwdm-wan'].rxMbps).toBe(40000);
    expect(result.metrics['dst-1']).toBeDefined();
    expect(result.metrics['dst-1'].rxMbps).toBe(40000);
  });
});

describe('DwdmNetworkNode ports', () => {
  const render = () =>
    renderToStaticMarkup(
      <ReactFlowProvider>
        <DwdmNetworkNode
          {...({
            id: 'dwdm-1',
            data: { label: 'Metro Ring', configType: CONFIG_TYPES.DWDM_NETWORK },
            selected: false,
            type: NODE_TYPES.DWDM_NETWORK,
            zIndex: 1,
            isConnectable: true,
            positionAbsoluteX: 0,
            positionAbsoluteY: 0,
            dragging: false,
            draggable: true,
            selectable: true,
            deletable: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)}
        />
      </ReactFlowProvider>,
    );

  it('offers ingress and egress on all four sides', () => {
    const html = render();
    const ports = (html.match(/<div[^>]*react-flow__handle[^>]*>/g) || []).map((tag) => ({
      id: (tag.match(/data-handleid="([^"]*)"/) || [])[1],
      pos: (tag.match(/data-handlepos="([^"]*)"/) || [])[1],
      kind: tag.includes(' source ') ? 'source' : 'target',
    }));

    // These ids are what every saved project's ring links resolve against, so
    // renaming one silently breaks existing topologies.
    expect(ports.map((p) => p.id).sort()).toEqual([
      'in-bottom', 'in-left', 'in-right', 'in-top',
      'out-bottom', 'out-left', 'out-right', 'out-top',
    ]);
    expect(ports.filter((p) => p.kind === 'target')).toHaveLength(4);
    expect(ports.filter((p) => p.kind === 'source')).toHaveLength(4);
    ports.forEach((p) => {
      expect(p.id.startsWith(p.kind === 'target' ? 'in-' : 'out-')).toBe(true);
      expect(p.id.endsWith(p.pos as string)).toBe(true);
    });
  });

  it('names every port so hovering explains what it accepts', () => {
    const html = render();
    const titles = (html.match(/title="[^"]*(?:Ingress|Egress)[^"]*"/g) || []).length;
    expect(titles).toBe(8);
  });
});
