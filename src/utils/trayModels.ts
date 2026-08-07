/**
 * trayModels.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared tap-tray identity rules used by both the BOM's tray quantity math
 * (bomGenerator.ts) and the auto-tray-node generator (traySync.ts). Split out
 * on its own so those two don't import from each other.
 */

// Multimode unidirectional TAP modules (TAP-Mxx1ULT) require the two-slot 1RU
// TAP-M202ULT chassis and cannot be fitted into an M100T/M200T tray. The
// singlemode TAP-Mxx3ULT modules are ordinary M-series modules and do share
// those trays, so only the "1ULT" pattern diverts here.
export const ULT_TRAY_SKU = 'TAP-M202ULT';
export const ULT_TRAY_SLOTS = 2;

export function requiresUltTray(sku: string, model = ''): boolean {
  return /M\d*1ULT/i.test(`${sku} ${model}`);
}

const TRAY_MODELS = ['TAP-M100T', 'TAP-M200T', ULT_TRAY_SKU] as const;

/** True for the three tray/chassis models that hold tap modules - these are
 *  auto-generated (see traySync.ts) rather than placed manually from the sidebar. */
export function isAutoTrayModel(model: string): boolean {
  return (TRAY_MODELS as readonly string[]).includes(model);
}

/**
 * Bin-packs per-site tap-module/breakout-panel counts into the tray SKUs and
 * quantities needed: 6 modules fill a TAP-M200T, a remainder of <=3 gets its
 * own TAP-M100T (otherwise it rounds up to another M200T); ULT-variant
 * modules pool separately into TAP-M202ULT at ULT_TRAY_SLOTS each. Shared by
 * traySync.ts (materialises the result as real tray nodes for Rack View) and
 * bomGenerator.ts (quotes the same result as BOM dependency rows) so the
 * formula only has to be correct in one place.
 */
export function packTapTrayTargets(
  countsPerSite: Record<string, number>,
  ultCountsPerSite: Record<string, number>,
): Record<string, Record<string, number>> {
  const targets: Record<string, Record<string, number>> = {};
  const add = (site: string, model: string, qty: number) => {
    if (qty <= 0) return;
    if (!targets[site]) targets[site] = {};
    targets[site][model] = (targets[site][model] || 0) + qty;
  };

  Object.entries(countsPerSite).forEach(([site, total]) => {
    let numM200T = Math.floor(total / 6);
    let numM100T = 0;
    const remainder = total % 6;
    if (remainder > 0) {
      if (remainder <= 3) numM100T = 1;
      else numM200T += 1;
    }
    add(site, 'TAP-M100T', numM100T);
    add(site, 'TAP-M200T', numM200T);
  });

  Object.entries(ultCountsPerSite).forEach(([site, count]) => {
    add(site, ULT_TRAY_SKU, Math.ceil(count / ULT_TRAY_SLOTS));
  });

  return targets;
}
