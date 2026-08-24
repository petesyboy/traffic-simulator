import { describe, it, expect } from 'vitest';
import { buildPatchSheetReportDocDefinition } from './patchSheetReport';
import type { ReportInput } from './buildReportDocDefinition';
import type { CustomNode } from '../../store/types';

const baseInput: Omit<ReportInput, 'nodes' | 'edges'> = {
  trafficStreams: [],
  projectName: 'Datacentre North',
  projectRegion: 'US',
  projectLicenseMode: 'Perpetual',
  defaultTermDuration: '12',
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

describe('buildPatchSheetReportDocDefinition', () => {
  it('generates a monospace commissioning work order with document control and checklist', () => {
    const nodes: CustomNode[] = [
      {
        id: 'hc3-1',
        type: 'hardwareNode',
        position: { x: 0, y: 0 },
        data: { label: 'Core HC3', model: 'GigaVUE-HC3', sku: 'GVS-HC301' },
      } as CustomNode,
      {
        id: 'tray-1',
        type: 'hardwareNode',
        position: { x: 50, y: 0 },
        data: { label: 'TAP Tray 1', model: 'TAP-M200T', sku: 'TAP-M200T' },
      } as CustomNode,
    ];

    const doc = buildPatchSheetReportDocDefinition({
      ...baseInput,
      nodes,
      edges: [],
    });

    const allText = collectTexts(doc.content).join(' ');
    expect(allText).toContain('FIELD INSTALLATION & PATCH SHEET — DATACENTRE NORTH');
    expect(allText).toContain('WORK ORDER REV');
    expect(allText).toContain('SECTION 01: COMMISSIONING & PHYSICAL MOUNTING CHECKLIST');
    expect(allText).toContain('INSTALLATION TECHNICIAN SIGN-OFF');
    expect(doc.defaultStyle?.font).toBe('Courier');
  });
});
