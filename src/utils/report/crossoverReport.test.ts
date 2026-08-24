import { describe, it, expect } from 'vitest';
import { buildCrossoverReportDocDefinition } from './crossoverReport';
import type { ReportInput } from './buildReportDocDefinition';
import type { CustomNode } from '../../store/types';

const baseInput: Omit<ReportInput, 'nodes' | 'edges'> = {
  trafficStreams: [],
  projectName: 'Core Visibility Upgrade',
  projectRegion: 'APAC',
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

describe('buildCrossoverReportDocDefinition', () => {
  it('generates a split decision report comparing Option A and Option B with recommendations', () => {
    const nodes: CustomNode[] = [
      {
        id: 'hc3-1',
        type: 'hardwareNode',
        position: { x: 0, y: 0 },
        data: { label: 'Core HC3', model: 'GigaVUE-HC3', sku: 'GVS-HC301' },
      } as CustomNode,
    ];

    const doc = buildCrossoverReportDocDefinition({
      ...baseInput,
      nodes,
      edges: [],
    });

    const allText = collectTexts(doc.content).join(' ');
    expect(allText).toContain('Crossover: Core Visibility Upgrade');
    expect(allText).toContain('OPTION A · RECOMMENDED');
    expect(allText).toContain('OPTION B · ALTERNATIVE');
    expect(allText).toContain('High Availability & Resiliency');
    expect(allText).toContain('Side-by-Side Architectural Trade-Offs');
  });
});
