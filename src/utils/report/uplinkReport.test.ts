import { describe, it, expect } from 'vitest';
import { buildUplinkReportDocDefinition } from './uplinkReport';
import type { ReportInput } from './buildReportDocDefinition';
import type { CustomNode } from '../../store/types';

const baseInput: Omit<ReportInput, 'nodes' | 'edges'> = {
  trafficStreams: [],
  projectName: 'Greenland Telco Core',
  projectRegion: 'EMEA',
  projectLicenseMode: 'HTL',
  defaultTermDuration: '36',
  peakNodeRxMbps: {},
  advancedMode: true,
  diagramDataUrl: 'data:image/png;base64,AAAA',
  nodeMetrics: {},
  isRunning: false,
};

function collectTexts(node: unknown, out: string[] = []): string[] {
  if (node == null) return out;
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((n) => collectTexts(n, out));
    return out;
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if ('text' in obj) collectTexts(obj.text, out);
    if ('stack' in obj) collectTexts(obj.stack, out);
    if ('columns' in obj) collectTexts(obj.columns, out);
    if ('table' in obj) collectTexts((obj.table as Record<string, unknown>).body, out);
    if ('ul' in obj) collectTexts(obj.ul, out);
  }
  return out;
}

describe('buildUplinkReportDocDefinition', () => {
  it('generates an executive brief with milestone progression and outcome reframes', () => {
    const nodes: CustomNode[] = [
      {
        id: 'tap-1',
        type: 'hardwareNode',
        position: { x: 0, y: 0 },
        data: { label: 'TAP 1', model: 'TAP-M273T', sku: 'TAP-M273T' },
      } as CustomNode,
      {
        id: 'tool-1',
        type: 'toolNode',
        position: { x: 100, y: 0 },
        data: { label: 'Splunk Core', toolName: 'Splunk' },
      } as CustomNode,
    ];

    const doc = buildUplinkReportDocDefinition({
      ...baseInput,
      nodes,
      edges: [],
    });

    const allText = collectTexts(doc.content).join(' ');
    expect(allText).toContain('EXECUTIVE VISIBILITY BRIEF · UPLINK');
    expect(allText).toContain('Greenland Telco Core');
    expect(allText).toContain('6 Monitored Links');
    expect(allText).toContain('12 Ingress Optical Feeds');
    expect(allText).toContain('1 Destination Tools');
    expect(allText).toContain('Risk Mitigation');
    expect(allText).toContain('Tool Cost Optimisation');
  });
});
