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
});
