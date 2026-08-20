/**
 * linkResolution.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Diagnostic and automatic resolution logic for network link problems
 * (mismatched transceivers, missing optics, speed/fibre discrepancies).
 *
 * Implements TAA-preference rule (preferring 'T'-suffix variants such as SFP-553T)
 * and intelligent speed upgrade (upgrading lower speed side to higher speed peer).
 */
import type { Edge } from '@xyflow/react';
import type { CustomNode, HardwareNodeData, InstalledOptic, PortLink } from '../store/types';
import { getChassisPorts, getPortOpticMap, resolveTapAllocations } from './ports';
import { getOpticSpeed, getOpticSpeedMbps, getOpticFiberType, isBreakoutPanelModel } from './hardwareUtils';
import { getSupportedBoards } from './opticValidation';
import { syncPortAssignments } from './portSync';
import { syncOpticsOnTapConnection } from './bomEngine';

export interface LinkDiagnosticResult {
  hasProblem: boolean;
  problemType?: 'missing_source_optic' | 'missing_target_optic' | 'missing_both_optics' | 'speed_mismatch' | 'fiber_mismatch' | 'unassigned_ports';
  reason?: string;
  fixActionDescription?: string;
}

/**
 * Finds the best matching optic available on a chassis model to pair with a reference optic.
 * Strictly adheres to TAA preference (preferring 'T'-suffix variants).
 */
export function findBestMatchingOptic(
  targetModel: string,
  referenceOpticStr: string,
  portCapacity?: string,
): { board: string; optic: string } | null {
  const boards = getSupportedBoards(targetModel, portCapacity);
  if (!boards.length) return null;

  const refCleanSku = referenceOpticStr.split(' ')[0].replace(/\[.*?\]/g, '').trim();
  const refSpeed = getOpticSpeed(referenceOpticStr);
  const refFiber = getOpticFiberType(referenceOpticStr);

  const cleanTargetSku = (opt: string) => opt.split(' ')[0].trim();

  // Try exact match first
  for (const b of boards) {
    const exact = b.supportedOptics.find(opt => cleanTargetSku(opt) === refCleanSku || opt === referenceOpticStr);
    if (exact) {
      const taaSku = refCleanSku.endsWith('T') ? refCleanSku : `${refCleanSku}T`;
      const taaMatch = b.supportedOptics.find(opt => cleanTargetSku(opt) === taaSku);
      return { board: b.board, optic: taaMatch || exact };
    }
  }

  // Try matching by TAA variant of the SKU
  const taaSku = refCleanSku.endsWith('T') ? refCleanSku : `${refCleanSku}T`;
  for (const b of boards) {
    const match = b.supportedOptics.find(opt => cleanTargetSku(opt) === taaSku);
    if (match) return { board: b.board, optic: match };
  }

  // Try matching by Speed and Fiber type (preferring TAA variant)
  for (const b of boards) {
    const candidates = b.supportedOptics.filter(opt => {
      const sp = getOpticSpeed(opt);
      const fb = getOpticFiberType(opt);
      if (refSpeed !== 'Unknown' && sp !== refSpeed) return false;
      if (refFiber && fb && fb !== refFiber) return false;
      return true;
    });

    if (candidates.length > 0) {
      const taaCandidate = candidates.find(opt => cleanTargetSku(opt).endsWith('T'));
      return { board: b.board, optic: taaCandidate || candidates[0] };
    }
  }

  // Fallback: Pick any compatible optic for the board with highest speed match
  for (const b of boards) {
    const speedMatch = b.supportedOptics.filter(opt => getOpticSpeed(opt) === refSpeed);
    if (speedMatch.length > 0) {
      const taa = speedMatch.find(opt => cleanTargetSku(opt).endsWith('T'));
      return { board: b.board, optic: taa || speedMatch[0] };
    }
  }

  return null;
}

/**
 * Diagnoses whether a connection edge has any optic or port configuration problem.
 */
export function diagnoseLink(edge: Edge, nodes: CustomNode[]): LinkDiagnosticResult {
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);

  if (!sourceNode || !targetNode) {
    return { hasProblem: false };
  }

  const sourceModel = String(sourceNode.data?.model || sourceNode.type || '');
  const targetModel = String(targetNode.data?.model || targetNode.type || '');

  const isSourceHw = sourceNode.type === 'hardwareNode' && !isBreakoutPanelModel(sourceModel) && !sourceModel.includes('TAP');
  const isTargetHw = targetNode.type === 'hardwareNode' && !isBreakoutPanelModel(targetModel) && !targetModel.includes('TAP');
  const isSourceTap = sourceNode.type === 'inputNode' || sourceModel.includes('TAP');

  const portLinks = (edge.data?.portLinks as PortLink[]) || [];
  const primaryLink = portLinks[0];

  const sourcePortId = primaryLink?.sourcePortId || '';
  const targetPortId = primaryLink?.targetPortId || '';

  // Get source optic
  let sourceOptic = primaryLink?.opticSku || '';
  if (isSourceHw) {
    const hwData = sourceNode.data as HardwareNodeData;
    const ports = getChassisPorts(sourceModel, hwData);
    const opticMap = getPortOpticMap(ports, hwData.optics);
    if (sourcePortId && opticMap.has(sourcePortId)) {
      sourceOptic = opticMap.get(sourcePortId)!;
    }
  } else if (isSourceTap) {
    const hwData = sourceNode.data as HardwareNodeData;
    const allocs = resolveTapAllocations(hwData, 'SFP-532');
    sourceOptic = allocs[0]?.toolOptic || allocs[0]?.optic || (hwData.tappedLinkOptic as string) || 'Passive Optical Splitter';
  }

  // Get target optic
  let targetOptic = '';
  if (isTargetHw) {
    const hwData = targetNode.data as HardwareNodeData;
    const ports = getChassisPorts(targetModel, hwData);
    const opticMap = getPortOpticMap(ports, hwData.optics);
    if (targetPortId && opticMap.has(targetPortId)) {
      targetOptic = opticMap.get(targetPortId)!;
    }
  }

  // Speed and Fiber analysis
  const sourceSpeed = sourceOptic ? getOpticSpeed(sourceOptic) : 'Unknown';
  const targetSpeed = targetOptic ? getOpticSpeed(targetOptic) : 'Unknown';
  const sourceMbps = getOpticSpeedMbps(sourceOptic);
  const targetMbps = getOpticSpeedMbps(targetOptic);
  const sourceFiber = sourceOptic ? getOpticFiberType(sourceOptic) : '';
  const targetFiber = targetOptic ? getOpticFiberType(targetOptic) : '';

  // Case 1: Hardware to Hardware with source optic fitted, but target missing optic
  if (isSourceHw && isTargetHw) {
    if (sourceOptic && !targetOptic) {
      return {
        hasProblem: true,
        problemType: 'missing_target_optic',
        reason: `Target appliance (${targetNode.data?.label || targetModel}) has no transceiver fitted to receive traffic from ${sourceNode.data?.label || sourceModel} (${sourceOptic.split(' ')[0]}).`,
        fixActionDescription: `Auto-fit matching ${sourceSpeed} ${sourceFiber ? `${sourceFiber} ` : ''}transceiver on ${targetNode.data?.label || targetModel}`,
      };
    }
    if (!sourceOptic && targetOptic) {
      return {
        hasProblem: true,
        problemType: 'missing_source_optic',
        reason: `Source appliance (${sourceNode.data?.label || sourceModel}) has no transceiver fitted for the link to ${targetNode.data?.label || targetModel} (${targetOptic.split(' ')[0]}).`,
        fixActionDescription: `Auto-fit matching ${targetSpeed} ${targetFiber ? `${targetFiber} ` : ''}transceiver on ${sourceNode.data?.label || sourceModel}`,
      };
    }
    if (!sourceOptic && !targetOptic) {
      return {
        hasProblem: true,
        problemType: 'missing_both_optics',
        reason: `Neither endpoint has transceivers fitted for this physical link.`,
        fixActionDescription: `Auto-fit standard matching 25G/10G transceivers on both appliances`,
      };
    }
    if (sourceSpeed !== 'Unknown' && targetSpeed !== 'Unknown' && sourceMbps !== targetMbps) {
      const higherSpeed = sourceMbps >= targetMbps ? sourceSpeed : targetSpeed;
      const higherOptic = sourceMbps >= targetMbps ? sourceOptic : targetOptic;
      const nodeToUpgrade = sourceMbps >= targetMbps ? (targetNode.data?.label || targetModel) : (sourceNode.data?.label || sourceModel);
      const nodeToKeep = sourceMbps >= targetMbps ? (sourceNode.data?.label || sourceModel) : (targetNode.data?.label || targetModel);

      return {
        hasProblem: true,
        problemType: 'speed_mismatch',
        reason: `Speed mismatch: ${nodeToKeep} is configured for ${higherSpeed} (${higherOptic.split(' ')[0]}), but ${nodeToUpgrade} is operating at lower rate (${sourceMbps >= targetMbps ? targetSpeed : sourceSpeed}).`,
        fixActionDescription: `Upgrade transceivers to matching ${higherSpeed} data rate on ${nodeToUpgrade}`,
      };
    }
    if (sourceFiber && targetFiber && sourceFiber !== targetFiber) {
      return {
        hasProblem: true,
        problemType: 'fiber_mismatch',
        reason: `Fibre type mismatch: Source uses ${sourceFiber}, while Target uses ${targetFiber}.`,
        fixActionDescription: `Align transceiver optical media to ${sourceFiber} on ${targetNode.data?.label || targetModel}`,
      };
    }
  }

  // Case 2: TAP to Hardware
  if (isSourceTap && isTargetHw) {
    if (!targetOptic) {
      return {
        hasProblem: true,
        problemType: 'missing_target_optic',
        reason: `Appliance ${targetNode.data?.label || targetModel} has no transceivers fitted for TAP feed (${sourceOptic.split(' ')[0]}).`,
        fixActionDescription: `Auto-fit required transceivers on ${targetNode.data?.label || targetModel}`,
      };
    }
    if (sourceSpeed !== 'Unknown' && targetSpeed !== 'Unknown' && sourceMbps !== targetMbps) {
      return {
        hasProblem: true,
        problemType: 'speed_mismatch',
        reason: `Speed mismatch between TAP feed (${sourceSpeed}) and appliance ingress port (${targetSpeed}).`,
        fixActionDescription: `Upgrade ingress transceivers to ${sourceSpeed} on ${targetNode.data?.label || targetModel}`,
      };
    }
  }

  return { hasProblem: false };
}

/**
 * Automatically resolves and aligns transceivers across a link connection.
 */
export function resolveLinkConnectionProblem(
  edge: Edge,
  nodes: CustomNode[],
  edges: Edge[],
): { updatedNodes: CustomNode[]; updatedEdges: Edge[]; message: string } {
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);

  if (!sourceNode || !targetNode) {
    return { updatedNodes: nodes, updatedEdges: edges, message: 'Cannot resolve link: nodes not found.' };
  }

  const diag = diagnoseLink(edge, nodes);
  if (!diag.hasProblem) {
    return { updatedNodes: nodes, updatedEdges: edges, message: 'No connection problems detected on this link.' };
  }

  const sourceModel = String(sourceNode.data?.model || sourceNode.type || '');
  const targetModel = String(targetNode.data?.model || targetNode.type || '');

  const isSourceHw = sourceNode.type === 'hardwareNode' && !isBreakoutPanelModel(sourceModel) && !sourceModel.includes('TAP');
  const isTargetHw = targetNode.type === 'hardwareNode' && !isBreakoutPanelModel(targetModel) && !targetModel.includes('TAP');

  const portLinks = (edge.data?.portLinks as PortLink[]) || [];
  const primaryLink = portLinks[0];
  const sourcePortId = primaryLink?.sourcePortId || '';
  const targetPortId = primaryLink?.targetPortId || '';

  // Get current optics
  let sourceOptic = primaryLink?.opticSku || '';
  if (isSourceHw) {
    const hwData = sourceNode.data as HardwareNodeData;
    const ports = getChassisPorts(sourceModel, hwData);
    const opticMap = getPortOpticMap(ports, hwData.optics);
    if (sourcePortId && opticMap.has(sourcePortId)) {
      sourceOptic = opticMap.get(sourcePortId)!;
    }
  } else if (sourceNode.type === 'inputNode' || sourceModel.includes('TAP')) {
    const hwData = sourceNode.data as HardwareNodeData;
    const allocs = resolveTapAllocations(hwData, 'SFP-532');
    sourceOptic = allocs[0]?.toolOptic || allocs[0]?.optic || (hwData.tappedLinkOptic as string) || 'SFP-532T (10G SFP+ SR)';
  }

  let targetOptic = '';
  if (isTargetHw) {
    const hwData = targetNode.data as HardwareNodeData;
    const ports = getChassisPorts(targetModel, hwData);
    const opticMap = getPortOpticMap(ports, hwData.optics);
    if (targetPortId && opticMap.has(targetPortId)) {
      targetOptic = opticMap.get(targetPortId)!;
    }
  }

  let nodesCopy = nodes.map(n => ({ ...n, data: { ...n.data } }));
  let message = 'Connection problem resolved.';

  // Helper to replace/update optic on a node
  const updateNodeOptics = (
    nodeId: string,
    newOptic: { board: string; optic: string },
    oldOpticStr?: string,
    portId?: string,
  ) => {
    nodesCopy = nodesCopy.map(n => {
      if (n.id !== nodeId) return n;
      const hwData = n.data as HardwareNodeData;
      let currentOptics: InstalledOptic[] = [...(hwData.optics || [])];

      // If there was an old optic on this port or of this type, decrement/remove it
      if (oldOpticStr) {
        const oldClean = oldOpticStr.split(' ')[0].trim();
        if (portId) {
          currentOptics = currentOptics.filter(o => !(o.pinnedPortId === portId));
        }
        const oldIdx = currentOptics.findIndex(o => !o.pinnedPortId && (o.optic.startsWith(oldClean) || o.optic === oldOpticStr));
        if (oldIdx >= 0) {
          if (currentOptics[oldIdx].qty > 1) {
            currentOptics[oldIdx] = { ...currentOptics[oldIdx], qty: currentOptics[oldIdx].qty - 1 };
          } else {
            currentOptics.splice(oldIdx, 1);
          }
        }
      }

      // Add new matching optic
      const matchIdx = currentOptics.findIndex(o => !o.pinnedPortId && o.board === newOptic.board && o.optic === newOptic.optic);
      if (matchIdx >= 0) {
        currentOptics[matchIdx] = { ...currentOptics[matchIdx], qty: currentOptics[matchIdx].qty + 1 };
      } else {
        currentOptics.push({
          board: newOptic.board,
          optic: newOptic.optic,
          qty: 1,
        });
      }

      return { ...n, data: { ...hwData, optics: currentOptics } };
    });
  };

  const sourceMbps = getOpticSpeedMbps(sourceOptic);
  const targetMbps = getOpticSpeedMbps(targetOptic);

  // Scenario 1: Speed mismatch between two hardware chassis -> Upgrade the lower speed side to match higher speed!
  if (isSourceHw && isTargetHw && sourceOptic && targetOptic && sourceMbps !== targetMbps) {
    if (sourceMbps < targetMbps) {
      // Upgrade Source to match Target's higher speed
      const match = findBestMatchingOptic(sourceModel, targetOptic, sourceNode.data?.portCapacity as string);
      if (match) {
        updateNodeOptics(sourceNode.id, match, sourceOptic, sourcePortId);
        message = `Resolved connection: Upgraded ${sourceNode.data?.label || sourceModel} to ${match.optic.split(' ')[0]} to match ${targetNode.data?.label || targetModel} (${targetOptic.split(' ')[0]}).`;
      }
    } else {
      // Upgrade Target to match Source's higher speed
      const match = findBestMatchingOptic(targetModel, sourceOptic, targetNode.data?.portCapacity as string);
      if (match) {
        updateNodeOptics(targetNode.id, match, targetOptic, targetPortId);
        message = `Resolved connection: Upgraded ${targetNode.data?.label || targetModel} to ${match.optic.split(' ')[0]} to match ${sourceNode.data?.label || sourceModel} (${sourceOptic.split(' ')[0]}).`;
      }
    }
  }
  // Scenario 2: Target is missing optic (or fibre mismatch)
  else if (sourceOptic && isTargetHw) {
    const match = findBestMatchingOptic(targetModel, sourceOptic, targetNode.data?.portCapacity as string);
    if (match) {
      updateNodeOptics(targetNode.id, match, targetOptic, targetPortId);
      message = `Resolved connection: Fitted 1x ${match.optic.split(' ')[0]} in ${targetNode.data?.label || targetModel} to match ${sourceNode.data?.label || sourceModel}.`;
    }
  }
  // Scenario 3: Source is missing optic
  else if (targetOptic && isSourceHw) {
    const match = findBestMatchingOptic(sourceModel, targetOptic, sourceNode.data?.portCapacity as string);
    if (match) {
      updateNodeOptics(sourceNode.id, match, sourceOptic, sourcePortId);
      message = `Resolved connection: Fitted 1x ${match.optic.split(' ')[0]} in ${sourceNode.data?.label || sourceModel} to match ${targetNode.data?.label || targetModel}.`;
    }
  }
  // Scenario 4: Neither has optic -> Provision matching pair
  else if (!sourceOptic && !targetOptic && isSourceHw && isTargetHw) {
    const defaultOptic = 'SFP-553T (25G SFP28 LR)';
    const srcMatch = findBestMatchingOptic(sourceModel, defaultOptic) || findBestMatchingOptic(sourceModel, 'SFP-532T (10G SFP+ SR)');
    const tgtMatch = srcMatch ? findBestMatchingOptic(targetModel, srcMatch.optic) : null;

    if (srcMatch && tgtMatch) {
      updateNodeOptics(sourceNode.id, srcMatch);
      updateNodeOptics(targetNode.id, tgtMatch);
      message = `Resolved connection: Fitted matching ${srcMatch.optic.split(' ')[0]} transceivers on both ${sourceNode.data?.label || sourceModel} and ${targetNode.data?.label || targetModel}.`;
    }
  }

  // Update edges with clean portLinks and sync
  const connectedNodes = syncOpticsOnTapConnection(nodesCopy, edges);
  const syncedEdges = syncPortAssignments(connectedNodes, edges);

  return {
    updatedNodes: connectedNodes,
    updatedEdges: syncedEdges,
    message,
  };
}
