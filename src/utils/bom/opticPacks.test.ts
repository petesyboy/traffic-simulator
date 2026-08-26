import { describe, it, expect } from 'vitest';
import { optimizeOpticPacks, aggregateBomRowsBySku, buildProjectWideOpticBom } from './opticPacks';
import { generateBom, type BomRow } from './bomGenerator';
import { getSkus } from './skuUtils';
import type { CustomNode } from '../../store/types';

const skus: Record<string, string> = {
  'SFP-532T': 'Base optic',
  'SFP-532T-20P': '20-pack of 10G SFP+, multimode SR, TAA',
  'QSF-503T': 'Base optic',
  'QSF-503T-5P': '5-pack of 40G QSFP+, singlemode LR4, TAA',
};

const row = (sku: string, qty: number, type: BomRow['type'] = 'Optic'): BomRow => ({
  sku,
  qty,
  description: skus[sku] || 'Base optic',
  type,
});

describe('optimizeOpticPacks', () => {
  it('leaves a small quantity (at most half a pack) untouched', () => {
    const result = optimizeOpticPacks([row('SFP-532T', 10)], skus);
    expect(result).toEqual([row('SFP-532T', 10)]);
  });

  it('rounds a quantity of more than half a pack up to one full pack, even below the pack size', () => {
    // 11x on a 20-pack is "more than 10" - a whole box beats 11 loose singles.
    const result = optimizeOpticPacks([row('SFP-532T', 11)], skus);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ sku: 'SFP-532T-20P', qty: 1, description: skus['SFP-532T-20P'], type: 'Optic' });
  });

  it('explains a round-up with a customer-facing note naming the surplus, and leaves an exact-fit pack with no note', () => {
    const roundedUp = optimizeOpticPacks([row('SFP-532T', 11)], skus);
    expect(roundedUp[0].note).toMatch(/rounded up from 11/i);
    expect(roundedUp[0].note).toContain('9 spare units');
    expect(roundedUp[0].note).toContain('SFP-532T-20P');

    const singleSpare = optimizeOpticPacks([row('SFP-532T', 19)], skus);
    expect(singleSpare[0].note).toContain('1 spare unit.');
    expect(singleSpare[0].note).not.toContain('1 spare units');

    // Landing exactly on a pack size is not a "round up" - nothing was over-bought.
    const exactFit = optimizeOpticPacks([row('SFP-532T', 20)], skus);
    expect(exactFit[0].note).toBeUndefined();

    // Splitting into a pack + exact-remainder singles doesn't over-buy either.
    const packPlusSingles = optimizeOpticPacks([row('SFP-532T', 47)], skus);
    expect(packPlusSingles[0].note).toBeUndefined();
  });

  it('swaps in a full pack once the quantity exactly reaches the pack size, with no leftover row', () => {
    const result = optimizeOpticPacks([row('SFP-532T', 20)], skus);
    expect(result).toEqual([{ sku: 'SFP-532T-20P', qty: 1, description: skus['SFP-532T-20P'], type: 'Optic' }]);
  });

  it('splits into a pack row plus a singles remainder row when the leftover is at most half a pack', () => {
    const result = optimizeOpticPacks([row('SFP-532T', 47)], skus);
    expect(result).toEqual([
      { sku: 'SFP-532T-20P', qty: 2, description: skus['SFP-532T-20P'], type: 'Optic' },
      { sku: 'SFP-532T', qty: 7, description: skus['SFP-532T'], type: 'Optic' },
    ]);
  });

  it('rounds a large leftover up to another full pack instead of quoting it as singles', () => {
    // 51x = 2 full packs + 11 leftover; 11 > 10 (half of 20), so round up to 3 packs flat.
    const result = optimizeOpticPacks([row('SFP-532T', 51)], skus);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ sku: 'SFP-532T-20P', qty: 3, description: skus['SFP-532T-20P'], type: 'Optic' });
    expect(result[0].note).toContain('9 spare units');
  });

  it('uses a 5-pack for a different optic with a smaller pack size', () => {
    const result = optimizeOpticPacks([row('QSF-503T', 12)], skus);
    expect(result).toEqual([
      { sku: 'QSF-503T-5P', qty: 2, description: skus['QSF-503T-5P'], type: 'Optic' },
      { sku: 'QSF-503T', qty: 2, description: skus['QSF-503T'], type: 'Optic' },
    ]);
  });

  it('leaves an optic with no pack option unchanged regardless of quantity', () => {
    const result = optimizeOpticPacks([row('Q28-502T', 500)], skus);
    expect(result).toEqual([row('Q28-502T', 500)]);
  });

  it('never touches non-Optic rows even if the SKU string happens to collide', () => {
    const result = optimizeOpticPacks([row('SFP-532T', 30, 'Dependency')], skus);
    expect(result).toEqual([row('SFP-532T', 30, 'Dependency')]);
  });

  it('preserves term/nodeId/site fields on both the pack and remainder rows', () => {
    const source: BomRow = { sku: 'SFP-532T', qty: 25, description: 'Base optic', type: 'Optic', term: '36', nodeId: 'chassis-1', site: 'HQ' };
    const result = optimizeOpticPacks([source], skus);
    expect(result).toEqual([
      { sku: 'SFP-532T-20P', qty: 1, description: skus['SFP-532T-20P'], type: 'Optic', term: '36', nodeId: 'chassis-1', site: 'HQ' },
      { sku: 'SFP-532T', qty: 5, description: 'Base optic', type: 'Optic', term: '36', nodeId: 'chassis-1', site: 'HQ' },
    ]);
  });
});

describe('aggregateBomRowsBySku', () => {
  it('combines rows for the same SKU from different nodes/sites into one project-wide total', () => {
    const rows: BomRow[] = [
      { sku: 'SFP-532T', qty: 12, description: 'Base optic', type: 'Optic', nodeId: 'ta-1', site: 'HQ' },
      { sku: 'SFP-532T', qty: 12, description: 'Base optic', type: 'Optic', nodeId: 'ta-2', site: 'HQ' },
      { sku: 'SFP-532T', qty: 12, description: 'Base optic', type: 'Optic', nodeId: 'ta-3', site: 'Branch' },
    ];
    const result = aggregateBomRowsBySku(rows);
    expect(result).toEqual([{ sku: 'SFP-532T', qty: 36, description: 'Base optic', type: 'Optic', nodeId: undefined, site: undefined }]);
  });

  it('leaves unrelated SKUs as separate rows', () => {
    const rows: BomRow[] = [row('SFP-532T', 5), row('Q28-502T', 3)];
    expect(aggregateBomRowsBySku(rows)).toHaveLength(2);
  });
});

describe('buildProjectWideOpticBom', () => {
  it('finds a pack opportunity across nodes that no single node reached on its own', () => {
    // Three nodes each need 8 - well under half a 20-pack (10), so none of
    // them rounds up on its own. The true 24-unit project total does.
    const rows: BomRow[] = [
      { sku: 'SFP-532T', qty: 8, description: 'Base optic', type: 'Optic', nodeId: 'ta-1', site: 'HQ' },
      { sku: 'SFP-532T', qty: 8, description: 'Base optic', type: 'Optic', nodeId: 'ta-2', site: 'HQ' },
      { sku: 'SFP-532T', qty: 8, description: 'Base optic', type: 'Optic', nodeId: 'ta-3', site: 'HQ' },
    ];
    expect(rows.every((r) => optimizeOpticPacks([r], skus)[0].sku === 'SFP-532T')).toBe(true);

    const result = buildProjectWideOpticBom(rows, skus);
    // 24 total = 1 pack + 4 leftover; 4 <= 10 (half of 20), so this stays as
    // a pack plus a small singles remainder rather than rounding up further.
    expect(result).toEqual([
      { sku: 'SFP-532T-20P', qty: 1, description: skus['SFP-532T-20P'], type: 'Optic', nodeId: undefined, site: undefined },
      { sku: 'SFP-532T', qty: 4, description: 'Base optic', type: 'Optic', nodeId: undefined, site: undefined },
    ]);
  });

  it('consolidates optics across different linkTypes (e.g. tap-termination and uplinks) into unified packs without split duplicate lines', () => {
    const testSkus: Record<string, string> = {
      ...skus,
      'SFP-533T': '10G SFP+ Singlemode LR',
      'SFP-533T-20P': '20 pack of 10Gb SFP+, Singlemode LR. TAA Compliant.',
    };

    const rows: BomRow[] = [
      { sku: 'SFP-533T', qty: 20, description: '10G SFP+ Singlemode LR', type: 'Optic', nodeId: 'chassis-1' }, // uplinks
      { sku: 'SFP-533T', qty: 192, description: '10G SFP+ Singlemode LR', type: 'Optic', nodeId: 'chassis-1', linkType: 'tap-termination' }, // tap termination
    ];

    const result = buildProjectWideOpticBom(rows, testSkus);
    // 192 + 20 = 212 total -> 10 packs of 20 (200) + 12 remainder -> rounded up to 11 packs of 20 (220 total)
    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('SFP-533T-20P');
    expect(result[0].qty).toBe(11);
    expect(result[0].note).toContain('Rounded up from 212 individual units to 11 × SFP-533T-20P (220 total)');
  });
});

describe('generateBom stays raw per-node/site - no pack optimization baked in', () => {
  it('does not roll up a single node\'s large optic quantity on its own', () => {
    const chassis: CustomNode = {
      id: 'ta',
      type: 'hardwareNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Core TA25E',
        model: 'GigaVUE-TA25E',
        sku: 'TA25E-BASE',
        powerSupply: 'AC',
        optics: [{ board: 'Base Ports', optic: 'SFP-532T (10G SFP+ SR)', qty: 47 }],
      },
    } as CustomNode;

    const bom = generateBom([chassis], [], 'HTL', '12');

    expect(bom.find((r) => r.sku === 'SFP-532T')?.qty).toBe(47);
    expect(bom.find((r) => r.sku === 'SFP-532T-20P')).toBeUndefined();
  });

  it('rolls up into packs once run through buildProjectWideOpticBom, matching what the BOM modal and PDF report show', () => {
    const chassis: CustomNode = {
      id: 'ta',
      type: 'hardwareNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Core TA25E',
        model: 'GigaVUE-TA25E',
        sku: 'TA25E-BASE',
        powerSupply: 'AC',
        optics: [{ board: 'Base Ports', optic: 'SFP-532T (10G SFP+ SR)', qty: 47 }],
      },
    } as CustomNode;

    const rawBom = generateBom([chassis], [], 'HTL', '12');
    // Real bundled SKU descriptions - SFP-532T-20P is a genuine catalogue entry.
    const projectWide = buildProjectWideOpticBom(rawBom, getSkus());

    expect(projectWide.find((r) => r.sku === 'SFP-532T-20P')?.qty).toBe(2);
    expect(projectWide.find((r) => r.sku === 'SFP-532T')?.qty).toBe(7);
  });
});
