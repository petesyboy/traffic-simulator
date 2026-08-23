/**
 * autoRack.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Automated datacenter rack deployment (Auto-Rack) engine.
 *
 * Implements datacenter industry standards (TIA-942, BICSI, ASHRAE, EIA-310-D):
 * 1. Rack Stability / Center of Gravity:
 *    - Heavy, deep multi-RU modular chassis (GigaVUE-HC3 [3U], GigaVUE-HC2 [2U])
 *      occupy the bottom tier of the 42U rack (U1 upwards).
 * 2. Intermediate Switching Tier:
 *    - Core fabric switches (TA400, TA200, TA100) and modular nodes (HC1, HC1-Plus,
 *      HCT, TA25) occupy the middle tier.
 * 3. Top-of-Rack Patching Tier:
 *    - Modular TAP trays (TAP-M200T, TAP-M100T, TAP-M202ULT), breakout panels, and
 *      active TAPs occupy the upper tier, aligning with overhead structured cabling.
 *
 * Also automatically bin-packs unassigned TAP modules and breakout panels into
 * available TAP tray bays for the site.
 */

import type { CustomNode } from '../store/types';
import { getDeviceRU, getTrayBayCount, isTapModule, isBreakoutPanelModel, isRackableGigamonEquipment } from './hardwareUtils';
import { syncTapTrays, isAutoTrayModel } from './traySync';

/** Weight / Hierarchy ranking: lower number = placed lower in the rack (bottom tier). */
export const getDeviceHierarchyRank = (model: string, sku?: string): number => {
  const m = model.toUpperCase();
  const s = (sku || '').toUpperCase();

  // Tier 1: Heavy Modular Chassis (Bottom of rack: U1..)
  if (m.includes('HC3') || s.includes('HC3')) return 10;
  if (m.includes('HC2') || s.includes('HC2')) return 20;

  // Tier 2: High-Density Core / Aggregation Switches
  if (m.includes('TA400') || s.includes('TA400')) return 30;
  if (m.includes('TA200') || s.includes('TA200')) return 40;
  if (m.includes('TA100') || s.includes('TA100')) return 50;
  if (m.includes('HC1-PLUS') || s.includes('HC1-PLUS') || m.includes('HC1PLUS')) return 60;
  if (m.includes('HC1') || s.includes('HC1') || m.includes('HCT') || s.includes('HCT')) return 65;
  if (m.includes('TA25') || s.includes('TA25')) return 70;

  // Other active chassis / switches
  if (!isAutoTrayModel(model) && !isTapModule(model, sku) && !isBreakoutPanelModel(model) && !m.includes('TAP')) {
    return 80;
  }

  // Tier 3: Passive TAP Trays & Active TAPs (Top of rack)
  if (m.includes('M200') || s.includes('M200')) return 110;
  if (m.includes('M100') || s.includes('M100')) return 120;
  if (m.includes('M202') || s.includes('M202')) return 130;
  if (m.includes('TAP') || s.includes('TAP')) return 140;

  return 999;
};

export const MAX_RACK_U = 42;

/**
 * Auto-deploys hardware for a given site to a 42U rack:
 * 1. Synchronises TAP trays for the site.
 * 2. Assigns unslotted TAP modules / breakout panels into available tray bays.
 * 3. Assigns non-overlapping rack units (1..42) to all site chassis and trays
 *    following datacenter weight/hierarchy standards.
 */
export function autoDeployRack(nodes: CustomNode[], siteName: string): CustomNode[] {
  const effectiveSite = siteName === 'Global / Unassigned' ? undefined : siteName;
  const rackId = siteName === 'Global / Unassigned' ? 'rack_global' : `rack_${siteName}`;

  // 1. Ensure trays are synced
  const currentNodes = syncTapTrays(nodes);

  // 2. Identify site nodes
  const isNodeForSite = (n: CustomNode) => {
    const s = n.data?.site as string | undefined;
    if (!effectiveSite) {
      return !s || s === 'Global / Unassigned' || s === 'Unassigned';
    }
    return s === effectiveSite;
  };

  // Find all trays for this site
  const siteTrays = currentNodes.filter(n =>
    n.type === 'hardwareNode' &&
    isNodeForSite(n) &&
    isAutoTrayModel(String(n.data?.model || ''))
  );

  // Find all unslotted tap modules / breakout panels for this site
  const siteModules = currentNodes.filter(n =>
    n.type === 'hardwareNode' &&
    isNodeForSite(n) &&
    (isTapModule(String(n.data?.model || ''), n.data?.sku as string | undefined) ||
     isBreakoutPanelModel(String(n.data?.model || '')))
  );

  // Track bay assignments
  const trayAssignments = new Map<string, Map<number, string>>(); // trayId -> Map<bayIndex, nodeId>
  siteTrays.forEach(tray => {
    trayAssignments.set(tray.id, new Map());
  });

  // Collect already slotted modules
  const unslottedModules: CustomNode[] = [];
  siteModules.forEach(mod => {
    const trayId = mod.data?.trayId as string | undefined;
    const traySlot = mod.data?.traySlot as number | undefined;
    if (trayId && typeof traySlot === 'number' && trayAssignments.has(trayId)) {
      trayAssignments.get(trayId)!.set(traySlot, mod.id);
    } else {
      unslottedModules.push(mod);
    }
  });

  // Slot remaining modules into empty bays
  const updatedModuleMap = new Map<string, { trayId: string; traySlot: number }>();
  let moduleIdx = 0;
  for (const tray of siteTrays) {
    const totalBays = getTrayBayCount(String(tray.data?.model || ''), tray.data?.sku as string | undefined);
    const assignedBays = trayAssignments.get(tray.id)!;
    for (let bay = 1; bay <= totalBays; bay++) {
      if (!assignedBays.has(bay) && moduleIdx < unslottedModules.length) {
        const modToSlot = unslottedModules[moduleIdx++];
        assignedBays.set(bay, modToSlot.id);
        updatedModuleMap.set(modToSlot.id, { trayId: tray.id, traySlot: bay });
      }
    }
  }

  // 3. Collect all rackable equipment for this site (chassis + trays + active TAPs)
  // (Exclude nested modules, since they live inside tray bays; exclude third-party tools/probes)
  const rackableEquipment = currentNodes.filter(n => {
    if (!isRackableGigamonEquipment(n)) return false;
    if (!isNodeForSite(n)) return false;
    const model = String(n.data?.model || '');
    const sku = n.data?.sku as string | undefined;
    if (isTapModule(model, sku) || isBreakoutPanelModel(model)) {
      return false; // nested inside trays
    }
    return true;
  });

  // Sort by hierarchy rank (heaviest chassis first for bottom, then switches, then trays/TAPs)
  const sorted = [...rackableEquipment].sort((a, b) => {
    const rankA = getDeviceHierarchyRank(String(a.data?.model || ''), a.data?.sku as string | undefined);
    const rankB = getDeviceHierarchyRank(String(b.data?.model || ''), b.data?.sku as string | undefined);
    if (rankA !== rankB) return rankA - rankB;
    return String(a.data?.label || '').localeCompare(String(b.data?.label || ''));
  });

  // 4. Assign non-overlapping rack units starting from U1 upwards
  // In 42U rack: U1 is bottom, U42 is top.
  // Lower rank items (HC3, HC2, TA400, HC1) start at bottom (U1, U4, U5...)
  // Trays and TAPs stack neatly on top!
  const updatedRackMap = new Map<string, { rackId: string; rackU: number }>();
  let currentU = 1;

  for (const device of sorted) {
    const model = String(device.data?.model || '');
    const sku = device.data?.sku as string | undefined;
    const ru = getDeviceRU(model, sku);

    if (currentU + ru - 1 <= MAX_RACK_U) {
      updatedRackMap.set(device.id, { rackId, rackU: currentU });
      currentU += ru;
    }
  }

  // 5. Build final updated node list
  return currentNodes.map(node => {
    if (updatedModuleMap.has(node.id)) {
      const slotInfo = updatedModuleMap.get(node.id)!;
      return {
        ...node,
        data: {
          ...node.data,
          trayId: slotInfo.trayId,
          traySlot: slotInfo.traySlot,
          rackId: undefined,
          rackU: undefined,
        },
      };
    }

    if (updatedRackMap.has(node.id)) {
      const rackInfo = updatedRackMap.get(node.id)!;
      return {
        ...node,
        data: {
          ...node.data,
          rackId: rackInfo.rackId,
          rackU: rackInfo.rackU,
          trayId: undefined,
          traySlot: undefined,
        },
      };
    }

    return node;
  });
}

/**
 * Clears rack positions and tray bay slot assignments for all equipment in the given site.
 */
export function clearRackDeploy(nodes: CustomNode[], siteName: string): CustomNode[] {
  const effectiveSite = siteName === 'Global / Unassigned' ? undefined : siteName;

  const isNodeForSite = (n: CustomNode) => {
    const s = n.data?.site as string | undefined;
    if (!effectiveSite) {
      return !s || s === 'Global / Unassigned' || s === 'Unassigned';
    }
    return s === effectiveSite;
  };

  return nodes.map(node => {
    if (node.type === 'hardwareNode' && isNodeForSite(node)) {
      return {
        ...node,
        data: {
          ...node.data,
          rackId: undefined,
          rackU: undefined,
          trayId: undefined,
          traySlot: undefined,
        },
      };
    }
    return node;
  });
}
