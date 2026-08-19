import { describe, it, expect } from 'vitest';
import { optimizeOpticPacks } from './opticPacks';
import { generateBom, type BomRow } from './bomGenerator';
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
  it('leaves a quantity below the pack size untouched', () => {
    const result = optimizeOpticPacks([row('SFP-532T', 19)], skus);
    expect(result).toEqual([row('SFP-532T', 19)]);
  });

  it('swaps in a full pack once the quantity exactly reaches the pack size, with no leftover row', () => {
    const result = optimizeOpticPacks([row('SFP-532T', 20)], skus);
    expect(result).toEqual([{ sku: 'SFP-532T-20P', qty: 1, description: skus['SFP-532T-20P'], type: 'Optic' }]);
  });

  it('splits into a pack row plus a singles remainder row above the pack size', () => {
    const result = optimizeOpticPacks([row('SFP-532T', 47)], skus);
    expect(result).toEqual([
      { sku: 'SFP-532T-20P', qty: 2, description: skus['SFP-532T-20P'], type: 'Optic' },
      { sku: 'SFP-532T', qty: 7, description: skus['SFP-532T'], type: 'Optic' },
    ]);
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

describe('pack optimization wired into generateBom', () => {
  it('rolls a large manually-fitted optic quantity up into packs on the real BOM', () => {
    const chassis: CustomNode = {
      id: 'ta',
      type: 'hardwareNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Core TA25E',
        model: 'GigaVUE-TA25E',
        sku: 'TA25E-BASE',
        powerSupply: 'AC',
        // 47 individually-fitted optics - well past the point where an SE would
        // actually want 47 separate transceiver lines on a customer quote.
        optics: [{ board: 'Base Ports', optic: 'SFP-532T (10G SFP+ SR)', qty: 47 }],
      },
    } as CustomNode;

    const bom = generateBom([chassis], [], 'HTL', '12');

    expect(bom.find((r) => r.sku === 'SFP-532T-20P')?.qty).toBe(2);
    expect(bom.find((r) => r.sku === 'SFP-532T')?.qty).toBe(7);
    // The old flat 47-count line must not survive as a third row.
    expect(bom.filter((r) => r.sku === 'SFP-532T' || r.sku === 'SFP-532T-20P')).toHaveLength(2);
  });

  it('leaves a modest optic quantity as plain singles, no pack applied', () => {
    const chassis: CustomNode = {
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

    const bom = generateBom([chassis], [], 'HTL', '12');

    expect(bom.find((r) => r.sku === 'SFP-532T')?.qty).toBe(6);
    expect(bom.find((r) => r.sku === 'SFP-532T-20P')).toBeUndefined();
  });
});
