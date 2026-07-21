import { describe, it, expect } from 'vitest';
import opticRules from '../constants/opticRules.json';

describe('Debug opticRules.json', () => {
  it('should log all keys from opticRules.json', () => {
    const keys = Object.keys(opticRules);
    console.log('opticRules keys:', keys);
    expect(keys).toBeDefined();
  });
});
