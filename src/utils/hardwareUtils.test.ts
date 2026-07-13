import { describe, it, expect } from 'vitest';
import {
  getOpticSpeed,
  getOpticSpeedMbps,
  getBoardPortCapacity,
  getChassisBasePortCapacity,
  getOpticFiberType,
  formatOpticLabel,
  getBoardDescription,
} from './hardwareUtils';

describe('hardwareUtils', () => {
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
    it('should return correct port capacity for boards and chassis combinations', () => {
      // TA25
      expect(getBoardPortCapacity('', 'GigaVUE-TA25', false)).toEqual({ sfp: 48, qsfp: 8 });
      // TA200
      expect(getBoardPortCapacity('', 'GigaVUE-TA200', false)).toEqual({ sfp: 0, qsfp: 64 });
      // HC1 Main board (not Plus)
      expect(getBoardPortCapacity('main', 'GigaVUE-HC1', false)).toEqual({ sfp: 12, qsfp: 0 });
      // HC1 Plus Main Board
      expect(getBoardPortCapacity('main', 'GigaVUE-HC1-Plus', true)).toEqual({ sfp: 8, qsfp: 4 });
      // HCT Board
      expect(getBoardPortCapacity('hct-c02', 'GigaVUE-HCT', false)).toEqual({ sfp: 4, qsfp: 2 });
    });
  });

  describe('getChassisBasePortCapacity', () => {
    it('should return correct base capacities for chassis models', () => {
      expect(getChassisBasePortCapacity('GigaVUE-TA25')).toEqual({ sfp: 48, qsfp: 8 });
      expect(getChassisBasePortCapacity('GigaVUE-HC1')).toEqual({ sfp: 12, qsfp: 0 });
      expect(getChassisBasePortCapacity('GigaVUE-HC1-Plus')).toEqual({ sfp: 8, qsfp: 4 });
      expect(getChassisBasePortCapacity('GigaVUE-HC3')).toEqual({ sfp: 0, qsfp: 0 });
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
});
