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
    const validResult = validateOptic('GigaVUE-TA25', 'Base Ports', 'Q28-502T (100G QSFP28 SR4)', 'Full');
    expect(validResult.valid).toBe(true);

    // Invalid optic on GigaVUE-TA25 Base Ports
    const supportedResult = validateOptic('GigaVUE-TA25', 'Base Ports', 'SFP-501 (1G SFP Copper)', 'Full');
    expect(supportedResult.valid).toBe(true);
    // SFP-501 is supported on TA25! Let's check a completely unsupported optic speed/type, e.g. QDD-503 (400G QSFP-DD LR4)
    const completelyInvalidResult = validateOptic('GigaVUE-TA25', 'Base Ports', 'QDD-503 (400G QSFP-DD LR4)', 'Full');
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

  // Breakout panels are now real, sidebar-placeable hardware nodes (PNL-M341T/
  // PNL-M343T) with their own MPO/LC ports, not a fake optic-string entry that
  // widened a chassis board's supportedOptics list - see breakoutRules.test.ts
  // for isParallelBreakoutOptic/getBreakoutLcOptics coverage and
  // ports.test.ts's "getChassisPorts for a breakout panel" for the port model.

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

    it('BPS-HC1-D25A60/D35C60 now offer 1G/10G SFP+ optics (previously missing entirely) - the matrix\'s "Transceiver and Cable Matrices" sheet groups both alongside BPS-HC1-D25A24/PRT-HC1-X12/PRT-HC1-Q04X08 for the 1G and 10G sections on all three chassis', () => {
      for (const chassis of ['GigaVUE-HC1', 'GigaVUE-HC1-Plus', 'GigaVUE-HCT']) {
        for (const board of ['BPS-HC1-D25A60', 'BPS-HC1-D35C60']) {
          const optics = boardOptics(chassis, board);
          expect(optics.length, `${chassis} ${board} has no supported optics`).toBeGreaterThan(0);
          for (const sku of ['SFP-501', 'SFP-502', 'SFP-503', 'SFP-531', 'SFP-532', 'SFP-533', 'SFP-534']) {
            expect(optics.some(o => o.startsWith(sku)), `${chassis} ${board} missing ${sku}`).toBe(true);
          }
          // 1G/10G only per the matrix - no 25G support like PRT-HC1-Q04X08 has on HC1-Plus/HCT
          expect(optics.some(o => o.includes('25G'))).toBe(false);
        }
      }
    });

    it('GigaVUE-HC3 CCv2-only boards (PRT-HC3-C16, SMT-HC3-C08) are now reachable - previously invisible entirely', () => {
      // opticRules.json used to key HC3's boards under "GigaVUE-HC3 CCv1" and
      // "GigaVUE-HC3 CCv2" separately, but hardwareCatalogue.json only has a single
      // "GigaVUE-HC3" model (no way for the app to select which compute-card
      // generation is deployed). getSupportedBoards's prefix match always resolved
      // to "GigaVUE-HC3 CCv1" (first match, equal string length), so CCv2-exclusive
      // boards never appeared in the Slot dropdown at all - installing them was
      // impossible even though they're real, valid HC3 modules.
      const boards = getSupportedBoards('GigaVUE-HC3', 'Full');
      const names = boards.map(b => b.board);
      for (const board of ['PRT-HC3-X24', 'PRT-HC3-C08Q08', 'PRT-HC3-C16', 'SMT-HC3-C05', 'SMT-HC3-C08', 'BPS-HC3-C25F2G', 'BPS-HC3-C35C2G', 'BPS-HC3-Q35C2G']) {
        expect(names, `${board} unreachable on GigaVUE-HC3`).toContain(board);
      }
    });

    it('PRT-HC3-C08Q16 (CCv1-only, no longer shipped) is not offered - its CCv2 replacement PRT-HC3-C08Q08 is', () => {
      // CCv1 HC3 units are EOL - all new deployments are CCv2. PRT-HC3-C08Q16 also
      // has no port-capacity entry in hardwareCatalogue.json's modules list, so it
      // was never functional even when reachable (would show 0 cages installed).
      const names = getSupportedBoards('GigaVUE-HC3', 'Full').map(b => b.board);
      expect(names).not.toContain('PRT-HC3-C08Q16');
      expect(names).toContain('PRT-HC3-C08Q08');
    });

    it('a base chassis is never shadowed by a longer sibling key it happens to prefix-match', () => {
      // getSupportedBoards used to sort keys longest-first and accept any key
      // k where k.startsWith(model) - so for model "GigaVUE-HC1", the key
      // "GigaVUE-HC1-Plus" (which does start with "GigaVUE-HC1") was tried before
      // the exact "GigaVUE-HC1" key ever got a chance, silently handing every
      // plain HC1 node HC1-Plus's rules instead - including a "Main Board" with
      // built-in 40G/100G QSFP+ cages a base HC1 doesn't physically have (its
      // Main Board is 100M/1G/10G SFP-only per hardwareCatalogue.json).
      const isRealQsfpOptic = (o: string) => o.startsWith('QSF-') || o.startsWith('Q28-');

      const hc1MainBoard = getSupportedBoards('GigaVUE-HC1').find(b => b.board.toLowerCase().includes('main'));
      expect(hc1MainBoard?.board).toBe('HC1-X12G4 (Main board)');
      expect(hc1MainBoard?.supportedOptics.some(isRealQsfpOptic)).toBe(false);

      const hc1PlusMainBoard = getSupportedBoards('GigaVUE-HC1-Plus').find(b => b.board.toLowerCase().includes('main'));
      expect(hc1PlusMainBoard?.board).toBe('HC1P-BASE (Main Board)');
      expect(hc1PlusMainBoard?.supportedOptics.some(o => o.startsWith('Q28-'))).toBe(true);
    });
  });
});
