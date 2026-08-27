import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getProjectQuoteWorkspace,
  saveProjectQuoteWorkspace,
  clearProjectQuoteWorkspace,
  isQuoteDiscountApplied,
} from './projectQuoteStorage';
import { DEFAULT_DISCOUNT_CONFIG } from './pricingEngine';

describe('projectQuoteStorage', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mockStorage[k] || null,
      setItem: (k: string, v: string) => {
        mockStorage[k] = v;
      },
      removeItem: (k: string) => {
        delete mockStorage[k];
      },
      clear: () => {
        mockStorage = {};
      },
    });
  });

  it('returns null when no quote workspace has been saved', () => {
    expect(getProjectQuoteWorkspace('City of Goteborg')).toBeNull();
  });

  it('identifies un-discounted workspace as not applied', () => {
    saveProjectQuoteWorkspace('City of Goteborg', {
      discountConfig: DEFAULT_DISCOUNT_CONFIG,
      excludeOptics: false,
      freePowerCords: false,
      spanOnlyMode: false,
    });

    const workspace = getProjectQuoteWorkspace('City of Goteborg');
    expect(workspace).not.toBeNull();
    expect(isQuoteDiscountApplied(workspace)).toBe(false);
  });

  it('identifies category discounts as applied', () => {
    saveProjectQuoteWorkspace('City of Goteborg', {
      discountConfig: {
        ...DEFAULT_DISCOUNT_CONFIG,
        global: 25,
      },
      excludeOptics: false,
      freePowerCords: false,
      spanOnlyMode: false,
    });

    const workspace = getProjectQuoteWorkspace('City of Goteborg');
    expect(workspace).not.toBeNull();
    expect(isQuoteDiscountApplied(workspace)).toBe(true);
  });

  it('identifies discount modifiers (free power cords or exclude optics) as applied', () => {
    saveProjectQuoteWorkspace('City of Goteborg', {
      discountConfig: DEFAULT_DISCOUNT_CONFIG,
      excludeOptics: true,
      freePowerCords: false,
      spanOnlyMode: false,
    });

    const workspace = getProjectQuoteWorkspace('City of Goteborg');
    expect(isQuoteDiscountApplied(workspace)).toBe(true);
  });

  it('clears workspace correctly', () => {
    saveProjectQuoteWorkspace('City of Goteborg', {
      discountConfig: { ...DEFAULT_DISCOUNT_CONFIG, global: 30 },
      excludeOptics: false,
      freePowerCords: false,
      spanOnlyMode: false,
    });

    clearProjectQuoteWorkspace('City of Goteborg');
    expect(getProjectQuoteWorkspace('City of Goteborg')).toBeNull();
  });
});
