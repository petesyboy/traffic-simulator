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
