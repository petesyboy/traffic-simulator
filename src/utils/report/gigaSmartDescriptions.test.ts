import { describe, it, expect } from 'vitest';
import { describeGigaSmartFunction, GIGASMART_ACTION_DESCRIPTIONS } from './gigaSmartDescriptions';
import { ACTION_TYPES } from '../../constants/nodeTypes';

describe('describeGigaSmartFunction', () => {
  it('returns the catalogued sentence for a known action', () => {
    expect(describeGigaSmartFunction(ACTION_TYPES.SSL_DECRYPT)).toContain('decrypts, and delivers TLS/SSL traffic');
  });

  it('has an entry for every ACTION_TYPES value', () => {
    Object.values(ACTION_TYPES).forEach((actionType) => {
      expect(GIGASMART_ACTION_DESCRIPTIONS[actionType], `missing description for ${actionType}`).toBeTruthy();
    });
  });

  it('falls back to a generic sentence naming the action for an unrecognised action type', () => {
    expect(describeGigaSmartFunction('Some Future Action')).toBe(
      'Applies the "Some Future Action" GigaSMART function to optimise, protect, or scale downstream monitoring tools.',
    );
  });

  it('falls back to a fully generic sentence when no action type is given', () => {
    expect(describeGigaSmartFunction(undefined)).toBe(
      'Applies GigaSMART processing to optimise, protect, or scale downstream monitoring tools.',
    );
  });
});
