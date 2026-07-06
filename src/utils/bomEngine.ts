import skusData from '../constants/skus.json';
import type { CustomNode } from '../store/store';
import type { Edge } from '@xyflow/react';
import hardwareCatalogue from '../constants/hardwareCatalogue.json';
import { resolveNodeSkus } from './skuResolver';
import { NODE_TYPES, CONFIG_TYPES, SUPPORTED_TAP_OPTICS } from '../constants/nodeTypes';
import opticRules from '../constants/opticRules.json';

const skus: Record<string, string> = skusData as Record<string, string>;

function resolveOpticSku(opticStr: string, chassisModel: string): string {
  const name = opticStr.toUpperCase();
  if (name.includes('1G COPPER')) return 'SFP-501';
  if (name.includes('1G MULTIMODE SX') || name.includes('1G MM SX')) return 'SFP-502';
  if (name.includes('1G SINGLEMODE LX') || name.includes('1G SM LX')) return 'SFP-503';
  if (name.includes('10G COPPER')) return 'SFP-531';
  if (name.includes('10G MULTIMODE SR') || name.includes('10G MM SR')) return 'SFP-532';
  if (name.includes('10G SINGLEMODE LR') || name.includes('10G SM LR')) return 'SFP-533';
  if (name.includes('25G MULTIMODE SR') || name.includes('25G MM SR')) return 'SFP-552';
  if (name.includes('25G SINGLEMODE LR') || name.includes('25G SM LR')) return 'SFP-553';
  if (name.includes('40G MULTIMODE SR4') || name.includes('40G MM SR4')) return 'QSF-502';
  if (name.includes('40G SINGLEMODE LR4') || name.includes('40G SM LR4')) return 'QSF-503';
  if (name.includes('100G MULTIMODE SR4') || name.includes('100G MM SR4')) return 'Q28-502';
  if (name.includes('100G SINGLEMODE LR4') || name.includes('100G SM LR4')) return 'Q28-503';

  const firstWord = opticStr.split(' ')[0];
  if (firstWord === 'Cable') {
    if (chassisModel.includes('TA200') || chassisModel.includes('HC3')) {
      return 'CBL-505';
    } else if (chassisModel.includes('TA400')) {
      return 'CBL-602';
    }
    return 'CBL-205';
  }
  const taaSku = firstWord + 'T';
  if (skus[taaSku]) {
    return taaSku;
  }
  return firstWord;
}

export function syncOpticsOnTapConnection(nodes: CustomNode[], edges: Edge[]): CustomNode[] {
  return nodes.map(node => {
    if (node.type !== NODE_TYPES.HARDWARE || String(node.data?.model || '').includes('TAP')) {
      return node;
    }

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
            ? (String(sourceNode.data?.sku || '').includes('253') || 
               String(sourceNode.data?.sku || '').includes('273') || 
               String(sourceNode.data?.sku || '').includes('453') || 
               String(sourceNode.data?.model || '').toLowerCase().includes('single-mode') || 
               String(sourceNode.data?.model || '').toLowerCase().includes('sm') || 
               String(sourceNode.data?.model || '').includes('253T') || 
               String(sourceNode.data?.model || '').includes('273T') || 
               String(sourceNode.data?.model || '').includes('453T'))
            : (sourceNode.data?.tapFiberMode === 'Singlemode');
          
          const allocations = (sourceNode.data?.tappedLinkAllocations as { qty: number, optic: string, toolOptic?: string }[]) || [
            { 
              qty: (sourceNode.data?.tappedLinksCount as number) ?? 1, 
              optic: (sourceNode.data?.tappedLinkOptic as string) || (isSMTap ? 'SFP-533 (10G SFP+ LR)' : 'SFP-532 (10G SFP+ SR)')
            }
          ];

          for (const alloc of allocations) {
            let selectedOpticVal = alloc.toolOptic || alloc.optic;
            if (String(sourceNode.data?.model || '').includes('TAP-M506T') || String(sourceNode.data?.sku || '').includes('TAP-M506T')) {
              selectedOpticVal = 'QSB-523T (40/100G QSFP28 Dual-Rate BiDi)';
            }
            const requiredQty = alloc.qty * 2;
            tapOpticsNeeded[selectedOpticVal] = (tapOpticsNeeded[selectedOpticVal] || 0) + requiredQty;
          }
        }
      }
    });

    const currentOptics = (node.data?.optics as { board: string, optic: string, qty: number }[]) || [];
    
    // Consolidate optics of the same type and target board/cage together
    const consolidatedMap: Record<string, { board: string, optic: string, qty: number }> = {};
    currentOptics.forEach(opt => {
      if (!opt.optic) return;
      const boardKey = opt.board || 'Base Ports';
      const key = `${boardKey}|||${opt.optic}`;
      if (consolidatedMap[key]) {
        consolidatedMap[key].qty += opt.qty;
      } else {
        consolidatedMap[key] = { ...opt, board: boardKey };
      }
    });
    
    const consolidatedOptics = Object.values(consolidatedMap);
    let changed = consolidatedOptics.length !== currentOptics.length;

    const nextOptics = consolidatedOptics.map(opt => {
      const isTapOpticType = SUPPORTED_TAP_OPTICS.some(o => o.value === opt.optic);
      if (isTapOpticType) {
        const needed = tapOpticsNeeded[opt.optic] || 0;
        if (opt.qty !== needed) {
          changed = true;
          delete tapOpticsNeeded[opt.optic];
          return needed > 0 ? { ...opt, qty: needed } : null;
        }
        delete tapOpticsNeeded[opt.optic];
      }
      return opt;
    }).filter((opt): opt is { board: string, optic: string, qty: number } => opt !== null);

    Object.entries(tapOpticsNeeded).forEach(([optic, qty]) => {
      nextOptics.push({
        board: 'Base Ports',
        optic,
        qty
      });
      changed = true;
    });

    if (changed) {
      return {
        ...node,
        data: {
          ...node.data,
          optics: nextOptics
        }
      };
    }

    return node;
  });
}

export interface BomRow {
  sku: string;
  qty: number;
  description: string;
  term?: string;
  type: 'Hardware' | 'Chassis' | 'License' | 'Support' | 'Optic' | 'Accessory' | 'TAP' | 'Module' | 'Dependency';
  nodeId?: string;
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
  let totalTapModules = 0;

  // Track Series 1 TAP accessories
  let series1RackTaps = 0;
  let series1PstAcTaps = 0;
  let series1PstDcTaps = 0;

  const addRow = (nodeId: string | null, sku: string, qty: number, type: BomRow['type'], term?: string) => {
    const description = skus[sku] || 'Unknown SKU';
    
    // Check if there are any prerequisites mentioned in description
    const reqMatch = description.match(/(?:requires|Must also add|Needs)\s+(?:.*?)([A-Z0-9]+-[A-Z0-9-]+)(?:\s|\)|\.|$)/i);
    
    const key = (groupByNode && nodeId) ? `${nodeId}_${sku}` : sku;
    
    if (rowMap[key]) {
      rowMap[key].qty += qty;
    } else {
      rowMap[key] = { sku, qty, description, term, type, nodeId: groupByNode ? (nodeId || 'global') : undefined };
    }

    if (reqMatch && reqMatch[1]) {
      const depSku = reqMatch[1];
      // Skip regex parsing for TA25E advanced features, as it's explicitly handled below
      if (depSku !== 'TAP-M100T' && depSku !== 'TAP-M200T' && !depSku.includes('CLS-TAX20E')) {
        let depTerm = undefined;
        if (depSku.endsWith('-SW-TM')) depTerm = term || globalTermDuration;
        
        const depKey = (groupByNode && nodeId) ? `${nodeId}_${depSku}` : depSku;
        if (rowMap[depKey]) {
          rowMap[depKey].qty += qty;
        } else {
          rowMap[depKey] = { 
            sku: depSku, 
            qty, 
            description: skus[depSku] || 'Required Dependency', 
            term: depTerm, 
            type: 'Dependency',
            nodeId: groupByNode ? (nodeId || 'global') : undefined
          };
        }
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
        if (optic && qty > 0) {
          const opticSku = resolveOpticSku(optic, '');
          addRow(node.id, opticSku, qty, 'Optic');
        }
      }
      return;
    }

    if (node.type !== 'hardwareNode') return;
    
    const model = (node.data?.model as string) || '';
    const termOverride = (node.data?.termDurationOverride as string) || globalTermDuration;
    const licenseMode = (node.data?.licenseModeOverride as string && node.data?.licenseModeOverride !== 'default') 
      ? node.data?.licenseModeOverride as 'HTL' | 'Perpetual'
      : globalLicenseMode;
      
    const resolved = resolveNodeSkus(node.data || {}, globalLicenseMode);

    if (model.includes('TAP')) {
      addRow(node.id, resolved.hwSku, 1, 'TAP');
      
      // Ensure active fiber TAPs always have exactly four of the selected optic
      if (model.includes('G-TAP A-SF') || model.includes('ASF2')) {
        const allocations = (node.data?.tappedLinkAllocations as { qty: number, optic: string, toolOptic?: string }[]) || [];
        if (allocations.length > 0) {
          allocations.forEach(alloc => {
            const networkOpticSku = resolveOpticSku(alloc.optic, '');
            const toolOpticSku = resolveOpticSku(alloc.toolOptic || alloc.optic, '');
            
            // 2 optics for the network ports (A/B)
            addRow(node.id, networkOpticSku, 2 * alloc.qty, 'Optic');
            // 2 optics for the monitor ports
            addRow(node.id, toolOpticSku, 2 * alloc.qty, 'Optic');
          });
        } else {
          // Fallback if no allocation exists yet
          const fallbackOptic = (node.data?.tappedLinkOptic as string) || 'SFP-532';
          const opticSku = resolveOpticSku(fallbackOptic, '');
          addRow(node.id, opticSku, 4, 'Optic');
        }
      }

      // Series 1 vs Series 2 Hardware & Power Options
      const isSeries2 = model.includes('SF2') || model.includes('TX2');
      const isSeries1 = !isSeries2 && (model.includes('A-SF') || model.includes('A-TX'));

      if (isSeries1) {
        const tapRackMount = (node.data.tapRackMount as string) || 'RMT-GTA03 (3-bay Rack Tray)';
        const tapPower = (node.data.tapPower as string) || 'Individual Power Brick';

        if (tapRackMount === 'RMT-GTA03 (3-bay Rack Tray)') {
          series1RackTaps++;
        }

        if (tapPower === 'PST-GTA01 (AC Power Tray)') {
          series1PstAcTaps++;
        } else if (tapPower === 'PST-GTA02 (DC Power Tray)') {
          series1PstDcTaps++;
        }
      } else if (isSeries2) {
        const tapDualPower = !!node.data.tapDualPower;
        const tapBattery = !!node.data.tapBattery;

        if (tapDualPower) {
          addRow(node.id, 'PBK-GTA21', 1, 'Dependency');
        }
        if (tapBattery) {
          addRow(node.id, 'BAT-GTA20', 1, 'Dependency');
        }

        let cordSku = 'PCD-00A21'; // Default US
        if (globalRegion === 'EU') {
          cordSku = 'PCD-00A23';
        } else if (globalRegion === 'UK') {
          cordSku = 'PCD-00A25';
        }
        
        // Series 2 units include 1 NA cord by default.
        // We add cords to the BOM if:
        // 1. We are in a non-US region (need regional cords for all bricks)
        // 2. We have dual power in the US (need 1 extra cord for the second brick)
        let cordQty = 0;
        if (globalRegion !== 'US') {
          cordQty = tapDualPower ? 2 : 1;
        } else if (tapDualPower) {
          cordQty = 1;
        }

        if (cordQty > 0) {
          addRow(node.id, cordSku, cordQty, 'Dependency');
        }
      }

      const tapEntry = hardwareCatalogue.taps.find(t => t.sku === resolved.hwSku);
      if (tapEntry && tapEntry.type === 'module') {
        totalTapModules += 1;
      }
      return;
    }

    addRow(node.id, resolved.hwSku, 1, 'Chassis');
    if (resolved.swSku) {
      addRow(node.id, resolved.swSku, 1, 'License', termOverride);
    }

    if (model.includes('TA400') && node.data?.portCapacity === 'Upgrade') {
      const upgradeSku = globalLicenseMode === 'HTL' ? 'UPG-TAC40EA-SW-TM' : 'UPG-TAC40EA';
      addRow(node.id, upgradeSku, 1, 'License', termOverride);
    }

    // Suggest power supply cables for TA and HC chassis nodes
    const isPoweredChassis = model.includes('TA') || model.includes('HC');
    if (isPoweredChassis) {
      const isDC = node.data?.powerSupply === 'DC';
      if (isDC) {
        addRow(node.id, 'PCD-00051', 2, 'Dependency');
      } else {
        let acSku = 'PCD-00001'; // Default US
        if (globalRegion === 'EU') {
          acSku = 'PCD-00003';
        } else if (globalRegion === 'UK') {
          acSku = 'PCD-00005';
        }
        addRow(node.id, acSku, 2, 'Dependency');
      }
    }

    if (resolved.advSku) {
      addRow(node.id, resolved.advSku, 1, 'License', termOverride);
    }

    const installedBoards = (node.data?.installedBoards as Record<string, string>) || {};
    Object.values(installedBoards).forEach(boardSku => {
      if (!boardSku) return;
      if (licenseMode === 'HTL') {
         addRow(node.id, boardSku + '-HW', 1, 'Module');
         addRow(node.id, boardSku + '-SW-TM', 1, 'License', termOverride);
      } else {
         addRow(node.id, boardSku, 1, 'Module');
      }
    });

    const optics = (node.data?.optics as { board: string, optic: string, qty: number }[]) || [];
    optics.forEach(opt => {
      if (!opt.optic) return;
      const opticSku = resolveOpticSku(opt.optic, model);
      addRow(node.id, opticSku, opt.qty, 'Optic');
      if (opticSku.includes('PNL-M341') || opticSku.includes('PNL-M343')) {
        totalTapModules += opt.qty;
      }
    });

    // Trace downstream paths to find GigaSMART action nodes connected to this HC chassis
    if (model.includes('HC')) {
      const gsActions = new Set<string>();
      
      // Add embedded GigaSMART apps directly from the hardware node (Advanced Mode)
      if (node.data?.gigaSmartApps && Array.isArray(node.data.gigaSmartApps)) {
        node.data.gigaSmartApps.forEach((app: any) => {
          const action = (app.actionType as string) || '';
          if (action) {
            gsActions.add(action);
          }
        });
      }

      const visited = new Set<string>();
      const queue = [node.id];
      visited.add(node.id);
      
      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const outbound = edges.filter(e => e.source === currentId);
        outbound.forEach(e => {
          if (!visited.has(e.target)) {
            visited.add(e.target);
            const targetNode = nodes.find(n => n.id === e.target);
            if (targetNode) {
              if (targetNode.type === 'gigaSmartNode') {
                const action = (targetNode.data?.actionType as string) || '';
                if (action) {
                  gsActions.add(action);
                }
              }
              if (targetNode.type !== 'hardwareNode') {
                // Keep traversing maps, filters, GigaSMART apps, etc., unless we hit another hardware chassis
                queue.push(e.target);
              }
            }
          }
        });
      }

      gsActions.forEach(action => {
        let gsSku = '';
        let gsTerm = undefined;
        const isHtl = licenseMode === 'HTL';

        if (action === 'Deduplication') {
          if (model.includes('HC1') && !model.includes('HC1-Plus')) {
            gsSku = isHtl ? 'SMT-HC1-GEN2-DD1-SW-TM' : 'SMT-HC1-DD1';
          } else if (model.includes('HC1-Plus') || model.includes('HC1P')) {
            gsSku = isHtl ? 'SMT-HC1P-GEN3-DD1-SW-TM' : 'SMT-HC1P-GEN3-DD1-PL';
          } else if (model.includes('HC3')) {
            gsSku = isHtl ? 'SMT-HC3-GEN3-DD1-SW-TM' : 'SMT-HC3-GEN3-DD1';
          }
        } 
        else if (action === 'SSL Decrypt') {
          if (model.includes('HC1') && !model.includes('HC1-Plus')) {
            gsSku = isHtl ? 'SMT-HC1-GEN2-INSSL-SW-TM' : 'SMT-HC1-INSSL';
          } else if (model.includes('HC1-Plus') || model.includes('HC1P')) {
            gsSku = isHtl ? 'SMT-HC1P-GEN3-INSSL-SW-TM' : 'SMT-HC1P-GEN3-INSSL-PL';
          } else if (model.includes('HC3')) {
            gsSku = isHtl ? 'SMT-HC3-GEN3-INSSL-SW-TM' : 'SMT-HC3-GEN3-INSSL-PL';
          }
        } 
        else if (action === 'Masking') {
          if (model.includes('HC1') && !model.includes('HC1-Plus')) {
            gsSku = isHtl ? 'SMT-HC1-GEN2-BSE-SW-TM' : 'SMT-HC1-BSE';
          } else if (model.includes('HC1-Plus') || model.includes('HC1P')) {
            gsSku = isHtl ? 'SMT-HC1P-GEN3-APF-SW-TM' : 'SMT-HC1P-GEN3-APF-PL';
          } else if (model.includes('HC3')) {
            gsSku = isHtl ? 'SMT-HC3-GEN3-APF-SW-TM' : 'SMT-HC3-GEN3-APF';
          }
        } 
        else if (action === 'Packet Slicing') {
          if (model.includes('HC1') && !model.includes('HC1-Plus')) {
            gsSku = isHtl ? 'SMT-HC1-GEN2-BSE-SW-TM' : 'SMT-HC1-BSE';
          } else if (model.includes('HC1-Plus') || model.includes('HC1P')) {
            gsSku = isHtl ? 'SMT-HC1P-GEN3-AFS-SW-TM' : 'SMT-HC1P-GEN3-AFS-PL';
          } else if (model.includes('HC3')) {
            gsSku = isHtl ? 'SMT-HC3-GEN3-AFS-SW-TM' : 'SMT-HC3-GEN3-AFS-PL';
          }
        } 
        else if (action === 'Header Stripping') {
          if (model.includes('HC1') && !model.includes('HC1-Plus')) {
            gsSku = isHtl ? 'SMT-HC1-GEN2-HS1-SW-TM' : 'SMT-HC1-HS1';
          } else if (model.includes('HC1-Plus') || model.includes('HC1P')) {
            gsSku = isHtl ? 'SMT-HC1P-GEN3-HS1-SW-TM' : 'SMT-HC1P-GEN3-HS1-PL';
          } else if (model.includes('HC3')) {
            gsSku = isHtl ? 'SMT-HC3-GEN3-HS1-SW-TM' : 'SMT-HC3-GEN3-HS1-PL';
          }
        } 
        else if (action === 'Application Metadata' || action === 'AMX' || action === 'AMI') {
          if (model.includes('HC1') && !model.includes('HC1-Plus')) {
            gsSku = isHtl ? 'SMT-HC1-GEN2-AMI-SW-TM' : 'SMT-HC1-AMI';
          } else if (model.includes('HC1-Plus') || model.includes('HC1P')) {
            gsSku = isHtl ? 'SMT-HC1P-GEN3-AMI-SW-TM' : 'SMT-HC1P-GEN3-AMI-PL';
          } else if (model.includes('HC3')) {
            gsSku = isHtl ? 'SMT-HC3-GEN3-AMI-SW-TM' : 'SMT-HC3-GEN3-AMI';
          }
        }

        if (gsSku) {
          if (isHtl) gsTerm = termOverride;
          addRow(node.id, gsSku, 1, 'License', gsTerm);
        }
      });
    }
  });

  if (totalTapModules > 0) {
    let numM200T = Math.floor(totalTapModules / 6);
    let remainder = totalTapModules % 6;
    let numM100T = 0;
    if (remainder > 0) {
      if (remainder <= 3) {
        numM100T = 1;
      } else {
        numM200T += 1;
      }
    }
    
    if (numM100T > 0) {
      addRow(null, 'TAP-M100T', numM100T, 'Dependency');
    }
    if (numM200T > 0) {
      addRow(null, 'TAP-M200T', numM200T, 'Dependency');
    }
  }

  // Helper functions for TA-to-HC aggregation link optic suggestions
  const getChassisMaxOpticSpeed = (chassisModel: string): '100G' | '40G' | '10G' => {
    const rules = (opticRules as any)[chassisModel];
    if (!rules) return '10G';
    let has100G = false;
    let has40G = false;
    for (const group of Object.values(rules)) {
      if (Array.isArray(group)) {
        for (const opt of group) {
          if (opt.includes('100G')) has100G = true;
          if (opt.includes('40G')) has40G = true;
        }
      }
    }
    if (has100G) return '100G';
    if (has40G) return '40G';
    return '10G';
  };

  const findOpticSkuForSpeed = (chassisModel: string, speed: '100G' | '40G' | '10G'): string | null => {
    const rules = (opticRules as any)[chassisModel];
    if (!rules) return null;
    for (const group of Object.values(rules)) {
      if (Array.isArray(group)) {
        for (const opt of group) {
          if (opt.includes(speed) && (opt.includes('SR') || opt.includes('SX') || opt.includes('SR4'))) {
            return opt.split(' ')[0];
          }
        }
      }
    }
    for (const group of Object.values(rules)) {
      if (Array.isArray(group)) {
        for (const opt of group) {
          if (opt.includes(speed)) {
            return opt.split(' ')[0];
          }
        }
      }
    }
    return null;
  };

  // Scan edges for TA-to-HC high-speed links and suggest appropriate optics
  edges.forEach(edge => {
    const sourceNode = syncedNodes.find(n => n.id === edge.source);
    const targetNode = syncedNodes.find(n => n.id === edge.target);
    if (sourceNode?.type === NODE_TYPES.HARDWARE && targetNode?.type === NODE_TYPES.HARDWARE) {
      const srcModel = String(sourceNode.data?.model || '');
      const dstModel = String(targetNode.data?.model || '');
      const isSrcTA = srcModel.includes('TA') && !srcModel.includes('TAP');
      const isDstHC = dstModel.includes('HC');
      const isSrcHC = srcModel.includes('HC');
      const isDstTA = dstModel.includes('TA') && !dstModel.includes('TAP');

      if ((isSrcTA && isDstHC) || (isSrcHC && isDstTA)) {
        const srcSpeed = getChassisMaxOpticSpeed(srcModel);
        const dstSpeed = getChassisMaxOpticSpeed(dstModel);

        let mutualSpeed: '100G' | '40G' | '10G' = '10G';
        if (srcSpeed === '100G' && dstSpeed === '100G') {
          mutualSpeed = '100G';
        } else if (srcSpeed === '100G' && dstSpeed === '40G' || srcSpeed === '40G' && dstSpeed === '100G' || srcSpeed === '40G' && dstSpeed === '40G') {
          mutualSpeed = '40G';
        }

        const srcOpticSku = findOpticSkuForSpeed(srcModel, mutualSpeed);
        const dstOpticSku = findOpticSkuForSpeed(dstModel, mutualSpeed);

        if (srcOpticSku) {
          addRow(sourceNode.id, srcOpticSku, 1, 'Optic');
        }
        if (dstOpticSku) {
          addRow(targetNode.id, dstOpticSku, 1, 'Optic');
        }
      }
    }
  });

  // Aggregate TAP Accessories
  if (series1RackTaps > 0) {
    addRow(null, 'RMT-GTA03', Math.ceil(series1RackTaps / 3), 'Dependency');
  }
  if (series1PstAcTaps > 0) {
    const trayQty = Math.ceil(series1PstAcTaps / 24);
    addRow(null, 'PST-GTA01', trayQty, 'Dependency');
    
    // Each AC Power Tray has 2 power supplies, needs 2 cords
    let acSku = 'PCD-00001'; // Default US
    if (globalRegion === 'EU') acSku = 'PCD-00003';
    else if (globalRegion === 'UK') acSku = 'PCD-00005';
    addRow(null, acSku, trayQty * 2, 'Dependency');
  }
  if (series1PstDcTaps > 0) {
    const trayQty = Math.ceil(series1PstDcTaps / 24);
    addRow(null, 'PST-GTA02', trayQty, 'Dependency');
    // DC trays need DC cords
    addRow(null, 'PCD-00051', trayQty * 2, 'Dependency');
  }

  return Object.values(rowMap).sort((a, b) => a.type.localeCompare(b.type) || a.sku.localeCompare(b.sku));
}

// Helper to get physical cage capacities for HC nodes and modules
function getBoardCages(boardName: string, isPlus: boolean, model: string): { sfp: number; qsfp: number } {
  const name = boardName.toLowerCase();
  const modelLower = model.toLowerCase();
  
  if (modelLower.includes('ta25')) {
    return { sfp: 48, qsfp: 8 };
  }
  if (modelLower.includes('ta200')) {
    return { sfp: 0, qsfp: 64 };
  }
  if (modelLower.includes('ta400')) {
    return { sfp: 0, qsfp: 32 };
  }
  
  if (name.includes('main') || name.includes('base') || name.includes('hc1-x12g4') || name.includes('hc1p-c04x08') || name.includes('hc1p-base') || name.includes('hct-c02')) {
    if (isPlus) {
      return { sfp: 8, qsfp: 4 };
    } else if (modelLower.includes('hct')) {
      return { sfp: 4, qsfp: 2 };
    } else { // HC1
      return { sfp: 12, qsfp: 0 };
    }
  }
  
  if (name.includes('q04x08')) {
    return { sfp: 8, qsfp: 4 };
  }
  if (name.includes('d25a24') || name.includes('bps-hc1-d25a24')) {
    return { sfp: 24, qsfp: 0 };
  }
  if (name.includes('x12') || name.includes('g12')) {
    return { sfp: 12, qsfp: 0 };
  }
  if (name.includes('x24')) {
    return { sfp: 24, qsfp: 0 };
  }
  if (name.includes('c08q08')) {
    return { sfp: 0, qsfp: 16 };
  }
  if (name.includes('c16')) {
    return { sfp: 0, qsfp: 16 };
  }
  if (name.includes('c08')) {
    return { sfp: 0, qsfp: 8 };
  }
  if (name.includes('c05')) {
    return { sfp: 0, qsfp: 5 };
  }
  if (name.includes('bps-hc3')) {
    return { sfp: 16, qsfp: 4 };
  }
  return { sfp: 0, qsfp: 0 };
}

export interface ConfigurationValidationError {
  type: 'no_hc_for_gigasmart' | 'gigasmart_not_connected_to_hc' | 'insufficient_optics' | 'license_port_limit_exceeded' | 'port_capacity_exceeded';
  message: string;
  nodeId?: string;
  nodeLabel?: string;
}

export function validateConfiguration(
  nodes: CustomNode[],
  edges: Edge[]
): ConfigurationValidationError[] {
  const errors: ConfigurationValidationError[] = [];

  // 1. Check for GigaSMART nodes without HC chassis
  const gigasmartNodes = nodes.filter((n) => n.type === NODE_TYPES.GIGASMART);
  const hcNodes = nodes.filter(
    (n) => n.type === NODE_TYPES.HARDWARE && String(n.data?.model || '').includes('HC')
  );

  if (gigasmartNodes.length > 0 && hcNodes.length === 0) {
    errors.push({
      type: 'no_hc_for_gigasmart',
      message: 'GigaSMART functions are placed on the canvas, but no GigaVUE-HC chassis is present. GigaSMART requires a GigaVUE-HC series chassis.',
    });
  }

  // 2. Check for GigaSMART nodes not connected to an HC chassis
  gigasmartNodes.forEach((gsNode) => {
    let hasConnectedHc = false;
    const visited = new Set<string>();
    const queue = [gsNode.id];
    visited.add(gsNode.id);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const incoming = edges.filter((e) => e.target === currentId);
      incoming.forEach((e) => {
        if (!visited.has(e.source)) {
          visited.add(e.source);
          const sourceNode = nodes.find((n) => n.id === e.source);
          if (sourceNode) {
            if (sourceNode.type === NODE_TYPES.HARDWARE && String(sourceNode.data?.model || '').includes('HC')) {
              hasConnectedHc = true;
            } else if (sourceNode.type !== NODE_TYPES.HARDWARE) {
              queue.push(e.source);
            }
          }
        }
      });
      if (hasConnectedHc) break;
    }

    if (!hasConnectedHc) {
      errors.push({
        type: 'gigasmart_not_connected_to_hc',
        nodeId: gsNode.id,
        nodeLabel: String(gsNode.data?.label || 'GigaSMART Function'),
        message: `GigaSMART function "${gsNode.data?.label || 'GigaSMART'}" is not connected to a GigaVUE-HC chassis.`,
      });
    }
  });

  // 3. Check for chassis nodes with insufficient optics and physical port/cage limits
  const chassisNodes = nodes.filter(
    (n) => n.type === NODE_TYPES.HARDWARE && !String(n.data?.model || '').includes('TAP')
  );

  chassisNodes.forEach((chassis) => {
    const installedOptics = (chassis.data?.optics as { board: string; optic: string; qty: number }[]) || [];
    const totalInstalledOptics = installedOptics.reduce((sum, opt) => sum + opt.qty, 0);

    const model = (chassis.data?.model as string) || '';
    const isPlus = model.includes('Plus');

    // Calculate maximum available SFP and QSFP cages on this chassis
    const installedBoards = (chassis.data?.installedBoards as Record<string, string>) || {};
    
    // SFP/QSFP counts across all active boards
    let totalSfpCages = 0;
    let totalQsfpCages = 0;

    // Get base/main board name from the model to query base cages
    let baseBoardName = 'Main Board';
    if (model.includes('HC1') && !isPlus) baseBoardName = 'HC1-X12G4 (Main board)';
    else if (model.includes('HC1') && isPlus) baseBoardName = 'HC1P-BASE (Main Board)';
    else if (model.includes('HCT')) baseBoardName = 'HCT-C02 (Main Board)';
    
    const baseCages = getBoardCages(baseBoardName, isPlus, model);
    totalSfpCages += baseCages.sfp;
    totalQsfpCages += baseCages.qsfp;

    Object.values(installedBoards).forEach((boardSku) => {
      if (!boardSku) return;
      const cages = getBoardCages(boardSku, isPlus, model);
      totalSfpCages += cages.sfp;
      totalQsfpCages += cages.qsfp;
    });

    // Check installed optics counts against physical cage limits
    let installedSfp = 0;
    let installedQsfp = 0;
    let numBreakouts = 0;
    installedOptics.forEach((opt) => {
      const upper = opt.optic.toUpperCase();
      if (upper.includes('PNL-M341') || upper.includes('PNL-M343')) {
        numBreakouts += opt.qty;
      }
      const isQsfp = upper.includes('QSFP') || upper.includes('Q28') || upper.includes('QSF-') || upper.startsWith('Q28-') || upper.includes('40G') || upper.includes('100G') || upper.includes('400G');
      if (isQsfp) {
        installedQsfp += opt.qty;
      } else {
        installedSfp += opt.qty;
      }
      if (upper.includes('PNL-M341') || upper.includes('PNL-M343')) {
        totalQsfpCages -= opt.qty;
      }
    });

    totalSfpCages += numBreakouts * 4;

    if (installedSfp > totalSfpCages) {
      errors.push({
        type: 'port_capacity_exceeded',
        nodeId: chassis.id,
        nodeLabel: String(chassis.data?.model || 'Chassis'),
        message: `Chassis "${chassis.data?.model || 'Chassis'}" (labeled: "${chassis.data?.label || ''}") has exceeded its physical SFP cage capacity. Allowed: ${totalSfpCages}, Installed: ${installedSfp}.`,
      });
    }

    if (installedQsfp > totalQsfpCages) {
      errors.push({
        type: 'port_capacity_exceeded',
        nodeId: chassis.id,
        nodeLabel: String(chassis.data?.model || 'Chassis'),
        message: `Chassis "${chassis.data?.model || 'Chassis'}" (labeled: "${chassis.data?.label || ''}") has exceeded its physical QSFP cage capacity. Allowed: ${totalQsfpCages}, Installed: ${installedQsfp}.`,
      });
    }

    // Calculate TAP link requirements
    const connectedEdges = edges.filter((e) => e.target === chassis.id || e.source === chassis.id);
    let tappedLinks = 0;
    connectedEdges.forEach((e) => {
      const otherId = e.target === chassis.id ? e.source : e.target;
      const sourceNode = nodes.find((n) => n.id === otherId);
      if (sourceNode?.data?.model?.includes('TAP')) {
        tappedLinks += (sourceNode.data.tappedLinksCount as number) ?? 1;
      }
    });

    // Count downstream tool destinations
    const toolsReached = new Set<string>();
    const visited = new Set<string>();
    const queue = [chassis.id];
    visited.add(chassis.id);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const outbound = edges.filter((e) => e.source === currentId);
      outbound.forEach((e) => {
        if (!visited.has(e.target)) {
          visited.add(e.target);
          const targetNode = nodes.find((n) => n.id === e.target);
          if (targetNode) {
            if (targetNode.type === 'toolNode') {
              toolsReached.add(targetNode.id);
            } else if (targetNode.type !== NODE_TYPES.HARDWARE) {
              queue.push(e.target);
            }
          }
        }
      });
    }

    const numToolLinks = toolsReached.size;
    const requiredTapOptics = tappedLinks * 2;
    const totalRequiredOptics = requiredTapOptics + numToolLinks;

    if (totalInstalledOptics < totalRequiredOptics) {
      errors.push({
        type: 'insufficient_optics',
        nodeId: chassis.id,
        nodeLabel: String(chassis.data?.model || 'Chassis'),
        message: `Chassis "${chassis.data?.model || 'Chassis'}" (labeled: "${chassis.data?.label || ''}") has insufficient optics installed. Needs at least ${totalRequiredOptics} optics (currently has ${totalInstalledOptics}).`,
      });
    }
  });

  // 4. Validate TA25/TA25E port license limits
  const ta25Nodes = nodes.filter(
    (n) => n.type === NODE_TYPES.HARDWARE && (String(n.data?.model || '').includes('TA25') || String(n.data?.model || '').includes('TA25E'))
  );

  ta25Nodes.forEach((node) => {
    const portCapacity = node.data?.portCapacity || 'Full';
    if (portCapacity === 'Full') return; // Full license has no restrictions below physical limits
    
    let maxSfp = 48;
    let maxQsfp = 8;
    
    if (portCapacity === 'Quarter') {
      maxSfp = 12;
      maxQsfp = 2;
    } else if (portCapacity === 'Half') {
      maxSfp = 24;
      maxQsfp = 4;
    }

    // Count installed optics by type (SFP vs QSFP)
    const installedOptics = (node.data?.optics as { optic: string; qty: number }[]) || [];
    let installedSfp = 0;
    let installedQsfp = 0;

    installedOptics.forEach((opt) => {
      if (!opt.optic) return;
      const upper = opt.optic.toUpperCase();
      const isQsfp = upper.includes('QSFP') || upper.includes('Q28') || upper.includes('QSF-') || upper.startsWith('Q28-') || upper.includes('40G') || upper.includes('100G') || upper.includes('400G');
      if (isQsfp) {
        installedQsfp += opt.qty;
      } else {
        installedSfp += opt.qty;
      }
    });

    if (installedSfp > maxSfp) {
      errors.push({
        type: 'license_port_limit_exceeded',
        nodeId: node.id,
        nodeLabel: String(node.data?.model || 'TA25'),
        message: `Chassis "${node.data?.model || 'TA25'}" (labeled: "${node.data?.label || ''}") has exceeded its SFP port license limit. Capacity "${portCapacity}" allows up to ${maxSfp} SFP ports (currently using ${installedSfp}).`,
      });
    }

    if (installedQsfp > maxQsfp) {
      errors.push({
        type: 'license_port_limit_exceeded',
        nodeId: node.id,
        nodeLabel: String(node.data?.model || 'TA25'),
        message: `Chassis "${node.data?.model || 'TA25'}" (labeled: "${node.data?.label || ''}") has exceeded its QSFP port license limit. Capacity "${portCapacity}" allows up to ${maxQsfp} QSFP ports (currently using ${installedQsfp}).`,
      });
    }
    
    // Calculate required ports from incoming connections
    const incomingEdges = edges.filter((e) => e.target === node.id);
    let requiredSfpPorts = 0;
    let requiredQsfpPorts = 0;

    incomingEdges.forEach((e) => {
      const sourceNode = nodes.find((n) => n.id === e.source);
      if (!sourceNode) return;
      
      let linkCount = 1;
      if (sourceNode.data?.model?.includes('TAP')) {
        linkCount = ((sourceNode.data.tappedLinksCount as number) ?? 1) * 2;
      }
      
      const sourceSpeed = sourceNode.data?.linkSpeed || 0;
      const isQsfp = sourceSpeed >= 40000 || String(sourceNode.data?.label || '').includes('40G') || String(sourceNode.data?.label || '').includes('100G');
      
      if (isQsfp) {
        requiredQsfpPorts += linkCount;
      } else {
        requiredSfpPorts += linkCount;
      }
    });

    // Also include outbound connections to tools
    const outboundEdges = edges.filter((e) => e.source === node.id);
    outboundEdges.forEach(() => {
      requiredSfpPorts += 1;
    });

    if (requiredSfpPorts > maxSfp) {
      errors.push({
        type: 'license_port_limit_exceeded',
        nodeId: node.id,
        nodeLabel: String(node.data?.model || 'TA25'),
        message: `Chassis "${node.data?.model || 'TA25'}" (labeled: "${node.data?.label || ''}") requires ${requiredSfpPorts} SFP ports for connected links, which exceeds its "${portCapacity}" license limit of ${maxSfp} ports.`,
      });
    }

    if (requiredQsfpPorts > maxQsfp) {
      errors.push({
        type: 'license_port_limit_exceeded',
        nodeId: node.id,
        nodeLabel: String(node.data?.model || 'TA25'),
        message: `Chassis "${node.data?.model || 'TA25'}" (labeled: "${node.data?.label || ''}") requires ${requiredQsfpPorts} QSFP ports for connected links, which exceeds its "${portCapacity}" license limit of ${maxQsfp} ports.`,
      });
    }
  });

  return errors;
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
  
  const addRow = (sku: string, qty: number, type: BomRow['type'], term?: string) => {
    const description = skus[sku] || 'Unknown SKU';
    const reqMatch = description.match(/(?:requires|Must also add|Needs)\s+(?:.*?)([A-Z0-9]+-[A-Z0-9-]+)(?:\s|\)|\.|$)/i);
    
    if (rowMap[sku]) {
      rowMap[sku].qty += qty;
    } else {
      rowMap[sku] = { sku, qty, description, term, type };
    }

    if (reqMatch && reqMatch[1]) {
      const depSku = reqMatch[1];
      if (depSku !== 'TAP-M100T' && depSku !== 'TAP-M200T' && !depSku.includes('CLS-TAX20E')) {
        let depTerm = undefined;
        if (depSku.endsWith('-SW-TM')) depTerm = term || globalTermDuration;
        
        if (rowMap[depSku]) {
          rowMap[depSku].qty += qty;
        } else {
          rowMap[depSku] = { 
            sku: depSku, 
            qty, 
            description: skus[depSku] || 'Required Dependency', 
            term: depTerm, 
            type: 'Dependency' 
          };
        }
      }
    }
  };

  const model = (node.data?.model as string) || '';
  const termOverride = (node.data?.termDurationOverride as string) || globalTermDuration;
  const licenseMode = (node.data?.licenseModeOverride as string && node.data?.licenseModeOverride !== 'default') 
    ? node.data?.licenseModeOverride as 'HTL' | 'Perpetual'
    : globalLicenseMode;
    
  if (node.type === 'toolNode') {
    const isPacketTool = node.data?.configType === 'Packet Tool';
    const optic = (node.data?.ingestOptic as string) || '';
    const isCustomerSupplied = optic.includes('Customer Supplied');
    if (!isPacketTool && !isCustomerSupplied) {
      const qty = parseInt(node.data?.ingestOpticQty as string || '0');
      if (optic && qty > 0) {
        const opticSku = resolveOpticSku(optic, '');
        addRow(opticSku, qty, 'Optic');
      }
    }
    return Object.values(rowMap);
  }

  const resolved = resolveNodeSkus(node.data || {}, globalLicenseMode);

  if (model.includes('TAP')) {
    addRow(resolved.hwSku, 1, 'TAP');
    
    // Optic allocations
    if (model.includes('G-TAP A-SF') || model.includes('ASF2')) {
      const allocations = (node.data?.tappedLinkAllocations as { qty: number, optic: string, toolOptic?: string }[]) || [];
      if (allocations.length > 0) {
        allocations.forEach(alloc => {
          const networkOpticSku = resolveOpticSku(alloc.optic, '');
          const toolOpticSku = resolveOpticSku(alloc.toolOptic || alloc.optic, '');
          addRow(networkOpticSku, 2 * alloc.qty, 'Optic');
          addRow(toolOpticSku, 2 * alloc.qty, 'Optic');
        });
      } else {
        const fallbackOptic = (node.data?.tappedLinkOptic as string) || 'SFP-532';
        addRow(resolveOpticSku(fallbackOptic, ''), 4, 'Optic');
      }
    }

    // Hardware & Power Options
    const isSeries2 = model.includes('SF2') || model.includes('TX2');
    const isSeries1 = !isSeries2 && (model.includes('A-SF') || model.includes('A-TX'));

    if (isSeries1) {
      const tapRackMount = (node.data.tapRackMount as string) || 'RMT-GTA03 (3-bay Rack Tray)';
      const tapPower = (node.data.tapPower as string) || 'Individual Power Brick';

      if (tapRackMount === 'RMT-GTA03 (3-bay Rack Tray)') {
        addRow('RMT-GTA03', 1, 'Dependency');
      }
      if (tapPower === 'Individual Power Brick') {
        const powerSku = model.includes('A-TX') ? 'GTP-ATX01-UN' : 'GTP-ASF01-UN';
        addRow(powerSku, 1, 'Dependency');
      } else if (tapPower === 'PST-GTA01 (AC Power Tray)') {
        addRow('PST-GTA01', 1, 'Dependency');
      } else if (tapPower === 'PST-GTA02 (DC Power Tray)') {
        addRow('PST-GTA02', 1, 'Dependency');
      }
    } else if (isSeries2) {
      const tapDualPower = !!node.data.tapDualPower;
      const tapBattery = !!node.data.tapBattery;

      if (tapDualPower) {
        addRow('PBK-GTA21', 1, 'Dependency');
      }
      if (tapBattery) {
        addRow('BAT-GTA20', 1, 'Dependency');
      }
      if (globalRegion !== 'US') {
        const cordSku = globalRegion === 'EU' ? 'PCD-00A23' : 'PCD-00A25';
        addRow(cordSku, 1, 'Dependency');
      }
    }

    return Object.values(rowMap);
  }

  addRow(resolved.hwSku, 1, 'Chassis');
  if (resolved.swSku) {
    addRow(resolved.swSku, 1, 'License', termOverride);
  }

  if (model.includes('TA400') && node.data?.portCapacity === 'Upgrade') {
    const upgradeSku = globalLicenseMode === 'HTL' ? 'UPG-TAC40EA-SW-TM' : 'UPG-TAC40EA';
    addRow(upgradeSku, 1, 'License', termOverride);
  }

  const isPoweredChassis = model.includes('TA') || model.includes('HC');
  if (isPoweredChassis) {
    const isDC = node.data?.powerSupply === 'DC';
    if (isDC) {
      addRow('PCD-00051', 2, 'Dependency');
    } else {
      let acSku = 'PCD-00001';
      if (globalRegion === 'EU') {
        acSku = 'PCD-00003';
      } else if (globalRegion === 'UK') {
        acSku = 'PCD-00005';
      }
      addRow(acSku, 2, 'Dependency');
    }
  }

  if (resolved.advSku) {
    addRow(resolved.advSku, 1, 'License', termOverride);
  }

  const installedBoards = (node.data?.installedBoards as Record<string, string>) || {};
  Object.values(installedBoards).forEach(boardSku => {
    if (!boardSku) return;
    if (licenseMode === 'HTL') {
       addRow(boardSku + '-HW', 1, 'Module');
       addRow(boardSku + '-SW-TM', 1, 'License', termOverride);
    } else {
       addRow(boardSku, 1, 'Module');
    }
  });

  const optics = (node.data?.optics as { board: string, optic: string, qty: number }[]) || [];
  optics.forEach(opt => {
    if (!opt.optic) return;
    const opticSku = resolveOpticSku(opt.optic, model);
    addRow(opticSku, opt.qty, 'Optic');
  });

  if (model.includes('HC')) {
    const gsActions = new Set<string>();
    if (node.data?.gigaSmartApps && Array.isArray(node.data.gigaSmartApps)) {
      node.data.gigaSmartApps.forEach((app: any) => {
        const action = (app.actionType as string) || '';
        if (action) gsActions.add(action);
      });
    }

    const visited = new Set<string>();
    const queue = [node.id];
    visited.add(node.id);
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const outbound = edges.filter(e => e.source === currentId);
      outbound.forEach(e => {
        if (!visited.has(e.target)) {
          visited.add(e.target);
          const targetNode = nodes.find(n => n.id === e.target);
          if (targetNode) {
            if (targetNode.type === 'gigaSmartNode') {
              const action = (targetNode.data?.actionType as string) || '';
              if (action) gsActions.add(action);
            } else if (targetNode.type === 'filterNode' || targetNode.type === 'mapNode') {
              queue.push(targetNode.id);
            }
          }
        }
      });
    }

    gsActions.forEach(action => {
      let appSku = '';
      if (action === 'dedup') appSku = 'CLS-HC1-DEDUP';
      else if (action === 'slicing') appSku = 'CLS-HC1-SLICE';
      else if (action === 'masking') appSku = 'CLS-HC1-MASK';
      else if (action === 'header_stripping') appSku = 'CLS-HC1-STRIP';

      if (appSku) {
        if (model.includes('HC3')) appSku = appSku.replace('HC1', 'HC3');
        if (licenseMode === 'HTL') {
          appSku += '-SW-TM';
        }
        addRow(appSku, 1, 'License', termOverride);
      }
    });
  }

  return Object.values(rowMap);
}
