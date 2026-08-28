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

export type TrayAllocationPreference = 'auto' | 'TAP-M200T' | 'TAP-M100T';

/**
 * Bin-packs per-site tap-module/breakout-panel counts into the tray SKUs and
 * quantities needed:
 * - 'auto': 6 modules fill a TAP-M200T, a remainder of <=3 gets its own TAP-M100T (otherwise it rounds up to another M200T)
 * - 'TAP-M200T': forces full-width 1RU 6-slot TAP-M200T trays for all standard M-series modules (even for 1-3 modules)
 * - 'TAP-M100T': forces half-width 0.5RU 3-slot TAP-M100T trays for all standard M-series modules
 * - ULT-variant modules pool separately into TAP-M202ULT at ULT_TRAY_SLOTS each.
 *
 * Supports deducting capacity from manually overridden or existing fixed trays.
 */
export function packTapTrayTargets(
  countsPerSite: Record<string, number>,
  ultCountsPerSite: Record<string, number>,
  preference: TrayAllocationPreference = 'auto',
  manualTraysPerSite?: Record<string, Record<string, number>>,
): Record<string, Record<string, number>> {
  const targets: Record<string, Record<string, number>> = {};
  const add = (site: string, model: string, qty: number) => {
    if (qty <= 0) return;
    if (!targets[site]) targets[site] = {};
    targets[site][model] = (targets[site][model] || 0) + qty;
  };

  // Seed with manual trays first if present
  if (manualTraysPerSite) {
    Object.entries(manualTraysPerSite).forEach(([site, trays]) => {
      Object.entries(trays).forEach(([model, qty]) => {
        add(site, model, qty);
      });
    });
  }

  const allSites = new Set([
    ...Object.keys(countsPerSite),
    ...(manualTraysPerSite ? Object.keys(manualTraysPerSite) : []),
  ]);

  allSites.forEach((site) => {
    const rawTotal = countsPerSite[site] || 0;
    const manualM200 = manualTraysPerSite?.[site]?.['TAP-M200T'] || 0;
    const manualM100 = manualTraysPerSite?.[site]?.['TAP-M100T'] || 0;
    const manualSlotsProvided = manualM200 * 6 + manualM100 * 3;

    // Remaining module slots needed beyond what manual trays already provide
    const remainingSlots = Math.max(0, rawTotal - manualSlotsProvided);

    if (remainingSlots > 0) {
      if (preference === 'TAP-M200T') {
        const numM200T = Math.ceil(remainingSlots / 6);
        add(site, 'TAP-M200T', numM200T);
      } else if (preference === 'TAP-M100T') {
        const numM100T = Math.ceil(remainingSlots / 3);
        add(site, 'TAP-M100T', numM100T);
      } else {
        let numM200T = Math.floor(remainingSlots / 6);
        let numM100T = 0;
        const remainder = remainingSlots % 6;
        if (remainder > 0) {
          if (remainder <= 3) numM100T = 1;
          else numM200T += 1;
        }
        add(site, 'TAP-M100T', numM100T);
        add(site, 'TAP-M200T', numM200T);
      }
    }
  });

  const allUltSites = new Set([
    ...Object.keys(ultCountsPerSite),
    ...(manualTraysPerSite ? Object.keys(manualTraysPerSite) : []),
  ]);

  allUltSites.forEach((site) => {
    const count = ultCountsPerSite[site] || 0;
    const manualUlt = manualTraysPerSite?.[site]?.[ULT_TRAY_SKU] || 0;
    const manualUltSlots = manualUlt * ULT_TRAY_SLOTS;
    const remainingUlt = Math.max(0, count - manualUltSlots);
    if (remainingUlt > 0) {
      add(site, ULT_TRAY_SKU, Math.ceil(remainingUlt / ULT_TRAY_SLOTS));
    }
  });

  return targets;
}
