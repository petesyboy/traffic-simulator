import { type Edge } from '@xyflow/react';
import { type CustomNode } from '../../store/types';
import { NODE_TYPES, CONFIG_TYPES } from '../../constants/nodeTypes';
import hardwareCatalogue from '../../constants/hardwareCatalogue.json';
import opticRules from '../../constants/opticRules.json';
import { resolveNodeSkus } from '../skuResolver';
import { resolveOpticSku, getSkus } from './skuUtils';

export interface BomRow {
  sku: string;
  qty: number;
  description: string;
  term?: string;
  type: 'Hardware' | 'Chassis' | 'License' | 'Support' | 'Optic' | 'Accessory' | 'TAP' | 'Module' | 'Dependency';
  nodeId?: string;
  site?: string;
}

export function syncOpticsOnTapConnection(nodes: CustomNode[], edges: Edge[]): CustomNode[] {
  return nodes.map(node => {
    if (node.type !== NODE_TYPES.HARDWARE || String(node.data?.model || '').includes('TAP')) return node;

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
          
          const allocations = (sourceNode.data?.tappedLinkAllocations as { qty: number, optic: string, toolOptic?: string }[]) || [
            { qty: (sourceNode.data?.tappedLinksCount as number) ?? 1, optic: (sourceNode.data?.tappedLinkOptic as string) || (isSMTap ? 'SFP-533' : 'SFP-532') }
          ];

          for (const alloc of allocations) {
            let selectedOpticVal = alloc.toolOptic || alloc.optic;
            if (String(sourceNode.data?.model || '').includes('TAP-M506T')) selectedOpticVal = 'QSB-523T';
            tapOpticsNeeded[selectedOpticVal] = (tapOpticsNeeded[selectedOpticVal] || 0) + alloc.qty * 2;
          }
        }
      }
    });

    const currentOptics = (node.data?.optics as { board: string, optic: string, qty: number, isAutoAdded?: boolean }[]) || [];
    const userOptics = currentOptics.filter(opt => !opt.isAutoAdded);
    const nextOptics = [...userOptics];
    let changed = currentOptics.length !== userOptics.length;

    Object.entries(tapOpticsNeeded).forEach(([optic, qty]) => {
      const existingQty = nextOptics.filter(o => o.optic === optic).reduce((sum, o) => sum + o.qty, 0);
      if (existingQty < qty) {
        nextOptics.push({ board: 'Base Ports', optic, qty: qty - existingQty, isAutoAdded: true });
        changed = true;
      }
    });

    return changed ? { ...node, data: { ...node.data, optics: nextOptics } } : node;
  });
}

export function generateBom(
  nodes: CustomNode[],
  edges: Edge[],
  globalLicenseMode: 'HTL' | 'Perpetual',
  globalTermDuration: string,
  globalRegion: 'US' | 'EU' | 'UK' = 'US',
  groupByNode: boolean = false
): BomRow[] {
  const syncedNodes = syncOpticsOnTapConnection(nodes, edges);
  const rowMap: Record<string, BomRow> = {};
  const skus = getSkus();
  const tapModulesPerSite: Record<string, number> = {};
  const series1RackTapsPerSite: Record<string, number> = {};
  const series1PstAcTapsPerSite: Record<string, number> = {};
  const series1PstDcTapsPerSite: Record<string, number> = {};

  const addRow = (nodeId: string | null, sku: string, qty: number, type: BomRow['type'], term?: string, overrideSite?: string) => {
    const description = skus[sku] || 'Unknown SKU';
    const reqMatch = description.match(/(?:requires|Must also add|Needs)\s+(?:.*?)([A-Z0-9]+-[A-Z0-9-]+)(?:\s|\)|\.|$)/i);
    const node = nodeId ? nodes.find(n => n.id === nodeId) : null;
    const site = overrideSite || (node?.data?.site as string) || 'Unassigned';
    const key = (groupByNode && nodeId) ? `${nodeId}_${sku}` : `${site}_${sku}`;
    
    if (rowMap[key]) rowMap[key].qty += qty;
    else rowMap[key] = { sku, qty, description, term, type, nodeId: groupByNode ? (nodeId || 'global') : undefined, site };

    if (reqMatch && reqMatch[1]) {
      const depSku = reqMatch[1];
      if (depSku !== 'TAP-M100T' && depSku !== 'TAP-M200T' && !depSku.includes('CLS-TAX20E')) {
        let depTerm = depSku.endsWith('-SW-TM') ? (term || globalTermDuration) : undefined;
        const depKey = (groupByNode && nodeId) ? `${nodeId}_${depSku}` : `${site}_${depSku}`;
        if (rowMap[depKey]) rowMap[depKey].qty += qty;
        else rowMap[depKey] = { sku: depSku, qty, description: skus[depSku] || 'Required Dependency', term: depTerm, type: 'Dependency', nodeId: groupByNode ? (nodeId || 'global') : undefined, site };
      }
    }
  };

  syncedNodes.forEach(node => {
    if (node.type === 'toolNode') {
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
    const termOverride = (node.data?.termDurationOverride as string) || globalTermDuration;
    const licenseMode = (node.data?.licenseModeOverride as string && node.data?.licenseModeOverride !== 'default') ? node.data?.licenseModeOverride as 'HTL' | 'Perpetual' : globalLicenseMode;
    const resolved = resolveNodeSkus(node.data || {}, globalLicenseMode);

    if (model.includes('TAP')) {
      addRow(node.id, resolved.hwSku, 1, 'TAP');
      const tapMode = (node.data?.tapMode as string) || 'Passive';
      if (model.includes('G-TAP A-SF') || model.includes('ASF2')) {
        if (tapMode === 'Active') {
          const cuCount = Number(node.data?.activeTapCopperSfpCount) || 0;
          const fiCount = Number(node.data?.activeTapFiberSfpCount) || 0;
          if (cuCount > 0) {
            const fallbackOptic = (node.data?.tappedLinkOptic as string) || 'SFP-501';
            addRow(node.id, (fallbackOptic.includes('TAA') || fallbackOptic.includes('T')) ? 'SFP-501T' : 'SFP-501', cuCount, 'Optic');
          }
          if (fiCount > 0) addRow(node.id, resolveOpticSku((node.data?.tappedLinkOptic as string) || 'SFP-532', ''), fiCount, 'Optic');
        } else {
          const allocations = (node.data?.tappedLinkAllocations as { qty: number, optic: string, toolOptic?: string }[]) || [];
          if (allocations.length > 0) {
            allocations.forEach(alloc => {
              addRow(node.id, resolveOpticSku(alloc.optic, ''), 2 * alloc.qty, 'Optic');
              addRow(node.id, resolveOpticSku(alloc.toolOptic || alloc.optic, ''), 2 * alloc.qty, 'Optic');
            });
          } else addRow(node.id, resolveOpticSku((node.data?.tappedLinkOptic as string) || 'SFP-532', ''), 4, 'Optic');
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
        let cordSku = globalRegion === 'EU' ? 'PCD-00A23' : (globalRegion === 'UK' ? 'PCD-00A25' : 'PCD-00A21');
        let cordQty = globalRegion !== 'US' ? (node.data.tapDualPower ? 2 : 1) : (node.data.tapDualPower ? 1 : 0);
        if (cordQty > 0) addRow(node.id, cordSku, cordQty, 'Dependency');
      }
      if (hardwareCatalogue.taps.find(t => t.sku === resolved.hwSku)?.type === 'module') tapModulesPerSite[siteKey] = (tapModulesPerSite[siteKey] || 0) + 1;
      return;
    }

    addRow(node.id, resolved.hwSku, 1, 'Chassis');
    if (resolved.swSku) addRow(node.id, resolved.swSku, 1, 'License', termOverride);
    if (model.includes('TA400') && node.data?.portCapacity === 'Upgrade') addRow(node.id, globalLicenseMode === 'HTL' ? 'UPG-TAC40EA-SW-TM' : 'UPG-TAC40EA', 1, 'License', termOverride);
    if (model.includes('TA') || model.includes('HC')) {
      if (node.data?.powerSupply === 'DC') addRow(node.id, 'PCD-00051', 2, 'Dependency');
      else addRow(node.id, globalRegion === 'EU' ? 'PCD-00003' : (globalRegion === 'UK' ? 'PCD-00005' : 'PCD-00001'), 2, 'Dependency');
    }
    if (resolved.advSku) addRow(node.id, resolved.advSku, 1, 'License', termOverride);
    Object.values((node.data?.installedBoards as Record<string, string>) || {}).forEach(boardSku => {
      if (!boardSku || boardSku.toLowerCase().includes('base')) return;
      if (licenseMode === 'HTL') { addRow(node.id, boardSku + '-HW', 1, 'Module'); addRow(node.id, boardSku + '-SW-TM', 1, 'License', termOverride); }
      else addRow(node.id, boardSku, 1, 'Module');
    });
    ((node.data?.optics as { board: string, optic: string, qty: number }[]) || []).forEach(opt => {
      if (!opt.optic) return;
      const opticSku = resolveOpticSku(opt.optic, model);
      addRow(node.id, opticSku, opt.qty, 'Optic');
      if (opticSku.includes('PNL-M341') || opticSku.includes('PNL-M343')) {
        const siteKey = (node.data?.site as string) || 'Unassigned';
        tapModulesPerSite[siteKey] = (tapModulesPerSite[siteKey] || 0) + opt.qty;
      }
    });

    if (model.includes('HC')) {
      const gsActions = resolveGsActionsFromGraph(node.id, node.data?.gigaSmartApps as any[], edges, syncedNodes);
      gsActions.forEach(action => {
        const gsSku = resolveGigaSmartSku(action, model, licenseMode);
        if (gsSku) addRow(node.id, gsSku, 1, 'License', licenseMode === 'HTL' ? termOverride : undefined);
      });
    }
  });

  for (const [siteKey, totalTapModules] of Object.entries(tapModulesPerSite)) {
    if (totalTapModules > 0) {
      let numM200T = Math.floor(totalTapModules / 6), remainder = totalTapModules % 6, numM100T = 0;
      if (remainder > 0) { if (remainder <= 3) numM100T = 1; else numM200T += 1; }
      if (numM100T > 0) addRow(null, 'TAP-M100T', numM100T, 'Dependency', undefined, siteKey);
      if (numM200T > 0) addRow(null, 'TAP-M200T', numM200T, 'Dependency', undefined, siteKey);
    }
  }

  const getChassisMaxOpticSpeed = (chassisModel: string): '100G' | '40G' | '10G' => {
    const rules = (opticRules as any)[chassisModel];
    if (!rules) return '10G';
    let has100G = false, has40G = false;
    for (const group of Object.values(rules)) { if (Array.isArray(group)) { for (const opt of group) { if (opt.includes('100G')) has100G = true; if (opt.includes('40G')) has40G = true; } } }
    return has100G ? '100G' : (has40G ? '40G' : '10G');
  };

  const findOpticSkuForSpeed = (chassisModel: string, speed: '100G' | '40G' | '10G'): string | null => {
    const rules = (opticRules as any)[chassisModel];
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
        let mutualSpeed: '100G' | '40G' | '10G' = (srcSpeed === '100G' && dstSpeed === '100G') ? '100G' : ((srcSpeed === '100G' && dstSpeed === '40G' || srcSpeed === '40G' && dstSpeed === '100G' || srcSpeed === '40G' && dstSpeed === '40G') ? '40G' : '10G');
        const srcOpticSku = findOpticSkuForSpeed(srcModel, mutualSpeed), dstOpticSku = findOpticSkuForSpeed(dstModel, mutualSpeed);
        if (srcOpticSku) addRow(sourceNode.id, srcOpticSku, 1, 'Optic');
        if (dstOpticSku) addRow(targetNode.id, dstOpticSku, 1, 'Optic');
      }
    }
  });

  for (const [siteKey, series1RackTaps] of Object.entries(series1RackTapsPerSite)) if (series1RackTaps > 0) addRow(null, 'RMT-GTA03', Math.ceil(series1RackTaps / 3), 'Dependency', undefined, siteKey);
  for (const [siteKey, series1PstAcTaps] of Object.entries(series1PstAcTapsPerSite)) if (series1PstAcTaps > 0) {
    let numPstAC = Math.ceil(series1PstAcTaps / 24);
    addRow(null, 'PST-GTA01', numPstAC, 'Dependency', undefined, siteKey);
    addRow(null, globalRegion === 'EU' ? 'PCD-00A23' : (globalRegion === 'UK' ? 'PCD-00A25' : 'PCD-00A21'), numPstAC * 2, 'Dependency', undefined, siteKey);
  }
  for (const [siteKey, series1PstDcTaps] of Object.entries(series1PstDcTapsPerSite)) if (series1PstDcTaps > 0) {
    let numPstDC = Math.ceil(series1PstDcTaps / 24);
    addRow(null, 'PST-GTA02', numPstDC, 'Dependency', undefined, siteKey);
    addRow(null, 'PCD-00051', numPstDC * 2, 'Dependency', undefined, siteKey);
  }

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
      if (isHc1Plain) return isHtl ? 'SMT-HC1-GEN2-BSE-SW-TM' : 'SMT-HC1-BSE';
      if (isHc1Plus) return ''; // Packet Slicing is included in the HC1 Plus base license
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
    default:
      return '';
  }
}

/** Walk the graph from a given HC node and collect all GigaSMART actions */
function resolveGsActionsFromGraph(
  nodeId: string,
  localApps: any[] | undefined,
  edges: Edge[],
  nodes: CustomNode[],
): Set<string> {
  const gsActions = new Set<string>();
  if (Array.isArray(localApps)) localApps.forEach((app: any) => app.actionType && gsActions.add(app.actionType));

  const visited = new Set<string>([nodeId]);
  const queue = [nodeId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    edges.filter(e => e.source === currentId).forEach(e => {
      if (!visited.has(e.target)) {
        visited.add(e.target);
        const targetNode = nodes.find(n => n.id === e.target);
        if (targetNode) {
          if (targetNode.type === 'gigaSmartNode' && targetNode.data?.actionType) gsActions.add(targetNode.data.actionType);
          if (targetNode.type !== 'hardwareNode') queue.push(e.target);
        }
      }
    });
  }
  return gsActions;
}

export function generateSingleNodeBom(
  node: CustomNode,
  globalLicenseMode: 'HTL' | 'Perpetual',
  globalTermDuration: string,
  globalRegion: 'US' | 'EU' | 'UK' = 'US',
  edges: Edge[] = [],
  nodes: CustomNode[] = []
): BomRow[] {
  const rowMap: Record<string, BomRow> = {};
  const skus = getSkus();
  const addRow = (sku: string, qty: number, type: BomRow['type'], term?: string) => {
    let description = skus[sku] || 'Unknown SKU';
    let purpose = type === 'Chassis' ? 'Base hardware chassis required to host modules and aggregate traffic.' : (type === 'Module' ? 'Hardware line card or module installed in the chassis to provide additional ports or compute resources.' : (type === 'Optic' ? 'Transceiver required to connect physical fiber or copper links to the system.' : (type === 'TAP' ? 'Network TAP used to passively mirror traffic from live network links without disruption.' : (type === 'License' ? 'Software license required to enable features, advanced processing (GigaSMART), or hardware functionality.' : (type === 'Dependency' ? 'Mandatory accessory (e.g., power cord, rack mount) required for proper installation and operation.' : '')))));
    if (sku.includes('PNL-M341')) purpose = 'Provides 4x10G LC ports from a single 40G QSFP+ port. (Requires a 40G QSFP+ transceiver).';
    else if (sku.includes('PNL-M343')) purpose = 'Provides 4x25G LC ports from a single 100G QSFP28 port. (Requires a 100G QSFP28 transceiver).';
    if (purpose) description += ` | Purpose: ${purpose}`;
    const reqMatch = description.match(/(?:requires|Must also add|Needs)\s+(?:.*?)([A-Z0-9]+-[A-Z0-9-]+)(?:\s|\)|\.|$)/i);
    if (rowMap[sku]) rowMap[sku].qty += qty;
    else rowMap[sku] = { sku, qty, description, term, type };
    if (reqMatch && reqMatch[1]) {
      const depSku = reqMatch[1];
      if (depSku !== 'TAP-M100T' && depSku !== 'TAP-M200T' && !depSku.includes('CLS-TAX20E')) {
        if (rowMap[depSku]) rowMap[depSku].qty += qty;
        else rowMap[depSku] = { sku: depSku, qty, description: (skus[depSku] || 'Required Dependency') + ' | Purpose: Mandatory accessory (e.g., power cord, rack mount) required for proper installation and operation.', term: depSku.endsWith('-SW-TM') ? (term || globalTermDuration) : undefined, type: 'Dependency' };
      }
    }
  };

  const model = (node.data?.model as string) || '', termOverride = (node.data?.termDurationOverride as string) || globalTermDuration, licenseMode = (node.data?.licenseModeOverride as string && node.data?.licenseModeOverride !== 'default') ? node.data?.licenseModeOverride as 'HTL' | 'Perpetual' : globalLicenseMode;
  if (node.type === 'toolNode') {
    const isPacketTool = node.data?.configType === 'Packet Tool', optic = (node.data?.ingestOptic as string) || '', isCustomerSupplied = optic.includes('Customer Supplied');
    if (!isPacketTool && !isCustomerSupplied) {
      const qty = parseInt(node.data?.ingestOpticQty as string || '0');
      if (optic && qty > 0) addRow(resolveOpticSku(optic, ''), qty, 'Optic');
    }
    return Object.values(rowMap);
  }

  const resolved = resolveNodeSkus(node.data || {}, globalLicenseMode);
  if (model.includes('TAP')) {
    addRow(resolved.hwSku, 1, 'TAP');
    if (model.includes('G-TAP A-SF') || model.includes('ASF2')) {
      const allocations = (node.data?.tappedLinkAllocations as { qty: number, optic: string, toolOptic?: string }[]) || [];
      if (allocations.length > 0) allocations.forEach(alloc => { addRow(resolveOpticSku(alloc.optic, ''), 2 * alloc.qty, 'Optic'); addRow(resolveOpticSku(alloc.toolOptic || alloc.optic, ''), 2 * alloc.qty, 'Optic'); });
      else addRow(resolveOpticSku((node.data?.tappedLinkOptic as string) || 'SFP-532', ''), 4, 'Optic');
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
      if (globalRegion !== 'US') addRow(globalRegion === 'EU' ? 'PCD-00A23' : 'PCD-00A25', 1, 'Dependency');
    }
    return Object.values(rowMap);
  }

  addRow(resolved.hwSku, 1, 'Chassis');
  if (resolved.swSku) addRow(resolved.swSku, 1, 'License', termOverride);
  if (model.includes('TA400') && node.data?.portCapacity === 'Upgrade') addRow(globalLicenseMode === 'HTL' ? 'UPG-TAC40EA-SW-TM' : 'UPG-TAC40EA', 1, 'License', termOverride);
  if (model.includes('TA') || model.includes('HC')) {
    if (node.data?.powerSupply === 'DC') addRow('PCD-00051', 2, 'Dependency');
    else addRow(globalRegion === 'EU' ? 'PCD-00003' : (globalRegion === 'UK' ? 'PCD-00005' : 'PCD-00001'), 2, 'Dependency');
  }
  if (resolved.advSku) addRow(resolved.advSku, 1, 'License', termOverride);
  Object.values((node.data?.installedBoards as Record<string, string>) || {}).forEach(boardSku => { if (!boardSku || boardSku.toLowerCase().includes('base')) return; if (licenseMode === 'HTL') { addRow(boardSku + '-HW', 1, 'Module'); addRow(boardSku + '-SW-TM', 1, 'License', termOverride); } else addRow(boardSku, 1, 'Module'); });
  let totalTapModules = 0;
  ((node.data?.optics as { board: string, optic: string, qty: number }[]) || []).forEach(opt => { if (!opt.optic) return; const opticSku = resolveOpticSku(opt.optic, model); addRow(opticSku, opt.qty, 'Optic'); if (opticSku.includes('PNL-M341') || opticSku.includes('PNL-M343')) totalTapModules += opt.qty; });
  if (totalTapModules > 0) {
    let numM200T = Math.floor(totalTapModules / 6), remainder = totalTapModules % 6, numM100T = 0;
    if (remainder > 0) { if (remainder <= 3) numM100T = 1; else numM200T += 1; }
    if (numM100T > 0) addRow('TAP-M100T', numM100T, 'Dependency');
    if (numM200T > 0) addRow('TAP-M200T', numM200T, 'Dependency');
  }
  if (model.includes('HC')) {
    const gsActions = resolveGsActionsFromGraph(node.id, node.data?.gigaSmartApps as any[], edges, nodes);
    gsActions.forEach(action => {
      const gsSku = resolveGigaSmartSku(action, model, licenseMode);
      if (gsSku) addRow(gsSku, 1, 'License', licenseMode === 'HTL' ? termOverride : undefined);
    });
  }
  return Object.values(rowMap);
}

