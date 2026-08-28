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

  it('persists and restores complete CPQ metadata, AHR/FM Prime/eLearning options, and discount overrides', () => {
    saveProjectQuoteWorkspace('Finance DC Project', {
      discountConfig: {
        global: 20,
        software: 25,
        optics: 40,
        chassis: 15,
        modules: 15,
        taps: 10,
        support: 5,
        accessories: 0,
      },
      excludeOptics: false,
      freePowerCords: true,
      spanOnlyMode: false,
      includeAhr: true,
      includeFmPrime: true,
      includeELearning: true,
      quoteMetadata: {
        quoteNumber: 'Q-2026-999',
        posId: 'POS888123',
        endCustomer: 'Global Bank Corp',
        reseller: 'Enterprise Security Ltd',
        salesRep: 'Jane Doe',
        paymentTerms: 'Net 60',
      },
    });

    const workspace = getProjectQuoteWorkspace('Finance DC Project');
    expect(workspace).not.toBeNull();
    expect(workspace?.discountConfig.software).toBe(25);
    expect(workspace?.freePowerCords).toBe(true);
    expect(workspace?.includeAhr).toBe(true);
    expect(workspace?.includeFmPrime).toBe(true);
    expect(workspace?.quoteMetadata?.quoteNumber).toBe('Q-2026-999');
    expect(workspace?.quoteMetadata?.endCustomer).toBe('Global Bank Corp');
    expect(workspace?.quoteMetadata?.paymentTerms).toBe('Net 60');
  });
});
