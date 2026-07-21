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
} from './hardwareUtils';
import type { HardwareNodeData } from '../store/types';

describe('hardwareUtils', () => {
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
      
      expect(getBoardPortCapacity('SMT-HC1-q04x08')).toEqual({ 'SFP+': 8, 'QSFP+': 4 });
    });
  });

  describe('getChassisBasePortCapacity', () => {
    it('should return correct base capacities for chassis models', () => {
      expect(getChassisBasePortCapacity('GigaVUE-TA25E')).toEqual({ 'SFP28': 48, 'QSFP28': 8 });
      expect(getChassisBasePortCapacity('GigaVUE-HC1')).toEqual({ 'RJ45': 4, 'SFP+': 12 });
      expect(getChassisBasePortCapacity('GigaVUE-HC1-Plus')).toEqual({ 'SFP+': 8, 'QSFP+': 4 });
      expect(getChassisBasePortCapacity('GigaVUE-HC3')).toEqual({});
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
