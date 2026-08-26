import type { CustomNode } from '../store/store';
import type { Edge } from '@xyflow/react';
import type { HardwareNodeData, InstalledOptic } from '../store/types';
import { NODE_TYPES, CONFIG_TYPES } from '../constants/nodeTypes';
import { getOpticFiberType, getOpticSpeed } from './hardwareUtils';
import { syncOpticsOnTapConnection } from './bom/bomGenerator';
import { getOpticCage } from './ports';
import { getSupportedBoards } from './opticValidation';

export interface BulkReplaceOpticOptions {
  targetNodeId?: string; // If undefined, applies project-wide to all chassis nodes
  sourceOptic: string;   // e.g. "SFP-533 (10G SFP+ LR)" or "SFP-533"
  targetOptic: string;   // e.g. "SFP-533T (10G SFP+ LR TAA)" or "SFP-532 (10G SFP+ SR)"
  syncConnectedTaps?: boolean; // Whether to update connected TAP allocations and media
}

export interface BulkReplaceResult {
  updatedNodes: CustomNode[];
  replacedChassisOpticCount: number;
  updatedTapCount: number;
  fiberModeChanged: boolean;
  sourceFiberMode: string;
  targetFiberMode: string;
}

/**
 * Returns candidate replacement optics for a given optic on a hardware model,
 * constrained to compatible cages (e.g. SFP -> SFP, QSFP -> QSFP) and sorted logically.
 */
export function getCandidateReplacementOptics(model: string, currentOptic: string): string[] {
  const currentCage = getOpticCage(currentOptic);
  const currentSpeed = getOpticSpeed(currentOptic);
  const currentFiber = getOpticFiberType(currentOptic);
  const currentSku = currentOptic.split(' ')[0].trim().toUpperCase();

  const boards = getSupportedBoards(model);
  const allSupportedOptics = new Set<string>();
  boards.forEach((b) => b.supportedOptics.forEach((opt) => allSupportedOptics.add(opt)));

  const candidates = Array.from(allSupportedOptics).filter((opt) => {
    const cage = getOpticCage(opt);
    const sku = opt.split(' ')[0].trim().toUpperCase();
    if (sku === currentSku) return false; // Exclude exact same SKU
    return cage === currentCage;
  });

  return candidates.sort((a, b) => {
    const speedA = getOpticSpeed(a);
    const speedB = getOpticSpeed(b);
    const fiberA = getOpticFiberType(a);
    const fiberB = getOpticFiberType(b);
    const skuA = a.split(' ')[0].toUpperCase();
    const skuB = b.split(' ')[0].toUpperCase();

    // 1. Same speed and same fiber mode first (e.g. TAA swap)
    const exactMatchA = speedA === currentSpeed && fiberA === currentFiber ? 1 : 0;
    const exactMatchB = speedB === currentSpeed && fiberB === currentFiber ? 1 : 0;
    if (exactMatchA !== exactMatchB) return exactMatchB - exactMatchA;

    // 2. Same speed alternative media next
    const sameSpeedA = speedA === currentSpeed ? 1 : 0;
    const sameSpeedB = speedB === currentSpeed ? 1 : 0;
    if (sameSpeedA !== sameSpeedB) return sameSpeedB - sameSpeedA;

    // 3. Prefer TAA compliant variant if available
    const isTaaA = skuA.endsWith('T') ? 1 : 0;
    const isTaaB = skuB.endsWith('T') ? 1 : 0;
    if (isTaaA !== isTaaB) return isTaaB - isTaaA;

    return a.localeCompare(b);
  });
}

/**
 * Executes a bulk replacement of optics across a specific node or project-wide,
 * intelligently keeping connected TAP nodes, link allocations, and fiber media in sync.
 */
export function performOpticBulkReplace(
  nodes: CustomNode[],
  edges: Edge[],
  options: BulkReplaceOpticOptions,
): BulkReplaceResult {
  const { targetNodeId, sourceOptic, targetOptic, syncConnectedTaps = true } = options;

  const sourceSku = sourceOptic.split(' ')[0].trim().toUpperCase();
  const targetSku = targetOptic.split(' ')[0].trim().toUpperCase();

  const sourceFiberMode = getOpticFiberType(sourceOptic);
  const targetFiberMode = getOpticFiberType(targetOptic);
  const fiberModeChanged = sourceFiberMode !== targetFiberMode && !!sourceFiberMode && !!targetFiberMode;

  let replacedChassisOpticCount = 0;
  let updatedTapCount = 0;

  // Determine which TAP nodes are in scope
  const targetChassisIds = targetNodeId
    ? new Set([targetNodeId])
    : new Set(
        nodes
          .filter((n) => n.type === NODE_TYPES.HARDWARE && !String(n.data?.model || '').includes('TAP'))
          .map((n) => n.id),
      );

  const relevantTapIds = new Set<string>();
  edges.forEach((e) => {
    if (targetChassisIds.has(e.target)) {
      relevantTapIds.add(e.source);
    }
    if (targetChassisIds.has(e.source)) {
      relevantTapIds.add(e.target);
    }
  });

  const updatedNodes = nodes.map((node) => {
    // 1. Update Chassis Node installed optics
    if (node.type === NODE_TYPES.HARDWARE && !String(node.data?.model || '').includes('TAP')) {
      if (targetNodeId && node.id !== targetNodeId) {
        return node;
      }

      const hwData = node.data as HardwareNodeData;
      const currentOptics: InstalledOptic[] = hwData.optics || [];
      let nodeOpticsChanged = false;

      const nextOptics: InstalledOptic[] = currentOptics.map((opt) => {
        const optSku = opt.optic.split(' ')[0].trim().toUpperCase();
        if (optSku === sourceSku || opt.optic === sourceOptic) {
          replacedChassisOpticCount += opt.qty;
          nodeOpticsChanged = true;
          return {
            ...opt,
            optic: targetOptic,
          };
        }
        return opt;
      });

      if (nodeOpticsChanged) {
        return {
          ...node,
          data: {
            ...node.data,
            optics: nextOptics,
          },
        };
      }
      return node;
    }

    // 2. Update Connected TAP Nodes
    if (syncConnectedTaps) {
      const isTargetTap = targetNodeId ? relevantTapIds.has(node.id) : true;
      const isHardwareTap = node.type === NODE_TYPES.HARDWARE && String(node.data?.model || '').includes('TAP');
      const isInputTap = node.type === NODE_TYPES.INPUT && node.data?.configType === CONFIG_TYPES.TAP;

      if (isTargetTap && (isHardwareTap || isInputTap)) {
        let tapChanged = false;
        const hwData = node.data as HardwareNodeData;
        const currentTappedOptic = String(hwData.tappedLinkOptic || '');
        const currentOpticSku = currentTappedOptic.split(' ')[0].trim().toUpperCase();

        let nextTappedLinkOptic = hwData.tappedLinkOptic;
        if (currentOpticSku === sourceSku || currentTappedOptic === sourceOptic) {
          nextTappedLinkOptic = targetSku;
          tapChanged = true;
        }

        let nextAllocations = hwData.tappedLinkAllocations;
        if (Array.isArray(hwData.tappedLinkAllocations)) {
          nextAllocations = hwData.tappedLinkAllocations.map((alloc) => {
            let allocChanged = false;
            let updatedOptic = alloc.optic;
            let updatedToolOptic = alloc.toolOptic;

            if (alloc.optic && (alloc.optic.split(' ')[0].trim().toUpperCase() === sourceSku || alloc.optic === sourceOptic)) {
              updatedOptic = targetSku;
              allocChanged = true;
            }
            if (alloc.toolOptic && (alloc.toolOptic.split(' ')[0].trim().toUpperCase() === sourceSku || alloc.toolOptic === sourceOptic)) {
              updatedToolOptic = targetSku;
              allocChanged = true;
            }

            if (allocChanged) {
              tapChanged = true;
              return { ...alloc, optic: updatedOptic, toolOptic: updatedToolOptic };
            }
            return alloc;
          });
        }

        // Handle fiber mode change on TAP hardware & input nodes
        let nextSku = hwData.sku;
        let nextModel = hwData.model;
        let nextTapFiberMode = hwData.tapFiberMode;

        if (fiberModeChanged && tapChanged) {
          if (isInputTap) {
            nextTapFiberMode = targetFiberMode === 'SM' ? 'Singlemode' : 'Multimode';
          } else if (isHardwareTap) {
            const isTaa = String(hwData.sku || '').endsWith('T') || String(hwData.model || '').endsWith('T');
            if (targetFiberMode === 'MM') {
              // Convert to Multimode TAP
              if (String(hwData.sku || '').includes('273') || String(hwData.sku || '').includes('453')) {
                nextSku = isTaa ? 'TAP-M253T' : 'TAP-M253';
                nextModel = `G-TAP M Series ${nextSku}`;
              } else if (String(hwData.sku || '').includes('503')) {
                nextSku = isTaa ? 'TAP-M501T' : 'TAP-M501';
                nextModel = `G-TAP M Series ${nextSku}`;
              }
              nextTapFiberMode = 'Multimode';
            } else if (targetFiberMode === 'SM') {
              // Convert to Single-mode TAP
              if (String(hwData.sku || '').includes('253') || String(hwData.sku || '').includes('251')) {
                nextSku = isTaa ? 'TAP-M273T' : 'TAP-M273';
                nextModel = `G-TAP M Series ${nextSku}`;
              } else if (String(hwData.sku || '').includes('501')) {
                nextSku = isTaa ? 'TAP-M503T' : 'TAP-M503';
                nextModel = `G-TAP M Series ${nextSku}`;
              }
              nextTapFiberMode = 'Singlemode';
            }
          }
        }

        if (tapChanged) {
          updatedTapCount++;
          return {
            ...node,
            data: {
              ...node.data,
              tappedLinkOptic: nextTappedLinkOptic,
              tappedLinkAllocations: nextAllocations,
              sku: nextSku,
              model: nextModel,
              tapFiberMode: nextTapFiberMode,
            },
          };
        }
      }
    }

    return node;
  });

  // Re-synchronize auto-added optics on all chassis nodes to reflect any TAP updates
  const finalNodes = syncOpticsOnTapConnection(updatedNodes, edges);

  return {
    updatedNodes: finalNodes,
    replacedChassisOpticCount,
    updatedTapCount,
    fiberModeChanged,
    sourceFiberMode,
    targetFiberMode,
  };
}
