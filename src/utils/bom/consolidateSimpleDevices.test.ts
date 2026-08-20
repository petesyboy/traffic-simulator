import { describe, it, expect } from 'vitest';
import { consolidateSimpleDeviceRows, CONSOLIDATED_DEVICES_NODE_ID } from './consolidateSimpleDevices';
import { generateBom, type BomRow } from './bomGenerator';
import { buildProjectWideOpticBom } from './opticPacks';
import { getSkus } from './skuUtils';
import type { CustomNode } from '../../store/types';

const tapRow = (nodeId: string, site = 'HQ'): BomRow => ({
  sku: 'TAP-M273T',
  qty: 1,
  description: 'G-TAP M Series module',
  type: 'TAP',
  nodeId,
  site,
});

describe('consolidateSimpleDeviceRows', () => {
  it('merges nine standalone single-row TAP modules into one summed row', () => {
    const rows = Array.from({ length: 9 }, (_, i) => tapRow(`tap-${i + 1}`));
    const result = consolidateSimpleDeviceRows(rows);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ sku: 'TAP-M273T', qty: 9, nodeId: CONSOLIDATED_DEVICES_NODE_ID, site: 'HQ' });
  });

  it('keeps separate sites as separate merged rows', () => {
    const rows = [
      ...Array.from({ length: 9 }, (_, i) => tapRow(`tap-hq-${i + 1}`, 'HQ')),
      ...Array.from({ length: 9 }, (_, i) => tapRow(`tap-branch-${i + 1}`, 'Branch')),
    ];
    const result = consolidateSimpleDeviceRows(rows);

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.site === 'HQ')?.qty).toBe(9);
    expect(result.find((r) => r.site === 'Branch')?.qty).toBe(9);
  });

  it('leaves a multi-row node (a real chassis with chassis+license+optics rows) untouched and un-merged', () => {
    const chassisRows: BomRow[] = [
      { sku: 'GVS-HC3A1-HW', qty: 1, description: 'Chassis', type: 'Chassis', nodeId: 'hc3-1', site: 'HQ' },
      { sku: 'GVS-HC3A0-SW-TM', qty: 1, description: 'License', type: 'License', nodeId: 'hc3-1', site: 'HQ' },
      { sku: 'SFP-532T', qty: 4, description: 'Optic', type: 'Optic', nodeId: 'hc3-1', site: 'HQ' },
    ];
    const result = consolidateSimpleDeviceRows(chassisRows);

    expect(result).toHaveLength(3);
    expect(result.every((r) => r.nodeId === 'hc3-1')).toBe(true);
  });

  it('leaves two different single-row devices as two separate merged rows (different SKUs never combine)', () => {
    const rows: BomRow[] = [tapRow('tap-1'), { ...tapRow('panel-1'), sku: 'PNL-M341T', description: 'Breakout panel', type: 'Module' }];
    const result = consolidateSimpleDeviceRows(rows);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.sku).sort()).toEqual(['PNL-M341T', 'TAP-M273T']);
  });

  it('passes global (non-node-specific) rows through untouched, distinct from the consolidated-devices bucket', () => {
    const globalRow: BomRow = { sku: 'PCD-00001', qty: 2, description: 'Power cord', type: 'Dependency', site: 'HQ' };
    const rows = [globalRow, ...Array.from({ length: 3 }, (_, i) => tapRow(`tap-${i + 1}`))];
    const result = consolidateSimpleDeviceRows(rows);

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.sku === 'PCD-00001')?.nodeId).toBeUndefined();
    expect(result.find((r) => r.sku === 'TAP-M273T')?.nodeId).toBe(CONSOLIDATED_DEVICES_NODE_ID);
  });

  it('mixes complex and simple nodes correctly in the same site', () => {
    const rows: BomRow[] = [
      { sku: 'GVS-HC3A1-HW', qty: 1, description: 'Chassis', type: 'Chassis', nodeId: 'hc3-1', site: 'HQ' },
      { sku: 'GVS-HC3A0-SW-TM', qty: 1, description: 'License', type: 'License', nodeId: 'hc3-1', site: 'HQ' },
      tapRow('tap-1'),
      tapRow('tap-2'),
    ];
    const result = consolidateSimpleDeviceRows(rows);

    expect(result).toHaveLength(3);
    expect(result.find((r) => r.sku === 'TAP-M273T')).toMatchObject({ qty: 2, nodeId: CONSOLIDATED_DEVICES_NODE_ID });
    expect(result.filter((r) => r.nodeId === 'hc3-1')).toHaveLength(2);
  });
});

describe('consolidation feeding into the Master (All Sites) view - reproduces BomModal.tsx\'s exact pipeline', () => {
  const m273t = (id: string, site?: string): CustomNode =>
    ({
      id,
      type: 'hardwareNode',
      position: { x: 0, y: 0 },
      data: { label: 'TAP-M273T', model: 'TAP-M273T', sku: 'TAP-M273T', ...(site ? { site } : {}) },
    }) as CustomNode;

  it('shows one combined 9x TAP-M273T row on Master view for nine modules on one site', () => {
    const nodes = Array.from({ length: 9 }, (_, i) => m273t(`tap-${i + 1}`, 'HQ'));
    const raw = generateBom(nodes, [], 'HTL', '12');
    const consolidated = consolidateSimpleDeviceRows(raw);
    const master = buildProjectWideOpticBom(consolidated, getSkus());

    const tapRows = master.filter((r) => r.sku === 'TAP-M273T');
    expect(tapRows).toHaveLength(1);
    expect(tapRows[0].qty).toBe(9);
  });

  it('still combines correctly into one Master row even across two different sites (9 + 9 = 18)', () => {
    const nodes = [
      ...Array.from({ length: 9 }, (_, i) => m273t(`tap-hq-${i + 1}`, 'HQ')),
      ...Array.from({ length: 9 }, (_, i) => m273t(`tap-branch-${i + 1}`, 'Branch')),
    ];
    const raw = generateBom(nodes, [], 'HTL', '12');
    const consolidated = consolidateSimpleDeviceRows(raw);
    const master = buildProjectWideOpticBom(consolidated, getSkus());

    const tapRows = master.filter((r) => r.sku === 'TAP-M273T');
    expect(tapRows).toHaveLength(1);
    expect(tapRows[0].qty).toBe(18);
  });

  it('produces the exact same Master-view totals whether or not the Site-tab consolidation step ran first', () => {
    // The per-node/per-site merge is purely cosmetic for the Site tab - Master
    // view already aggregates by SKU project-wide regardless, so running
    // consolidateSimpleDeviceRows first must be a no-op for its numbers.
    const nodes = Array.from({ length: 9 }, (_, i) => m273t(`tap-${i + 1}`, 'HQ'));
    const raw = generateBom(nodes, [], 'HTL', '12');

    const masterWithConsolidation = buildProjectWideOpticBom(consolidateSimpleDeviceRows(raw), getSkus());
    const masterWithoutConsolidation = buildProjectWideOpticBom(raw, getSkus());

    const sortBySku = (rows: BomRow[]) => [...rows].sort((a, b) => a.sku.localeCompare(b.sku));
    expect(sortBySku(masterWithConsolidation)).toEqual(sortBySku(masterWithoutConsolidation));
  });
});
