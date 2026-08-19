import { describe, it, expect } from 'vitest';
import type { CustomNode } from '../../store/types';
import { generateBom, generateSingleNodeBom } from './bomGenerator';

/**
 * Regression coverage for the TA200/TA200E licensing model: unlike TA25(E)/
 * TA400(E), Gigamon has no distinct SKU for the "Half" (32-port) tier - the
 * base GVS-TAC2[12](E) SKU already is that state - so Full (64 ports) must
 * add a separate UPG-TAC20(E)(-SW-TM) BOM row rather than swap in a suffixed
 * base SKU. See skuResolver.ts and bomGenerator.ts for the fix this guards.
 */
const ta200Node = (overrides: Partial<CustomNode['data']> = {}): CustomNode =>
  ({
    id: 'ta',
    type: 'hardwareNode',
    position: { x: 0, y: 0 },
    data: { label: 'TA200', model: 'GigaVUE-TA200', sku: 'TA200-BASE', powerSupply: 'AC', ...overrides },
  }) as CustomNode;

const ta200eNode = (overrides: Partial<CustomNode['data']> = {}): CustomNode =>
  ({
    id: 'ta',
    type: 'hardwareNode',
    position: { x: 0, y: 0 },
    data: { label: 'TA200E', model: 'GigaVUE-TA200E', sku: 'TA200E-BASE', powerSupply: 'AC', ...overrides },
  }) as CustomNode;

describe('TA200/TA200E licensing BOM rows', () => {
  it('adds the UPG-TAC20-SW-TM add-on at the default (Full) tier in HTL mode, never a fabricated GVS-TAC20A-SW-TM-style SKU', () => {
    const bom = generateBom([ta200Node()], [], 'HTL', '12');
    expect(bom.find((r) => r.sku === 'GVS-TAC20-SW-TM')?.qty).toBe(1);
    expect(bom.find((r) => r.sku === 'UPG-TAC20-SW-TM')?.qty).toBe(1);
    expect(bom.some((r) => r.description === 'Unknown SKU')).toBe(false);
  });

  it('adds no UPG add-on for the Half tier, and reuses the plain base SKU', () => {
    const bom = generateBom([ta200Node({ portCapacity: 'Half' })], [], 'HTL', '12');
    expect(bom.find((r) => r.sku === 'GVS-TAC20-SW-TM')?.qty).toBe(1);
    expect(bom.find((r) => r.sku === 'UPG-TAC20-SW-TM')).toBeUndefined();
    expect(bom.some((r) => r.description === 'Unknown SKU')).toBe(false);
  });

  it('does the same for TA200E, with the E-suffixed UPG SKU', () => {
    const full = generateBom([ta200eNode()], [], 'HTL', '12');
    expect(full.find((r) => r.sku === 'GVS-TAC20E-SW-TM')?.qty).toBe(1);
    expect(full.find((r) => r.sku === 'UPG-TAC20E-SW-TM')?.qty).toBe(1);
    expect(full.some((r) => r.description === 'Unknown SKU')).toBe(false);

    const half = generateBom([ta200eNode({ portCapacity: 'Half' })], [], 'HTL', '12');
    expect(half.find((r) => r.sku === 'GVS-TAC20E-SW-TM')?.qty).toBe(1);
    expect(half.find((r) => r.sku === 'UPG-TAC20E-SW-TM')).toBeUndefined();
    expect(half.some((r) => r.description === 'Unknown SKU')).toBe(false);
  });

  it('holds in Perpetual mode too - Full adds the perpetual UPG SKU, Half adds nothing extra', () => {
    const full = generateBom([ta200Node()], [], 'Perpetual', '12');
    expect(full.find((r) => r.sku === 'GVS-TAC21')?.qty).toBe(1);
    expect(full.find((r) => r.sku === 'UPG-TAC20')?.qty).toBe(1);

    const half = generateBom([ta200Node({ portCapacity: 'Half' })], [], 'Perpetual', '12');
    expect(half.find((r) => r.sku === 'GVS-TAC21')?.qty).toBe(1);
    expect(half.find((r) => r.sku === 'UPG-TAC20')).toBeUndefined();
  });

  it('holds in the single-node BOM preview path too', () => {
    const full = generateSingleNodeBom(ta200Node(), 'HTL', '12');
    expect(full.find((r) => r.sku === 'UPG-TAC20-SW-TM')?.qty).toBe(1);

    const half = generateSingleNodeBom(ta200Node({ portCapacity: 'Half' }), 'HTL', '12');
    expect(half.find((r) => r.sku === 'UPG-TAC20-SW-TM')).toBeUndefined();
  });
});
