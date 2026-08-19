/**
 * opticPacks.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Some transceivers are also sold in fixed-size multipacks (10/20-packs etc.)
 * at a better per-unit price than ordering singles. Once a BOM's total need
 * for one of these optics reaches a pack's size, this swaps in as many full
 * packs as fit and leaves only the remainder as individual units - e.g. 47x
 * SFP-532T becomes 2x SFP-532T-20P + 7x SFP-532T, not 47 individual lines.
 *
 * Deliberately greedy/floor-based rather than trying to minimise total spend
 * across multiple pack sizes - every SKU here only has one pack size, so
 * "use as many packs as fit, singles for the rest" is already optimal.
 */
import type { BomRow } from './bomGenerator';

export interface OpticPackRule {
  packSku: string;
  packSize: number;
}

/** Base optic SKU → its multipack option. Only these seven optics are sold in packs. */
export const OPTIC_PACK_RULES: Record<string, OpticPackRule> = {
  'QSF-502T': { packSku: 'QSF-502T-10P', packSize: 10 },
  'QSF-502': { packSku: 'QSF-502-10P', packSize: 10 },
  'QSF-503T': { packSku: 'QSF-503T-5P', packSize: 5 },
  'SFP-532T': { packSku: 'SFP-532T-20P', packSize: 20 },
  'SFP-532': { packSku: 'SFP-532-20P', packSize: 20 },
  'SFP-533T': { packSku: 'SFP-533T-20P', packSize: 20 },
  'SFP-533': { packSku: 'SFP-533-20P', packSize: 20 },
};

/**
 * Replaces each Optic row whose SKU has a pack option and whose quantity
 * reaches at least one full pack with a pack-qty row (+ a leftover singles
 * row, if any remainder). Every other row passes through unchanged.
 */
export function optimizeOpticPacks(rows: BomRow[], skus: Record<string, string>): BomRow[] {
  const result: BomRow[] = [];
  for (const row of rows) {
    const rule = row.type === 'Optic' ? OPTIC_PACK_RULES[row.sku] : undefined;
    if (!rule || row.qty < rule.packSize) {
      result.push(row);
      continue;
    }
    const packs = Math.floor(row.qty / rule.packSize);
    const remainder = row.qty % rule.packSize;
    result.push({ ...row, sku: rule.packSku, qty: packs, description: skus[rule.packSku] || 'Unknown SKU' });
    if (remainder > 0) result.push({ ...row, qty: remainder });
  }
  return result;
}
