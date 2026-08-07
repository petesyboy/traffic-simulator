/**
 * traySync.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Keeps TAP-M100T/M200T/M202ULT tray nodes in sync with however many tap
 * modules actually need one, per site - the trays aren't manually placed from
 * the sidebar (they're excluded there) and don't appear on the Canvas at all
 * (see CanvasArea's render filter); they only ever surface in Rack View.
 *
 * The bin-packing math mirrors what bomGenerator.ts has always used to compute
 * tray *quantities* for the BOM (6 tap modules per M200T, a leftover of <=3
 * gets one M100T; ULT-variant modules take their own 2-slot M202ULT chassis
 * and pool separately) - this just materialises that same count as real,
 * placeable hardwareNodes instead of a BOM line item.
 */
import { v4 as uuidv4 } from 'uuid';
import type { CustomNode, HardwareNodeData } from '../store/types';
import hardwareCatalogue from '../constants/hardwareCatalogue.json';
import { isTapModule } from './hardwareUtils';
import { requiresUltTray, ULT_TRAY_SLOTS, isAutoTrayModel } from './trayModels';

export { isAutoTrayModel };

/** Bin-packs a per-site tap-module count into the tray models/quantities needed. */
function packTargets(tapModulesPerSite: Record<string, number>, ultTapModulesPerSite: Record<string, number>) {
  const targets: Record<string, Record<string, number>> = {};
  const add = (site: string, model: string, qty: number) => {
    if (qty <= 0) return;
    if (!targets[site]) targets[site] = {};
    targets[site][model] = (targets[site][model] || 0) + qty;
  };

  Object.entries(tapModulesPerSite).forEach(([site, total]) => {
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

  Object.entries(ultTapModulesPerSite).forEach(([site, count]) => {
    add(site, 'TAP-M202ULT', Math.ceil(count / ULT_TRAY_SLOTS));
  });

  return targets;
}

export function syncTapTrays(nodes: CustomNode[]): CustomNode[] {
  const tapModulesPerSite: Record<string, number> = {};
  const ultTapModulesPerSite: Record<string, number> = {};

  nodes.forEach(node => {
    if (node.type !== 'hardwareNode') return;
    const model = String(node.data?.model || '');
    const sku = node.data?.sku as string | undefined;
    if (!isTapModule(model, sku)) return;
    const siteKey = (node.data?.site as string) || 'Unassigned';
    const pool = requiresUltTray(sku || '', model) ? ultTapModulesPerSite : tapModulesPerSite;
    pool[siteKey] = (pool[siteKey] || 0) + 1;
  });

  const targetPerSite = packTargets(tapModulesPerSite, ultTapModulesPerSite);

  const existingBySiteModel: Record<string, Record<string, CustomNode[]>> = {};
  nodes.forEach(node => {
    if (node.type !== 'hardwareNode') return;
    const model = String(node.data?.model || '');
    if (!isAutoTrayModel(model)) return;
    const site = (node.data?.site as string) || 'Unassigned';
    if (!existingBySiteModel[site]) existingBySiteModel[site] = {};
    if (!existingBySiteModel[site][model]) existingBySiteModel[site][model] = [];
    existingBySiteModel[site][model].push(node);
  });

  // Sites can (and do, in this app's demo data) contain spaces, so site/model
  // pairs are walked as nested lookups rather than a joined-then-split string key.
  const sites = new Set<string>([...Object.keys(targetPerSite), ...Object.keys(existingBySiteModel)]);
  const toRemove = new Set<string>();
  const toAdd: CustomNode[] = [];

  sites.forEach(site => {
    const targetsForSite = targetPerSite[site] || {};
    const existingForSite = existingBySiteModel[site] || {};
    const models = new Set<string>([...Object.keys(targetsForSite), ...Object.keys(existingForSite)]);

    models.forEach(model => {
      const target = targetsForSite[model] || 0;
      const existing = existingForSite[model] || [];

      if (existing.length < target) {
        const catalogueEntry = hardwareCatalogue.taps.find(t => t.model === model) as { sku?: string; image?: string } | undefined;
        for (let i = existing.length; i < target; i++) {
          const label = target > 1 ? `${model} #${i + 1}` : model;
          toAdd.push({
            id: uuidv4(),
            type: 'hardwareNode',
            position: { x: 0, y: 0 },
            data: {
              label,
              configType: 'Hardware',
              model,
              sku: catalogueEntry?.sku || model,
              image: catalogueEntry?.image,
              site: site === 'Unassigned' ? undefined : site,
            } as HardwareNodeData,
          } as CustomNode);
        }
      } else if (existing.length > target) {
        // Never discard a tray the user has already placed/populated in Rack View,
        // even if the math now wants fewer - only trim ones still sitting empty.
        const removable = existing.filter(tray => {
          const isRacked = typeof tray.data?.rackU === 'number' && Boolean(tray.data?.rackId);
          const hasNested = nodes.some(n => n.data?.trayId === tray.id);
          return !isRacked && !hasNested;
        });
        removable.slice(0, existing.length - target).forEach(tray => toRemove.add(tray.id));
      }
    });
  });

  if (toAdd.length === 0 && toRemove.size === 0) return nodes;
  return [...nodes.filter(n => !toRemove.has(n.id)), ...toAdd];
}
