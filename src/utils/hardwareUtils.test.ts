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
      ['PRT-HC3-X24', { 'SFP+': 24 }],
      ['SMT-HC3-c08q08', { 'QSFP28': 8, 'QSFP+': 8 }],
      ['PRT-HC3-C08Q08', { 'QSFP28': 8, 'QSFP+': 8 }],
      ['SMT-HC3-c16', { 'QSFP28': 16 }],
      ['PRT-HC3-C16', { 'QSFP28': 16 }],
      ['SMT-HC3-c08', { 'QSFP28': 8 }],
      ['BPS-HC3-C25F2G', { 'QSFP28': 4, 'SFP+': 16 }],
      ['BPS-HC3-Q35C2G', { 'QSFP+': 4, 'SFP+': 16 }],
      ['BPS-HC3-C35C2G', { 'QSFP28': 4, 'SFP+': 16 }],
    ])('%s returns %j', (boardSku, expected) => {
      expect(getBoardPortCapacity(boardSku)).toEqual(expected);
    });
  });

  describe('getChassisBasePortCapacity', () => {
    it('should return correct base capacities for chassis models', () => {
      expect(getChassisBasePortCapacity('GigaVUE-TA25E')).toEqual({ 'SFP28': 48, 'QSFP28': 8 });
      expect(getChassisBasePortCapacity('GigaVUE-HC1')).toEqual({ 'RJ45': 4, 'SFP+': 12 });
      expect(getChassisBasePortCapacity('GigaVUE-HC1-Plus')).toEqual({ 'SFP+': 8, 'QSFP+': 4 });
      expect(getChassisBasePortCapacity('GigaVUE-HC3')).toEqual({});
      expect(getChassisBasePortCapacity('GigaVUE-HCT')).toEqual({});
    });
  });

  describe('getCageCapacityBreakdown — every HC module installed alone', () => {
    // Base physical SFP/QSFP cage totals per chassis with zero boards installed,
    // derived straight from getChassisBasePortCapacity (RJ45 built-in ports never
    // count toward either cage bucket).
    const baseCages: Record<string, { sfp: number; qsfp: number }> = {
      'GigaVUE-HCT': { sfp: 0, qsfp: 0 },
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
      // base (SFP+:8, QSFP+:4) + PRT-HC1-x12 (SFP+:12) + BPS-HC1-D35C60 (SFP+:12)
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

  describe('getCageCapacityBreakdown — fully populated + fully broken out vs. datasheet 10Gb/25Gb max', () => {
    // Same p.7 table's 10Gb/25Gb rows (marked with '*', "Maximum density requires
    // using port breakout, such as G-TAP PNL-M341"). Fanout capability confirmed
    // real per GigaVUE-OS-Compatibility-and-Interoperability-Matrix.xlsx's "Fanout
    // Matrix" sheet (PRT-HC1-Q04X08 4x10G v5.11+; HC1-Plus boards 4x10G/4x25G
    // v6.0+; PRT-HC3-C16 4x10G/4x25G v5.4+ on CCv2).
    const breakoutOptic = (qty: number) => ({ board: 'main', optic: 'PNL-M341 (40/100G Multimode Breakout Panel)', qty });

    it('HC1 fully populated + every QSFP cage broken out matches the datasheet 10Gb max of 60', () => {
      const breakdown = getCageCapacityBreakdown('GigaVUE-HC1', {
        label: 'Test', configType: 'Hardware', model: 'GigaVUE-HC1',
        optics: [breakoutOptic(8)], // all 8 QSFP28 cages (2x PRT-HC1-Q04X08) broken out
        installedBoards: { '1': 'PRT-HC1-Q04X08', '2': 'PRT-HC1-Q04X08' },
      } as unknown as HardwareNodeData);
      // 12 built-in SFP+ + 16 SFP28 (boards) + 32 from breaking out 8 QSFP28 cages = 60
      expect(breakdown.totalExpandedSfpPorts).toBe(60);
      expect(breakdown.remainingSfpCages).toBe(60);
    });

    it('HC1-Plus fully populated + every QSFP cage broken out matches the datasheet 10Gb/25Gb max of 72', () => {
      const breakdown = getCageCapacityBreakdown('GigaVUE-HC1-Plus', {
        label: 'Test', configType: 'Hardware', model: 'GigaVUE-HC1-Plus',
        optics: [breakoutOptic(12)], // all 12 QSFP28 cages (4 built-in + 2x PRT-HC1-Q04X08) broken out
        installedBoards: { '1': 'PRT-HC1-Q04X08', '2': 'PRT-HC1-Q04X08' },
      } as unknown as HardwareNodeData);
      // 8 built-in SFP28 + 16 SFP28 (boards) + 48 from breaking out 12 QSFP28 cages = 72
      expect(breakdown.totalExpandedSfpPorts).toBe(72);
      expect(breakdown.remainingSfpCages).toBe(72);
    });

    it('HC3 fully populated + every QSFP cage broken out is capped at the datasheet-documented 128, not the raw 256', () => {
      const breakdown = getCageCapacityBreakdown('GigaVUE-HC3', {
        label: 'Test', configType: 'Hardware', model: 'GigaVUE-HC3',
        optics: [breakoutOptic(64)], // all 64 QSFP28 cages (4x PRT-HC3-C16) broken out
        installedBoards: { '1': 'PRT-HC3-C16', '2': 'PRT-HC3-C16', '3': 'PRT-HC3-C16', '4': 'PRT-HC3-C16' },
      } as unknown as HardwareNodeData);
      // Raw arithmetic would give 0 base + 64 cages x 4 = 256; the datasheet caps
      // the real chassis at 128, so getMaxFanoutSfpPorts enforces that ceiling.
      expect(breakdown.breakoutSfpExpansion).toBe(256);
      expect(breakdown.totalExpandedSfpPorts).toBe(128);
      expect(breakdown.remainingSfpCages).toBe(128);
    });
  });

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
});
