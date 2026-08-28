import { describe, it, expect } from 'vitest';
import type { CustomNode } from '../store/types';
import { syncTapTrays, isAutoTrayModel } from './traySync';

const tapModule = (id: string, model: string, extra: Record<string, unknown> = {}): CustomNode => ({
  id,
  type: 'hardwareNode',
  position: { x: 0, y: 0 },
  data: { label: model, model, sku: model, ...extra },
} as CustomNode);

const traysOf = (nodes: CustomNode[], model: string) =>
  nodes.filter(n => n.data?.model === model);

describe('isAutoTrayModel', () => {
  it('is true only for the three tray/chassis models', () => {
    expect(isAutoTrayModel('TAP-M100T')).toBe(true);
    expect(isAutoTrayModel('TAP-M200T')).toBe(true);
    expect(isAutoTrayModel('TAP-M202ULT')).toBe(true);
    expect(isAutoTrayModel('TAP-M251T')).toBe(false);
    expect(isAutoTrayModel('GigaVUE-HC1-Plus')).toBe(false);
  });
});

describe('syncTapTrays', () => {
  it('creates no trays when there are no tap modules', () => {
    const nodes = [tapModule('a', 'GigaVUE-HC1-Plus')];
    expect(syncTapTrays(nodes)).toBe(nodes); // unchanged reference - no-op
  });

  it('creates one M100T for a small module count', () => {
    const nodes = [tapModule('a', 'TAP-M251T'), tapModule('b', 'TAP-M251T')];
    const synced = syncTapTrays(nodes);
    expect(traysOf(synced, 'TAP-M100T')).toHaveLength(1);
    expect(traysOf(synced, 'TAP-M200T')).toHaveLength(0);
  });

  it('creates one M200T for exactly six modules', () => {
    const nodes = Array.from({ length: 6 }, (_, i) => tapModule(`m${i}`, 'TAP-M251T'));
    const synced = syncTapTrays(nodes);
    expect(traysOf(synced, 'TAP-M200T')).toHaveLength(1);
    expect(traysOf(synced, 'TAP-M100T')).toHaveLength(0);
  });

  it('creates an M200T plus an M100T for a 6+3 split', () => {
    const nodes = Array.from({ length: 9 }, (_, i) => tapModule(`m${i}`, 'TAP-M251T'));
    const synced = syncTapTrays(nodes);
    expect(traysOf(synced, 'TAP-M200T')).toHaveLength(1);
    expect(traysOf(synced, 'TAP-M100T')).toHaveLength(1);
  });

  it('pools ULT modules into TAP-M202ULT separately from ordinary modules', () => {
    const nodes = [tapModule('a', 'TAP-M251ULT'), tapModule('b', 'TAP-M251T'), tapModule('c', 'TAP-M251T')];
    const synced = syncTapTrays(nodes);
    expect(traysOf(synced, 'TAP-M202ULT')).toHaveLength(1);
    expect(traysOf(synced, 'TAP-M100T')).toHaveLength(1);
  });

  it('grows the tray set as more modules are added, without duplicating existing trays', () => {
    let nodes = [tapModule('a', 'TAP-M251T')];
    nodes = syncTapTrays(nodes);
    expect(traysOf(nodes, 'TAP-M100T')).toHaveLength(1);
    const firstTrayId = traysOf(nodes, 'TAP-M100T')[0].id;

    nodes = [...nodes, tapModule('b', 'TAP-M251T')];
    nodes = syncTapTrays(nodes);
    expect(traysOf(nodes, 'TAP-M100T')).toHaveLength(1);
    expect(traysOf(nodes, 'TAP-M100T')[0].id).toBe(firstTrayId); // same tray, not replaced
  });

  it('scopes tray counts per site', () => {
    const nodes = [
      tapModule('a', 'TAP-M251T', { site: 'Docklands Datacentre' }),
      tapModule('b', 'TAP-M251T', { site: 'Docklands Datacentre' }),
      tapModule('c', 'TAP-M251T', { site: 'Manchester Data centre' }),
    ];
    const synced = syncTapTrays(nodes);
    const docklandsTray = traysOf(synced, 'TAP-M100T').find(t => t.data?.site === 'Docklands Datacentre');
    const manchesterTray = traysOf(synced, 'TAP-M100T').find(t => t.data?.site === 'Manchester Data centre');
    expect(traysOf(synced, 'TAP-M100T')).toHaveLength(2);
    expect(docklandsTray).toBeDefined();
    expect(manchesterTray).toBeDefined();
  });

  it('removes an excess tray once it is no longer needed, if it is still empty and unracked', () => {
    let nodes = [tapModule('a', 'TAP-M251T'), tapModule('b', 'TAP-M251T'), tapModule('c', 'TAP-M251T')];
    nodes = syncTapTrays(nodes);
    expect(traysOf(nodes, 'TAP-M100T')).toHaveLength(1);

    // Delete two of the three modules - only one module left, still needs a tray, count unchanged.
    nodes = nodes.filter(n => n.id !== 'b' && n.id !== 'c');
    nodes = syncTapTrays(nodes);
    expect(traysOf(nodes, 'TAP-M100T')).toHaveLength(1);

    // Delete the last module - no modules left, the (empty, unracked) tray is removed.
    nodes = nodes.filter(n => n.id !== 'a');
    nodes = syncTapTrays(nodes);
    expect(traysOf(nodes, 'TAP-M100T')).toHaveLength(0);
  });

  it('never removes a tray that has been racked, even if it is no longer needed', () => {
    let nodes = [tapModule('a', 'TAP-M251T'), tapModule('b', 'TAP-M251T'), tapModule('c', 'TAP-M251T')];
    nodes = syncTapTrays(nodes);
    const trayId = traysOf(nodes, 'TAP-M100T')[0].id;

    // Rack the tray.
    nodes = nodes.map(n => n.id === trayId ? { ...n, data: { ...n.data, rackId: 'rack-1', rackU: 20 } } : n);

    // Delete all the modules that needed it.
    nodes = nodes.filter(n => n.data?.model !== 'TAP-M251T');
    nodes = syncTapTrays(nodes);

    expect(traysOf(nodes, 'TAP-M100T')).toHaveLength(1);
    expect(traysOf(nodes, 'TAP-M100T')[0].id).toBe(trayId);
  });

  it('pools a breakout panel with real tap modules in the same tray budget', () => {
    // PNL-M341T is catalogued as a "module" (isTapModule() keys purely on
    // catalogue type, not name), so it should compete for tray bays exactly
    // like a tap module: 3 tap modules + 1 panel = 4, which spills into an
    // M200T rather than fitting an M100T's 3 bays.
    const nodes = [
      tapModule('a', 'TAP-M251T'), tapModule('b', 'TAP-M251T'), tapModule('c', 'TAP-M251T'),
      tapModule('p', 'PNL-M341T'),
    ];
    const synced = syncTapTrays(nodes);
    expect(traysOf(synced, 'TAP-M200T')).toHaveLength(1);
    expect(traysOf(synced, 'TAP-M100T')).toHaveLength(0);
  });

  it('never removes a tray with a module nested in one of its bays, even if it is no longer needed', () => {
    let nodes = [tapModule('a', 'TAP-M251T'), tapModule('b', 'TAP-M251T'), tapModule('c', 'TAP-M251T')];
    nodes = syncTapTrays(nodes);
    const trayId = traysOf(nodes, 'TAP-M100T')[0].id;

    // Nest one of the modules into the tray's bay 1.
    nodes = nodes.map(n => n.id === 'a' ? { ...n, data: { ...n.data, trayId, traySlot: 1 } } : n);

    // Delete the other two modules that aren't nested.
    nodes = nodes.filter(n => n.id !== 'b' && n.id !== 'c');
    nodes = syncTapTrays(nodes);

    // The tray survives because "a" is still nested in it, even though the
    // math (1 module) would technically fit without a tray at all now moot -
    // trays are never removed while anything is nested inside them.
    expect(traysOf(nodes, 'TAP-M100T')).toHaveLength(1);
    expect(traysOf(nodes, 'TAP-M100T')[0].id).toBe(trayId);
  });

  it('allocates TAP-M200T for 2 TAPs when preference is TAP-M200T', () => {
    const nodes = [tapModule('a', 'TAP-M251T'), tapModule('b', 'TAP-M251T')];
    const synced = syncTapTrays(nodes, 'TAP-M200T');
    expect(traysOf(synced, 'TAP-M200T')).toHaveLength(1);
    expect(traysOf(synced, 'TAP-M100T')).toHaveLength(0);
  });

  it('preserves and accounts for a manually overridden TAP-M200T tray', () => {
    const manualTray: CustomNode = {
      id: 'manual-tray-1',
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
    const nodes = [manualTray, tapModule('a', 'TAP-M251T'), tapModule('b', 'TAP-M251T')];
    const synced = syncTapTrays(nodes, 'auto');
    expect(traysOf(synced, 'TAP-M200T')).toHaveLength(1);
    expect(traysOf(synced, 'TAP-M100T')).toHaveLength(0);
    expect(synced.find(n => n.id === 'manual-tray-1')).toBeDefined();
  });
});
