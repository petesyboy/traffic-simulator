import { describe, it, expect } from 'vitest';
import { buildPhysicalItems, parseAndConvertDimensions } from './physicalItems';
import type { BomRow } from './bomGenerator';
import type { CustomNode } from '../../store/types';

const node = (id: string, data: Record<string, unknown>): CustomNode =>
  ({
    id,
    type: 'hardwareNode',
    position: { x: 0, y: 0 },
    data,
  }) as CustomNode;

const bomRow = (overrides: Partial<BomRow>): BomRow => ({
  sku: overrides.sku || 'SOME-SKU',
  qty: overrides.qty ?? 1,
  description: overrides.description || '',
  type: overrides.type || 'Hardware',
  site: overrides.site,
  term: overrides.term,
  nodeId: overrides.nodeId,
});

describe('parseAndConvertDimensions', () => {
  it('converts inches to centimetres', () => {
    const result = parseAndConvertDimensions('1.75 in x 17.26 in x 19.5 in');
    expect(result.inches).toBe('1.75 in x 17.26 in x 19.5 in');
    expect(result.cm).toBe('4.45 cm x 43.84 cm x 49.53 cm');
  });

  it('passes through a string that does not match the dimension pattern', () => {
    const result = parseAndConvertDimensions('n/a');
    expect(result.inches).toBe('n/a');
    expect(result.cm).toBe('n/a');
  });
});

describe('buildPhysicalItems', () => {
  it('rolls up TAP-M100T/M200T/M202ULT tray quantities per site from BOM rows', () => {
    const bomRows = [
      bomRow({ sku: 'TAP-M100T', qty: 2, site: 'Site A' }),
      bomRow({ sku: 'TAP-M200T', qty: 1, site: 'Site A' }),
      bomRow({ sku: 'TAP-M202ULT', qty: 3, site: 'Site B' }),
    ];
    const items = buildPhysicalItems([], bomRows);

    const siteATray100 = items.find((i) => i.name.includes('M100T') && i.site === 'Site A');
    expect(siteATray100?.qty).toBe(2);
    expect(siteATray100?.ruNum).toBe(1);

    const siteATray200 = items.find((i) => i.name.includes('M200T') && i.site === 'Site A');
    expect(siteATray200?.qty).toBe(1);
    expect(siteATray200?.ruNum).toBe(1);

    const siteBTrayUlt = items.find((i) => i.name.includes('M202ULT') && i.site === 'Site B');
    expect(siteBTrayUlt?.qty).toBe(3);
    expect(siteBTrayUlt?.ruNum).toBe(3);
  });

  it('produces one physical spec row per hardware chassis node, keyed by model branch', () => {
    const nodes = [
      node('n1', { label: 'HC1 Chassis', model: 'GigaVUE-HC1', site: 'Site A' }),
      node('n2', { label: 'HC3 Chassis', model: 'GigaVUE-HC3', site: 'Site A' }),
      node('n3', { label: 'TA25 Chassis', model: 'GigaVUE-TA25E', site: 'Site B' }),
    ];
    const items = buildPhysicalItems(nodes, []);

    const hc1 = items.find((i) => i.name.includes('HC1 Chassis'));
    expect(hc1?.ru).toBe('1 RU');
    expect(hc1?.powerNum).toBe(360);

    const hc3 = items.find((i) => i.name.includes('HC3 Chassis'));
    expect(hc3?.ru).toBe('3 RU');
    expect(hc3?.powerNum).toBe(2000);

    const ta25 = items.find((i) => i.name.includes('TA25 Chassis'));
    expect(ta25?.site).toBe('Site B');
    expect(ta25?.powerNum).toBe(400);
  });

  it('does not double-count a physical TAP appliance as a tray (only TAP-M* models roll up as trays)', () => {
    const nodes = [node('n1', { label: 'GigaVUE TAP', model: 'GigaVUE-TAP-BiDi', site: 'Site A' })];
    const items = buildPhysicalItems(nodes, []);
    expect(items).toHaveLength(1);
    expect(items[0].powerNum).toBe(337);
  });
});
