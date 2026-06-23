import skusData from '../constants/skus.json';
import type { CustomNode } from '../store/store';
import type { Edge } from '@xyflow/react';
import hardwareCatalogue from '../constants/hardwareCatalogue.json';
import { resolveNodeSkus } from './skuResolver';

const skus: Record<string, string> = skusData as Record<string, string>;

function resolveOpticSku(opticStr: string, chassisModel: string): string {
  const firstWord = opticStr.split(' ')[0];
  if (firstWord === 'Cable') {
    if (chassisModel.includes('TA200') || chassisModel.includes('HC3')) {
      return 'CBL-505';
    } else if (chassisModel.includes('TA400')) {
      return 'CBL-602';
    }
    return 'CBL-205';
  }
  return firstWord;
}

export interface BomRow {
  sku: string;
  qty: number;
  description: string;
  term?: string;
  type: 'Chassis' | 'Module' | 'Optic' | 'Dependency' | 'TAP';
}

export function generateBom(
  nodes: CustomNode[],
  edges: Edge[],
  globalLicenseMode: 'HTL' | 'Perpetual',
  globalTermDuration: string
): BomRow[] {
  const rowMap: Record<string, BomRow> = {};
  let totalTapModules = 0;

  const addRow = (sku: string, qty: number, type: BomRow['type'], term?: string) => {
    const description = skus[sku] || 'Unknown SKU';
    
    // Check if there are any prerequisites mentioned in description
    const reqMatch = description.match(/(?:requires|Must also add)\s+(?:.*?)([A-Z0-9]+-[A-Z0-9-]+)(?:\s|\)|\.|$)/i);
    
    if (rowMap[sku]) {
      rowMap[sku].qty += qty;
    } else {
      rowMap[sku] = { sku, qty, description, term, type };
    }

    if (reqMatch && reqMatch[1]) {
      const depSku = reqMatch[1];
      if (depSku !== 'TAP-M100T' && depSku !== 'TAP-M200T') {
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

  nodes.forEach(node => {
    if (node.type !== 'hardwareNode') return;
    
    const model = (node.data?.model as string) || '';
    const termOverride = (node.data?.termDurationOverride as string) || globalTermDuration;
    const licenseMode = (node.data?.licenseModeOverride as string && node.data?.licenseModeOverride !== 'default') 
      ? node.data?.licenseModeOverride as 'HTL' | 'Perpetual'
      : globalLicenseMode;
      
    const resolved = resolveNodeSkus(node.data || {}, globalLicenseMode);

    if (model.includes('TAP')) {
      addRow(resolved.hwSku, 1, 'TAP');
      
      const tapEntry = hardwareCatalogue.taps.find(t => t.sku === resolved.hwSku);
      if (tapEntry && tapEntry.type === 'module') {
        totalTapModules += 1;
      }
      return;
    }

    addRow(resolved.hwSku, 1, 'Chassis');
    if (resolved.swSku) {
      addRow(resolved.swSku, 1, 'Chassis', termOverride);
    }

    const installedBoards = (node.data?.installedBoards as Record<string, string>) || {};
    Object.values(installedBoards).forEach(boardSku => {
      if (!boardSku) return;
      if (licenseMode === 'HTL') {
         addRow(boardSku + '-HW', 1, 'Module');
         addRow(boardSku + '-SW-TM', 1, 'Module', termOverride);
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
          addRow(gsSku, 1, 'Module', gsTerm);
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
      addRow('TAP-M100T', numM100T, 'Dependency');
    }
    if (numM200T > 0) {
      addRow('TAP-M200T', numM200T, 'Dependency');
    }
  }

  return Object.values(rowMap).sort((a, b) => a.type.localeCompare(b.type) || a.sku.localeCompare(b.sku));
}

// ─── Global Configuration Validator ───────────────────────────────────────────

import { NODE_TYPES } from '../constants/nodeTypes';

export interface ConfigurationValidationError {
  type: 'no_hc_for_gigasmart' | 'gigasmart_not_connected_to_hc' | 'insufficient_optics';
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

  // 3. Check for chassis nodes with insufficient optics
  const chassisNodes = nodes.filter(
    (n) => n.type === NODE_TYPES.HARDWARE && !String(n.data?.model || '').includes('TAP')
  );

  chassisNodes.forEach((chassis) => {
    const installedOptics = (chassis.data?.optics as { qty: number }[]) || [];
    const totalInstalledOptics = installedOptics.reduce((sum, opt) => sum + opt.qty, 0);

    // Calculate TAP link requirements
    const incomingTapEdges = edges.filter((e) => e.target === chassis.id);
    let tappedLinks = 0;
    incomingTapEdges.forEach((e) => {
      const sourceNode = nodes.find((n) => n.id === e.source);
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

  return errors;
}
