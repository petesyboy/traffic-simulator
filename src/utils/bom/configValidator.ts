import { type Edge } from '@xyflow/react';
import { type CustomNode } from '../../store/types';
import { NODE_TYPES } from '../../constants/nodeTypes';
import { areActionsCompatible } from '../../constants/gigaSmartRules';
import { resolveOpticSku } from './skuUtils';
import { resolveNodeSkus } from '../skuResolver';
import { getBoardPortCapacity, getChassisBasePortCapacity } from '../hardwareUtils';
import skusMetadata from '../../constants/skus_metadata.json';

export interface ConfigurationValidationError {
  type: 'no_hc_for_gigasmart' | 'gigasmart_not_connected_to_hc' | 'insufficient_optics' | 'license_port_limit_exceeded' | 'port_capacity_exceeded' | 'gigasmart_combination_unsupported' | 'eos_eol_sku_used';
  message: string;
  nodeId?: string;
  nodeLabel?: string;
}

interface SkuMetadata {
  eos?: string;
  eol?: string;
  replacement?: string;
}

let activeMetadata: Record<string, SkuMetadata> = skusMetadata as Record<string, SkuMetadata>;

export function setMockSkusMetadata(mockData: Record<string, SkuMetadata> | null) {
  if (mockData === null) {
    activeMetadata = skusMetadata as Record<string, SkuMetadata>;
  } else {
    activeMetadata = mockData;
  }
}

function checkSkuStatus(
  sku: string,
  typeName: string,
  chassisLabel: string,
  nodeId: string,
  errors: ConfigurationValidationError[]
) {
  if (!sku) return;
  const entry = activeMetadata[sku];
  if (!entry) return;

  const hasEos = Boolean(entry.eos);
  const hasEol = Boolean(entry.eol);
  
  if (hasEos || hasEol) {
    const statusStr = hasEol ? 'End of Life' : 'End of Sale';
    const dateStr = hasEol ? entry.eol : entry.eos;
    let msg = `${typeName} SKU "${sku}" on chassis "${chassisLabel}" is ${statusStr} (effective ${dateStr}).`;
    if (entry.replacement) {
      msg += ` It is not available. Please use replacement SKU "${entry.replacement}" instead.`;
    } else {
      msg += ` It is no longer supported.`;
    }
    
    errors.push({
      type: 'eos_eol_sku_used',
      nodeId,
      nodeLabel: chassisLabel,
      message: msg
    });
  }
}

export function validateConfiguration(
  nodes: CustomNode[],
  edges: Edge[]
): ConfigurationValidationError[] {
  const errors: ConfigurationValidationError[] = [];

  // ─── SKU Status Validation (EOS/EOL) ──────────────────────────────────────
  nodes.filter((n) => n.type === NODE_TYPES.HARDWARE).forEach((hwNode) => {
    const model = (hwNode.data?.model as string) || '';
    const label = (hwNode.data?.label as string) || model;
    
    // 1. Check Chassis/TAP SKU
    const resolved = resolveNodeSkus(hwNode.data || {}, 'Perpetual');
    if (resolved && resolved.hwSku) {
      checkSkuStatus(resolved.hwSku, 'Chassis/TAP', label, hwNode.id, errors);
    }

    // 2. Check Installed Slot Boards
    const installedBoards = (hwNode.data?.installedBoards as Record<string, string>) || {};
    Object.values(installedBoards).forEach((boardSku) => {
      if (boardSku) {
        checkSkuStatus(boardSku, 'Module', label, hwNode.id, errors);
      }
    });

    // 3. Check Installed Optics
    const installedOptics = (hwNode.data?.optics as { optic: string }[]) || [];
    installedOptics.forEach((opt) => {
      const opticSku = resolveOpticSku(opt.optic, model);
      checkSkuStatus(opticSku, 'Optic', label, hwNode.id, errors);
    });
  });

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

  const chassisNodes = nodes.filter(
    (n) => n.type === NODE_TYPES.HARDWARE && !String(n.data?.model || '').includes('TAP')
  );

  chassisNodes.forEach((chassis) => {
    const installedOptics = (chassis.data?.optics as { board: string; optic: string; qty: number }[]) || [];
    const totalInstalledOptics = installedOptics.reduce((sum, opt) => sum + opt.qty, 0);

    const model = (chassis.data?.model as string) || '';

    const installedBoards = (chassis.data?.installedBoards as Record<string, string>) || {};
    let totalSfpCages = 0;
    let totalQsfpCages = 0;

    const baseCages = getChassisBasePortCapacity(model);
    for (const portType in baseCages) {
      if (portType.toUpperCase().includes('QSFP')) {
        totalQsfpCages += baseCages[portType];
      } else if (portType.toUpperCase().includes('SFP')) {
        totalSfpCages += baseCages[portType];
      }
    }

    Object.values(installedBoards).forEach((boardSku) => {
      if (!boardSku) return;
      const cages = getBoardPortCapacity(boardSku);
      for (const portType in cages) {
        if (portType.toUpperCase().includes('QSFP')) {
          totalQsfpCages += cages[portType];
        } else if (portType.toUpperCase().includes('SFP')) {
          totalSfpCages += cages[portType];
        }
      }
    });

    let installedSfp = 0;
    let installedQsfp = 0;
    let numBreakouts = 0;
    installedOptics.forEach((opt) => {
      const upper = opt.optic.toUpperCase();
      if (upper.includes('PNL-M341') || upper.includes('PNL-M343')) numBreakouts += opt.qty;
      const isQsfp = upper.includes('QSFP') || upper.includes('Q28') || upper.includes('QSF-') || upper.startsWith('Q28-') || upper.includes('40G') || upper.includes('100G') || upper.includes('400G');
      if (isQsfp) installedQsfp += opt.qty;
      else installedSfp += opt.qty;
      if (upper.includes('PNL-M341') || upper.includes('PNL-M343')) totalQsfpCages -= opt.qty;
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

    const apps = (chassis.data?.gigaSmartApps as any[]) || [];
    if (apps.length >= 2) {
      for (let i = 0; i < apps.length; i++) {
        for (let j = i + 1; j < apps.length; j++) {
          const comp = areActionsCompatible(apps[i].actionType, apps[j].actionType);
          if (!comp.compatible) {
            errors.push({
              type: 'gigasmart_combination_unsupported',
              nodeId: chassis.id,
              nodeLabel: String(chassis.data?.model || 'Chassis'),
              message: `Chassis "${chassis.data?.model || 'Chassis'}" (labeled: "${chassis.data?.label || ''}") GigaSMART configuration error: ${comp.reason || ''}`,
            });
          }
        }
      }
    }

    const connectedEdges = edges.filter((e) => e.target === chassis.id || e.source === chassis.id);
    let tappedLinks = 0;
    connectedEdges.forEach((e) => {
      const otherId = e.target === chassis.id ? e.source : e.target;
      const sourceNode = nodes.find((n) => n.id === otherId);
      if (sourceNode?.data?.model?.includes('TAP')) tappedLinks += (sourceNode.data.tappedLinksCount as number) ?? 1;
    });

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
            if (targetNode.type === 'toolNode') toolsReached.add(targetNode.id);
            else if (targetNode.type !== NODE_TYPES.HARDWARE) queue.push(e.target);
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

  const ta25Nodes = nodes.filter(
    (n) => n.type === NODE_TYPES.HARDWARE && (String(n.data?.model || '').includes('TA25') || String(n.data?.model || '').includes('TA25E'))
  );

  ta25Nodes.forEach((node) => {
    const portCapacity = node.data?.portCapacity || 'Full';
    if (portCapacity === 'Full') return;
    
    let maxSfp = 48, maxQsfp = 8;
    if (portCapacity === 'Quarter') { maxSfp = 12; maxQsfp = 2; }
    else if (portCapacity === 'Half') { maxSfp = 24; maxQsfp = 4; }

    const installedOptics = (node.data?.optics as { optic: string; qty: number }[]) || [];
    let installedSfp = 0, installedQsfp = 0;
    installedOptics.forEach((opt) => {
      if (!opt.optic) return;
      const upper = opt.optic.toUpperCase();
      const isQsfp = upper.includes('QSFP') || upper.includes('Q28') || upper.includes('QSF-') || upper.startsWith('Q28-') || upper.includes('40G') || upper.includes('100G') || upper.includes('400G');
      if (isQsfp) installedQsfp += opt.qty;
      else installedSfp += opt.qty;
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
    
    const incomingEdges = edges.filter((e) => e.target === node.id);
    let requiredSfpPorts = 0, requiredQsfpPorts = 0;
    incomingEdges.forEach((e) => {
      const sourceNode = nodes.find((n) => n.id === e.source);
      if (!sourceNode) return;
      let linkCount = 1;
      if (sourceNode.data?.model?.includes('TAP')) linkCount = ((sourceNode.data.tappedLinksCount as number) ?? 1) * 2;
      const sourceSpeed = sourceNode.data?.linkSpeed || 0;
      const isQsfp = sourceSpeed >= 40000 || String(sourceNode.data?.label || '').includes('40G') || String(sourceNode.data?.label || '').includes('100G');
      if (isQsfp) requiredQsfpPorts += linkCount;
      else requiredSfpPorts += linkCount;
    });

    const outboundEdges = edges.filter((e) => e.source === node.id);
    outboundEdges.forEach(() => { requiredSfpPorts += 1; });

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
