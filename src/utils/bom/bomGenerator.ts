import { type Edge } from '@xyflow/react';
import { type CustomNode, type HardwareNodeData } from '../../store/types';
import { NODE_TYPES, CONFIG_TYPES } from '../../constants/nodeTypes';
import hardwareCatalogue from '../../constants/hardwareCatalogue.json';
import opticRules from '../../constants/opticRules.json';
import { resolveNodeSkus, type HardwareNodeSkuData } from '../skuResolver';
import { resolveOpticSku, getSkus } from './skuUtils';
import { getDefaultIngestLimitMbps } from '../../constants/toolIngestLimits';
import { resolveTapAllocations } from '../ports';
import { requiresUltTray, ULT_TRAY_SKU, isAutoTrayModel, packTapTrayTargets } from '../trayModels';
import { isBreakoutPanelModel } from '../hardwareUtils';
import { optimizeOpticPacks } from './opticPacks';

// Re-exported so existing imports of `requiresUltTray` from this module keep working.
export { requiresUltTray };

/** Passive module TAPs record a descriptive label where an optic SKU would go. */
function isPassiveSplitterLabel(optic: string): boolean {
  return optic.startsWith('Passive Optical Splitter');
}

export interface BomRow {
  sku: string;
  qty: number;
  description: string;
  term?: string;
  type: 'Hardware' | 'Chassis' | 'License' | 'Support' | 'Optic' | 'Accessory' | 'TAP' | 'Module' | 'Dependency';
  nodeId?: string;
  site?: string;
  /** Customer-facing explanation shown alongside this row - currently only set
   *  when optic-pack optimization rounds a quantity up past what's strictly
   *  needed, so the surplus isn't a silent surprise on the quote. */
  note?: string;
  /** Set only on optic rows that terminate a TAP link (northbound+southbound pair) -
   *  the only optics a "Convert to SPAN Only" quote should halve. Chassis-to-chassis
   *  uplinks, GigaSMART/module board optics, and tool ingest optics are never tagged. */
  linkType?: 'tap-termination';
}

// Not every chassis names its always-installed board "Base Ports" - e.g. GigaVUE-HC1's is
// "HC1-X12G4 (Main board)". Find whichever board key represents it so auto-added optics
// resolve against the board that's actually there.
function getMainBoardKey(rules: Record<string, string[]> | undefined): string | undefined {
  if (!rules) return undefined;
  const keys = Object.keys(rules);
  return keys.find(k => /\b(main|base)\b/i.test(k)) || keys[0];
}

function resolveOpticForChassis(opticStr: string, chassisModel: string): string {
  const resolvedSku = resolveOpticSku(opticStr, chassisModel);
  const rules = (opticRules as Record<string, Record<string, string[]>>)[chassisModel];
  const mainBoardKey = getMainBoardKey(rules);
  const group = mainBoardKey ? rules[mainBoardKey] : undefined;
  if (group) {
    // 1. Look for exact match for the requested SKU first (preserves explicit non-TAA / TAA user choices)
    const exactMatch = group.find(opt => opt.startsWith(resolvedSku + ' ') || opt === resolvedSku);
    if (exactMatch) return exactMatch;

    // 2. If exact SKU not found on this chassis, look for TAA variant ('T' suffix)
    const candidateTaaSku = resolvedSku.endsWith('T') ? resolvedSku : resolvedSku + 'T';
    const taaSku = candidateTaaSku === resolvedSku || getSkus()[candidateTaaSku] ? candidateTaaSku : resolvedSku;
    const taaMatch = group.find(opt => opt.startsWith(taaSku + ' ') || opt === taaSku);
    if (taaMatch) return taaMatch;

    // 3. Fallback to base SKU without 'T'
    const baseSku = resolvedSku.endsWith('T') ? resolvedSku.slice(0, -1) : resolvedSku;
    const baseMatch = group.find(opt => opt.startsWith(baseSku + ' ') || opt === baseSku);
    if (baseMatch) return baseMatch;
  }
  return resolvedSku;
}

export function syncOpticsOnTapConnection(nodes: CustomNode[], edges: Edge[]): CustomNode[] {
  return nodes.map(node => {
    if (node.type !== NODE_TYPES.HARDWARE || String(node.data?.model || '').includes('TAP')) return node;

    const chassisModel = String(node.data?.model || '');
    const chassisMainBoard = getMainBoardKey((opticRules as Record<string, Record<string, string[]>>)[chassisModel]) || 'Base Ports';
    const connectedEdges = edges.filter(e => e.target === node.id || e.source === node.id);
    const tapOpticsNeeded: Record<string, number> = {};

    connectedEdges.forEach(e => {
      const otherId = e.source === node.id ? e.target : e.source;
      const sourceNode = nodes.find(n => n.id === otherId);
      if (sourceNode) {
        const isHardwareTap = sourceNode.type === NODE_TYPES.HARDWARE && String(sourceNode.data?.model || '').includes('TAP');
        const isInputTap = sourceNode.type === NODE_TYPES.INPUT && sourceNode.data?.configType === CONFIG_TYPES.TAP;
        if (isHardwareTap || isInputTap) {
          const isSMTap = isHardwareTap 
            ? (String(sourceNode.data?.sku || '').includes('253') || String(sourceNode.data?.sku || '').includes('273') || String(sourceNode.data?.sku || '').includes('453') || String(sourceNode.data?.model || '').toLowerCase().includes('single-mode') || String(sourceNode.data?.model || '').toLowerCase().includes('sm'))
            : (sourceNode.data?.tapFiberMode === 'Singlemode');
          
          const isM506T = String(sourceNode.data?.model || '').includes('TAP-M506T') || String(sourceNode.data?.sku || '').includes('TAP-M506T');
          const defaultOptic = isM506T ? 'QSB-523T' : (isSMTap ? 'SFP-533T' : 'SFP-532T');
          const allocations = resolveTapAllocations(sourceNode.data as HardwareNodeData, defaultOptic);

          for (const alloc of allocations) {
            let selectedOpticVal = alloc.toolOptic || alloc.optic;
            if (isPassiveSplitterLabel(selectedOpticVal) || (isM506T && selectedOpticVal.startsWith('SFP'))) selectedOpticVal = defaultOptic;
            tapOpticsNeeded[selectedOpticVal] = (tapOpticsNeeded[selectedOpticVal] || 0) + alloc.qty * 2;
          }
        }
      }
    });

    const currentOptics = (node.data?.optics as { board: string, optic: string, qty: number, isAutoAdded?: boolean, pinnedPortId?: string }[]) || [];
    const userOptics = currentOptics.filter(opt => !opt.isAutoAdded);
    const nextOptics = [...userOptics];
    let changed = currentOptics.length !== userOptics.length;

    // Different taps can express the same physical optic with different raw strings
    // (picker codes vs. legacy fallback labels). Resolve to the chassis target SKU first
    // so those variants are combined into a single requirement before topping up nextOptics -
    // otherwise each raw-key group is topped up independently and produces duplicate/undercounted lines.
    const resolvedOpticsNeeded: Record<string, number> = {};
    Object.entries(tapOpticsNeeded).forEach(([rawOptic, qty]) => {
      const targetOptic = resolveOpticForChassis(rawOptic, chassisModel);
      resolvedOpticsNeeded[targetOptic] = (resolvedOpticsNeeded[targetOptic] || 0) + qty;
    });

    Object.entries(resolvedOpticsNeeded).forEach(([targetOptic, qty]) => {
      const targetSku = resolveOpticSku(targetOptic, chassisModel);

      // Only a *pinned* entry claims a specific, already-spoken-for port, so
      // only pinned entries offset how many auto-added units are still
      // needed. A plain aggregate (non-pinned) manual entry of the same optic
      // type doesn't necessarily exist for this TAP requirement at all - it
      // might be there to cover a completely different link (a SPAN/ERSPAN/
      // VMware feed, which this function never counts a requirement for in
      // the first place). Counting it here used to let it silently cannibalise
      // the auto-added pool: adding one more unit to fix a "missing
      // transceiver" on such a link left the net total unchanged, since the
      // auto portion just shrank by the same amount on the next sync.
      const existingQty = nextOptics
        .filter(o => o.pinnedPortId && (o.optic === targetOptic || resolveOpticSku(o.optic, chassisModel) === targetSku))
        .reduce((sum, o) => sum + o.qty, 0);

      if (existingQty < qty) {
        nextOptics.push({ board: chassisMainBoard, optic: targetOptic, qty: qty - existingQty, isAutoAdded: true });
        changed = true;
      }
    });

    return changed ? { ...node, data: { ...node.data, optics: nextOptics } } : node;
  });
}

/**
 * Dependency rows are inferred by scanning a SKU's description for phrases like
 * "requires X". That heuristic also catches plain prose that merely looks like a
 * part number - e.g. the GSA's "requires a separate GigaVUE-OS license" yields
 * "GigaVUE-OS", which isn't orderable (the GVOS licence is quoted explicitly as
 * GVS-GSA110-SW-TM), and several TA upgrade SKUs yield "Elite-Plus". Requiring
 * the token to be a real catalogue SKU drops those without touching the ~75
 * genuine dependencies, which all resolve. TAP trays and CLS-TAX20E are
 * separately excluded because they're quoted by their own aggregate logic.
 */
function isQuotableDependency(depSku: string, skus: Record<string, string>): boolean {
  if (!skus[depSku]) return false;
  // TAP trays are pooled across all the modules at a site rather than quoted
  // once per module, so they must not also be picked up from the "requires
  // TAP-M202ULT chassis" phrasing in a module's own description.
  if (depSku === 'TAP-M100T' || depSku === 'TAP-M200T' || depSku === ULT_TRAY_SKU) return false;
  return !depSku.includes('CLS-TAX20E');
}

export function generateBom(
  nodes: CustomNode[],
  edges: Edge[],
  globalLicenseMode: 'HTL' | 'Perpetual',
  globalTermDuration: string,
  globalRegion: 'US' | 'EU' | 'UK' = 'US',
  groupByNode: boolean = false,
  peakNodeRxMbps: Record<string, number> = {}
): BomRow[] {
  const syncedNodes = syncOpticsOnTapConnection(nodes, edges);
  const rowMap: Record<string, BomRow> = {};
  const skus = getSkus();
  const tapModulesPerSite: Record<string, number> = {};
  const ultTapModulesPerSite: Record<string, number> = {};
  const series1RackTapsPerSite: Record<string, number> = {};
  const series1PstAcTapsPerSite: Record<string, number> = {};
  const series1PstDcTapsPerSite: Record<string, number> = {};

  const addRow = (nodeId: string | null, sku: string, qty: number, type: BomRow['type'], term?: string, overrideSite?: string, linkType?: BomRow['linkType']) => {
    const description = skus[sku] || 'Unknown SKU';
    const reqMatch = description.match(/(?:requires|Must also add|Needs)\s+(?:.*?)([A-Z0-9]+-[A-Z0-9-]+)(?:\s|\)|\.|$)/i);
    const node = nodeId ? nodes.find(n => n.id === nodeId) : null;
    const site = overrideSite || (node?.data?.site as string) || 'Unassigned';
    const key = ((groupByNode && nodeId) ? `${nodeId}_${sku}` : `${site}_${sku}`) + (linkType ? `__${linkType}` : '');

    if (rowMap[key]) rowMap[key].qty += qty;
    else rowMap[key] = { sku, qty, description, term, type, nodeId: groupByNode ? (nodeId || 'global') : undefined, site, linkType };

    if (reqMatch && reqMatch[1]) {
      const depSku = reqMatch[1];
      if (isQuotableDependency(depSku, skus)) {
        const depTerm = depSku.endsWith('-SW-TM') ? (term || globalTermDuration) : undefined;
        const depKey = (groupByNode && nodeId) ? `${nodeId}_${depSku}` : `${site}_${depSku}`;
        if (rowMap[depKey]) rowMap[depKey].qty += qty;
        else rowMap[depKey] = { sku: depSku, qty, description: skus[depSku], term: depTerm, type: 'Dependency', nodeId: groupByNode ? (nodeId || 'global') : undefined, site };
      }
    }
  };

  syncedNodes.forEach(node => {
    if (node.type === 'toolNode') {
      if (node.data?.toolName === 'GigaSMART Appliance') {
        const termOverride = (node.data?.termDurationOverride as string) || globalTermDuration;
        const power = (node.data?.powerSupply as string) || 'AC';
        if (globalLicenseMode === 'HTL') {
          addRow(node.id, resolveGsaChassisSku(power, 'HTL'), 1, 'Chassis');
          addRow(node.id, 'GVS-GSA110-SW-TM', 1, 'License', termOverride);
        } else {
          addRow(node.id, resolveGsaChassisSku(power, 'Perpetual'), 1, 'Chassis');
        }
        const peakMbps = peakNodeRxMbps[node.id];
        const licensableMbps = (typeof peakMbps === 'number' && peakMbps > 0)
          ? peakMbps
          : ((node.data?.ingestLimitMbps as number) || getDefaultIngestLimitMbps('GigaSMART Appliance'));
        const appLicenseQty = resolveGsaAppLicenseQty(licensableMbps);
        ((node.data?.gigaSmartApps as { actionType?: string; gsa5gDecode?: boolean }[]) || []).forEach(app => {
          const sku = resolveGsaAppLicenseSku(app.actionType || '', globalLicenseMode, !!app.gsa5gDecode);
          if (sku) addRow(node.id, sku, appLicenseQty, 'License', globalLicenseMode === 'HTL' ? termOverride : undefined);
        });
        return;
      }

      const isPacketTool = node.data?.configType === 'Packet Tool';
      const optic = (node.data?.ingestOptic as string) || '';
      const isCustomerSupplied = optic.includes('Customer Supplied');
      if (!isPacketTool && !isCustomerSupplied) {
        const qty = parseInt(node.data?.ingestOpticQty as string || '0');
        if (optic && qty > 0) addRow(node.id, resolveOpticSku(optic, ''), qty, 'Optic');
      }
      return;
    }
    if (node.type !== 'hardwareNode') return;

    const model = (node.data?.model as string) || '';
    // TAP-M100T/M200T/M202ULT trays are auto-generated placement aids (see
    // traySync.ts) - the tapModulesPerSite/ultTapModulesPerSite math below
    // already accounts for exactly how many are needed, so a tray that exists
    // as a real node here would otherwise double up its own BOM row on top.
    if (isAutoTrayModel(model)) return;
    const termOverride = (node.data?.termDurationOverride as string) || globalTermDuration;
    const licenseMode = (node.data?.licenseModeOverride as string && node.data?.licenseModeOverride !== 'default') ? node.data?.licenseModeOverride as 'HTL' | 'Perpetual' : globalLicenseMode;
    const resolved = resolveNodeSkus((node.data as HardwareNodeSkuData) || {}, globalLicenseMode);

    if (model.includes('TAP')) {
      addRow(node.id, resolved.hwSku, 1, 'TAP');
      const tapMode = (node.data?.tapMode as string) || 'Passive';
      if (model.includes('G-TAP A-SF') || model.includes('ASF2')) {
        if (tapMode === 'Active') {
          const cuCount = Number(node.data?.activeTapCopperSfpCount) || 0;
          const fiCount = Number(node.data?.activeTapFiberSfpCount) || 0;
          if (cuCount > 0) {
            const fallbackOptic = (node.data?.tappedLinkOptic as string) || 'SFP-501';
            addRow(node.id, (fallbackOptic.includes('TAA') || fallbackOptic.includes('T')) ? 'SFP-501T' : 'SFP-501', cuCount, 'Optic', undefined, undefined, 'tap-termination');
          }
          if (fiCount > 0) addRow(node.id, resolveOpticSku((node.data?.tappedLinkOptic as string) || 'SFP-532', ''), fiCount, 'Optic', undefined, undefined, 'tap-termination');
        } else {
          const allocations = (node.data?.tappedLinkAllocations as { qty: number, optic: string, toolOptic?: string }[]) || [];
          if (allocations.length > 0) {
            allocations.forEach(alloc => {
              addRow(node.id, resolveOpticSku(alloc.optic, ''), 2 * alloc.qty, 'Optic', undefined, undefined, 'tap-termination');
              addRow(node.id, resolveOpticSku(alloc.toolOptic || alloc.optic, ''), 2 * alloc.qty, 'Optic', undefined, undefined, 'tap-termination');
            });
          } else addRow(node.id, resolveOpticSku((node.data?.tappedLinkOptic as string) || 'SFP-532', ''), 4, 'Optic', undefined, undefined, 'tap-termination');
        }
      }
      const isSeries2 = model.includes('SF2') || model.includes('TX2');
      const isSeries1 = !isSeries2 && (model.includes('A-SF') || model.includes('A-TX'));
      const siteKey = (node.data?.site as string) || 'Unassigned';
      if (isSeries1) {
        const tapRackMount = (node.data.tapRackMount as string) || 'RMT-GTA03 (3-bay Rack Tray)';
        const tapPower = (node.data.tapPower as string) || 'Individual Power Brick';
        if (tapRackMount === 'RMT-GTA03 (3-bay Rack Tray)') series1RackTapsPerSite[siteKey] = (series1RackTapsPerSite[siteKey] || 0) + 1;
        if (tapPower === 'PST-GTA01 (AC Power Tray)') series1PstAcTapsPerSite[siteKey] = (series1PstAcTapsPerSite[siteKey] || 0) + 1;
        else if (tapPower === 'PST-GTA02 (DC Power Tray)') series1PstDcTapsPerSite[siteKey] = (series1PstDcTapsPerSite[siteKey] || 0) + 1;
      } else if (isSeries2) {
        if (node.data.tapDualPower) addRow(node.id, 'PBK-GTA21', 1, 'Dependency');
        if (node.data.tapBattery) addRow(node.id, 'BAT-GTA20', 1, 'Dependency');
        const cordSku = globalRegion === 'EU' ? 'PCD-00A23' : (globalRegion === 'UK' ? 'PCD-00A25' : 'PCD-00A21');
        const cordQty = (globalRegion !== 'US' ? (node.data.tapDualPower ? 2 : 1) : (node.data.tapDualPower ? 1 : 0)) + (node.data.tapExtraPowerCord ? 1 : 0);
        if (cordQty > 0) addRow(node.id, cordSku, cordQty, 'Dependency');
      }
      if (hardwareCatalogue.taps.find(t => t.sku === resolved.hwSku)?.type === 'module') {
        const pool = requiresUltTray(resolved.hwSku, model) ? ultTapModulesPerSite : tapModulesPerSite;
        pool[siteKey] = (pool[siteKey] || 0) + 1;
      }
      return;
    }

    if (isBreakoutPanelModel(model)) {
      // A passive MPO breakout panel: one BOM row for itself, and it pools into
      // the same tap-tray bin-packing as real tap modules below (it shares tray
      // bays with them - see traySync.ts).
      addRow(node.id, resolved.hwSku, 1, 'Module');
      const siteKey = (node.data?.site as string) || 'Unassigned';
      const pool = requiresUltTray(resolved.hwSku, model) ? ultTapModulesPerSite : tapModulesPerSite;
      pool[siteKey] = (pool[siteKey] || 0) + 1;
      return;
    }

    addRow(node.id, resolved.hwSku, 1, 'Chassis');
    if (resolved.swSku) addRow(node.id, resolved.swSku, 1, 'License', termOverride);
    if (model.includes('TA400') && node.data?.portCapacity === 'Upgrade') addRow(node.id, globalLicenseMode === 'HTL' ? 'UPG-TAC40EA-SW-TM' : 'UPG-TAC40EA', 1, 'License', globalLicenseMode === 'HTL' ? termOverride : undefined);
    // TA200/TA200E ship licensed for 32 of their 64 QSFP28 ports by default -
    // going to Full (64 ports) needs a separate UPG-TAC20(E)(-SW-TM) add-on
    // license. See the matching comment in generateSingleNodeBom below and in
    // skuResolver.ts.
    if (model.includes('TA200') && ((node.data?.portCapacity as string) || 'Full') === 'Full') {
      const upgBase = model.includes('TA200E') ? 'UPG-TAC20E' : 'UPG-TAC20';
      addRow(node.id, globalLicenseMode === 'HTL' ? `${upgBase}-SW-TM` : upgBase, 1, 'License', globalLicenseMode === 'HTL' ? termOverride : undefined);
    }
    if (model.includes('TA') || model.includes('HC')) {
      const psuQty = (model.includes('HC3') && node.data?.psuCount === 4) ? 4 : 2;
      if (node.data?.powerSupply === 'DC') addRow(node.id, 'PCD-00051', psuQty, 'Dependency');
      else addRow(node.id, globalRegion === 'EU' ? 'PCD-00003' : (globalRegion === 'UK' ? 'PCD-00005' : 'PCD-00001'), psuQty, 'Dependency');
    }
    if (resolved.advSku) addRow(node.id, resolved.advSku, 1, 'License', resolved.advSku.includes('-SW-TM') ? termOverride : undefined);
    Object.values((node.data?.installedBoards as Record<string, string>) || {}).forEach(boardSku => {
      if (!boardSku || boardSku.toLowerCase().includes('base')) return;
      if (licenseMode === 'HTL') { addRow(node.id, boardSku + '-HW', 1, 'Module'); addRow(node.id, boardSku + '-SW-TM', 1, 'License', termOverride); }
      else addRow(node.id, boardSku, 1, 'Module');
    });
    ((node.data?.optics as { board: string, optic: string, qty: number, isAutoAdded?: boolean }[]) || []).forEach(opt => {
      if (!opt.optic) return;
      // Only optics auto-added by syncOpticsOnTapConnection actually terminate a TAP link
      // (northbound+southbound pair) - manually configured board optics may serve uplinks,
      // GigaSMART appliance links, or other non-TAP purposes and must not be halved with them.
      addRow(node.id, resolveOpticSku(opt.optic, model), opt.qty, 'Optic', undefined, undefined, opt.isAutoAdded ? 'tap-termination' : undefined);
    });

    if (model.includes('HC')) {
      const gsApps = resolveGsAppsFromGraph(node.id, node.data?.gigaSmartApps as { actionType?: string; gtpSamplePercent?: number }[], edges, syncedNodes);
      resolveGsLicenseSkus(gsApps, model, licenseMode).forEach(gsSku => {
        addRow(node.id, gsSku, 1, 'License', licenseMode === 'HTL' ? termOverride : undefined);
      });
    }
  });

  // Tray quantities are bin-packed once, shared with traySync.ts's Rack View
  // tray-node generator, so tap modules and breakout panels (which pool into
  // the same tapModulesPerSite above) always agree on how many trays they need.
  const trayTargetsPerSite = packTapTrayTargets(tapModulesPerSite, ultTapModulesPerSite);
  Object.entries(trayTargetsPerSite).forEach(([siteKey, targets]) => {
    Object.entries(targets).forEach(([traySku, qty]) => {
      if (qty > 0) addRow(null, traySku, qty, 'Dependency', undefined, siteKey);
    });
  });

  const getChassisMaxOpticSpeed = (chassisModel: string): '100G' | '40G' | '10G' => {
    const rules = (opticRules as Record<string, Record<string, string[]>>)[chassisModel];
    if (!rules) return '10G';
    let has100G = false, has40G = false;
    for (const group of Object.values(rules)) { if (Array.isArray(group)) { for (const opt of group) { if (opt.includes('100G')) has100G = true; if (opt.includes('40G')) has40G = true; } } }
    return has100G ? '100G' : (has40G ? '40G' : '10G');
  };

  const findOpticSkuForSpeed = (chassisModel: string, speed: '100G' | '40G' | '10G'): string | null => {
    const rules = (opticRules as Record<string, Record<string, string[]>>)[chassisModel];
    if (!rules) return null;
    for (const group of Object.values(rules)) if (Array.isArray(group)) for (const opt of group) if (opt.includes(speed) && (opt.includes('SR') || opt.includes('SX') || opt.includes('SR4'))) return opt.split(' ')[0];
    for (const group of Object.values(rules)) if (Array.isArray(group)) for (const opt of group) if (opt.includes(speed)) return opt.split(' ')[0];
    return null;
  };

  edges.forEach(edge => {
    const sourceNode = syncedNodes.find(n => n.id === edge.source), targetNode = syncedNodes.find(n => n.id === edge.target);
    if (sourceNode?.type === NODE_TYPES.HARDWARE && targetNode?.type === NODE_TYPES.HARDWARE) {
      const srcModel = String(sourceNode.data?.model || ''), dstModel = String(targetNode.data?.model || '');
      if ((srcModel.includes('TA') && !srcModel.includes('TAP') && dstModel.includes('HC')) || (srcModel.includes('HC') && dstModel.includes('TA') && !dstModel.includes('TAP'))) {
        const srcSpeed = getChassisMaxOpticSpeed(srcModel), dstSpeed = getChassisMaxOpticSpeed(dstModel);
        const mutualSpeed: '100G' | '40G' | '10G' = (srcSpeed === '100G' && dstSpeed === '100G') ? '100G' : ((srcSpeed === '100G' && dstSpeed === '40G' || srcSpeed === '40G' && dstSpeed === '100G' || srcSpeed === '40G' && dstSpeed === '40G') ? '40G' : '10G');
        const srcOpticSku = findOpticSkuForSpeed(srcModel, mutualSpeed), dstOpticSku = findOpticSkuForSpeed(dstModel, mutualSpeed);
        if (srcOpticSku) addRow(sourceNode.id, srcOpticSku, 1, 'Optic');
        if (dstOpticSku) addRow(targetNode.id, dstOpticSku, 1, 'Optic');
      }
    }
  });

  for (const [siteKey, series1RackTaps] of Object.entries(series1RackTapsPerSite)) if (series1RackTaps > 0) addRow(null, 'RMT-GTA03', Math.ceil(series1RackTaps / 3), 'Dependency', undefined, siteKey);
  for (const [siteKey, series1PstAcTaps] of Object.entries(series1PstAcTapsPerSite)) if (series1PstAcTaps > 0) {
    const numPstAC = Math.ceil(series1PstAcTaps / 24);
    addRow(null, 'PST-GTA01', numPstAC, 'Dependency', undefined, siteKey);
    addRow(null, globalRegion === 'EU' ? 'PCD-00A23' : (globalRegion === 'UK' ? 'PCD-00A25' : 'PCD-00A21'), numPstAC * 2, 'Dependency', undefined, siteKey);
  }
  for (const [siteKey, series1PstDcTaps] of Object.entries(series1PstDcTapsPerSite)) if (series1PstDcTaps > 0) {
    const numPstDC = Math.ceil(series1PstDcTaps / 24);
    addRow(null, 'PST-GTA02', numPstDC, 'Dependency', undefined, siteKey);
    addRow(null, 'PCD-00051', numPstDC * 2, 'Dependency', undefined, siteKey);
  }

  // Deliberately NOT pack-optimized here - a multipack is a physical box of
  // loose transceivers, not tied to any one node/site, so rolling packs in at
  // this per-node/per-site granularity would misleadingly attribute a shared
  // pack to whichever node happened to push the count over the line. Callers
  // that want the actual whole-project order (BomModal's Master tab, the PDF
  // report's Appendix A) run these raw rows through
  // `buildProjectWideOpticBom()` themselves after aggregating across nodes.
  return Object.values(rowMap).sort((a, b) => a.type.localeCompare(b.type) || a.sku.localeCompare(b.sku));
}

// ─── Shared GigaSMART helpers ─────────────────────────────────────────────────

/** Resolve the GigaSMART licence SKU for a given action + chassis model + licence mode */
function resolveGigaSmartSku(
  action: string,
  model: string,
  licenseMode: 'HTL' | 'Perpetual',
): string {
  const isHtl = licenseMode === 'HTL';
  const isHc1Plain = model.includes('HC1') && !model.includes('HC1-Plus') && !model.includes('HC1P');
  const isHc1Plus = model.includes('HC1-Plus') || model.includes('HC1P');
  const isHc3 = model.includes('HC3');

  switch (action) {
    case 'Deduplication':
      if (isHc1Plain) return isHtl ? 'SMT-HC1-GEN2-DD1-SW-TM' : 'SMT-HC1-DD1';
      if (isHc1Plus) return isHtl ? 'SMT-HC1P-GEN3-DD1-SW-TM' : 'SMT-HC1P-GEN3-DD1-PL';
      if (isHc3) return isHtl ? 'SMT-HC3-GEN3-DD1-SW-TM' : 'SMT-HC3-GEN3-DD1';
      return '';
    case 'SSL Decrypt':
      if (isHc1Plain) return isHtl ? 'SMT-HC1-GEN2-INSSL-SW-TM' : 'SMT-HC1-INSSL';
      if (isHc1Plus) return isHtl ? 'SMT-HC1P-GEN3-INSSL-SW-TM' : 'SMT-HC1P-GEN3-INSSL-PL';
      if (isHc3) return isHtl ? 'SMT-HC3-GEN3-INSSL-SW-TM' : 'SMT-HC3-GEN3-INSSL-PL';
      return '';
    case 'Masking':
      if (isHc1Plain) return isHtl ? 'SMT-HC1-GEN2-BSE-SW-TM' : 'SMT-HC1-BSE';
      if (isHc1Plus) return ''; // Masking is included in the HC1 Plus base license
      if (isHc3) return isHtl ? 'SMT-HC3-GEN3-APF-SW-TM' : 'SMT-HC3-GEN3-APF';
      return '';
    case 'Packet Slicing':
    case 'Slicing':
      if (isHc1Plain) return isHtl ? 'SMT-HC1-GEN2-BSE-SW-TM' : 'SMT-HC1-BSE';
      if (isHc1Plus) return ''; // Packet Slicing is included in the HC1 Plus base license
      if (isHc3) return isHtl ? 'SMT-HC3-GEN3-APF-SW-TM' : 'SMT-HC3-GEN3-APF';
      return '';
    case 'Advanced Flow Slicing':
    case 'AFS':
      if (isHc1Plain) return isHtl ? 'SMT-HC1-GEN2-AFS-SW-TM' : 'SMT-HC1-AFS';
      if (isHc1Plus) return isHtl ? 'SMT-HC1P-GEN3-AFS-SW-TM' : 'SMT-HC1P-GEN3-AFS-PL';
      if (isHc3) return isHtl ? 'SMT-HC3-GEN3-AFS-SW-TM' : 'SMT-HC3-GEN3-AFS-PL';
      return '';
    case 'Header Stripping':
      if (isHc1Plain) return isHtl ? 'SMT-HC1-GEN2-HS1-SW-TM' : 'SMT-HC1-HS1';
      if (isHc1Plus) return isHtl ? 'SMT-HC1P-GEN3-HS1-SW-TM' : 'SMT-HC1P-GEN3-HS1-PL';
      if (isHc3) return isHtl ? 'SMT-HC3-GEN3-HS1-SW-TM' : 'SMT-HC3-GEN3-HS1-PL';
      return '';
    case 'Application Metadata':
    case 'AMX':
    case 'AMI':
      if (isHc1Plain) return isHtl ? 'SMT-HC1-GEN2-AMI-SW-TM' : 'SMT-HC1-AMI';
      if (isHc1Plus) return isHtl ? 'SMT-HC1P-GEN3-AMI-SW-TM' : 'SMT-HC1P-GEN3-AMI-PL';
      if (isHc3) return isHtl ? 'SMT-HC3-GEN3-AMI-SW-TM' : 'SMT-HC3-GEN3-AMI';
      return '';
    case 'IP FlowVUE':
      if (isHc1Plain) return isHtl ? 'SMT-HC1-GEN2-FVU-SW-TM' : 'SMT-HC1-FVU';
      if (isHc1Plus) return isHtl ? 'SMT-HC1P-GEN3-FVU-SW-TM' : 'SMT-HC1P-GEN3-FVU-PL';
      if (isHc3) return isHtl ? 'SMT-HC3-GEN3-FVU-SW-TM' : 'SMT-HC3-GEN3-FVU';
      return '';
    // GTP Filtering, Whitelisting and Sampling all draw on the same "maximum
    // subscribers" GTP Filtering & Correlation licence - Gigamon doesn't sell
    // them as separate SKUs. Not offered on plain HC1 (see GIGASMART_MATRIX).
    case 'GTP Flow Filtering':
    case 'GTP Rotational Sampling':
    case 'GTP Whitelisting':
    case 'GTP Flow Sampling':
      if (isHc1Plus) return isHtl ? 'SMT-HC1P-GEN3-GTPMAX-SW-TM' : 'SMT-HC1P-GEN3-GTPMAX-PL';
      if (isHc3) return isHtl ? 'SMT-HC3-GEN3-GTPMAX-SW-TM' : 'SMT-HC3-GEN3-GTPMAX';
      return '';
    case 'Tunneling':
    case 'Tunneling (ERSPAN Decap)':
    case 'ERSPAN Tunnel Decapsulation':
    case 'L2GRE Tunnel Decapsulation':
    case 'VXLAN Tunnel Decapsulation':
    case 'GRE-In-UDP Tunnel Decapsulation':
    case 'L2GRE Tunnel Encapsulation':
    case 'VXLAN Tunnel Encapsulation':
    case 'TCP Tunnel':
    case 'Secure Tunnels':
      if (isHc1Plain) return isHtl ? 'SMT-HC1-GEN2-TUN-SW-TM' : 'SMT-HC1-TUN';
      if (isHc1Plus) return isHtl ? 'SMT-HC1P-GEN3-TUN-SW-TM' : 'SMT-HC1P-GEN3-TUN-PL';
      if (isHc3) return isHtl ? 'SMT-HC3-GEN3-TUN-SW-TM' : 'SMT-HC3-GEN3-TUN';
      return isHtl ? 'SMT-HC1-GEN2-TUN-SW-TM' : 'SMT-HC1-TUN';
    default:
      return '';
  }
}

/**
 * True when `action` needs a separate FlowVUE entitlement alongside its own
 * licence, on the same Gen3 GigaSMART card. Per Gigamon's KB, GTPMAX and
 * FlowVUE are independent entitlements that can both be licensed on one
 * card: GTP whitelisting always needs both, and GTP flow sampling needs both
 * for any sample rate strictly between 0% and 100% - a 0% or 100% rate
 * needs GTPMAX alone. Unset `gtpSamplePercent` is treated as 100% (no
 * sampling reduction configured yet), matching every other GigaSMART app's
 * "no additional configuration required" default.
 */
function needsFlowVueAlongsideGtp(action: string, gtpSamplePercent: number | undefined): boolean {
  if (action === 'GTP Whitelisting') return true;
  if (action === 'GTP Flow Sampling') {
    const pct = gtpSamplePercent ?? 100;
    return pct > 0 && pct < 100;
  }
  return false;
}

/** Resolve the GVS-GSA110 chassis SKU for the GigaSMART Appliance (GSA), by power supply + licence mode */
function resolveGsaChassisSku(power: string, licenseMode: 'HTL' | 'Perpetual'): string {
  const base = power === 'DC' ? 'GVS-GSA110-2DC' : 'GVS-GSA110-2AC';
  return licenseMode === 'HTL' ? `${base}-HW` : base;
}

/**
 * Each SMT-GSA110-*-100G-* app licence only covers 100 Gbps of throughput -
 * pushing more traffic through the appliance requires that many more licences
 * of the same SKU (e.g. 400 Gbps needs 4x the AMI licence), not just one. The
 * base GVOS chassis licence (GVS-GSA110-SW-TM) isn't capacity-tiered this way,
 * so it's excluded from this calculation.
 *
 * Sized off the traffic actually delivered to the appliance, not its fixed
 * hardware ingest ceiling - the ceiling is a worst-case ports limit, but
 * licences only need to cover what's really flowing through it. Callers pass
 * the session's *peak* rxMbps rather than the live figure, so a quote never
 * shrinks just because traffic dipped when the BOM happened to be opened,
 * and fall back to the ingest ceiling before any simulation has run so the
 * BOM isn't a misleading 1x before anyone hits Run.
 */
function resolveGsaAppLicenseQty(licensableMbps: number): number {
  const licenseCapacityMbps = 100000; // 100 Gbps per licence
  return Math.max(1, Math.ceil(licensableMbps / licenseCapacityMbps));
}

/**
 * Resolve a GigaSMART Appliance (GSA) app licence SKU. Only AMI, AFI, and
 * Deduplication have known SMT-GSA110-* licence SKUs so far - AMX and AppViz
 * return '' (not yet billed) until those SKUs are confirmed.
 */
function resolveGsaAppLicenseSku(
  action: string,
  licenseMode: 'HTL' | 'Perpetual',
  is5gDecode: boolean,
): string {
  const isHtl = licenseMode === 'HTL';
  switch (action) {
    case 'AMI':
      if (is5gDecode) return isHtl ? 'SMT-GSA110-AMI-5G-100G-SW-TM' : 'SMT-GSA110-AMI-5G-100G-PL';
      return isHtl ? 'SMT-GSA110-AMI-100G-SW-TM' : 'SMT-GSA110-AMI-100G-PL';
    case 'Application Filtering Intelligence':
      return isHtl ? 'SMT-GSA110-AFI-100G-SW-TM' : 'SMT-GSA110-AFI-100G-PL';
    case 'Deduplication':
      return isHtl ? 'SMT-GSA110-DD-100G-SW-TM' : 'SMT-GSA110-DD-100G-PL';
    default:
      return '';
  }
}

interface GsAppRef {
  actionType: string;
  gtpSamplePercent?: number;
}

/**
 * Walk the graph from a given HC node and collect all GigaSMART apps (as full
 * refs, not just action-type strings) - callers that need per-app config,
 * like GTP Flow Sampling's percentage, need more than the bare action name.
 * Deduped by actionType, first occurrence wins.
 */
function resolveGsAppsFromGraph(
  nodeId: string,
  localApps: { actionType?: string; gtpSamplePercent?: number }[] | undefined,
  edges: Edge[],
  nodes: CustomNode[],
): GsAppRef[] {
  const apps: GsAppRef[] = [];
  const seen = new Set<string>();
  const addApp = (actionType: string | undefined, gtpSamplePercent: number | undefined) => {
    if (!actionType || seen.has(actionType)) return;
    seen.add(actionType);
    apps.push({ actionType, gtpSamplePercent });
  };

  if (Array.isArray(localApps)) localApps.forEach((app) => addApp(app.actionType, app.gtpSamplePercent));

  const visited = new Set<string>([nodeId]);
  const queue = [nodeId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    edges.filter(e => e.source === currentId).forEach(e => {
      if (!visited.has(e.target)) {
        visited.add(e.target);
        const targetNode = nodes.find(n => n.id === e.target);
        if (targetNode) {
          if (targetNode.type === 'gigaSmartNode' && targetNode.data?.actionType) {
            addApp(targetNode.data.actionType as string, targetNode.data?.gtpSamplePercent as number | undefined);
          }
          if (targetNode.type !== 'hardwareNode') queue.push(e.target);
        }
      }
    });
  }
  return apps;
}

/**
 * Resolve the full, deduplicated set of GigaSMART licence SKUs a node's apps
 * need - including a FlowVUE entitlement implied by GTP whitelisting/sampling
 * even when the user hasn't separately dropped an IP FlowVUE app (and without
 * double-counting it when they have, since this is a Set).
 */
function resolveGsLicenseSkus(apps: GsAppRef[], model: string, licenseMode: 'HTL' | 'Perpetual'): Set<string> {
  const skus = new Set<string>();
  apps.forEach((app) => {
    const sku = resolveGigaSmartSku(app.actionType, model, licenseMode);
    if (!sku) return; // Chassis doesn't support this action at all - no implied FlowVUE either.
    skus.add(sku);
    if (needsFlowVueAlongsideGtp(app.actionType, app.gtpSamplePercent)) {
      const fvuSku = resolveGigaSmartSku('IP FlowVUE', model, licenseMode);
      if (fvuSku) skus.add(fvuSku);
    }
  });
  return skus;
}

export function generateSingleNodeBom(
  node: CustomNode,
  globalLicenseMode: 'HTL' | 'Perpetual',
  globalTermDuration: string,
  globalRegion: 'US' | 'EU' | 'UK' = 'US',
  edges: Edge[] = [],
  nodes: CustomNode[] = [],
  peakRxMbps?: number
): BomRow[] {
  const rowMap: Record<string, BomRow> = {};
  const skus = getSkus();
  const addRow = (sku: string, qty: number, type: BomRow['type'], term?: string, linkType?: BomRow['linkType']) => {
    let description = skus[sku] || 'Unknown SKU';
    const purpose = type === 'Chassis' ? 'Base hardware chassis required to host modules and aggregate traffic.' : (type === 'Module' ? 'Hardware line card or module installed in the chassis to provide additional ports or compute resources.' : (type === 'Optic' ? 'Transceiver required to connect physical fiber or copper links to the system.' : (type === 'TAP' ? 'Network TAP used to passively mirror traffic from live network links without disruption.' : (type === 'License' ? 'Software license required to enable features, advanced processing (GigaSMART), or hardware functionality.' : (type === 'Dependency' ? 'Mandatory accessory (e.g., power cord, rack mount) required for proper installation and operation.' : '')))));
    if (purpose) description += ` | Purpose: ${purpose}`;
    const reqMatch = description.match(/(?:requires|Must also add|Needs)\s+(?:.*?)([A-Z0-9]+-[A-Z0-9-]+)(?:\s|\)|\.|$)/i);
    const key = sku + (linkType ? `__${linkType}` : '');
    if (rowMap[key]) rowMap[key].qty += qty;
    else rowMap[key] = { sku, qty, description, term, type, linkType };
    if (reqMatch && reqMatch[1]) {
      const depSku = reqMatch[1];
      if (isQuotableDependency(depSku, skus)) {
        if (rowMap[depSku]) rowMap[depSku].qty += qty;
        else rowMap[depSku] = { sku: depSku, qty, description: skus[depSku] + ' | Purpose: Mandatory accessory (e.g., power cord, rack mount) required for proper installation and operation.', term: depSku.endsWith('-SW-TM') ? (term || globalTermDuration) : undefined, type: 'Dependency' };
      }
    }
  };

  const model = (node.data?.model as string) || '', termOverride = (node.data?.termDurationOverride as string) || globalTermDuration, licenseMode = (node.data?.licenseModeOverride as string && node.data?.licenseModeOverride !== 'default') ? node.data?.licenseModeOverride as 'HTL' | 'Perpetual' : globalLicenseMode;
  if (node.type === 'toolNode') {
    if (node.data?.toolName === 'GigaSMART Appliance') {
      const power = (node.data?.powerSupply as string) || 'AC';
      if (licenseMode === 'HTL') {
        addRow(resolveGsaChassisSku(power, 'HTL'), 1, 'Chassis');
        addRow('GVS-GSA110-SW-TM', 1, 'License', termOverride);
      } else {
        addRow(resolveGsaChassisSku(power, 'Perpetual'), 1, 'Chassis');
      }
      const licensableMbps = (typeof peakRxMbps === 'number' && peakRxMbps > 0)
        ? peakRxMbps
        : ((node.data?.ingestLimitMbps as number) || getDefaultIngestLimitMbps('GigaSMART Appliance'));
      const appLicenseQty = resolveGsaAppLicenseQty(licensableMbps);
      ((node.data?.gigaSmartApps as { actionType?: string; gsa5gDecode?: boolean }[]) || []).forEach(app => {
        const sku = resolveGsaAppLicenseSku(app.actionType || '', licenseMode, !!app.gsa5gDecode);
        if (sku) addRow(sku, appLicenseQty, 'License', licenseMode === 'HTL' ? termOverride : undefined);
      });
      return optimizeOpticPacks(Object.values(rowMap), skus);
    }

    const isPacketTool = node.data?.configType === 'Packet Tool', optic = (node.data?.ingestOptic as string) || '', isCustomerSupplied = optic.includes('Customer Supplied');
    if (!isPacketTool && !isCustomerSupplied) {
      const qty = parseInt(node.data?.ingestOpticQty as string || '0');
      if (optic && qty > 0) addRow(resolveOpticSku(optic, ''), qty, 'Optic');
    }
    return optimizeOpticPacks(Object.values(rowMap), skus);
  }

  const resolved = resolveNodeSkus((node.data as HardwareNodeSkuData) || {}, globalLicenseMode);
  if (model.includes('TAP')) {
    addRow(resolved.hwSku, 1, 'TAP');
    if (model.includes('G-TAP A-SF') || model.includes('ASF2')) {
      const allocations = (node.data?.tappedLinkAllocations as { qty: number, optic: string, toolOptic?: string }[]) || [];
      if (allocations.length > 0) allocations.forEach(alloc => { addRow(resolveOpticSku(alloc.optic, ''), 2 * alloc.qty, 'Optic', undefined, 'tap-termination'); addRow(resolveOpticSku(alloc.toolOptic || alloc.optic, ''), 2 * alloc.qty, 'Optic', undefined, 'tap-termination'); });
      else addRow(resolveOpticSku((node.data?.tappedLinkOptic as string) || 'SFP-532', ''), 4, 'Optic', undefined, 'tap-termination');
    }
    const isSeries2 = model.includes('SF2') || model.includes('TX2'), isSeries1 = !isSeries2 && (model.includes('A-SF') || model.includes('A-TX'));
    if (isSeries1) {
      if (((node.data.tapRackMount as string) || 'RMT-GTA03 (3-bay Rack Tray)') === 'RMT-GTA03 (3-bay Rack Tray)') addRow('RMT-GTA03', 1, 'Dependency');
      const tapPower = (node.data.tapPower as string) || 'Individual Power Brick';
      if (tapPower === 'Individual Power Brick') addRow(model.includes('A-TX') ? 'GTP-ATX01-UN' : 'GTP-ASF01-UN', 1, 'Dependency');
      else if (tapPower === 'PST-GTA01 (AC Power Tray)') addRow('PST-GTA01', 1, 'Dependency');
      else if (tapPower === 'PST-GTA02 (DC Power Tray)') addRow('PST-GTA02', 1, 'Dependency');
    } else if (isSeries2) {
      if (node.data.tapDualPower) addRow('PBK-GTA21', 1, 'Dependency');
      if (node.data.tapBattery) addRow('BAT-GTA20', 1, 'Dependency');
      const cordSku = globalRegion === 'EU' ? 'PCD-00A23' : (globalRegion === 'UK' ? 'PCD-00A25' : 'PCD-00A21');
      const cordQty = (globalRegion !== 'US' ? (node.data.tapDualPower ? 2 : 1) : (node.data.tapDualPower ? 1 : 0)) + (node.data.tapExtraPowerCord ? 1 : 0);
      if (cordQty > 0) addRow(cordSku, cordQty, 'Dependency');
    }
    return optimizeOpticPacks(Object.values(rowMap), skus);
  }

  if (isBreakoutPanelModel(model)) {
    // A single node's BOM preview shows no tray dependency for a standalone tap
    // module either - tray quantities are only meaningful across the whole
    // project (see generateBom's tapModulesPerSite bin-packing), so a panel
    // just gets a row for itself here.
    addRow(resolved.hwSku, 1, 'Module');
    return optimizeOpticPacks(Object.values(rowMap), skus);
  }

  addRow(resolved.hwSku, 1, 'Chassis');
  if (resolved.swSku) addRow(resolved.swSku, 1, 'License', termOverride);
  if (model.includes('TA400') && node.data?.portCapacity === 'Upgrade') addRow(globalLicenseMode === 'HTL' ? 'UPG-TAC40EA-SW-TM' : 'UPG-TAC40EA', 1, 'License', globalLicenseMode === 'HTL' ? termOverride : undefined);
  // TA200/TA200E ship licensed for 32 of their 64 QSFP28 ports by default (the
  // base GVS-TAC2[12](E)(-HW)/-SW-TM SKUs already cover that) - going to Full
  // (64 ports) is a separate UPG-TAC20(E)(-SW-TM) add-on license, not a
  // different base SKU. See the comment in skuResolver.ts for why this isn't
  // baked into resolved.swSku like TA25(E)/TA400(E)'s suffixed variants are.
  if (model.includes('TA200') && ((node.data?.portCapacity as string) || 'Full') === 'Full') {
    const upgBase = model.includes('TA200E') ? 'UPG-TAC20E' : 'UPG-TAC20';
    addRow(globalLicenseMode === 'HTL' ? `${upgBase}-SW-TM` : upgBase, 1, 'License', globalLicenseMode === 'HTL' ? termOverride : undefined);
  }
  if (model.includes('TA') || model.includes('HC')) {
    const psuQty = (model.includes('HC3') && node.data?.psuCount === 4) ? 4 : 2;
    if (node.data?.powerSupply === 'DC') addRow('PCD-00051', psuQty, 'Dependency');
    else addRow(globalRegion === 'EU' ? 'PCD-00003' : (globalRegion === 'UK' ? 'PCD-00005' : 'PCD-00001'), psuQty, 'Dependency');
  }
  if (resolved.advSku) addRow(resolved.advSku, 1, 'License', resolved.advSku.includes('-SW-TM') ? termOverride : undefined);
  Object.values((node.data?.installedBoards as Record<string, string>) || {}).forEach(boardSku => { if (!boardSku || boardSku.toLowerCase().includes('base')) return; if (licenseMode === 'HTL') { addRow(boardSku + '-HW', 1, 'Module'); addRow(boardSku + '-SW-TM', 1, 'License', termOverride); } else addRow(boardSku, 1, 'Module'); });
  ((node.data?.optics as { board: string, optic: string, qty: number, isAutoAdded?: boolean }[]) || []).forEach(opt => { if (!opt.optic) return; addRow(resolveOpticSku(opt.optic, model), opt.qty, 'Optic', undefined, opt.isAutoAdded ? 'tap-termination' : undefined); });
  if (model.includes('HC')) {
    const gsApps = resolveGsAppsFromGraph(node.id, node.data?.gigaSmartApps as { actionType?: string; gtpSamplePercent?: number }[], edges, nodes);
    resolveGsLicenseSkus(gsApps, model, licenseMode).forEach(gsSku => {
      addRow(gsSku, 1, 'License', licenseMode === 'HTL' ? termOverride : undefined);
    });
  }
  return optimizeOpticPacks(Object.values(rowMap), skus);
}

