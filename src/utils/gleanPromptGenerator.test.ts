import { describe, it, expect } from 'vitest';
import { generateGleanExecutiveSummaryPrompt } from './gleanPromptGenerator';
import type { CustomNode, TrafficStream } from '../store/types';
import type { Edge } from '@xyflow/react';
import { NODE_TYPES, CONFIG_TYPES } from '../constants/nodeTypes';

describe('gleanPromptGenerator', () => {
  it('generates a comprehensive prompt with BOM, physical specs, and Glean instructions', async () => {
    const mockNodes: CustomNode[] = [
      {
        id: 'tap-1',
        type: NODE_TYPES.INPUT,
        position: { x: 0, y: 0 },
        data: {
          configType: CONFIG_TYPES.TAP,
          label: 'Core TAP 1',
          site: 'Stockholm DC1',
        },
      },
      {
        id: 'chassis-1',
        type: NODE_TYPES.HARDWARE,
        position: { x: 200, y: 0 },
        data: {
          configType: 'Hardware',
          model: 'GigaVUE-HC3',
          label: 'HC3 Aggregator',
          site: 'Stockholm DC1',
        },
      },
      {
        id: 'tool-1',
        type: NODE_TYPES.TOOL,
        position: { x: 400, y: 0 },
        data: {
          configType: CONFIG_TYPES.PACKET_TOOL,
          label: 'Splunk',
          name: 'Splunk',
          toolType: 'SIEM',
          site: 'Stockholm DC1',
        },
      },
    ];

    const mockEdges: Edge[] = [
      { id: 'e1', source: 'tap-1', target: 'chassis-1' },
      { id: 'e2', source: 'chassis-1', target: 'tool-1' },
    ];

    const mockStreams: TrafficStream[] = [
      {
        id: 's1',
        name: 'Web Traffic',
        bandwidth: 4500,
        protocol: 'TCP',
        active: true,
        sourceNodeId: 'tap-1',
        vlan: '10',
        ipSrc: '10.0.0.1',
        ipDst: '10.0.0.2',
        portSrc: '443',
        portDst: '443',
      },
    ];

    const prompt = await generateGleanExecutiveSummaryPrompt({
      nodes: mockNodes,
      edges: mockEdges,
      trafficStreams: mockStreams,
      scenarioName: 'Nordic Bank Visibility',
      projectRegion: 'EU',
      projectLicenseMode: 'HTL',
      defaultTermDuration: '36',
    });

    expect(prompt).toContain('# GIGAMON GLEAN AI PROMPT');
    expect(prompt).toContain('ROLE & OBJECTIVE FOR GLEAN AI');
    expect(prompt).toContain('British English spelling');
    expect(prompt).toContain('### Scope Considerations & Key Assumptions');
    expect(prompt).toContain('Nordic Bank Visibility');
    expect(prompt).toContain('Stockholm DC1');
    expect(prompt).toContain('GigaVUE-HC3');
    expect(prompt).toContain('Splunk');
    expect(prompt).toContain('Traffic profiles, stream volumes, and specific protocol distributions will be established');
    expect(prompt).toContain('Northbound and Southbound duplex split');
  });

  it('handles empty topologies gracefully without crashing', async () => {
    const prompt = await generateGleanExecutiveSummaryPrompt({
      nodes: [],
      edges: [],
      trafficStreams: [],
      scenarioName: 'Empty Solution',
    });

    expect(prompt).toContain('# GIGAMON GLEAN AI PROMPT');
    expect(prompt).toContain('Empty Solution');
    expect(prompt).toContain('_No hardware or software components provisioned in BOM._');
    expect(prompt).toContain('_No rack-mountable equipment required._');
  });

  it('indicates that traffic profiles are defined during technical scoping without guessing bandwidth or protocols', async () => {
    const mockNodes: CustomNode[] = [
      {
        id: 'chassis-1',
        type: NODE_TYPES.HARDWARE,
        position: { x: 0, y: 0 },
        data: {
          configType: 'Hardware',
          label: 'TA200 Aggregator',
          model: 'GigaVUE-TA200',
          site: 'Frankfurt',
        },
      },
    ];

    const streams: TrafficStream[] = Array.from({ length: 40 }, (_, i) => ({
      id: `stream-${i}`,
      name: `Stream-${i}`,
      bandwidth: (i + 1) * 100,
      protocol: 'UDP',
      active: true,
      sourceNodeId: 'chassis-1',
      vlan: '10',
      ipSrc: '10.0.0.1',
      ipDst: '10.0.0.2',
      portSrc: '80',
      portDst: '80',
    }));

    const prompt = await generateGleanExecutiveSummaryPrompt({
      nodes: mockNodes,
      edges: [],
      trafficStreams: streams,
      scenarioName: 'Heavy Traffic Test',
    });

    expect(prompt).toContain('Traffic profiles, stream volumes, and specific protocol distributions will be established during customer technical scoping');
    expect(prompt).toContain('The Gigamon architecture provides non-blocking, line-rate capture');
  });
});
