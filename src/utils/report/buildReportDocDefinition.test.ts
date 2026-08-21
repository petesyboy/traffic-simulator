import { describe, it, expect } from 'vitest';
import { buildReportDocDefinition, type ReportInput } from './buildReportDocDefinition';
import type { CustomNode } from '../../store/types';

const baseInput: Omit<ReportInput, 'nodes' | 'edges'> = {
  trafficStreams: [],
  projectName: 'Test Project',
  projectRegion: 'US',
  projectLicenseMode: 'HTL',
  defaultTermDuration: '12',
  peakNodeRxMbps: {},
  advancedMode: false,
  diagramDataUrl: 'data:image/png;base64,AAAA',
  nodeMetrics: {},
  isRunning: false,
};

/** Recursively collects every string found under a `text` key anywhere in a pdfmake Content tree. */
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
    if ('ol' in obj) collectTexts(obj.ol, out);
  }
  return out;
}

describe('buildReportDocDefinition - Appendix A optic pack notes', () => {
  it('flags a rounded-up pack quantity with a customer-facing note in the BOM appendix', () => {
    const node: CustomNode = {
      id: 'ta',
      type: 'hardwareNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Core TA25E',
        model: 'GigaVUE-TA25E',
        sku: 'TA25E-BASE',
        powerSupply: 'AC',
        // 11x rounds up to a single 20-pack (11 > half of 20) - a deliberate surplus.
        optics: [{ board: 'Base Ports', optic: 'SFP-532T (10G SFP+ SR)', qty: 11 }],
      },
    } as CustomNode;

    const doc = buildReportDocDefinition({ ...baseInput, nodes: [node], edges: [] });
    const allText = collectTexts(doc.content).join(' ');

    expect(allText).toContain('SFP-532T-20P');
    expect(allText).toMatch(/💡.*Rounded up from 11/);
    expect(allText).toContain('more cost-effective and simpler to order');
    // The table-wide explanatory caption only appears when at least one row was flagged.
    expect(allText).toContain('include a small surplus of pre-fitted optics');
  });

  it('adds no note and no caption when nothing was rounded up', () => {
    const node: CustomNode = {
      id: 'ta',
      type: 'hardwareNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Core TA25E',
        model: 'GigaVUE-TA25E',
        sku: 'TA25E-BASE',
        powerSupply: 'AC',
        optics: [{ board: 'Base Ports', optic: 'SFP-532T (10G SFP+ SR)', qty: 6 }],
      },
    } as CustomNode;

    const doc = buildReportDocDefinition({ ...baseInput, nodes: [node], edges: [] });
    const allText = collectTexts(doc.content).join(' ');

    expect(allText).not.toContain('💡');
    expect(allText).not.toContain('include a small surplus');
  });

  it('renders Appendix B Physical Rack & Deployment report with multi-site breakdown and aggregate metrics', () => {
    const nodeA: CustomNode = {
      id: 'ta-site1',
      type: 'hardwareNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Datacentre A TA25E',
        model: 'GigaVUE-TA25E',
        sku: 'TA25E-BASE',
        powerSupply: 'AC',
        site: 'Datacentre A (North)',
        optics: [{ board: 'Base Ports', optic: 'SFP-532T (10G SFP+ SR)', qty: 2 }],
      },
    } as CustomNode;

    const nodeB: CustomNode = {
      id: 'ta-site2',
      type: 'hardwareNode',
      position: { x: 300, y: 0 },
      data: {
        label: 'Datacentre B TA25E',
        model: 'GigaVUE-TA25E',
        sku: 'TA25E-BASE',
        powerSupply: 'AC',
        site: 'Datacentre B (South)',
        optics: [{ board: 'Base Ports', optic: 'SFP-532T (10G SFP+ SR)', qty: 2 }],
      },
    } as CustomNode;

    const doc = buildReportDocDefinition({ ...baseInput, nodes: [nodeA, nodeB], edges: [] });
    const allText = collectTexts(doc.content).join(' ');

    expect(allText).toContain('Appendix B: Physical Rack & Deployment Report');
    expect(allText).toContain('Site-by-Site Deployment Breakdown');
    expect(allText).toContain('Datacentre A (North)');
    expect(allText).toContain('Datacentre B (South)');
    expect(allText).toContain('Master Aggregate Deployment (All Sites Combined)');
    expect(allText).toContain('Total Space Required');
    expect(allText).toContain('Total Max Power');
  });

  it('renders tool ingest capacity advisory notice when tool nodes are present', () => {
    const toolNode: CustomNode = {
      id: 'tool-1',
      type: 'toolNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Vectra NDR',
        toolName: 'Vectra',
        ingestLimitMbps: 10000,
      },
    } as CustomNode;

    const doc = buildReportDocDefinition({ ...baseInput, nodes: [toolNode], edges: [] });
    const allText = collectTexts(doc.content).join(' ');

    expect(allText).toContain('Destinations & Tools');
    expect(allText).toContain('Important Notice: Tool Ingest Capacities & Vendor Verification');
    expect(allText).toContain('simulation baseline assumptions and estimates only');
    expect(allText).toContain('consult the respective tool, probe, or sensor manufacturer directly');
  });
});

