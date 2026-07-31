import { describe, it, expect } from 'vitest';
import { generateBom, requiresUltTray } from './bom/bomGenerator';
import type { CustomNode } from '../store/types';

const tapModule = (id: string, model: string, sku = model): CustomNode => ({
  id,
  type: 'hardwareNode',
  position: { x: 0, y: 0 },
  data: { label: model, model, sku, tappedLinkAllocations: [{ qty: 1, optic: 'Passive Optical Splitter (Multimode)' }] },
} as CustomNode);

const trayQty = (bom: ReturnType<typeof generateBom>, sku: string) => bom.find(r => r.sku === sku)?.qty;

describe('requiresUltTray', () => {
  it('matches only the multimode unidirectional modules', () => {
    // TAP-Mxx1ULT is multimode unidirectional and needs the dedicated chassis.
    expect(requiresUltTray('TAP-M251ULT')).toBe(true);
    // TAP-Mxx3ULT is singlemode and shares the ordinary M-series trays.
    expect(requiresUltTray('TAP-M253ULT')).toBe(false);
    // Non-ULT modules are unaffected.
    expect(requiresUltTray('TAP-M251T')).toBe(false);
    expect(requiresUltTray('TAP-M253T')).toBe(false);
    expect(requiresUltTray('TAP-M506T')).toBe(false);
  });
});

describe('TAP tray allocation', () => {
  it('puts a multimode ULT module in a TAP-M202ULT, never an M100T/M200T', () => {
    const bom = generateBom([tapModule('t1', 'TAP-M251ULT')], [], 'HTL', '12');

    expect(trayQty(bom, 'TAP-M202ULT')).toBe(1);
    expect(trayQty(bom, 'TAP-M100T')).toBeUndefined();
    expect(trayQty(bom, 'TAP-M200T')).toBeUndefined();
  });

  it('fits two ULT modules per chassis and rounds up beyond that', () => {
    const two = generateBom([tapModule('t1', 'TAP-M251ULT'), tapModule('t2', 'TAP-M251ULT')], [], 'HTL', '12');
    expect(trayQty(two, 'TAP-M202ULT')).toBe(1);

    // A third module spills into a second 1RU chassis - the M202ULT has 2 slots.
    const three = generateBom(
      [tapModule('t1', 'TAP-M251ULT'), tapModule('t2', 'TAP-M251ULT'), tapModule('t3', 'TAP-M251ULT')],
      [], 'HTL', '12',
    );
    expect(trayQty(three, 'TAP-M202ULT')).toBe(2);
  });

  it('keeps the singlemode ULT module in the ordinary M-series tray', () => {
    const bom = generateBom([tapModule('t1', 'TAP-M253ULT')], [], 'HTL', '12');

    expect(trayQty(bom, 'TAP-M100T')).toBe(1);
    expect(trayQty(bom, 'TAP-M202ULT')).toBeUndefined();
  });

  it('pools the two tray families independently rather than mixing slot counts', () => {
    // 3 standard modules -> one M100T (3 slots); 1 ULT module -> one M202ULT.
    const bom = generateBom(
      [
        tapModule('a', 'TAP-M251T'), tapModule('b', 'TAP-M251T'), tapModule('c', 'TAP-M253T'),
        tapModule('d', 'TAP-M251ULT'),
      ],
      [], 'HTL', '12',
    );

    expect(trayQty(bom, 'TAP-M100T')).toBe(1);
    expect(trayQty(bom, 'TAP-M202ULT')).toBe(1);
    // The ULT module must not have inflated the standard pool to 4 (an M200T).
    expect(trayQty(bom, 'TAP-M200T')).toBeUndefined();
  });

  it('still fills a 6-slot M200T for six standard modules', () => {
    const nodes = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => tapModule(id, 'TAP-M251T'));
    const bom = generateBom(nodes, [], 'HTL', '12');

    expect(trayQty(bom, 'TAP-M200T')).toBe(1);
    expect(trayQty(bom, 'TAP-M100T')).toBeUndefined();
  });
});
