/**
 * consolidateSimpleDevices.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * The BOM modal's Site tab breaks line items out per hardware node, which is
 * genuinely useful for a chassis (its own chassis/license/module/optic rows
 * grouped together so you can see what's configured on that specific unit) -
 * but produces one near-identical section per device for anything that's
 * just a single line item on its own (a standalone TAP module, a breakout
 * panel, ...). Nine TAP-M273T modules on a site showed up as nine separate
 * "1x TAP-M273T" sections instead of one "9x TAP-M273T" line.
 *
 * This merges any node whose entire BOM contribution is exactly one row into
 * a shared per-site bucket (summed by SKU), leaving multi-row nodes (real
 * chassis) exactly as they were.
 */
import type { BomRow } from './bomGenerator';

/** Sentinel `nodeId` used for the merged bucket - distinct from the `undefined`
 *  nodeId that global (non-node-specific) dependency rows already use. */
export const CONSOLIDATED_DEVICES_NODE_ID = 'consolidated-devices';

export function consolidateSimpleDeviceRows(rows: BomRow[]): BomRow[] {
  const rowsByNode = new Map<string, BomRow[]>();
  const passthrough: BomRow[] = [];

  for (const row of rows) {
    if (!row.nodeId) {
      passthrough.push(row);
      continue;
    }
    if (!rowsByNode.has(row.nodeId)) rowsByNode.set(row.nodeId, []);
    rowsByNode.get(row.nodeId)!.push(row);
  }

  const merged = new Map<string, BomRow>();
  const complex: BomRow[] = [];

  rowsByNode.forEach((nodeRows) => {
    if (nodeRows.length !== 1) {
      complex.push(...nodeRows);
      return;
    }
    const row = nodeRows[0];
    const key = `${row.site || ''}_${row.sku}${row.linkType ? `__${row.linkType}` : ''}`;
    const existing = merged.get(key);
    if (existing) existing.qty += row.qty;
    else merged.set(key, { ...row, nodeId: CONSOLIDATED_DEVICES_NODE_ID });
  });

  return [...passthrough, ...Array.from(merged.values()), ...complex];
}
