/**
 * opticPacks.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Some transceivers are also sold in fixed-size multipacks (10/20-packs etc.)
 * at a better per-unit price than ordering singles. This rolls a BOM's total
 * need for one of these optics up into packs: as many full packs as fit,
 * rounding the leftover up to one more full pack once it's more than half a
 * pack's worth (e.g. 15x on a 20-pack becomes a single 20-pack; 47x becomes
 * 2 packs + 7 singles, since 7 isn't "nearly a pack"; 51x becomes 3 packs
 * with nothing left over).
 *
 * A pack is a physical box of loose transceivers, not tied to any one
 * chassis, so this only makes sense applied to a *whole-project* total -
 * see `aggregateBomRowsBySku` below, used to build that total before
 * `optimizeOpticPacks` runs on it. Per-node/per-site BOM views intentionally
 * stay as raw individual counts (see BomModal.tsx's Site tab and
 * buildReportDocDefinition.ts's physical appendix) - a pack of 20 dropped
 * onto one node's own line would misleadingly suggest that box ships
 * attached to that specific device.
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
 * Merges rows sharing the same SKU into one project-wide total, dropping the
 * per-node/per-site identity in the process (qty is summed; type/description/
 * term are taken from the first row seen for that SKU). This is the "whole
 * project" total that pack optimization should run on - summing already-
 * pack-optimized per-node rows instead would under-count: three nodes each
 * needing 12x (no single node reaches a pack) would otherwise never combine
 * into the 36-total's 1 pack + 16 singles.
 */
export function aggregateBomRowsBySku(rows: BomRow[]): BomRow[] {
  const map = new Map<string, BomRow>();
  for (const row of rows) {
    const key = row.sku;
    const existing = map.get(key);
    if (existing) {
      existing.qty += row.qty;
      if (row.linkType) existing.linkType = row.linkType;
    } else {
      map.set(key, { ...row, nodeId: undefined, site: undefined });
    }
  }
  return Array.from(map.values());
}

/**
 * Replaces each Optic row whose SKU has a pack option with a pack-qty row
 * (+ a leftover singles row, if any remainder survives the round-up rule
 * below). Every other row passes through unchanged.
 */
export function optimizeOpticPacks(rows: BomRow[], skus: Record<string, string>): BomRow[] {
  const result: BomRow[] = [];
  for (const row of rows) {
    const rule = row.type === 'Optic' ? OPTIC_PACK_RULES[row.sku] : undefined;
    if (!rule) {
      result.push(row);
      continue;
    }

    const originalQty = row.qty;
    let packs = Math.floor(row.qty / rule.packSize);
    let remainder = row.qty % rule.packSize;
    // A leftover of more than half a pack reads better as one more full pack
    // than as that many loose singles - so 15x on a 20-pack (remainder 15)
    // becomes 1 pack, not 15 individual lines; 47x (remainder 7) stays 2
    // packs + 7 singles, since 7 isn't "nearly a pack".
    let roundedUp = false;
    if (remainder > rule.packSize / 2) {
      packs += 1;
      remainder = 0;
      roundedUp = true;
    }

    if (packs === 0) {
      result.push(row);
      continue;
    }

    const surplus = packs * rule.packSize - originalQty;
    // Only the round-up case ever over-supplies (splitting into pack +
    // exact-remainder singles always totals back to the original qty) - flag
    // it so the extra units on the quote read as a deliberate cost/ordering
    // tradeoff, not a mistake.
    const note =
      roundedUp && surplus > 0
        ? `Rounded up from ${originalQty} individual units to ${packs} × ${rule.packSku} (${packs * rule.packSize} total) - a full pack is more cost-effective and simpler to order than ${originalQty} singles. Includes ${surplus} spare unit${surplus === 1 ? '' : 's'}.`
        : undefined;

    result.push({ ...row, sku: rule.packSku, qty: packs, description: skus[rule.packSku] || 'Unknown SKU', note });
    if (remainder > 0) result.push({ ...row, qty: remainder });
  }
  return result;
}

/** The project-wide BOM: aggregate every row by SKU, and optionally roll quantities up into 20-packs. */
export function buildProjectWideOpticBom(
  rows: BomRow[],
  skus: Record<string, string>,
  useOpticPacks: boolean = true,
): BomRow[] {
  const aggregated = aggregateBomRowsBySku(rows);
  return useOpticPacks ? optimizeOpticPacks(aggregated, skus) : aggregated;
}

