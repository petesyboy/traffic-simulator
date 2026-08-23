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

  it('deduplicates multiple identical tool nodes into a single consolidated description', () => {
    const probeNodes: CustomNode[] = Array.from({ length: 5 }, (_, i) => ({
      id: `probe-${i + 1}`,
      type: 'toolNode',
      position: { x: 0, y: i * 50 },
      data: {
        label: `Ericsson Probe ${i + 1}`,
        toolName: 'Ericsson Probe',
        configType: 'Packet Tool',
        site: i < 3 ? 'Site A' : 'Site B',
      },
    })) as CustomNode[];

    const doc = buildReportDocDefinition({ ...baseInput, nodes: probeNodes, edges: [] });
    const allText = collectTexts(doc.content).join(' ');

    expect(allText).toContain('Ericsson Probe (5 instances deployed across 2 sites: 3 at Site A, 2 at Site B)');
    // Description should appear once, not 5 times
    const occurrences = (allText.match(/Monitors and analyses the traffic it receives/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it('deduplicates multiple identical chassis into a single consolidated description', () => {
    const ta25Nodes: CustomNode[] = [
      {
        id: 'ta25-1',
        type: 'hardwareNode',
        position: { x: 0, y: 0 },
        data: {
          label: 'Leaf TA25E #1',
          model: 'GigaVUE-TA25E',
          sku: 'GVS-TA2501',
        },
      } as CustomNode,
      {
        id: 'ta25-2',
        type: 'hardwareNode',
        position: { x: 100, y: 0 },
        data: {
          label: 'Leaf TA25E #2',
          model: 'GigaVUE-TA25E',
          sku: 'GVS-TA2501',
        },
      } as CustomNode,
    ];

    const doc = buildReportDocDefinition({ ...baseInput, nodes: ta25Nodes, edges: [] });
    const allText = collectTexts(doc.content).join(' ');

    expect(allText).toContain('GigaVUE-TA25E (GVS-TA2501) (2 units deployed: Leaf TA25E #1, Leaf TA25E #2)');
    // Chassis description should appear once
    const occurrences = (allText.match(/a 1RU, high-density 25GbE traffic aggregation node/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it('embeds siteRackImages in Appendix B', () => {
    const node: CustomNode = {
      id: 'hw-1',
      type: 'hardwareNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'DC1 TA25',
        model: 'GigaVUE-TA25',
        sku: 'GVS-TA2501',
        site: 'DC1',
      },
    } as CustomNode;

    const doc = buildReportDocDefinition({
      ...baseInput,
      nodes: [node],
      edges: [],
      siteRackImages: {
        DC1: 'data:image/png;base64,fake-rack-image',
      },
    });

    // Verify document contains the rack image
    const stringified = JSON.stringify(doc.content);
    expect(stringified).toContain('data:image/png;base64,fake-rack-image');
  });

  it('renders split site architecture diagrams when siteDiagrams are provided', () => {
    const doc = buildReportDocDefinition({
      ...baseInput,
      nodes: [],
      edges: [],
      siteDiagrams: {
        'Site A': 'data:image/png;base64,site-a-diagram',
        'Site B': 'data:image/png;base64,site-b-diagram',
      },
    });

    const allText = collectTexts(doc.content).join(' ');
    expect(allText).toContain('End-to-End Multi-Site Architecture Overview');
    expect(allText).toContain('Site Architecture Breakdown — Site A');
    expect(allText).toContain('Site Architecture Breakdown — Site B');

    const stringified = JSON.stringify(doc.content);
    expect(stringified).toContain('data:image/png;base64,site-a-diagram');
    expect(stringified).toContain('data:image/png;base64,site-b-diagram');
  });

  it('deduplicates optical TAP modules and consolidates TAP trays into a single mention', () => {
    const tapNodes: CustomNode[] = Array.from({ length: 8 }, (_, i) => ({
      id: `tap-${i + 1}`,
      type: 'hardwareNode',
      position: { x: 0, y: i * 50 },
      data: {
        label: `TAP-M273T #${i + 1}`,
        model: 'TAP-M273T',
        sku: 'TAP-M273T',
        tappedLinksCount: 6,
        site: i < 4 ? 'Site A' : 'Site B',
      },
    })) as CustomNode[];

    const trayNodes: CustomNode[] = [
      {
        id: 'tray-1',
        type: 'hardwareNode',
        position: { x: 0, y: 0 },
        data: { label: 'Tray 1', model: 'TAP-M200T', sku: 'TAP-M200T', site: 'Site A' },
      } as CustomNode,
      {
        id: 'tray-2',
        type: 'hardwareNode',
        position: { x: 0, y: 0 },
        data: { label: 'Tray 2', model: 'TAP-M100T', sku: 'TAP-M100T', site: 'Site A' },
      } as CustomNode,
      {
        id: 'tray-3',
        type: 'hardwareNode',
        position: { x: 0, y: 0 },
        data: { label: 'Tray 3', model: 'TAP-M200T', sku: 'TAP-M200T', site: 'Site B' },
      } as CustomNode,
      {
        id: 'tray-4',
        type: 'hardwareNode',
        position: { x: 0, y: 0 },
        data: { label: 'Tray 4', model: 'TAP-M100T', sku: 'TAP-M100T', site: 'Site B' },
      } as CustomNode,
    ];

    const doc = buildReportDocDefinition({
      ...baseInput,
      nodes: [...tapNodes, ...trayNodes],
      edges: [],
    });

    const allText = collectTexts(doc.content).join(' ');
    // TAP modules should be grouped
    expect(allText).toContain('TAP-M273T (TAP-M273T) (8 modules deployed)');
    expect(allText).toContain('48 monitored links across 8 modules (6 links per module)');

    // Trays should be mentioned once
    expect(allText).toContain('G-TAP Modular Mounting Trays');
    expect(allText).toContain('2 × TAP-M200T (1RU, 6-slot chassis tray)');
    expect(allText).toContain('2 × TAP-M100T (0.5RU, 3-slot chassis tray)');
  });
});

