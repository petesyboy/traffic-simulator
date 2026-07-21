import { describe, it, expect } from 'vitest';
import { getSupportedBoards, validateOptic } from './opticValidation';

describe('opticValidation', () => {
  it('should return supported boards and optics for GigaVUE-TA25', () => {
    const supports = getSupportedBoards('GigaVUE-TA25');
    expect(supports.length).toBeGreaterThan(0);
    // Base Ports board is expected to exist
    const basePorts = supports.find(b => b.board === 'Base Ports');
    expect(basePorts).toBeDefined();
    // 100G TAA optic should be supported on TA25
    expect(basePorts?.supportedOptics).toContain('Q28-502T (100G QSFP28 SR4)');
  });

  it('should validate supported and unsupported optics', () => {
    // Valid optic on GigaVUE-TA25 Base Ports
    const validResult = validateOptic('GigaVUE-TA25', 'Base Ports', 'Q28-502T (100G QSFP28 SR4)', 'Full', []);
    expect(validResult.valid).toBe(true);

    // Invalid optic on GigaVUE-TA25 Base Ports
    const supportedResult = validateOptic('GigaVUE-TA25', 'Base Ports', 'SFP-501 (1G SFP Copper)', 'Full', []);
    expect(supportedResult.valid).toBe(true);
    // SFP-501 is supported on TA25! Let's check a completely unsupported optic speed/type, e.g. QDD-503 (400G QSFP-DD LR4)
    const completelyInvalidResult = validateOptic('GigaVUE-TA25', 'Base Ports', 'QDD-503 (400G QSFP-DD LR4)', 'Full', []);
    expect(completelyInvalidResult.valid).toBe(false);
    expect(completelyInvalidResult.message).toContain('is NOT supported on Base Ports');
  });

  it('should restrict 400G optics on GigaVUE-TA400 when capacity is 100G', () => {
    // Full capacity (should support 400G)
    const supportsFull = getSupportedBoards('GigaVUE-TA400', 'Full');
    const basePortsFull = supportsFull.find(b => b.board === 'Base Ports');
    expect(basePortsFull?.supportedOptics).toContain('QDD-503 (400G QSFP-DD LR4)');

    // 100G capacity (should NOT support 400G)
    const supports100G = getSupportedBoards('GigaVUE-TA400', '100G');
    const basePorts100G = supports100G.find(b => b.board === 'Base Ports');
    expect(basePorts100G?.supportedOptics).not.toContain('QDD-503 (400G QSFP-DD LR4)');
  });

  it('should append breakout optics if breakout panel is installed', () => {
    // Without breakout panel (TA200 doesn't natively support SFP-532 10G)
    const supportsNormal = getSupportedBoards('GigaVUE-TA200', 'Full', []);
    const basePortsNormal = supportsNormal.find(b => b.board === 'Base Ports');
    expect(basePortsNormal?.supportedOptics).not.toContain('SFP-532 (10G SFP+ SR)');

    // With breakout panel
    const supportsBreakout = getSupportedBoards('GigaVUE-TA200', 'Full', [{ optic: 'PNL-M341 (40/100G Multimode Breakout Panel)' }]);
    const basePortsBreakout = supportsBreakout.find(b => b.board === 'Base Ports');
    expect(basePortsBreakout?.supportedOptics).toContain('SFP-532 (10G SFP+ SR)');
  });

  // Regression tests locking in corrections made against the official
  // GigaVUE-OS Compatibility and Interoperability Matrix
  // (references/GigaVUE-OS-Compatibility-and-Interoperability-Matrix.xlsx,
  // "Transceiver Support for Modules" sheet).
  describe('compatibility matrix corrections', () => {
    const boardOptics = (chassis: string, board: string) =>
      getSupportedBoards(chassis).find(b => b.board === board)?.supportedOptics ?? [];

    it('TA400E now offers SFP+ optics for its 2 physical management ports (previously missing entirely)', () => {
      const optics = boardOptics('GigaVUE-TA400E', 'Base Ports');
      for (const sku of ['SFP-531', 'SFP-531T', 'SFP-532', 'SFP-532T', 'SFP-533', 'SFP-533T', 'SFP-534', 'SFP-534T']) {
        expect(optics.some(o => o.startsWith(sku + ' '))).toBe(true);
      }
    });

    it('bare (non-TAA) Q28-504 is removed everywhere the matrix does not confirm support', () => {
      for (const chassis of ['GigaVUE-TA25', 'GigaVUE-TA25E', 'GigaVUE-TA200', 'GigaVUE-TA200E', 'GigaVUE-TA400', 'GigaVUE-TA400E']) {
        const optics = boardOptics(chassis, 'Base Ports');
        expect(optics.some(o => o.startsWith('Q28-504 '))).toBe(false);
        expect(optics.some(o => o.startsWith('Q28-504T'))).toBe(true);
      }
    });

    it('SFP-505T (100M FX) is removed from boards the matrix does not list it on', () => {
      expect(boardOptics('GigaVUE-TA25', 'Base Ports').some(o => o.startsWith('SFP-505T'))).toBe(false);
      expect(boardOptics('GigaVUE-TA25E', 'Base Ports').some(o => o.startsWith('SFP-505T'))).toBe(false);
      expect(boardOptics('GigaVUE-HC1', 'PRT-HC1-Q04X08').some(o => o.startsWith('SFP-505T'))).toBe(false);
      expect(boardOptics('GigaVUE-HCT', 'PRT-HC1-Q04X08').some(o => o.startsWith('SFP-505T'))).toBe(false);
    });

    it("HCT's PRT-HC1-Q04X08 only offers TAA (T-suffix) optics, matching the matrix's qualification for this compact platform", () => {
      const optics = boardOptics('GigaVUE-HCT', 'PRT-HC1-Q04X08');
      for (const sku of ['SFP-501', 'SFP-502', 'SFP-503', 'QSF-504', 'QSF-506', 'QSF-507']) {
        expect(optics.some(o => o.startsWith(sku + ' '))).toBe(false);
      }
      for (const sku of ['SFP-531T', 'SFP-532T', 'SFP-533T', 'SFP-534T', 'SFP-552T', 'SFP-553T']) {
        expect(optics.some(o => o.startsWith(sku))).toBe(true);
      }
    });

    it("HCT's Main Board only offers TAA (T-suffix) 40G optics, plus the 100G optics the matrix confirms", () => {
      const optics = boardOptics('GigaVUE-HCT', 'HCT-C02 (Main Board)');
      for (const sku of ['QSF-504', 'QSF-506', 'QSF-507']) {
        expect(optics.some(o => o.startsWith(sku + ' '))).toBe(false);
      }
      for (const sku of ['Q28-502T', 'Q28-503T', 'Q28-506', 'Q28-508', 'Q28-513']) {
        expect(optics.some(o => o.startsWith(sku))).toBe(true);
      }
    });
  });
});
