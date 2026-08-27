/**
 * projectQuoteStorage.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Project-specific commercial quote & discount workspace tracking.
 *
 * Persists customized pricing rules, category discount matrix, and toggles
 * per scenario name so that:
 *  1. Quote adjustments made in QuoteModal survive modal close/reopen.
 *  2. "Dump All to Folder" only generates commercial quote documents if the
 *     user has actively configured discounting for the project (avoiding
 *     unintended scary 0%-discount list price quote outputs).
 */

import { sanitizeSolutionName } from './exportNaming';
import { DEFAULT_DISCOUNT_CONFIG, type DiscountCategoryConfig } from './pricingEngine';

const QUOTE_STORAGE_PREFIX = 'fm-simulator-quote-workspace-';

export interface ProjectQuoteWorkspace {
  scenarioName: string;
  discountConfig: DiscountCategoryConfig;
  rawDiscountInputs?: Record<string, string>;
  excludeOptics: boolean;
  freePowerCords: boolean;
  spanOnlyMode: boolean;
  savedAt: string;
  isDiscountConfigured: boolean;
}

/**
 * Retrieves the saved commercial quote workspace for a given scenario name.
 */
export function getProjectQuoteWorkspace(scenarioName?: string | null): ProjectQuoteWorkspace | null {
  if (typeof localStorage === 'undefined') return null;
  const key = `${QUOTE_STORAGE_PREFIX}${sanitizeSolutionName(scenarioName)}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as ProjectQuoteWorkspace;
  } catch (err) {
    console.warn(`Failed to read quote workspace for ${scenarioName}:`, err);
    return null;
  }
}

/**
 * Checks whether active discounting or commercial adjustments have been configured
 * on a project quote workspace.
 */
export function isQuoteDiscountApplied(workspace?: ProjectQuoteWorkspace | null): boolean {
  if (!workspace) return false;
  if (!workspace.isDiscountConfigured) return false;

  // Check if any discount category percentage is > 0
  const cfg = workspace.discountConfig || {};
  const hasCategoryDiscount = Object.values(cfg).some((val) => typeof val === 'number' && val > 0);
  if (hasCategoryDiscount) return true;

  // Check if any special pricing modifier toggle is active
  if (workspace.excludeOptics || workspace.freePowerCords || workspace.spanOnlyMode) {
    return true;
  }

  return false;
}

/**
 * Persists the current commercial quote workspace for the scenario.
 */
export function saveProjectQuoteWorkspace(
  scenarioName: string | null | undefined,
  config: {
    discountConfig: DiscountCategoryConfig;
    rawDiscountInputs?: Record<string, string>;
    excludeOptics: boolean;
    freePowerCords: boolean;
    spanOnlyMode: boolean;
  },
): void {
  if (typeof localStorage === 'undefined') return;
  const key = `${QUOTE_STORAGE_PREFIX}${sanitizeSolutionName(scenarioName)}`;

  const cfg = config.discountConfig || DEFAULT_DISCOUNT_CONFIG;
  const hasDiscount =
    Object.values(cfg).some((val) => typeof val === 'number' && val > 0) ||
    config.excludeOptics ||
    config.freePowerCords ||
    config.spanOnlyMode;

  const workspace: ProjectQuoteWorkspace = {
    scenarioName: scenarioName || 'Solution',
    discountConfig: cfg,
    rawDiscountInputs: config.rawDiscountInputs,
    excludeOptics: config.excludeOptics,
    freePowerCords: config.freePowerCords,
    spanOnlyMode: config.spanOnlyMode,
    savedAt: new Date().toISOString(),
    isDiscountConfigured: hasDiscount,
  };

  try {
    localStorage.setItem(key, JSON.stringify(workspace));
  } catch (err) {
    console.warn(`Failed to save quote workspace for ${scenarioName}:`, err);
  }
}

/**
 * Clears the saved commercial quote workspace for a scenario.
 */
export function clearProjectQuoteWorkspace(scenarioName?: string | null): void {
  if (typeof localStorage === 'undefined') return;
  const key = `${QUOTE_STORAGE_PREFIX}${sanitizeSolutionName(scenarioName)}`;
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`Failed to clear quote workspace for ${scenarioName}:`, err);
  }
}
