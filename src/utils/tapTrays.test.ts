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

describe('MPO breakout panel BOM/tray allocation', () => {
  const panel = (id: string, model: 'PNL-M341T' | 'PNL-M343T'): CustomNode => ({
    id,
    type: 'hardwareNode',
    position: { x: 0, y: 0 },
    data: { label: model, model, sku: model },
  } as CustomNode);

  it('produces a Module BOM row for the panel itself, plus a shared M100T tray dependency', () => {
    const bom = generateBom([panel('p1', 'PNL-M341T')], [], 'HTL', '12');

    const panelRow = bom.find(r => r.sku === 'PNL-M341T');
    expect(panelRow?.type).toBe('Module');
    expect(panelRow?.qty).toBe(1);
    expect(trayQty(bom, 'TAP-M100T')).toBe(1);
    expect(trayQty(bom, 'TAP-M200T')).toBeUndefined();
  });

  it('pools with real tap modules in the same tray, not a separate bin', () => {
    // 3 tap modules + 1 panel = 4 bays needed - still fits one M100T (3 slots)
    // only if pooled wrong; pooled correctly it spills into an M200T (6 slots).
    const nodes = [
      tapModule('a', 'TAP-M251T'), tapModule('b', 'TAP-M251T'), tapModule('c', 'TAP-M251T'),
      panel('p1', 'PNL-M341T'),
    ];
    const bom = generateBom(nodes, [], 'HTL', '12');

    expect(trayQty(bom, 'TAP-M200T')).toBe(1);
    expect(trayQty(bom, 'TAP-M100T')).toBeUndefined();
  });

  it('scopes panel tray pooling per site, same as tap modules', () => {
    const siteAPanel = panel('p2', 'PNL-M341T');
    siteAPanel.data = { ...siteAPanel.data, site: 'Site A' };
    const nodes = [panel('p1', 'PNL-M341T'), siteAPanel];
    const bom = generateBom(nodes, [], 'HTL', '12');

    const siteARow = bom.find(r => r.sku === 'TAP-M100T' && r.site === 'Site A');
    const unassignedRow = bom.find(r => r.sku === 'TAP-M100T' && r.site === 'Unassigned');
    expect(siteARow?.qty).toBe(1);
    expect(unassignedRow?.qty).toBe(1);
  });

  it('a singlemode panel (PNL-M343T) is quoted the same way as the multimode one', () => {
    const bom = generateBom([panel('p1', 'PNL-M343T')], [], 'HTL', '12');
    expect(bom.find(r => r.sku === 'PNL-M343T')?.type).toBe('Module');
    expect(trayQty(bom, 'TAP-M100T')).toBe(1);
  });

  it('forces TAP-M200T even for 2 TAPs when trayPreference is set to TAP-M200T', () => {
    const t1 = tapModule('t1', 'TAP-M251T');
    t1.data = { ...t1.data, trayPreference: 'TAP-M200T' };
    const t2 = tapModule('t2', 'TAP-M251T');
    const bom = generateBom([t1, t2], [], 'HTL', '12');

    expect(trayQty(bom, 'TAP-M200T')).toBe(1);
    expect(trayQty(bom, 'TAP-M100T')).toBeUndefined();
  });

  it('respects a manually overridden TAP-M200T tray node for 2 TAPs', () => {
    const manualTray: CustomNode = {
      id: 'tray-override-1',
      type: 'hardwareNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'TAP-M200T',
        configType: 'Hardware',
        model: 'TAP-M200T',
        sku: 'TAP-M200T',
        isManualOverride: true,
      },
    };
    const t1 = tapModule('t1', 'TAP-M251T');
    const t2 = tapModule('t2', 'TAP-M251T');
    const bom = generateBom([manualTray, t1, t2], [], 'HTL', '12');

    expect(trayQty(bom, 'TAP-M200T')).toBe(1);
    expect(trayQty(bom, 'TAP-M100T')).toBeUndefined();
  });

  it('respects a racked TAP-M200T tray node in BOM generation', () => {
    const rackedTray: CustomNode = {
      id: 'tray-racked-1',
      type: 'hardwareNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'TAP-M200T #1',
        configType: 'Hardware',
        model: 'TAP-M200T',
        sku: 'TAP-M200T',
        rackId: 'rack_global',
        rackU: 40,
      },
    };
    const t1 = tapModule('t1', 'TAP-M251T');
    const t2 = tapModule('t2', 'TAP-M251T');
    const bom = generateBom([rackedTray, t1, t2], [], 'HTL', '12');

    expect(trayQty(bom, 'TAP-M200T')).toBe(1);
    expect(trayQty(bom, 'TAP-M100T')).toBeUndefined();
  });

  it('respects trayPreferenceOverride parameter in generateBom', () => {
    const t1 = tapModule('t1', 'TAP-M251T');
    const t2 = tapModule('t2', 'TAP-M251T');
    const bom = generateBom([t1, t2], [], 'HTL', '12', 'US', false, {}, 'TAP-M200T');

    expect(trayQty(bom, 'TAP-M200T')).toBe(1);
    expect(trayQty(bom, 'TAP-M100T')).toBeUndefined();
  });
});
