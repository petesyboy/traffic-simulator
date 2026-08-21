import { type Edge } from '@xyflow/react';
import { type CustomNode, type HardwareNodeData } from '../../store/types';
import { NODE_TYPES } from '../../constants/nodeTypes';
import { areActionsCompatible } from '../../constants/gigaSmartRules';
import { resolveOpticSku } from './skuUtils';
import { resolveNodeSkus, type HardwareNodeSkuData } from '../skuResolver';
import { getBoardPortCapacity, getChassisBasePortCapacity, getOpticFiberType, isBreakoutPanelModel } from '../hardwareUtils';
import {
  getChassisPorts,
  getOpticCage,
  getPortOpticMap,
  getRequiredPortCount,
  isTapNode,
  isTapUnconfigured,
} from '../ports';
import { getCompatibleTapOptics, isTapOpticCompatible } from '../../constants/tapOpticRules';
import { getMergedSkusMetadata } from '../skuOverrides';
import { isParallelBreakoutOptic, getBreakoutLcOptics, panelFiberType, PANEL_MPO_GROUPS } from '../breakoutRules';

export interface ConfigurationValidationError {
  type:
    | 'no_hc_for_gigasmart'
    | 'gigasmart_not_connected_to_hc'
    | 'insufficient_optics'
    | 'license_port_limit_exceeded'
    | 'port_capacity_exceeded'
    | 'gigasmart_combination_unsupported'
    | 'eos_eol_sku_used'
    | 'port_missing_optic'
    | 'port_optic_mismatch'
    | 'tap_not_configured'
    | 'tap_optic_incompatible'
    | 'breakout_optic_incompatible'
    | 'breakout_panel_capacity_exceeded'
    | 'breakout_lane_speed_mismatch'
    | 'breakout_panel_fiber_type_mismatch';
  message: string;
  nodeId?: string;
  nodeLabel?: string;
}

interface SkuMetadata {
  eos?: string;
  eol?: string;
  replacement?: string;
  unavailable?: boolean;
}

// Tests pin this to a fixed fixture via setMockSkusMetadata; production code leaves
// it null so checkSkuStatus always reads the live base+uploaded-price-list merge.
let mockMetadata: Record<string, SkuMetadata> | null = null;

export function setMockSkusMetadata(mockData: Record<string, SkuMetadata> | null) {
  mockMetadata = mockData;
}

function checkSkuStatus(
  sku: string,
  typeName: string,
  chassisLabel: string,
  nodeId: string,
  errors: ConfigurationValidationError[],
) {
  if (!sku) return;
  const activeMetadata = mockMetadata ?? getMergedSkusMetadata();
  const entry = activeMetadata[sku];
  if (!entry) return;

  const hasEos = Boolean(entry.eos);
  const hasEol = Boolean(entry.eol);
  const isUnavailable = Boolean(entry.unavailable);

  if (hasEos || hasEol || isUnavailable) {
    let statusStr = hasEol ? 'End of Life' : hasEos ? 'End of Sale' : 'Discontinued';
    if (entry.eos && entry.eos.toLowerCase().includes('discontinued')) {
      statusStr = 'Discontinued (Removed from Price List)';
    }
    const dateStr = hasEol ? entry.eol : entry.eos;
    let msg = `${typeName} SKU "${sku}" on chassis "${chassisLabel}" is ${statusStr}${dateStr && !dateStr.includes('Discontinued') ? ` (effective ${dateStr})` : ''}.`;
    if (entry.replacement) {
      msg += ` It is not available. Please use replacement SKU "${entry.replacement}" instead.`;
    } else {
      msg += ` It is no longer orderable.`;
    }

    errors.push({
      type: 'eos_eol_sku_used',
      nodeId,
      nodeLabel: chassisLabel,
      message: msg,
    });
  }
}

export function validateConfiguration(nodes: CustomNode[], edges: Edge[]): ConfigurationValidationError[] {
  const errors: ConfigurationValidationError[] = [];

  // ─── SKU Status Validation (EOS/EOL) ──────────────────────────────────────
  nodes
    .filter((n) => n.type === NODE_TYPES.HARDWARE)
    .forEach((hwNode) => {
      const model = (hwNode.data?.model as string) || '';
      const label = (hwNode.data?.label as string) || model;

      // 1. Check Chassis/TAP SKU
      const resolved = resolveNodeSkus((hwNode.data as HardwareNodeSkuData) || {}, 'Perpetual');
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
  const hcNodes = nodes.filter((n) => n.type === NODE_TYPES.HARDWARE && String(n.data?.model || '').includes('HC'));

  if (gigasmartNodes.length > 0 && hcNodes.length === 0) {
    errors.push({
      type: 'no_hc_for_gigasmart',
      message:
        'GigaSMART functions are placed on the canvas, but no GigaVUE-HC chassis is present. GigaSMART requires a GigaVUE-HC series chassis.',
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
    (n) =>
      n.type === NODE_TYPES.HARDWARE &&
      !String(n.data?.model || '').includes('TAP') &&
      !isBreakoutPanelModel(String(n.data?.model || '')),
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
    installedOptics.forEach((opt) => {
      const upper = opt.optic.toUpperCase();
      const isQsfp =
        upper.includes('QSFP') ||
        upper.includes('Q28') ||
        upper.includes('QSF-') ||
        upper.startsWith('Q28-') ||
        upper.includes('40G') ||
        upper.includes('100G') ||
        upper.includes('400G');
      if (isQsfp) installedQsfp += opt.qty;
      else installedSfp += opt.qty;
    });

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

    const apps = (chassis.data?.gigaSmartApps as { actionType: string }[]) || [];
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
    (n) =>
      n.type === NODE_TYPES.HARDWARE &&
      (String(n.data?.model || '').includes('TA25') || String(n.data?.model || '').includes('TA25E')),
  );

  ta25Nodes.forEach((node) => {
    const portCapacity = node.data?.portCapacity || 'Full';
    if (portCapacity === 'Full') return;

    let maxSfp = 48,
      maxQsfp = 8;
    if (portCapacity === 'Quarter') {
      maxSfp = 12;
      maxQsfp = 2;
    } else if (portCapacity === 'Half') {
      maxSfp = 24;
      maxQsfp = 4;
    }

    const installedOptics = (node.data?.optics as { optic: string; qty: number }[]) || [];
    let installedSfp = 0,
      installedQsfp = 0;
    installedOptics.forEach((opt) => {
      if (!opt.optic) return;
      const upper = opt.optic.toUpperCase();
      const isQsfp =
        upper.includes('QSFP') ||
        upper.includes('Q28') ||
        upper.includes('QSF-') ||
        upper.startsWith('Q28-') ||
        upper.includes('40G') ||
        upper.includes('100G') ||
        upper.includes('400G');
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
    let requiredSfpPorts = 0,
      requiredQsfpPorts = 0;
    incomingEdges.forEach((e) => {
      const sourceNode = nodes.find((n) => n.id === e.source);
      if (!sourceNode) return;
      let linkCount = 1;
      if (sourceNode.data?.model?.includes('TAP')) linkCount = ((sourceNode.data.tappedLinksCount as number) ?? 1) * 2;
      const sourceSpeed = sourceNode.data?.linkSpeed || 0;
      const isQsfp =
        sourceSpeed >= 40000 ||
        String(sourceNode.data?.label || '').includes('40G') ||
        String(sourceNode.data?.label || '').includes('100G');
      if (isQsfp) requiredQsfpPorts += linkCount;
      else requiredSfpPorts += linkCount;
    });

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

  validateTapConfiguration(nodes, edges, errors);
  validateBreakoutPanels(nodes, edges, errors);
  validatePortAssignments(nodes, edges, errors);

  return errors;
}

/**
 * A TAP wired to a chassis but with no tapped links set up yields nothing at
 * all - no optics, no BOM lines, no port allocations. That silence is easy to
 * mistake for a bug in the BOM, so say plainly that the TAP needs configuring.
 */
function validateTapConfiguration(nodes: CustomNode[], edges: Edge[], errors: ConfigurationValidationError[]) {
  const flagged = new Set<string>();

  edges.forEach((edge) => {
    const a = nodes.find((n) => n.id === edge.source);
    const b = nodes.find((n) => n.id === edge.target);
    const tap = isTapNode(a) ? a : isTapNode(b) ? b : undefined;
    const peer = tap === a ? b : a;
    if (!tap || flagged.has(tap.id)) return;

    const peerModel = String(peer?.data?.model || '');
    const peerIsChassis =
      peer?.type === NODE_TYPES.HARDWARE &&
      (peerModel.includes('HC') || peerModel.includes('TA')) &&
      !peerModel.includes('TAP');
    if (!peerIsChassis || !isTapUnconfigured(tap)) return;

    flagged.add(tap.id);
    const label = String(tap.data?.label || tap.data?.model || tap.id);
    errors.push({
      type: 'tap_not_configured',
      nodeId: tap.id,
      nodeLabel: label,
      message: `TAP "${label}" is connected to "${String(peer?.data?.label || peerModel)}" but has no tapped links configured, so it contributes no optics, ports or BOM lines. Set the number of links and their speed in the TAP's "Tapped Links" panel.`,
    });
  });

  validateTapOpticCompatibility(nodes, edges, errors);
}

/**
 * A passive TAP's monitor output can only terminate into an optic matching its
 * fibre type and connector - a multimode M251T can't be landed on a singlemode
 * LR, and neither LC tap accepts the MPO or Rx-only BiDi parts.
 */
function validateTapOpticCompatibility(nodes: CustomNode[], edges: Edge[], errors: ConfigurationValidationError[]) {
  const chassisFor = new Map<string, CustomNode>();
  edges.forEach((edge) => {
    const a = nodes.find((n) => n.id === edge.source);
    const b = nodes.find((n) => n.id === edge.target);
    const tap = isTapNode(a) ? a : isTapNode(b) ? b : undefined;
    const peer = tap === a ? b : a;
    if (tap && peer?.type === NODE_TYPES.HARDWARE && !chassisFor.has(tap.id)) chassisFor.set(tap.id, peer);
  });

  chassisFor.forEach((chassis, tapId) => {
    const tap = nodes.find((n) => n.id === tapId);
    if (!tap) return;
    const data = tap.data as HardwareNodeData;
    const model = String(data.model || '');
    const sku = String(data.sku || '');
    const compatible = getCompatibleTapOptics(model, sku, String(chassis.data?.model || ''));
    if (compatible.length === 0) return; // not a TAP this matrix governs

    const label = String(data.label || model || tapId);
    const seen = new Set<string>();

    (data.tappedLinkAllocations || []).forEach((alloc) => {
      // The chassis-side optic is the tool optic; the network side of a passive
      // TAP is a descriptive label, not a part number.
      const optic = alloc.toolOptic || alloc.optic;
      if (!optic || String(optic).startsWith('Passive Optical Splitter')) return;
      if (seen.has(optic) || isTapOpticCompatible(model, sku, optic)) return;
      seen.add(optic);

      errors.push({
        type: 'tap_optic_incompatible',
        nodeId: tapId,
        nodeLabel: label,
        message: `TAP "${label}" (${model}) cannot be terminated into ${optic.split(' ')[0]}. Valid options on "${String(chassis.data?.label || chassis.data?.model)}": ${compatible.map((o) => o.sku).join(', ')}.`,
      });
    });
  });
}

/**
 * A breakout panel (PNL-M341T/M343T) is passive - it has no optics of its
 * own, so correctness depends entirely on what's plugged into the *other*
 * end of each of its links: the MPO side needs a parallel-fibre optic on the
 * connected chassis, and each LC lane needs an optic matching that group's
 * derived speed/fibre-type on whichever device it terminates into.
 */
function validateBreakoutPanels(nodes: CustomNode[], edges: Edge[], errors: ConfigurationValidationError[]) {
  const opticsByNode = new Map<string, Map<string, string>>();
  nodes
    .filter((n) => n.type === NODE_TYPES.HARDWARE)
    .forEach((node) => {
      const model = String(node.data?.model || '');
      const hwData = node.data as HardwareNodeData;
      opticsByNode.set(node.id, getPortOpticMap(getChassisPorts(model, hwData), hwData.optics));
    });

  const isMpoPortId = (portId: string) => /\/m\d+$/.test(portId);
  const mpoGroupId = (lcPortId: string) => lcPortId.replace(/\/\d+$/, '');

  interface PanelLink {
    panelPortId: string;
    peerNode: CustomNode | undefined;
    peerPortId: string | undefined;
  }
  const linksByPanel = new Map<string, PanelLink[]>();

  edges.forEach((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    const sourceIsPanel = sourceNode?.type === NODE_TYPES.HARDWARE && isBreakoutPanelModel(String(sourceNode.data?.model || ''));
    const targetIsPanel = targetNode?.type === NODE_TYPES.HARDWARE && isBreakoutPanelModel(String(targetNode.data?.model || ''));
    if (!sourceIsPanel && !targetIsPanel) return;

    const links = (edge.data?.portLinks as { sourcePortId: string; targetPortId: string }[]) || [];
    const panelNode = (sourceIsPanel ? sourceNode : targetNode)!;
    const panelKey = sourceIsPanel ? ('sourcePortId' as const) : ('targetPortId' as const);
    const peerNode = sourceIsPanel ? targetNode : sourceNode;
    const peerKey = sourceIsPanel ? ('targetPortId' as const) : ('sourcePortId' as const);

    links.forEach((link) => {
      const panelPortId = link[panelKey];
      if (!panelPortId) return;
      if (!linksByPanel.has(panelNode.id)) linksByPanel.set(panelNode.id, []);
      linksByPanel.get(panelNode.id)!.push({ panelPortId, peerNode, peerPortId: link[peerKey] });
    });
  });

  linksByPanel.forEach((panelLinks, panelId) => {
    const panelNode = nodes.find((n) => n.id === panelId);
    const panelModel = String(panelNode?.data?.model || '');
    const panelLabel = String(panelNode?.data?.label || panelModel || panelId);
    const panelFiber = panelFiberType(panelModel);

    // The MPO side determines each group's tier - resolve those first so the
    // LC-side pass below can check lane optics against the right speed.
    const groupChassisOptic = new Map<string, string | undefined>();
    const wiredGroups = new Set<string>();
    panelLinks
      .filter((l) => isMpoPortId(l.panelPortId))
      .forEach(({ panelPortId, peerNode, peerPortId }) => {
        wiredGroups.add(panelPortId);
        const chassisOptic = peerPortId ? opticsByNode.get(peerNode?.id || '')?.get(peerPortId) : undefined;
        groupChassisOptic.set(panelPortId, chassisOptic);
        if (!chassisOptic) return;
        const peerLabel = String(peerNode?.data?.label || peerNode?.data?.model || '');
        if (!isParallelBreakoutOptic(chassisOptic)) {
          errors.push({
            type: 'breakout_optic_incompatible',
            nodeId: peerNode?.id,
            nodeLabel: peerLabel,
            message: `Port ${peerPortId} on "${peerLabel}" feeds breakout panel "${panelLabel}" but is fitted with ${chassisOptic.split(' ')[0]}, which is not a parallel-fibre optic. MPO breakout/aggregation requires SR4 (multimode) or PLR4/PSM4/DR4/DR4+ (singlemode) - not LR4, CWDM4, SWDM4, FR4 or single-lane DR1/FR1.`,
          });
        } else if (panelFiber) {
          // A parallel-fibre optic can still be the wrong *fibre type* for this
          // specific panel model - e.g. a multimode SR4 optic physically can't
          // couple into a PNL-M343T's singlemode MPO/APC trunk connector, even
          // though SR4 is a perfectly valid breakout parent in general.
          const opticFiber = getOpticFiberType(chassisOptic);
          if ((opticFiber === 'MM' || opticFiber === 'SM') && opticFiber !== panelFiber) {
            const panelFiberWord = panelFiber === 'MM' ? 'multimode' : 'singlemode';
            const opticFiberWord = opticFiber === 'MM' ? 'multimode' : 'singlemode';
            errors.push({
              type: 'breakout_panel_fiber_type_mismatch',
              nodeId: peerNode?.id,
              nodeLabel: peerLabel,
              message: `Port ${peerPortId} on "${peerLabel}" feeds breakout panel "${panelLabel}" (${panelModel}, ${panelFiberWord}) with ${chassisOptic.split(' ')[0]}, a ${opticFiberWord} optic. Fit a ${panelFiberWord} parallel-fibre optic (${panelFiber === 'MM' ? 'SR4/SR4-ER' : 'PLR4/PSM4/DR4/DR4+'}) instead - the trunk connector's fibre type must match the panel.`,
            });
          }
        }
      });

    if (wiredGroups.size > PANEL_MPO_GROUPS) {
      errors.push({
        type: 'breakout_panel_capacity_exceeded',
        nodeId: panelId,
        nodeLabel: panelLabel,
        message: `Breakout panel "${panelLabel}" has ${wiredGroups.size} MPO groups wired but only supports ${PANEL_MPO_GROUPS}.`,
      });
    }

    panelLinks
      .filter((l) => !isMpoPortId(l.panelPortId))
      .forEach(({ panelPortId, peerNode, peerPortId }) => {
        const chassisOptic = groupChassisOptic.get(mpoGroupId(panelPortId));
        if (!chassisOptic || !isParallelBreakoutOptic(chassisOptic)) return; // group not (validly) wired yet - nothing to check the lane against
        const laneOptic = peerPortId ? opticsByNode.get(peerNode?.id || '')?.get(peerPortId) : undefined;
        if (!laneOptic) return; // peer end has no catalogue port/optic (e.g. a tool) - nothing to check
        if (!getBreakoutLcOptics(chassisOptic).includes(laneOptic)) {
          errors.push({
            type: 'breakout_lane_speed_mismatch',
            nodeId: peerNode?.id,
            nodeLabel: String(peerNode?.data?.label || peerNode?.data?.model || ''),
            message: `Port ${peerPortId} on "${String(peerNode?.data?.label || peerNode?.data?.model)}" is fitted with ${laneOptic.split(' ')[0]}, which doesn't match breakout panel "${panelLabel}"'s ${chassisOptic.split(' ')[0]} group. Expected: ${getBreakoutLcOptics(chassisOptic).map((o) => o.split(' ')[0]).join(', ')}.`,
          });
        }
      });
  });
}

/**
 * Checks that come from the per-port assignment layer, which the aggregate
 * capacity checks above can't see: a chassis physically running out of cages,
 * and links landing on a cage that's empty or holds the wrong optic type.
 */
function validatePortAssignments(nodes: CustomNode[], edges: Edge[], errors: ConfigurationValidationError[]) {
  const portsByNode = new Map<string, ReturnType<typeof getChassisPorts>>();
  const opticsByNode = new Map<string, Map<string, string>>();

  nodes
    .filter((n) => n.type === NODE_TYPES.HARDWARE)
    .forEach((node) => {
      const model = String(node.data?.model || '');
      const hwData = node.data as HardwareNodeData;
      const ports = getChassisPorts(model, hwData);
      portsByNode.set(node.id, ports);
      opticsByNode.set(node.id, getPortOpticMap(ports, hwData.optics));
    });

  edges.forEach((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    const links = (edge.data?.portLinks as { sourcePortId: string; targetPortId: string }[]) || [];

    [
      { node: targetNode, key: 'targetPortId' as const, peer: sourceNode },
      { node: sourceNode, key: 'sourcePortId' as const, peer: targetNode },
    ].forEach(({ node, key, peer }) => {
      if (!node || node.type !== NODE_TYPES.HARDWARE) return;
      const ports = portsByNode.get(node.id) || [];
      if (ports.length === 0) return; // TAPs carry no catalogue ports

      const label = String(node.data?.label || node.data?.model || node.id);
      const required = getRequiredPortCount(sourceNode, targetNode);
      const allocated = links.filter((l) => l[key]).length;

      if (allocated < required) {
        errors.push({
          type: 'port_capacity_exceeded',
          nodeId: node.id,
          nodeLabel: label,
          message: `Chassis "${label}" has run out of physical ports: the link from "${String(peer?.data?.label || peer?.data?.model || 'peer')}" needs ${required} port${required === 1 ? '' : 's'} but only ${allocated} could be allocated.`,
        });
      }

      // A breakout panel carries no optics of its own - the transceiver that
      // matters for its ports lives on whichever chassis/tool sits on the
      // other end of the link. See validateBreakoutPanels() for the checks
      // that actually apply to a panel's ports.
      if (isBreakoutPanelModel(String(node.data?.model || ''))) return;

      const opticMap = opticsByNode.get(node.id) || new Map<string, string>();
      links.forEach((link) => {
        const portId = link[key];
        if (!portId) return;
        const port = ports.find((p) => p.id === portId);
        if (!port) return;
        const optic = opticMap.get(portId);

        if (!optic) {
          errors.push({
            type: 'port_missing_optic',
            nodeId: node.id,
            nodeLabel: label,
            message: `Port ${portId} on "${label}" carries a link but has no transceiver fitted.`,
          });
          return;
        }

        // Auto-allocation always picks a matching cage, so a mismatch here means
        // the port was pinned by hand to a cage the optic can't physically fit.
        if (getOpticCage(optic) !== port.cage) {
          errors.push({
            type: 'port_optic_mismatch',
            nodeId: node.id,
            nodeLabel: label,
            message: `Port ${portId} on "${label}" is a ${port.cage} cage but is assigned a ${getOpticCage(optic)} transceiver (${optic.split(' ')[0]}).`,
          });
        }
      });
    });
  });
}
