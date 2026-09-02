import { describe, it, expect } from 'vitest';
import hardwareCatalogue from '../constants/hardwareCatalogue.json';
import {
  getCageCapacityBreakdown,
  getChassisBasePortCapacity,
  getBoardPortCapacity,
  findModuleBySku,
  getTrayBayCount,
  isBreakoutPanelModel,
  getTaLicenseLimits,
  getRemainingCageCapacity,
} from './hardwareUtils';
import { getChassisPorts } from './ports';
import { getSupportedBoards } from './opticValidation';
import type { HardwareNodeData } from '../store/types';

describe('Hardware Matrix & Cage Capacity Comprehensive Audit', () => {
  describe('1. Standalone Base Chassis Verification', () => {
    const expectedBase: Record<string, { sfp: number; qsfp: number; rj45: number }> = {
      'GigaVUE-TA25E': { sfp: 48, qsfp: 8, rj45: 0 },
      'GigaVUE-TA200': { sfp: 0, qsfp: 64, rj45: 0 },
      'GigaVUE-TA200E': { sfp: 0, qsfp: 64, rj45: 0 },
      'GigaVUE-TA400': { sfp: 0, qsfp: 32, rj45: 0 },
      'GigaVUE-TA400E': { sfp: 2, qsfp: 32, rj45: 0 },
      'GigaVUE-HC1': { sfp: 12, qsfp: 0, rj45: 4 },
      'GigaVUE-HC1-Plus': { sfp: 8, qsfp: 4, rj45: 0 },
      'GigaVUE-HC3': { sfp: 0, qsfp: 0, rj45: 0 },
      'GigaVUE-HCT': { sfp: 0, qsfp: 2, rj45: 0 },
    };

    it.each(Object.entries(expectedBase))(
      '%s has exact expected base cages across getCageCapacityBreakdown and getChassisPorts',
      (model, expected) => {
        const hwData = { model, label: model, configType: 'Hardware', optics: [], installedBoards: {} } as unknown as HardwareNodeData;
        const breakdown = getCageCapacityBreakdown(model, hwData);
        const ports = getChassisPorts(model, hwData);

        const sfpPorts = ports.filter((p) => p.cage === 'SFP').length;
        const qsfpPorts = ports.filter((p) => p.cage === 'QSFP').length;
        const rj45Ports = ports.filter((p) => p.cage === 'RJ45').length;

        expect(breakdown.totalSfpCages).toBe(expected.sfp);
        expect(breakdown.totalQsfpCages).toBe(expected.qsfp);
        expect(sfpPorts).toBe(expected.sfp);
        expect(qsfpPorts).toBe(expected.qsfp);
        expect(rj45Ports).toBe(expected.rj45);
      }
    );

    it('works identically with normalized model names lacking GigaVUE- prefix', () => {
      const normalizedMap: Record<string, string> = {
        'TA25E': 'GigaVUE-TA25E',
        'TA200': 'GigaVUE-TA200',
        'TA200E': 'GigaVUE-TA200E',
        'TA400': 'GigaVUE-TA400',
        'TA400E': 'GigaVUE-TA400E',
        'HC1': 'GigaVUE-HC1',
        'HC1-Plus': 'GigaVUE-HC1-Plus',
        'HC3': 'GigaVUE-HC3',
        'HCT': 'GigaVUE-HCT',
      };

      for (const [shortName, fullName] of Object.entries(normalizedMap)) {
        const expected = expectedBase[fullName];
        const hwData = { model: shortName, label: shortName, configType: 'Hardware', optics: [], installedBoards: {} } as unknown as HardwareNodeData;
        const breakdown = getCageCapacityBreakdown(shortName, hwData);
        const ports = getChassisPorts(shortName, hwData);

        expect(breakdown.totalSfpCages).toBe(expected.sfp);
        expect(breakdown.totalQsfpCages).toBe(expected.qsfp);
        expect(ports.filter((p) => p.cage === 'SFP')).toHaveLength(expected.sfp);
        expect(ports.filter((p) => p.cage === 'QSFP')).toHaveLength(expected.qsfp);
      }
    });
  });

  describe('2. Standalone Module / Extension Card Port Capacity', () => {
    const expectedModules: Record<string, { sfp: number; qsfp: number; rj45: number }> = {
      'SMT-HC3-C05': { sfp: 0, qsfp: 5, rj45: 0 },
      'PRT-HC1-Q04X08': { sfp: 8, qsfp: 4, rj45: 0 },
      'BPS-HC1-D25A24': { sfp: 8, qsfp: 0, rj45: 0 },
      'BPS-HC1-D25A60': { sfp: 12, qsfp: 0, rj45: 0 },
      'BPS-HC1-D35C60': { sfp: 12, qsfp: 0, rj45: 0 },
      'PRT-HC1-X12': { sfp: 12, qsfp: 0, rj45: 0 },
      'PRT-HC1-G12': { sfp: 6, qsfp: 0, rj45: 6 },
      'SMT-HC1-S': { sfp: 0, qsfp: 0, rj45: 0 },
      'TAP-HC1-G10040': { sfp: 0, qsfp: 0, rj45: 8 },
      'PRT-HC3-X24': { sfp: 24, qsfp: 0, rj45: 0 },
      'SMT-HC3-C08Q08': { sfp: 0, qsfp: 16, rj45: 0 },
      'PRT-HC3-C08Q08': { sfp: 0, qsfp: 16, rj45: 0 },
      'SMT-HC3-C16': { sfp: 0, qsfp: 16, rj45: 0 },
      'PRT-HC3-C16': { sfp: 0, qsfp: 16, rj45: 0 },
      'SMT-HC3-C08': { sfp: 0, qsfp: 8, rj45: 0 },
      'BPS-HC3-C25F2G': { sfp: 16, qsfp: 4, rj45: 0 },
      'BPS-HC3-Q35C2G': { sfp: 16, qsfp: 4, rj45: 0 },
      'BPS-HC3-C35C2G': { sfp: 16, qsfp: 4, rj45: 0 },
    };

    it.each(Object.entries(expectedModules))(
      'Module %s resolves exact cage counts',
      (sku, expected) => {
        const boardCaps = getBoardPortCapacity(sku);
        let sfp = 0;
        let qsfp = 0;
        let rj45 = 0;
        for (const [type, count] of Object.entries(boardCaps)) {
          if (type.toUpperCase().includes('QSFP')) qsfp += count;
          else if (type.toUpperCase().includes('SFP')) sfp += count;
          else if (type.toUpperCase().includes('RJ45')) rj45 += count;
        }

        expect(sfp).toBe(expected.sfp);
        expect(qsfp).toBe(expected.qsfp);
        expect(rj45).toBe(expected.rj45);
      }
    );

    it('resolves module SKU with (Slot N), (Main Board), (Base Ports) suffixes and mixed casing', () => {
      const variations = [
        'PRT-HC1-Q04X08 (Slot 1)',
        'prt-hc1-q04x08 (Slot 2)',
        'PRT-HC1-X12 (Slot 2)',
        'prt-hc1-x12',
        'SMT-HC3-C16 (Slot 3)',
        'smt-hc3-c16',
        'SMT-HC3-C08 (Slot 4)',
        'BPS-HC3-C25F2G (Slot 1)',
      ];

      for (const variant of variations) {
        const mod = findModuleBySku(variant);
        expect(mod, `Failed to resolve module variant: ${variant}`).toBeDefined();
        const caps = getBoardPortCapacity(variant);
        expect(Object.keys(caps).length).toBeGreaterThan(0);
      }
    });
  });

  describe('3. All Chassis + Module Combinations Across Every Slot', () => {
    for (const chassis of hardwareCatalogue.hc_series) {
      const model = chassis.model;
      const slots = chassis.module_slots || 0;
      const supported = getSupportedBoards(model);
      const installable = supported.filter(
        (b) => !b.board.toLowerCase().includes('main') && !b.board.toLowerCase().includes('base')
      );

      describe(`Chassis: ${model} (${slots} slots)`, () => {
        for (const board of installable) {
          const boardName = board.board;
          it(`correctly computes cages for single module ${boardName}`, () => {
            const slotIdx = model.includes('HC1') ? '2' : '1';
            const hwData = {
              model,
              label: model,
              configType: 'Hardware',
              installedBoards: { [slotIdx]: boardName },
              optics: [],
            } as unknown as HardwareNodeData;

            const breakdown = getCageCapacityBreakdown(model, hwData);
            const ports = getChassisPorts(model, hwData);

            const sfpPorts = ports.filter((p) => p.cage === 'SFP').length;
            const qsfpPorts = ports.filter((p) => p.cage === 'QSFP').length;

            const baseCaps = getChassisBasePortCapacity(model);
            const modCaps = getBoardPortCapacity(boardName);

            let expectedSfp = 0;
            let expectedQsfp = 0;
            for (const [t, c] of Object.entries(baseCaps)) {
              if (t.toUpperCase().includes('QSFP')) expectedQsfp += c;
              else if (t.toUpperCase().includes('SFP')) expectedSfp += c;
            }
            for (const [t, c] of Object.entries(modCaps)) {
              if (t.toUpperCase().includes('QSFP')) expectedQsfp += c;
              else if (t.toUpperCase().includes('SFP')) expectedSfp += c;
            }

            expect(breakdown.totalSfpCages).toBe(expectedSfp);
            expect(breakdown.totalQsfpCages).toBe(expectedQsfp);
            expect(sfpPorts).toBe(expectedSfp);
            expect(qsfpPorts).toBe(expectedQsfp);
          });
        }
      });
    }

    it('handles multiple modules simultaneously across all slots on HC1, HC1-Plus, and HC3', () => {
      // HC1 fully populated (Slot 2 + Slot 3)
      const hc1Data = {
        model: 'GigaVUE-HC1',
        installedBoards: { '2': 'PRT-HC1-Q04X08', '3': 'PRT-HC1-X12' },
        optics: [],
      } as unknown as HardwareNodeData;
      const hc1Breakdown = getCageCapacityBreakdown('GigaVUE-HC1', hc1Data);
      expect(hc1Breakdown.totalSfpCages).toBe(12 + 8 + 12); // 32 SFP
      expect(hc1Breakdown.totalQsfpCages).toBe(0 + 4 + 0);  // 4 QSFP

      // HC1-Plus fully populated (Slot 2 + Slot 3) with TWO Q04X08 port cards
      const hc1pData = {
        model: 'GigaVUE-HC1-Plus',
        installedBoards: { '2': 'PRT-HC1-Q04X08', '3': 'PRT-HC1-Q04X08' },
        optics: [],
      } as unknown as HardwareNodeData;
      const hc1pBreakdown = getCageCapacityBreakdown('GigaVUE-HC1-Plus', hc1pData);
      expect(hc1pBreakdown.totalSfpCages).toBe(8 + 8 + 8);   // 24 SFP
      expect(hc1pBreakdown.totalQsfpCages).toBe(4 + 4 + 4);  // 12 QSFP

      // HC3 fully populated (Slots 1, 2, 3, 4)
      const hc3Data = {
        model: 'GigaVUE-HC3',
        installedBoards: {
          '1': 'PRT-HC3-C16',
          '2': 'SMT-HC3-C16',
          '3': 'PRT-HC3-C08Q08',
          '4': 'PRT-HC3-X24',
        },
        optics: [],
      } as unknown as HardwareNodeData;
      const hc3Breakdown = getCageCapacityBreakdown('GigaVUE-HC3', hc3Data);
      expect(hc3Breakdown.totalSfpCages).toBe(24);
      expect(hc3Breakdown.totalQsfpCages).toBe(16 + 16 + 16); // 48 QSFP
    });
  });

  describe('4. TA Series Licensing Tier Verification', () => {
    it('verifies TA25E licensing tiers', () => {
      const tiers = [
        { name: 'Quarter', sfp: 12, qsfp: 2 },
        { name: 'Half', sfp: 24, qsfp: 4 },
        { name: 'Full', sfp: 48, qsfp: 8 },
      ];

      for (const tier of tiers) {
        const hwData = { model: 'GigaVUE-TA25E', portCapacity: tier.name } as unknown as HardwareNodeData;
        const breakdown = getCageCapacityBreakdown('GigaVUE-TA25E', hwData);
        const ports = getChassisPorts('GigaVUE-TA25E', hwData);

        expect(breakdown.licensedSfpCages).toBe(tier.sfp);
        expect(breakdown.licensedQsfpCages).toBe(tier.qsfp);
        expect(ports.filter((p) => p.licensed && p.cage === 'SFP')).toHaveLength(tier.sfp);
        expect(ports.filter((p) => p.licensed && p.cage === 'QSFP')).toHaveLength(tier.qsfp);
      }
    });

    it('verifies TA200 and TA200E licensing tiers', () => {
      for (const model of ['GigaVUE-TA200', 'GigaVUE-TA200E', 'TA200', 'TA200E']) {
        const halfData = { model, portCapacity: 'Half' } as unknown as HardwareNodeData;
        const halfBreakdown = getCageCapacityBreakdown(model, halfData);
        expect(halfBreakdown.licensedQsfpCages).toBe(32);
        expect(halfBreakdown.licensedSfpCages).toBe(0);

        const fullData = { model, portCapacity: 'Full' } as unknown as HardwareNodeData;
        const fullBreakdown = getCageCapacityBreakdown(model, fullData);
        expect(fullBreakdown.licensedQsfpCages).toBe(64);
        expect(fullBreakdown.licensedSfpCages).toBe(0);
      }
    });

    it('verifies TA400E licensing tiers including 400G sub-limits', () => {
      const limits100G = getTaLicenseLimits('GigaVUE-TA400E', '100G');
      expect(limits100G['SFP+']).toBe(2);
      expect(limits100G['QSFP28']).toBe(32);
      expect(limits100G.qsfp_400g).toBe(0);

      const limitsUpgrade = getTaLicenseLimits('GigaVUE-TA400E', 'Upgrade');
      expect(limitsUpgrade['SFP+']).toBe(2);
      expect(limitsUpgrade['QSFP28']).toBe(32);
      expect(limitsUpgrade.qsfp_400g).toBe(16);

      const limitsFull = getTaLicenseLimits('GigaVUE-TA400E', 'Full');
      expect(limitsFull['SFP+']).toBe(2);
      expect(limitsFull['QSFP28']).toBe(32);
      expect(limitsFull.qsfp_400g).toBe(32);
    });
  });

  describe('5. Breakout Panels & TAP Trays', () => {
    it.each(['PNL-M341T', 'PNL-M343T'])('verifies %s has exactly 3 MPO connectors and 12 LC duplex connectors', (model) => {
      expect(isBreakoutPanelModel(model)).toBe(true);
      const ports = getChassisPorts(model, { model } as unknown as HardwareNodeData);
      expect(ports).toHaveLength(15);

      const mpo = ports.filter((p) => p.cage === 'MPO');
      const lc = ports.filter((p) => p.cage === 'SFP');
      expect(mpo).toHaveLength(3);
      expect(lc).toHaveLength(12);

      expect(mpo[0].id).toBe('1/1/m1');
      expect(mpo[2].id).toBe('1/1/m3');
      expect(lc[0].id).toBe('1/1/m1/1');
      expect(lc[11].id).toBe('1/1/m3/4');
    });

    it('verifies TAP tray bay capacities', () => {
      expect(getTrayBayCount('TAP-M100T')).toBe(3);
      expect(getTrayBayCount('TAP-M200T')).toBe(6);
      expect(getTrayBayCount('TAP-M202ULT')).toBe(2);
    });

    it('returns zero cage capacity for TAP devices and breakout panels so they never inflate chassis counts', () => {
      expect(getRemainingCageCapacity('TAP-M251T', {} as any)).toEqual({ sfp: 0, qsfp: 0 });
      expect(getRemainingCageCapacity('TAP-M253T', {} as any)).toEqual({ sfp: 0, qsfp: 0 });
      expect(getRemainingCageCapacity('TAP-M100T', {} as any)).toEqual({ sfp: 0, qsfp: 0 });
      expect(getRemainingCageCapacity('TAP-M200T', {} as any)).toEqual({ sfp: 0, qsfp: 0 });
    });
  });
});
