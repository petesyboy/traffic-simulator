import { describe, it, expect } from 'vitest';
import type { CustomNode, HardwareNodeData } from '../store/types';
import {
  allocatePorts,
  getChassisPorts,
  getOpticCage,
  getPortOpticMap,
  getRequiredPortCount,
  getTappedLinkCount,
  isTapNode,
  isTapUnconfigured,
} from './ports';

const hw = (data: Partial<HardwareNodeData>): HardwareNodeData => data as HardwareNodeData;

const node = (id: string, data: Record<string, unknown>): CustomNode => ({
  id,
  type: 'hardwareNode',
  position: { x: 0, y: 0 },
  data,
} as CustomNode);

describe('getChassisPorts', () => {
  it('expands a TA25E into its real 48 SFP28 + 8 QSFP28 complement', () => {
    const ports = getChassisPorts('GigaVUE-TA25E', hw({}));

    expect(ports).toHaveLength(56);

    const sfp = ports.filter(p => p.cage === 'SFP');
    const qsfp = ports.filter(p => p.cage === 'QSFP');
    expect(sfp).toHaveLength(48);
    expect(qsfp).toHaveLength(8);

    // GigaVUE-OS naming: x for the SFP family, c for QSFP.
    expect(sfp[0].id).toBe('1/1/x1');
    expect(sfp[47].id).toBe('1/1/x48');
    expect(qsfp[0].id).toBe('1/1/c1');
    expect(qsfp[7].id).toBe('1/1/c8');

    // Board must line up with InstalledOptic.board so optics can be tied to ports.
    expect(sfp[0].board).toBe('Base Ports');
    expect(sfp[0].type).toBe('SFP28');
    expect(qsfp[0].type).toBe('QSFP28');
  });

  it('flags only the licensed subset for a Quarter-capacity TA25E', () => {
    const ports = getChassisPorts('GigaVUE-TA25E', hw({ portCapacity: 'Quarter' }));

    expect(ports.filter(p => p.licensed && p.cage === 'SFP')).toHaveLength(12);
    expect(ports.filter(p => p.licensed && p.cage === 'QSFP')).toHaveLength(2);
    // The rest are physically present but outside the tier, not absent.
    expect(ports).toHaveLength(56);
    expect(ports.filter(p => !p.licensed)).toHaveLength(42);
    // Licensing runs from the low ports up.
    expect(ports.find(p => p.id === '1/1/x12')?.licensed).toBe(true);
    expect(ports.find(p => p.id === '1/1/x13')?.licensed).toBe(false);
  });

  it('treats every port as licensed at Full capacity', () => {
    const ports = getChassisPorts('GigaVUE-TA25E', hw({ portCapacity: 'Full' }));
    expect(ports.every(p => p.licensed)).toBe(true);
  });

  it('derives HC3 ports from installed modules, ignoring empty slots', () => {
    const ports = getChassisPorts('GigaVUE-HC3', hw({ installedBoards: { '2': 'PRT-HC3-C16' } }));

    expect(ports).toHaveLength(16);
    expect(ports[0].id).toBe('1/2/c1');
    expect(ports[15].id).toBe('1/2/c16');
    expect(ports[0].board).toBe('PRT-HC3-C16 (Slot 2)');
    // HC3 has no base ports of its own - everything comes from modules.
    expect(ports.every(p => p.slot === '2')).toBe(true);
  });

  it('returns nothing for an HC3 with no modules fitted', () => {
    expect(getChassisPorts('GigaVUE-HC3', hw({}))).toHaveLength(0);
  });

  it('includes HC1 built-in RJ45 copper ports alongside its SFP cages', () => {
    const ports = getChassisPorts('GigaVUE-HC1', hw({}));
    expect(ports.filter(p => p.cage === 'RJ45')).toHaveLength(4);
    expect(ports.filter(p => p.cage === 'SFP')).toHaveLength(12);
    expect(ports[0].board).toBe('HC1-X12G4 (Main board)');
  });

  it('returns nothing for TAPs and unknown models, which have no typed port list', () => {
    expect(getChassisPorts('G-TAP A-SF2', hw({}))).toHaveLength(0);
    expect(getChassisPorts('Not-A-Real-Model', hw({}))).toHaveLength(0);
    expect(getChassisPorts('', hw({}))).toHaveLength(0);
  });

  it('resolves an installed module regardless of the casing stored in installedBoards (regression: PRT-HC1-x12/SMT-HC3-c08 casing drift silently produced zero ports)', () => {
    const ports = getChassisPorts('GigaVUE-HC1-Plus', hw({ installedBoards: { '2': 'prt-hc1-x12' } }));
    expect(ports.filter(p => p.board.startsWith('prt-hc1-x12'))).toHaveLength(12);
  });

  it('every board name opticRules.json offers for a module slot resolves to a real catalogue module (regression: casing/naming drift between the two files makes a selectable board silently add zero ports)', async () => {
    const opticRules = (await import('../constants/opticRules.json')).default as Record<string, Record<string, string[]>>;
    const hardwareCatalogue = (await import('../constants/hardwareCatalogue.json')).default;
    const { findModuleBySku } = await import('./hardwareUtils');

    const moduleSlotModels = new Set(
      ([...hardwareCatalogue.ta_series, ...hardwareCatalogue.hc_series] as { model: string; module_slots?: number }[])
        .filter(c => (c.module_slots || 0) > 0)
        .map(c => c.model),
    );

    for (const [model, boards] of Object.entries(opticRules)) {
      if (!moduleSlotModels.has(model)) continue; // e.g. GigaVUE-HC2 was dropped from the catalogue on purpose
      for (const board of Object.keys(boards)) {
        if (board.toLowerCase().includes('main') || board.toLowerCase().includes('base')) continue;
        expect(findModuleBySku(board), `${model} board "${board}" has no matching catalogue module`).toBeDefined();
      }
    }
  });
});

describe('getChassisPorts for a breakout panel', () => {
  it('returns 3 MPO ports and 12 LC ports (4 per group), matching the physical unit', () => {
    const ports = getChassisPorts('PNL-M341T', hw({}));
    expect(ports).toHaveLength(15);

    const mpo = ports.filter(p => p.cage === 'MPO');
    const lc = ports.filter(p => p.cage === 'SFP');
    expect(mpo).toHaveLength(3);
    expect(lc).toHaveLength(12);

    expect(mpo.map(p => p.id)).toEqual(['1/1/m1', '1/1/m2', '1/1/m3']);
    expect(lc.filter(p => p.id.startsWith('1/1/m1/')).map(p => p.id)).toEqual([
      '1/1/m1/1', '1/1/m1/2', '1/1/m1/3', '1/1/m1/4',
    ]);
  });

  it('returns the same port shape for both PNL-M341T and PNL-M343T (panel identity has no effect on its own ports)', () => {
    expect(getChassisPorts('PNL-M343T', hw({}))).toEqual(getChassisPorts('PNL-M341T', hw({})));
  });

  it('every panel port is licensed and carries no optic of its own', () => {
    const ports = getChassisPorts('PNL-M341T', hw({}));
    expect(ports.every(p => p.licensed)).toBe(true);
    expect(getPortOpticMap(ports, undefined).size).toBe(0);
  });
});

describe('getOpticCage', () => {
  it('maps optic speed onto the cage family it physically needs', () => {
    expect(getOpticCage('SFP-532T (10G SFP+ SR)')).toBe('SFP');
    expect(getOpticCage('SFP-553T (25G SFP28 SR)')).toBe('SFP');
    expect(getOpticCage('QSF-502 (40G QSFP+ SR4)')).toBe('QSFP');
    expect(getOpticCage('Q28-502 (100G QSFP28 SR4)')).toBe('QSFP');
    expect(getOpticCage('QDD-501 (400G QSFP-DD SR8)')).toBe('QSFP');
  });

  it('places every QSB-* BiDi optic in a QSFP cage, never SFP', () => {
    // A bare "QSB-521" carries no speed digit, so it used to fall through to
    // 'Unknown' in getOpticSpeed and land in an SFP cage on a TA25E.
    ['QSB-501', 'QSB-521', 'QSB-523T', 'QSB-531'].forEach(sku => {
      expect(getOpticCage(sku)).toBe('QSFP');
    });
  });
});

describe('getPortOpticMap', () => {
  it('lays installed optics into matching cages in order', () => {
    const ports = getChassisPorts('GigaVUE-TA25E', hw({}));
    const map = getPortOpticMap(ports, [
      { board: 'Base Ports', optic: 'SFP-532T (10G SFP+ SR)', qty: 3 },
      { board: 'Base Ports', optic: 'Q28-502T (100G QSFP28 SR4)', qty: 2 },
    ]);

    // SFP optics fill SFP cages, QSFP optics fill QSFP cages - not one shared run.
    expect(map.get('1/1/x1')).toContain('SFP-532T');
    expect(map.get('1/1/x3')).toContain('SFP-532T');
    expect(map.get('1/1/x4')).toBeUndefined();
    expect(map.get('1/1/c1')).toContain('Q28-502T');
    expect(map.get('1/1/c2')).toContain('Q28-502T');
    expect(map.get('1/1/c3')).toBeUndefined();
    expect(map.size).toBe(5);
  });

  it('returns an empty map when no optics are fitted', () => {
    const ports = getChassisPorts('GigaVUE-TA25E', hw({}));
    expect(getPortOpticMap(ports, []).size).toBe(0);
    expect(getPortOpticMap(ports, undefined).size).toBe(0);
  });
});

describe('getTappedLinkCount / getRequiredPortCount', () => {
  it('sums tapped link allocations', () => {
    const tap = node('tap', { model: 'G-TAP A-SF2', tappedLinkAllocations: [{ qty: 3, optic: 'x' }, { qty: 1, optic: 'y' }] });
    expect(getTappedLinkCount(tap)).toBe(4);
  });

  it('falls back to the legacy tappedLinksCount scalar, then to 1', () => {
    expect(getTappedLinkCount(node('t', { model: 'G-TAP A-SF2', tappedLinksCount: 6 }))).toBe(6);
    expect(getTappedLinkCount(node('t', { model: 'G-TAP A-SF2' }))).toBe(1);
  });

  it('charges two chassis ports per tapped link, in either direction', () => {
    const tap = node('tap', { model: 'G-TAP A-SF2', tappedLinkAllocations: [{ qty: 4, optic: 'x' }] });
    const ta = node('ta', { model: 'GigaVUE-TA25E' });

    expect(getRequiredPortCount(tap, ta)).toBe(8);
    expect(getRequiredPortCount(ta, tap)).toBe(8);
  });

  it('charges a single port for an ordinary chassis-to-chassis link', () => {
    const ta = node('ta', { model: 'GigaVUE-TA25E' });
    const hc = node('hc', { model: 'GigaVUE-HC1' });
    expect(getRequiredPortCount(ta, hc)).toBe(1);
  });

  it('recognises both hardware TAPs and inputNode TAP sources', () => {
    expect(isTapNode(node('a', { model: 'G-TAP A-SF2' }))).toBe(true);
    expect(isTapNode(node('b', { model: 'GigaVUE-TA25E' }))).toBe(false);
    expect(isTapNode({ id: 'c', type: 'inputNode', position: { x: 0, y: 0 }, data: { configType: 'TAP' } } as CustomNode)).toBe(true);
    expect(isTapNode(undefined)).toBe(false);
  });
});

describe('unconfigured TAPs', () => {
  // The sidebar palette drops every TAP with exactly this shape.
  const freshlyDropped = { configType: 'Hardware', model: 'TAP-M251T', sku: 'TAP-M251T', tappedLinksCount: 0, tappedLinkAllocations: [] };

  it('treats a freshly dropped TAP as unconfigured rather than as one link', () => {
    const tap = node('tap', freshlyDropped);
    // An empty array is truthy, so a plain `allocations || [fallback]` used to
    // skip the fallback and silently produce nothing anywhere.
    expect(getTappedLinkCount(tap)).toBe(0);
    expect(isTapUnconfigured(tap)).toBe(true);
    expect(getRequiredPortCount(tap, node('ta', { model: 'GigaVUE-TA25E' }))).toBe(0);
  });

  it('still honours a legacy tappedLinksCount with no allocations array', () => {
    const legacy = node('tap', { model: 'G-TAP A-SF2', tappedLinksCount: 4, tappedLinkOptic: '10G-SFP-SR' });
    expect(getTappedLinkCount(legacy)).toBe(4);
    expect(isTapUnconfigured(legacy)).toBe(false);
  });

  it('still assumes a single link for data predating both fields', () => {
    const ancient = node('tap', { model: 'G-TAP A-SF2' });
    expect(getTappedLinkCount(ancient)).toBe(1);
    expect(isTapUnconfigured(ancient)).toBe(false);
  });

  it('is configured again as soon as links are allocated', () => {
    const configured = node('tap', { ...freshlyDropped, tappedLinkAllocations: [{ qty: 2, optic: '100G-QSFP28-SR4' }] });
    expect(getTappedLinkCount(configured)).toBe(2);
    expect(isTapUnconfigured(configured)).toBe(false);
  });

  it('does not treat a chassis as an unconfigured TAP', () => {
    expect(isTapUnconfigured(node('ta', { model: 'GigaVUE-TA25E' }))).toBe(false);
  });
});

describe('allocatePorts', () => {
  const ta25e = getChassisPorts('GigaVUE-TA25E', hw({}));

  it('skips ports already taken', () => {
    const allocated = allocatePorts(ta25e, new Set(['1/1/x1', '1/1/x2']), 2, 'SFP');
    expect(allocated.map(p => p.id)).toEqual(['1/1/x3', '1/1/x4']);
  });

  it('prefers licensed ports before falling back to unlicensed ones', () => {
    const quarter = getChassisPorts('GigaVUE-TA25E', hw({ portCapacity: 'Quarter' }));
    const allocated = allocatePorts(quarter, new Set(), 13, 'SFP');

    // 12 licensed SFP cages, so the 13th has to spill into unlicensed territory.
    expect(allocated.filter(p => p.licensed)).toHaveLength(12);
    expect(allocated[12].licensed).toBe(false);
  });

  it('honours the requested cage family', () => {
    expect(allocatePorts(ta25e, new Set(), 3, 'QSFP').every(p => p.cage === 'QSFP')).toBe(true);
    expect(allocatePorts(ta25e, new Set(), 3, 'SFP').every(p => p.cage === 'SFP')).toBe(true);
  });

  it('cannot place an SFP optic in a QSFP-only chassis like the TA200', () => {
    const ta200 = getChassisPorts('GigaVUE-TA200', hw({}));
    expect(ta200.length).toBeGreaterThan(0);
    expect(ta200.every(p => p.cage === 'QSFP')).toBe(true);
    expect(allocatePorts(ta200, new Set(), 2, 'SFP')).toHaveLength(0);
  });

  it('never auto-allocates RJ45 management/copper ports', () => {
    const hc1 = getChassisPorts('GigaVUE-HC1', hw({}));
    const allocated = allocatePorts(hc1, new Set(), 16);
    expect(allocated.some(p => p.cage === 'RJ45')).toBe(false);
    expect(allocated).toHaveLength(12); // the 12 SFP cages only
  });

  it('returns what it can rather than over-subscribing when cages run out', () => {
    // 8 QSFP cages exist; asking for 10 yields 8, and the shortfall is surfaced
    // by the config validator rather than silently invented here.
    expect(allocatePorts(ta25e, new Set(), 10, 'QSFP')).toHaveLength(8);
    expect(allocatePorts(ta25e, new Set(), 0, 'SFP')).toHaveLength(0);
  });
});
