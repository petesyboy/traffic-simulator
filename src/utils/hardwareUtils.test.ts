import { describe, it, expect } from 'vitest';
import {
  getOpticSpeed,
  getOpticSpeedMbps,
  getBoardPortCapacity,
  getChassisBasePortCapacity,
  getOpticFiberType,
  formatOpticLabel,
  getBoardDescription,
  getTapLinkCapacity,
  getRemainingCageCapacity,
  getTaLicenseLimits,
  getCageCapacityBreakdown,
  getMaxFanoutSfpPorts,
  getBoardSpeedSubCap,
  getMaxChassisCapacityBySpeed,
  getGigaSmartEngineCount,
  getDeviceRU,
} from './hardwareUtils';
import type { HardwareNodeData } from '../store/types';

describe('hardwareUtils', () => {
  describe('getCageCapacityBreakdown', () => {
    it('should calculate correct base capacity for an empty HC1', () => {
      const breakdown = getCageCapacityBreakdown('GigaVUE-HC1', {
        label: 'Test HC1',
        configType: 'Hardware',
        model: 'GigaVUE-HC1',
        optics: [],
        installedBoards: {},
      } as HardwareNodeData);

      expect(breakdown.totalSfpCages).toBe(12);
      expect(breakdown.totalQsfpCages).toBe(0);
      expect(breakdown.usedSfpOptics).toBe(0);
      expect(breakdown.remainingSfpCages).toBe(12);
      expect(breakdown.isLicensed).toBe(false);
    });

    it('should show the 2 built-in QSFP28 cages on a freshly-deployed GigaVUE-HCT with no module installed', () => {
      // GVS-HCT01's SKU description: "GigaVUE-HCT chassis, 2 x 40/100G QSFP28 cages,
      // fan tray, 1 AC power brick." A bare HCT with no board in its single slot
      // should still report those 2 fixed QSFP cages as free, not 0/0.
      const breakdown = getCageCapacityBreakdown('GigaVUE-HCT', {
        label: 'Test HCT',
        configType: 'Hardware',
        model: 'GigaVUE-HCT',
        optics: [],
        installedBoards: {},
      } as HardwareNodeData);

      expect(breakdown.totalQsfpCages).toBe(2);
      expect(breakdown.remainingQsfpCages).toBe(2);
      expect(breakdown.totalSfpCages).toBe(0);
    });

    it('should calculate used capacity for an HC1 with optics', () => {
      const breakdown = getCageCapacityBreakdown('GigaVUE-HC1', {
        label: 'Test HC1',
        configType: 'Hardware',
        model: 'GigaVUE-HC1',
        optics: [{ optic: 'SFP-532', qty: 5, board: 'Base Ports' }],
        installedBoards: {},
      } as HardwareNodeData);

      expect(breakdown.totalSfpCages).toBe(12);
      expect(breakdown.usedSfpOptics).toBe(5);
      expect(breakdown.remainingSfpCages).toBe(7);
      expect(breakdown.remainingLicensedSfpCages).toBe(7);
    });

    it('should report built-in copper RJ45 ports only for GigaVUE-HC1, not TA-series chassis', () => {
      const hc1 = getCageCapacityBreakdown('GigaVUE-HC1', {
        label: 'Test HC1', configType: 'Hardware', model: 'GigaVUE-HC1', optics: [], installedBoards: {},
      } as HardwareNodeData);
      expect(hc1.hasBuiltInCopper).toBe(true);

      for (const model of ['GigaVUE-TA25E', 'GigaVUE-TA25', 'GigaVUE-TA100', 'GigaVUE-TA200', 'GigaVUE-TA400']) {
        const breakdown = getCageCapacityBreakdown(model, {
          label: `Test ${model}`, configType: 'Hardware', model, optics: [], installedBoards: {},
        } as HardwareNodeData);
        expect(breakdown.hasBuiltInCopper).toBe(false);
      }
    });

    it('should account for installed boards on an HC3', () => {
      const breakdown = getCageCapacityBreakdown('GigaVUE-HC3', {
        label: 'Test HC3',
        configType: 'Hardware',
        model: 'GigaVUE-HC3',
        optics: [],
        installedBoards: { '1': 'PRT-HC3-C16' },
      } as HardwareNodeData);

      expect(breakdown.totalSfpCages).toBe(0);
      expect(breakdown.totalQsfpCages).toBe(16);
      expect(breakdown.usedQsfpOptics).toBe(0);
      expect(breakdown.remainingQsfpCages).toBe(16);
    });

    it('should respect license limits on a TA25E with Quarter capacity', () => {
      const breakdown = getCageCapacityBreakdown('GigaVUE-TA25E', {
        label: 'Test TA25E',
        configType: 'Hardware',
        model: 'GigaVUE-TA25E',
        portCapacity: 'Quarter',
        optics: [
          { optic: 'SFP-552', qty: 10, board: 'Base Ports' },
          { optic: 'Q28-502T', qty: 1, board: 'Base Ports' },
        ],
        installedBoards: {},
      } as HardwareNodeData);

      expect(breakdown.isLicensed).toBe(true);
      // Physical cages
      expect(breakdown.totalSfpCages).toBe(48);
      expect(breakdown.totalQsfpCages).toBe(8);
      // Licensed cages
      expect(breakdown.licensedSfpCages).toBe(12);
      expect(breakdown.licensedQsfpCages).toBe(2);
      // Used optics
      expect(breakdown.usedSfpOptics).toBe(10);
      expect(breakdown.usedQsfpOptics).toBe(1);
      // Remaining licensed cages
      expect(breakdown.remainingLicensedSfpCages).toBe(2); // 12 - 10
      expect(breakdown.remainingLicensedQsfpCages).toBe(1); // 2 - 1
    });

    it('should correctly calculate 400G usage on a TA400E with an Upgrade license', () => {
      const breakdown = getCageCapacityBreakdown('GigaVUE-TA400E', {
        label: 'Test TA400E',
        configType: 'Hardware',
        model: 'GigaVUE-TA400E',
        portCapacity: 'Upgrade',
        optics: [
          { optic: 'QDD-503', qty: 10, board: 'Base Ports' }, // 400G
          { optic: 'Q28-502T', qty: 12, board: 'Base Ports' }, // 100G
        ],
        installedBoards: {},
      } as HardwareNodeData);

      expect(breakdown.isLicensed).toBe(true);
      // Physical cages
      expect(breakdown.totalSfpCages).toBe(2);
      expect(breakdown.totalQsfpCages).toBe(32);
      // Licensed cages
      expect(breakdown.licensedSfpCages).toBe(2);
      expect(breakdown.licensedQsfpCages).toBe(32);
      expect(breakdown.licensedQsfp400gCages).toBe(16);
      // Used optics
      expect(breakdown.used400G).toBe(10);
      expect(breakdown.usedQsfpOptics).toBe(22); // 10 (400G) + 12 (100G)
      // Remaining licensed cages
      expect(breakdown.remainingLicensedQsfpCages).toBe(10); // 32 - 22
      expect(breakdown.remainingLicensedQsfp400gCages).toBe(6); // 16 - 10
    });
  });

  describe('getTaLicenseLimits', () => {
    it('should return correct license limits for GigaVUE-TA25E', () => {
      expect(getTaLicenseLimits('GigaVUE-TA25E', 'Quarter')).toEqual({ 'SFP28': 12, 'QSFP28': 2, qsfp_400g: 0 });
      expect(getTaLicenseLimits('GigaVUE-TA25E', 'Half')).toEqual({ 'SFP28': 24, 'QSFP28': 4, qsfp_400g: 0 });
      expect(getTaLicenseLimits('GigaVUE-TA25E', 'Full')).toEqual({ 'SFP28': 48, 'QSFP28': 8, qsfp_400g: 0 });
    });

    it('should return correct license limits for GigaVUE-TA200', () => {
      expect(getTaLicenseLimits('GigaVUE-TA200', 'Half')).toEqual({ 'QSFP28': 32, qsfp_400g: 0 });
      expect(getTaLicenseLimits('GigaVUE-TA200', 'Full')).toEqual({ 'QSFP28': 64, qsfp_400g: 0 });
    });
  });
  
  describe('getOpticSpeed and getOpticSpeedMbps', () => {
    it('should determine correct optic speed tiers', () => {
      expect(getOpticSpeed('QDD-502 (400G)')).toBe('400G');
      expect(getOpticSpeed('Q28-502 (100G)')).toBe('100G');
      expect(getOpticSpeed('SFP-552 (25G)')).toBe('25G');
      expect(getOpticSpeed('SFP-532 (10G)')).toBe('10G');
      expect(getOpticSpeed('SFP-501 (1G)')).toBe('1G');
      expect(getOpticSpeed('Unknown-Optic')).toBe('Unknown');
    });

    it('recognises the QSB-* BiDi optics, which carry no speed digit in the bare SKU', () => {
      // A bare "QSB-521" used to fall through every check to 'Unknown', which
      // getOpticCage then defaulted to an SFP cage instead of QSFP.
      expect(getOpticSpeed('QSB-501')).toBe('40G');
      expect(getOpticSpeed('QSB-521')).toBe('100G');
      expect(getOpticSpeed('QSB-523T')).toBe('100G');
      expect(getOpticSpeed('QSB-531')).toBe('100G');
    });

    it('should return correct speed in Mbps', () => {
      expect(getOpticSpeedMbps('QDD-502')).toBe(400000);
      expect(getOpticSpeedMbps('Q28-502')).toBe(100000);
      expect(getOpticSpeedMbps('SFP-552')).toBe(25000);
      expect(getOpticSpeedMbps('SFP-532')).toBe(10000);
      expect(getOpticSpeedMbps('SFP-501')).toBe(1000);
      expect(getOpticSpeedMbps('Unknown')).toBe(0);
    });
  });

  describe('getBoardPortCapacity', () => {
    it('should return correct port capacity for boards', () => {
      // Test a module from the catalogue
      expect(getBoardPortCapacity('SMT-HC3-C05')).toEqual({ 'QSFP28': 5 });

      expect(getBoardPortCapacity('PRT-HC1-Q04X08')).toEqual({ 'SFP28': 8, 'QSFP28': 4 });
    });

    // Every module in hardwareCatalogue.json's `modules` array, cross-checked against
    // the official GigaVUE HC Series datasheet (references/ds-gigavue-hc-series.pdf)
    // and the real SKU descriptions in src/constants/skus.json.
    it.each([
      ['SMT-HC3-C05', { 'QSFP28': 5 }],
      ['PRT-HC1-Q04X08', { 'SFP28': 8, 'QSFP28': 4 }],
      ['BPS-HC1-D25A24', { 'SFP+': 8 }],
      ['BPS-HC1-D25A60', { 'SFP+': 12 }],
      ['BPS-HC1-D35C60', { 'SFP+': 12 }],
      ['PRT-HC1-x12', { 'SFP+': 12 }],
      ['PRT-HC1-G12', { 'RJ45': 6, 'SFP': 6 }],
      ['SMT-HC1-S', {}],
      ['TAP-HC1-G10040', { 'RJ45': 8 }],
      ['PRT-HC3-X24', { 'SFP28': 24 }],
      ['SMT-HC3-c08q08', { 'QSFP28': 8, 'QSFP+': 8 }],
      ['PRT-HC3-C08Q08', { 'QSFP28': 8, 'QSFP+': 8 }],
      ['SMT-HC3-c16', { 'QSFP28': 16 }],
      ['PRT-HC3-C16', { 'QSFP28': 16 }],
      ['SMT-HC3-c08', { 'QSFP28': 8 }],
      ['BPS-HC3-C25F2G', { 'QSFP28': 4, 'SFP28': 16 }],
      ['BPS-HC3-Q35C2G', { 'QSFP+': 4, 'SFP28': 16 }],
      ['BPS-HC3-C35C2G', { 'QSFP28': 4, 'SFP28': 16 }],
    ])('%s returns %j', (boardSku, expected) => {
      expect(getBoardPortCapacity(boardSku)).toEqual(expected);
    });
  });

  describe('getChassisBasePortCapacity', () => {
    it('should return correct base capacities for chassis models', () => {
      expect(getChassisBasePortCapacity('GigaVUE-TA25E')).toEqual({ 'SFP28': 48, 'QSFP28': 8 });
      expect(getChassisBasePortCapacity('GigaVUE-HC1')).toEqual({ 'RJ45': 4, 'SFP+': 12 });
      expect(getChassisBasePortCapacity('GigaVUE-HC1-Plus')).toEqual({ 'SFP28': 8, 'QSFP28': 4 });
      expect(getChassisBasePortCapacity('GigaVUE-HC3')).toEqual({});
      expect(getChassisBasePortCapacity('GigaVUE-HCT')).toEqual({ 'QSFP28': 2 });
    });
  });

  describe('getCageCapacityBreakdown — every HC module installed alone', () => {
    // Base physical SFP/QSFP cage totals per chassis with zero boards installed,
    // derived straight from getChassisBasePortCapacity (RJ45 built-in ports never
    // count toward either cage bucket).
    const baseCages: Record<string, { sfp: number; qsfp: number }> = {
      'GigaVUE-HCT': { sfp: 0, qsfp: 2 },
      'GigaVUE-HC1': { sfp: 12, qsfp: 0 },
      'GigaVUE-HC1-Plus': { sfp: 8, qsfp: 4 },
      'GigaVUE-HC3': { sfp: 0, qsfp: 0 },
    };

    const hwData = (model: string, boardSku: string) => ({
      label: 'Test',
      configType: 'Hardware',
      model,
      optics: [],
      installedBoards: { '1': boardSku },
    } as unknown as HardwareNodeData);

    // [chassis, board, { sfp delta, qsfp delta }] — every board that chassis can
    // actually accept per the datasheet, installed alone in slot 1.
    it.each([
      // GigaVUE-HCT (1 slot) — all HC1-family boards it supports, plus its own PRT-HC1-G12
      ['GigaVUE-HCT', 'PRT-HC1-Q04X08', { sfp: 8, qsfp: 4 }],
      ['GigaVUE-HCT', 'PRT-HC1-x12', { sfp: 12, qsfp: 0 }],
      ['GigaVUE-HCT', 'PRT-HC1-G12', { sfp: 6, qsfp: 0 }],
      ['GigaVUE-HCT', 'BPS-HC1-D25A24', { sfp: 8, qsfp: 0 }],
      ['GigaVUE-HCT', 'BPS-HC1-D25A60', { sfp: 12, qsfp: 0 }],
      ['GigaVUE-HCT', 'BPS-HC1-D35C60', { sfp: 12, qsfp: 0 }],
      ['GigaVUE-HCT', 'SMT-HC1-S', { sfp: 0, qsfp: 0 }],
      ['GigaVUE-HCT', 'TAP-HC1-G10040', { sfp: 0, qsfp: 0 }],

      // GigaVUE-HC1 (2 slots) — PRT-HC1-G12 is HCT-only, not valid here
      ['GigaVUE-HC1', 'PRT-HC1-Q04X08', { sfp: 8, qsfp: 4 }],
      ['GigaVUE-HC1', 'PRT-HC1-x12', { sfp: 12, qsfp: 0 }],
      ['GigaVUE-HC1', 'BPS-HC1-D25A24', { sfp: 8, qsfp: 0 }],
      ['GigaVUE-HC1', 'BPS-HC1-D25A60', { sfp: 12, qsfp: 0 }],
      ['GigaVUE-HC1', 'BPS-HC1-D35C60', { sfp: 12, qsfp: 0 }],
      ['GigaVUE-HC1', 'SMT-HC1-S', { sfp: 0, qsfp: 0 }],
      ['GigaVUE-HC1', 'TAP-HC1-G10040', { sfp: 0, qsfp: 0 }],

      // GigaVUE-HC1-Plus (2 slots) — same module set as HC1
      ['GigaVUE-HC1-Plus', 'PRT-HC1-Q04X08', { sfp: 8, qsfp: 4 }],
      ['GigaVUE-HC1-Plus', 'PRT-HC1-x12', { sfp: 12, qsfp: 0 }],
      ['GigaVUE-HC1-Plus', 'BPS-HC1-D25A24', { sfp: 8, qsfp: 0 }],
      ['GigaVUE-HC1-Plus', 'BPS-HC1-D25A60', { sfp: 12, qsfp: 0 }],
      ['GigaVUE-HC1-Plus', 'BPS-HC1-D35C60', { sfp: 12, qsfp: 0 }],
      ['GigaVUE-HC1-Plus', 'SMT-HC1-S', { sfp: 0, qsfp: 0 }],
      ['GigaVUE-HC1-Plus', 'TAP-HC1-G10040', { sfp: 0, qsfp: 0 }],

      // GigaVUE-HC3 (4 slots) — combining the CCv1 and CCv2 board sets
      ['GigaVUE-HC3', 'SMT-HC3-C05', { sfp: 0, qsfp: 5 }],
      ['GigaVUE-HC3', 'SMT-HC3-c08', { sfp: 0, qsfp: 8 }],
      ['GigaVUE-HC3', 'SMT-HC3-c08q08', { sfp: 0, qsfp: 16 }],
      ['GigaVUE-HC3', 'SMT-HC3-c16', { sfp: 0, qsfp: 16 }],
      ['GigaVUE-HC3', 'PRT-HC3-X24', { sfp: 24, qsfp: 0 }],
      ['GigaVUE-HC3', 'PRT-HC3-C08Q08', { sfp: 0, qsfp: 16 }],
      ['GigaVUE-HC3', 'PRT-HC3-C16', { sfp: 0, qsfp: 16 }],
      ['GigaVUE-HC3', 'BPS-HC3-C25F2G', { sfp: 16, qsfp: 4 }],
      ['GigaVUE-HC3', 'BPS-HC3-Q35C2G', { sfp: 16, qsfp: 4 }],
      ['GigaVUE-HC3', 'BPS-HC3-C35C2G', { sfp: 16, qsfp: 4 }],
    ])('%s + %s -> base + module cages', (chassis, board, delta) => {
      const breakdown = getCageCapacityBreakdown(chassis, hwData(chassis, board));
      const base = baseCages[chassis];
      expect(breakdown.totalSfpCages).toBe(base.sfp + delta.sfp);
      expect(breakdown.totalQsfpCages).toBe(base.qsfp + delta.qsfp);
    });
  });

  describe('getCageCapacityBreakdown — multiple boards installed simultaneously', () => {
    it('sums cages across both slots on an HC1', () => {
      const breakdown = getCageCapacityBreakdown('GigaVUE-HC1', {
        label: 'Test', configType: 'Hardware', model: 'GigaVUE-HC1',
        optics: [],
        installedBoards: { '1': 'PRT-HC1-Q04X08', '2': 'BPS-HC1-D25A60' },
      } as unknown as HardwareNodeData);
      // base (SFP+:12) + PRT-HC1-Q04X08 (SFP28:8, QSFP28:4) + BPS-HC1-D25A60 (SFP+:12)
      expect(breakdown.totalSfpCages).toBe(12 + 8 + 12);
      expect(breakdown.totalQsfpCages).toBe(0 + 4 + 0);
    });

    it('sums cages across both slots on an HC1-Plus', () => {
      const breakdown = getCageCapacityBreakdown('GigaVUE-HC1-Plus', {
        label: 'Test', configType: 'Hardware', model: 'GigaVUE-HC1-Plus',
        optics: [],
        installedBoards: { '1': 'PRT-HC1-x12', '2': 'BPS-HC1-D35C60' },
      } as unknown as HardwareNodeData);
      // base (SFP28:8, QSFP28:4) + PRT-HC1-x12 (SFP+:12) + BPS-HC1-D35C60 (SFP+:12)
      expect(breakdown.totalSfpCages).toBe(8 + 12 + 12);
      expect(breakdown.totalQsfpCages).toBe(4);
    });

    it('sums cages across all four slots on an HC3, mixing SFP-only, QSFP-only, and mixed boards', () => {
      const breakdown = getCageCapacityBreakdown('GigaVUE-HC3', {
        label: 'Test', configType: 'Hardware', model: 'GigaVUE-HC3',
        optics: [],
        installedBoards: {
          '1': 'PRT-HC3-X24',      // SFP-only:  SFP+:24
          '2': 'SMT-HC3-c16',      // QSFP-only: QSFP28:16
          '3': 'BPS-HC3-C25F2G',   // mixed:     SFP+:16, QSFP28:4
          '4': 'PRT-HC3-C08Q08',   // QSFP-only: QSFP28:8, QSFP+:8
        },
      } as unknown as HardwareNodeData);
      // base HC3 is 0/0
      expect(breakdown.totalSfpCages).toBe(24 + 0 + 16 + 0);
      expect(breakdown.totalQsfpCages).toBe(0 + 16 + 4 + 16);
    });

    it('every board in the modules catalogue has a real entry (regression: no board silently returns {})', () => {
      const catalogueSkus = [
        'SMT-HC3-C05', 'PRT-HC1-Q04X08', 'BPS-HC1-D25A24', 'BPS-HC1-D25A60', 'BPS-HC1-D35C60',
        'PRT-HC1-x12', 'PRT-HC1-G12', 'SMT-HC1-S', 'TAP-HC1-G10040', 'PRT-HC3-X24',
        'SMT-HC3-c08q08', 'PRT-HC3-C08Q08', 'SMT-HC3-c16', 'PRT-HC3-C16', 'SMT-HC3-c08',
        'BPS-HC3-C25F2G', 'BPS-HC3-Q35C2G', 'BPS-HC3-C35C2G',
      ];
      for (const sku of catalogueSkus) {
        // SMT-HC1-S is a pure GigaSMART engine card with no physical cages — {} is correct for it.
        if (sku === 'SMT-HC1-S') continue;
        expect(getBoardPortCapacity(sku), `${sku} returned {} — missing from the catalogue`).not.toEqual({});
      }
    });
  });

  describe('getCageCapacityBreakdown — fully populated chassis vs. datasheet "Chassis Maximum Capabilities"', () => {
    // references/ds-gigavue-hc-series.pdf, p.7, "Chassis Maximum Capabilities" table.
    // The 40Gb/100Gb rows are pure QSFP cage counts with no port-breakout involved
    // (unlike the asterisked 10Gb/25Gb rows, which assume breakout panels), so
    // filling every module slot with the chassis's densest QSFP board and summing
    // cages should equal those rows exactly.
    it('HC1 with both slots filled with PRT-HC1-Q04X08 matches the datasheet 40Gb max of 8', () => {
      const breakdown = getCageCapacityBreakdown('GigaVUE-HC1', {
        label: 'Test', configType: 'Hardware', model: 'GigaVUE-HC1',
        optics: [],
        installedBoards: { '1': 'PRT-HC1-Q04X08', '2': 'PRT-HC1-Q04X08' },
      } as unknown as HardwareNodeData);
      expect(breakdown.totalQsfpCages).toBe(8);
    });

    it('HC1-Plus with both slots filled with PRT-HC1-Q04X08 matches the datasheet 40Gb/100Gb max of 12', () => {
      const breakdown = getCageCapacityBreakdown('GigaVUE-HC1-Plus', {
        label: 'Test', configType: 'Hardware', model: 'GigaVUE-HC1-Plus',
        optics: [],
        installedBoards: { '1': 'PRT-HC1-Q04X08', '2': 'PRT-HC1-Q04X08' },
      } as unknown as HardwareNodeData);
      // 4 built-in QSFP28 + 4 + 4 from the two modules = 12
      expect(breakdown.totalQsfpCages).toBe(12);
    });

    it('HC3 with all four slots filled with PRT-HC3-C16 matches the datasheet 40Gb/100Gb max of 64', () => {
      const breakdown = getCageCapacityBreakdown('GigaVUE-HC3', {
        label: 'Test', configType: 'Hardware', model: 'GigaVUE-HC3',
        optics: [],
        installedBoards: { '1': 'PRT-HC3-C16', '2': 'PRT-HC3-C16', '3': 'PRT-HC3-C16', '4': 'PRT-HC3-C16' },
      } as unknown as HardwareNodeData);
      expect(breakdown.totalQsfpCages).toBe(64);
    });
  });

  // The datasheet's asterisked 10Gb/25Gb density rows ("*Maximum density requires
  // using port breakout, such as G-TAP PNL-M341") used to be modelled by treating
  // a breakout panel as a chassis-side optic that inflated getCageCapacityBreakdown's
  // own SFP count. Breakout panels are now real hardwareNodes with their own MPO/LC
  // ports (see ports.test.ts's "getChassisPorts for a breakout panel") wired via
  // ordinary edges, so they no longer touch the chassis's own cage counting at all -
  // see bomEngine.test.ts and configValidator's validateBreakoutPanels tests for the
  // current coverage of that density scenario.

  describe('getMaxFanoutSfpPorts', () => {
    it('caps GigaVUE-HC3 at 128 and leaves other chassis uncapped', () => {
      expect(getMaxFanoutSfpPorts('GigaVUE-HC3')).toBe(128);
      expect(getMaxFanoutSfpPorts('GigaVUE-HC1')).toBe(Infinity);
      expect(getMaxFanoutSfpPorts('GigaVUE-HC1-Plus')).toBe(Infinity);
      expect(getMaxFanoutSfpPorts('GigaVUE-HCT')).toBe(Infinity);
    });
  });

  describe('getOpticFiberType', () => {
    it('should categorize optics by fiber/cable type', () => {
      expect(getOpticFiberType('SFP-501 (1G Copper)')).toBe('Copper');
      expect(getOpticFiberType('Q28-502 (100G QSFP28 SR4)')).toBe('MM');
      expect(getOpticFiberType('SFP-533 (10G SFP+ LR)')).toBe('SM');
      expect(getOpticFiberType('Unrecognizable')).toBe('');
    });
  });

  describe('formatOpticLabel', () => {
    it('should append fiber types and TAA badges', () => {
      expect(formatOpticLabel('SFP-501 (1G Copper)')).toBe('SFP-501 (1G Copper) [Copper]');
      expect(formatOpticLabel('SFP-533 (10G SFP+ LR)')).toBe('SFP-533 (10G SFP+ LR) [SM]');
    });
  });

  describe('getBoardDescription', () => {
    it('should return correct board descriptions', () => {
      expect(getBoardDescription('q04x08', 'HC1')).toBe('q04x08 (4x 40G QSFP+ & 8x 10G SFP+)');
      expect(getBoardDescription('SMT-HC3-C08Q08', 'HC3')).toBe('SMT-HC3-C08Q08 (GigaSMART Engine + 8x 100G QSFP28 & 8x 40G QSFP+)');
    });

    it('should vary PRT-HC1-Q04X08 port speeds by chassis - same 4 QSFP + 8 SFP cage count throughout', () => {
      expect(getBoardDescription('PRT-HC1-Q04X08', 'GigaVUE-HC1')).toBe('PRT-HC1-Q04X08 (4x 40G QSFP+ & 8x 10G SFP+)');
      expect(getBoardDescription('PRT-HC1-Q04X08', 'GigaVUE-HC1-Plus')).toBe('PRT-HC1-Q04X08 (4x 100G QSFP28 & 8x 25G SFP28)');
      expect(getBoardDescription('PRT-HC1-Q04X08', 'GigaVUE-HCT')).toBe('PRT-HC1-Q04X08 (4x 40G QSFP+ & 4x 25G SFP28 & 4x 10G SFP+)');
    });

    it('should not confuse the HCT-only PRT-HC1-G12 (RJ45+SFP copper module) with PRT-HC1-X12 (pure SFP+ module)', () => {
      expect(getBoardDescription('PRT-HC1-G12', 'GigaVUE-HCT')).toBe('PRT-HC1-G12 (6x RJ45 (10/100/1000M) & 6x SFP (100M/1G))');
      expect(getBoardDescription('PRT-HC1-x12', 'GigaVUE-HC1')).toBe('PRT-HC1-x12 (12x 10G/1G SFP+)');
    });

    it('should fix TAP-HC1-G10040 speed to 1000M-only on HC1-Plus/HCT, variable on plain HC1', () => {
      expect(getBoardDescription('TAP-HC1-G10040', 'GigaVUE-HC1')).toBe('TAP-HC1-G10040 (4x TAP/Bypass Pairs, 10/100/1000M Copper)');
      expect(getBoardDescription('TAP-HC1-G10040', 'GigaVUE-HC1-Plus')).toBe('TAP-HC1-G10040 (4x TAP/Bypass Pairs, 1000M Copper)');
      expect(getBoardDescription('TAP-HC1-G10040', 'GigaVUE-HCT')).toBe('TAP-HC1-G10040 (4x TAP/Bypass Pairs, 1000M Copper)');
    });
  });

  describe('getBoardSpeedSubCap', () => {
    it('caps 25G optics at 4 of the 8 SFP cages on PRT-HC1-Q04X08 when installed on a GigaVUE-HCT', () => {
      expect(getBoardSpeedSubCap('GigaVUE-HCT', 'PRT-HC1-Q04X08 (Slot 1)', '25G')).toBe(4);
    });

    it('does not cap 25G on PRT-HC1-Q04X08 for HC1-Plus, which supports 25G on all 8 SFP cages', () => {
      expect(getBoardSpeedSubCap('GigaVUE-HC1-Plus', 'PRT-HC1-Q04X08 (Slot 1)', '25G')).toBe(Infinity);
    });

    it('does not cap other speeds or other boards', () => {
      expect(getBoardSpeedSubCap('GigaVUE-HCT', 'PRT-HC1-Q04X08 (Slot 1)', '10G')).toBe(Infinity);
      expect(getBoardSpeedSubCap('GigaVUE-HCT', 'PRT-HC1-X12 (Slot 1)', '25G')).toBe(Infinity);
    });
  });

  describe('getRemainingCageCapacity', () => {
    it('returns full board capacity when no optics are installed', () => {
      const hwData = { optics: [], installedBoards: {} } as unknown as HardwareNodeData;
      expect(getRemainingCageCapacity('GigaVUE-HC1', hwData)).toEqual({ sfp: 12, qsfp: 0 });
    });

    it('subtracts installed optics from remaining SFP/QSFP capacity', () => {
      const hwData = {
        optics: [
          { board: 'main', optic: 'SFP-532 (10G SFP+ SR)', qty: 10 },
        ],
        installedBoards: {},
      } as unknown as HardwareNodeData;
      expect(getRemainingCageCapacity('GigaVUE-HC1', hwData)).toEqual({ sfp: 2, qsfp: 0 });
    });

    it('clamps at zero when optics exceed physical capacity', () => {
      const hwData = {
        optics: [
          { board: 'main', optic: 'SFP-532 (10G SFP+ SR)', qty: 20 },
        ],
        installedBoards: {},
      } as unknown as HardwareNodeData;
      expect(getRemainingCageCapacity('GigaVUE-HC1', hwData)).toEqual({ sfp: 0, qsfp: 0 });
    });

    it('returns zero capacity for TAP modules', () => {
      const hwData = { optics: [], installedBoards: {} } as unknown as HardwareNodeData;
      expect(getRemainingCageCapacity('TAP-A-TX2', hwData)).toEqual({ sfp: 0, qsfp: 0 });
    });
  });

  describe('getTapLinkCapacity', () => {
    it('should parse the correct number of links from a TAP SKU description', () => {
      const desc1 = "G-TAP M Series 1/10/25/40/100Gb 50/50 tap module, 830-940nm MM 50/125µm OM5, taps 6 links, LC, requires TAP-M100T or TAP-M200T chassis. TAA Compliant.";
      const desc2 = "G-TAP M Series 1/10/25/40/100Gb 50/50 tap module, 830-940nm MM 50/125µm OM5, taps 2 links, LC, requires TAP-M100T or TAP-M200T chassis. TAA Compliant.";
      const desc3 = "G-TAP M Series 40/100/400Gb 50/50 unidirectional tap module, 830-870nm MM 50/125µm OM5, taps 1 link, MPO, requires TAP-M202ULT chassis. TAA Compliant.";
      expect(getTapLinkCapacity(desc1)).toBe(6);
      expect(getTapLinkCapacity(desc2)).toBe(2);
      expect(getTapLinkCapacity(desc3)).toBe(1);
      expect(getTapLinkCapacity("Some description without the phrase")).toBe(1);
    });
  });

  describe('getOpticFiberType', () => {
    it('correctly identifies copper optics including shorthand codes and SFP-501/531', () => {
      expect(getOpticFiberType('1G-SFP-CU')).toBe('Copper');
      expect(getOpticFiberType('10G-SFP-CU6')).toBe('Copper');
      expect(getOpticFiberType('SFP-501')).toBe('Copper');
      expect(getOpticFiberType('SFP-501 (1G SFP Copper)')).toBe('Copper');
      expect(getOpticFiberType('SFP-501T')).toBe('Copper');
      expect(getOpticFiberType('SFP-531')).toBe('Copper');
      expect(getOpticFiberType('SFP-531T (10G SFP+ Copper)')).toBe('Copper');
    });

    it('correctly identifies MM and SM optics', () => {
      expect(getOpticFiberType('SFP-532 (10G SFP+ SR)')).toBe('MM');
      expect(getOpticFiberType('10G-SFP-SR')).toBe('MM');
      expect(getOpticFiberType('SFP-533 (10G SFP+ LR)')).toBe('SM');
      expect(getOpticFiberType('10G-SFP-LR')).toBe('SM');
    });
  });

  describe('getMaxChassisCapacityBySpeed', () => {
    it('returns [] for chassis with no module slots (TA-series)', () => {
      expect(getMaxChassisCapacityBySpeed('GigaVUE-TA25')).toEqual([]);
    });

    it('GigaVUE-HC3 tops out at 64x 100G ports (4x PRT-HC3-C16), matching the datasheet max', () => {
      const entry = getMaxChassisCapacityBySpeed('GigaVUE-HC3').find(e => e.speed === '100G');
      expect(entry?.maxPorts).toBe(64);
      expect(entry?.config).toBe('4x PRT-HC3-C16');
    });

    it("GigaVUE-HCT's PRT-HC1-Q04X08 only offers 40G optics per the matrix, so 100G max comes from the built-in cages only", () => {
      // Contrast with HC1/HC1-Plus below, where the same board SKU does offer 100G.
      const entry = getMaxChassisCapacityBySpeed('GigaVUE-HCT').find(e => e.speed === '100G');
      expect(entry?.maxPorts).toBe(2);
      expect(entry?.config).toBe('built-in ports');
    });

    it('GigaVUE-HC1 offers 100G only via PRT-HC1-Q04X08 (2 slots x 4 cages = 8) - its base ports are QSFP+ (40G only), no built-in 100G', () => {
      const entry = getMaxChassisCapacityBySpeed('GigaVUE-HC1').find(e => e.speed === '100G');
      expect(entry?.maxPorts).toBe(8);
    });

    it('GigaVUE-HC1-Plus adds its 4 built-in QSFP28 base cages on top of the module (4 + 2x4 = 12), matching the datasheet', () => {
      const entry = getMaxChassisCapacityBySpeed('GigaVUE-HC1-Plus').find(e => e.speed === '100G');
      expect(entry?.maxPorts).toBe(12);
      expect(entry?.config).toBe('2x PRT-HC1-Q04X08 + built-in ports');
    });

    // Every number below is cross-checked against the official GigaVUE HC-series
    // "Chassis Maximum Capabilities" datasheet table, including its "*" rows -
    // those are footnoted there as "maximum density requires using port breakout,
    // such as G-TAP PNL-M341", which is exactly what viaBreakout models: feeding a
    // QSFP-family cage's 40G/100G parent optic through an MPO breakout panel for
    // 4x the lower-speed (10G/25G) lane count.
    describe('breakout-aware capacity (10G/25G via MPO breakout panel)', () => {
      it('GigaVUE-HC1-Plus 25G/10G both reach 72 - 8 native SFP28 + all 12 QSFP28 cages (4 base + 2x4 module) broken out x4', () => {
        const capacity = getMaxChassisCapacityBySpeed('GigaVUE-HC1-Plus');
        const g25 = capacity.find(e => e.speed === '25G');
        const g10 = capacity.find(e => e.speed === '10G');
        expect(g25).toMatchObject({ maxPorts: 72, viaBreakout: true });
        expect(g10).toMatchObject({ maxPorts: 72, viaBreakout: true });
      });

      it('GigaVUE-HC3 25G/10G both reach 128 - the datasheet-documented fanout cap (getMaxFanoutSfpPorts), below the raw 4x64=256 arithmetic', () => {
        const capacity = getMaxChassisCapacityBySpeed('GigaVUE-HC3');
        const g25 = capacity.find(e => e.speed === '25G');
        const g10 = capacity.find(e => e.speed === '10G');
        expect(g25).toMatchObject({ maxPorts: 128, viaBreakout: true });
        expect(g10).toMatchObject({ maxPorts: 128, viaBreakout: true });
      });

      it('GigaVUE-HC3 40G reaches 64 via 4x PRT-HC3-C16 (16 dual-speed 40G/100G QSFP28 cages/slot), not just the 8-cage 40G-only boards', () => {
        const entry = getMaxChassisCapacityBySpeed('GigaVUE-HC3').find(e => e.speed === '40G');
        expect(entry).toMatchObject({ maxPorts: 64, viaBreakout: false, config: '4x PRT-HC3-C16' });
      });

      it('GigaVUE-HCT 25G/10G reach 12/32 via its single slot\'s QSFP28 breakout, with no native 25G cage on the chassis at all', () => {
        const capacity = getMaxChassisCapacityBySpeed('GigaVUE-HCT');
        expect(capacity.find(e => e.speed === '25G')).toMatchObject({ maxPorts: 12, viaBreakout: true });
        expect(capacity.find(e => e.speed === '10G')).toMatchObject({ maxPorts: 32, viaBreakout: true });
      });

      it('speeds with no breakout path (40G, 100G, 1G) are never marked viaBreakout', () => {
        for (const model of ['GigaVUE-HCT', 'GigaVUE-HC1', 'GigaVUE-HC1-Plus', 'GigaVUE-HC3']) {
          for (const entry of getMaxChassisCapacityBySpeed(model)) {
            if (entry.speed === '10G' || entry.speed === '25G') continue;
            expect(entry.viaBreakout).toBeFalsy();
          }
        }
      });
    });
  });

  describe('getGigaSmartEngineCount', () => {
    const baseHwData = (installedBoards: Record<number, string>) =>
      ({ label: '', configType: 'Hardware', model: '', optics: [], installedBoards } as unknown as HardwareNodeData);

    it('HC1 and HC1-Plus have one onboard engine with no boards installed', () => {
      expect(getGigaSmartEngineCount('GigaVUE-HC1', baseHwData({}))).toBe(1);
      expect(getGigaSmartEngineCount('GigaVUE-HC1-Plus', baseHwData({}))).toBe(1);
    });

    it('HCT and HC3 have no onboard engine with no boards installed', () => {
      expect(getGigaSmartEngineCount('GigaVUE-HCT', baseHwData({}))).toBe(0);
      expect(getGigaSmartEngineCount('GigaVUE-HC3', baseHwData({}))).toBe(0);
    });

    it('counts installed SMT- boards on top of any onboard engine', () => {
      expect(getGigaSmartEngineCount('GigaVUE-HC1', baseHwData({ 1: 'SMT-HC1-S' }))).toBe(2);
      expect(getGigaSmartEngineCount('GigaVUE-HCT', baseHwData({ 1: 'SMT-HC1-S' }))).toBe(1);
      expect(
        getGigaSmartEngineCount('GigaVUE-HC3', baseHwData({ 1: 'SMT-HC3-C05', 2: 'SMT-HC3-C08', 3: 'PRT-HC3-C16', 4: '' }))
      ).toBe(2);
    });

    it('ignores non-SMT boards', () => {
      expect(getGigaSmartEngineCount('GigaVUE-HC3', baseHwData({ 1: 'PRT-HC3-C16', 2: 'PRT-HC3-X24' }))).toBe(0);
    });
  });

  describe('getDeviceRU', () => {
    it('returns 1 RU for TAP-M200T', () => {
      expect(getDeviceRU('TAP-M200T')).toBe(1);
      expect(getDeviceRU('TAP-M200T', 'TAP-M200T')).toBe(1);
    });

    it('returns 0.5 RU for TAP-M100T', () => {
      expect(getDeviceRU('TAP-M100T')).toBe(0.5);
      expect(getDeviceRU('TAP-M100T', 'TAP-M100T')).toBe(0.5);
    });

    it('returns correct RU for chassis models', () => {
      expect(getDeviceRU('GigaVUE-HC3')).toBe(3);
      expect(getDeviceRU('GigaVUE-HC2')).toBe(2);
      expect(getDeviceRU('GigaVUE-HC1')).toBe(1);
      expect(getDeviceRU('GigaVUE-HC1-Plus')).toBe(1);
      expect(getDeviceRU('GigaVUE-HCT')).toBe(1);
      expect(getDeviceRU('GigaVUE-TA200')).toBe(1);
    });
  });
});
