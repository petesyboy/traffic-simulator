/**
 * opticReallocation.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Intelligently re-allocates and optimises transceivers and port links across
 * chassis boards.
 *
 * When chassis hardware or port cards are added, removed, or modified after
 * links are already wired, optics and port allocations can become fragmented,
 * over-provisioned, or misaligned across slots.
 *
 * This module derives the exact transceiver requirements for all connected
 * links (incoming TAPs, uplinks, tools, breakout panels), distributes them
 * optimally across physical boards (Base board first, then expansion slots in
 * ascending order), and resets/re-synchronises edge port links in clean,
 * sequential order.
 */

import type { Edge } from '@xyflow/react';
import type { CustomNode, HardwareNodeData, InstalledOptic, PortLink } from '../store/types';
import { NODE_TYPES } from '../constants/nodeTypes';
import {
  getChassisPorts,
  getOpticCage,
  isTapNode,
  resolveTapAllocations,
} from './ports';
import {
  isBreakoutPanelModel,
} from './hardwareUtils';
import { getSupportedBoards } from './opticValidation';
import { syncPortAssignments } from './portSync';
import { resolveOpticSku } from './bom/skuUtils';

export interface RequiredOpticItem {
  optic: string;
  qty: number;
  cage: 'SFP' | 'QSFP' | 'RJ45' | 'MPO';
  purpose: 'tap' | 'uplink' | 'tool' | 'breakout';
  peerNodeId?: string;
}

export interface ReallocationResult {
  updatedNodes: CustomNode[];
  updatedEdges: Edge[];
  totalOpticsCount: number;
  reallocatedLinksCount: number;
  affectedBoards: string[];
  chassisUpdatedCount: number;
}

/**
 * Returns the canonical main/base board key for a chassis model.
 */
function getMainBoardName(supportedBoards: { board: string; supportedOptics: string[] }[]): string {
  const main = supportedBoards.find(
    (b) => b.board.toLowerCase().includes('main') || b.board.toLowerCase().includes('base'),
  );
  return main ? main.board : (supportedBoards[0]?.board || 'Base Ports');
}

/**
 * Derives all required transceiver units for all active connections landing on a chassis.
 */
export function deriveChassisRequiredOptics(
  targetNode: CustomNode,
  nodes: CustomNode[],
  edges: Edge[],
): RequiredOpticItem[] {
  const model = String(targetNode.data?.model || '');
  if (!model || model.includes('TAP') || isBreakoutPanelModel(model)) return [];

  const hwData = targetNode.data as HardwareNodeData;
  const supportedBoards = getSupportedBoards(model, hwData.portCapacity as string);

  const required: RequiredOpticItem[] = [];

  // 1. Incoming Tapped Links
  const incomingTapEdges = edges.filter((e) => {
    if (e.target === targetNode.id) {
      const src = nodes.find((n) => n.id === e.source);
      return isTapNode(src);
    }
    if (e.source === targetNode.id) {
      const tgt = nodes.find((n) => n.id === e.target);
      return isTapNode(tgt);
    }
    return false;
  });
  const uniqueTapSourceIds = Array.from(
    new Set(incomingTapEdges.map((e) => (e.target === targetNode.id ? e.source : e.target))),
  );

  uniqueTapSourceIds.forEach((srcId) => {
    const tapNode = nodes.find((n) => n.id === srcId);
    if (!tapNode || !isTapNode(tapNode)) return;

    const isHardwareTap = tapNode.type === NODE_TYPES.HARDWARE && String(tapNode.data?.model || '').includes('TAP');
    const isSMTap = isHardwareTap
      ? String(tapNode.data?.sku || '').includes('253') ||
        String(tapNode.data?.sku || '').includes('273') ||
        String(tapNode.data?.sku || '').includes('453') ||
        String(tapNode.data?.model || '').toLowerCase().includes('single-mode') ||
        String(tapNode.data?.model || '').toLowerCase().includes('sm') ||
        String(tapNode.data?.sku || '').includes('253T') ||
        String(tapNode.data?.sku || '').includes('273T') ||
        String(tapNode.data?.sku || '').includes('453T')
      : tapNode.data?.tapFiberMode === 'Singlemode';

    const isM506T =
      String(tapNode.data?.model || '').includes('TAP-M506T') || String(tapNode.data?.sku || '').includes('TAP-M506T');
    const defaultOptic = isM506T ? 'QSB-523T' : isSMTap ? 'SFP-533T' : 'SFP-532T';

    const allocations = resolveTapAllocations(tapNode.data as HardwareNodeData, defaultOptic);

    allocations.forEach((alloc) => {
      const rawOptic = alloc.toolOptic || alloc.optic || defaultOptic;
      const targetOptic = resolveOpticToChassisCatalogue(rawOptic, model, supportedBoards);
      const cage = getOpticCage(targetOptic);
      // Each tapped link produces 2 feeds (North & South) into the chassis
      const neededQty = alloc.qty * 2;

      required.push({
        optic: targetOptic,
        qty: neededQty,
        cage,
        purpose: 'tap',
        peerNodeId: tapNode.id,
      });
    });
  });

  // 2. Chassis-to-Chassis Uplinks / Crossover Links
  const peerChassisEdges = edges.filter((e) => {
    const isConnected = e.source === targetNode.id || e.target === targetNode.id;
    if (!isConnected) return false;
    const peerId = e.source === targetNode.id ? e.target : e.source;
    const peer = nodes.find((n) => n.id === peerId);
    return peer && peer.type === NODE_TYPES.HARDWARE && !isTapNode(peer) && !isBreakoutPanelModel(String(peer.data?.model || ''));
  });

  peerChassisEdges.forEach((edge) => {
    const peerId = edge.source === targetNode.id ? edge.target : edge.source;
    const peer = nodes.find((n) => n.id === peerId);
    const existingLinks = (edge.data?.portLinks as PortLink[]) || [];
    const linkCount = Math.max(1, existingLinks.length);

    for (let i = 0; i < linkCount; i++) {
      const link = existingLinks[i];
      let uplinkOptic = link?.opticSku || '';
      if (!uplinkOptic || uplinkOptic === 'undefined') {
        // Default to best QSFP/SFP uplink optic supported by both
        uplinkOptic = resolveDefaultUplinkOptic(String(peer?.data?.model || ''), supportedBoards);
      } else {
        uplinkOptic = resolveOpticToChassisCatalogue(uplinkOptic, model, supportedBoards);
      }

      required.push({
        optic: uplinkOptic,
        qty: 1,
        cage: getOpticCage(uplinkOptic),
        purpose: 'uplink',
        peerNodeId: peerId,
      });
    }
  });

  // 3. Outgoing Tool Links
  const toolEdges = edges.filter((e) => {
    const isConnected = e.source === targetNode.id || e.target === targetNode.id;
    if (!isConnected) return false;
    const peerId = e.source === targetNode.id ? e.target : e.source;
    const peer = nodes.find((n) => n.id === peerId);
    return peer && (peer.type === 'toolNode' || (peer.type === 'clusterNode' && peer.data?.clusterType === 'tool'));
  });

  toolEdges.forEach((edge) => {
    const peerId = edge.source === targetNode.id ? edge.target : edge.source;
    const existingLinks = (edge.data?.portLinks as PortLink[]) || [];
    const linkCount = Math.max(1, existingLinks.length);

    for (let i = 0; i < linkCount; i++) {
      const link = existingLinks[i];
      let toolOptic = link?.opticSku || '';
      if (!toolOptic || toolOptic === 'undefined') {
        // Default tool ingest optic (10G SFP+ SR or 100G depending on tool node config)
        toolOptic = resolveDefaultToolOptic(supportedBoards);
      } else {
        toolOptic = resolveOpticToChassisCatalogue(toolOptic, model, supportedBoards);
      }

      required.push({
        optic: toolOptic,
        qty: 1,
        cage: getOpticCage(toolOptic),
        purpose: 'tool',
        peerNodeId: peerId,
      });
    }
  });

  // 4. Breakout Panel Links
  const breakoutEdges = edges.filter((e) => {
    const isConnected = e.source === targetNode.id || e.target === targetNode.id;
    if (!isConnected) return false;
    const peerId = e.source === targetNode.id ? e.target : e.source;
    const peer = nodes.find((n) => n.id === peerId);
    return peer && peer.type === NODE_TYPES.HARDWARE && isBreakoutPanelModel(String(peer.data?.model || ''));
  });

  breakoutEdges.forEach((edge) => {
    const peerId = edge.source === targetNode.id ? edge.target : edge.source;
    const peer = nodes.find((n) => n.id === peerId);
    const panelModel = String(peer?.data?.model || '');
    const isSmPanel = panelModel.includes('343') || panelModel.toLowerCase().includes('sm');
    const breakoutOptic = isSmPanel ? 'Q28-506T (100G QSFP28 PSM4)' : 'Q28-502T (100G QSFP28 SR4)';
    const resolvedOptic = resolveOpticToChassisCatalogue(breakoutOptic, model, supportedBoards);

    required.push({
      optic: resolvedOptic,
      qty: 1,
      cage: getOpticCage(resolvedOptic),
      purpose: 'breakout',
      peerNodeId: peerId,
    });
  });

  return required;
}

/**
 * Resolves a requested optic identifier/string to the exact catalog label on this chassis.
 */
function resolveOpticToChassisCatalogue(
  opticStr: string,
  model: string,
  supportedBoards: { board: string; supportedOptics: string[] }[],
): string {
  const targetSku = resolveOpticSku(opticStr, model);
  for (const b of supportedBoards) {
    const match = b.supportedOptics.find((opt) => {
      const s = opt.split(' ')[0].toUpperCase();
      return s === targetSku || opt === opticStr;
    });
    if (match) return match;
  }

  // If exact SKU wasn't found, try TAA / non-TAA counterpart
  const altSku = targetSku.endsWith('T') ? targetSku.slice(0, -1) : targetSku + 'T';
  for (const b of supportedBoards) {
    const match = b.supportedOptics.find((opt) => opt.split(' ')[0].toUpperCase() === altSku);
    if (match) return match;
  }

  // Fallback to first supported optic matching the cage type
  const cage = getOpticCage(opticStr);
  for (const b of supportedBoards) {
    const match = b.supportedOptics.find((opt) => getOpticCage(opt) === cage);
    if (match) return match;
  }

  return opticStr;
}

/**
 * Resolves default uplink transceiver between two chassis models.
 */
function resolveDefaultUplinkOptic(
  modelB: string,
  supportedBoardsA: { board: string; supportedOptics: string[] }[],
): string {
  const supportedBoardsB = getSupportedBoards(modelB);
  const opticsB = new Set<string>();
  supportedBoardsB.forEach((b) => b.supportedOptics.forEach((opt) => opticsB.add(opt.split(' ')[0].toUpperCase())));

  // Prefer 100G QSFP28 LR4 / SR4
  const preferredSkus = ['Q28-503T', 'Q28-502T', 'Q28-503', 'Q28-502', 'QSF-503T', 'QSF-502T', 'SFP-533T', 'SFP-532T'];
  for (const sku of preferredSkus) {
    if (opticsB.has(sku)) {
      for (const b of supportedBoardsA) {
        const match = b.supportedOptics.find((opt) => opt.split(' ')[0].toUpperCase() === sku);
        if (match) return match;
      }
    }
  }

  // Default to first QSFP or SFP optic on Model A
  for (const b of supportedBoardsA) {
    const qsfp = b.supportedOptics.find((opt) => getOpticCage(opt) === 'QSFP');
    if (qsfp) return qsfp;
  }
  return supportedBoardsA[0]?.supportedOptics[0] || 'SFP-532T (10G SFP+ SR)';
}

/**
 * Resolves default tool ingest transceiver for a chassis model.
 */
function resolveDefaultToolOptic(
  supportedBoards: { board: string; supportedOptics: string[] }[],
): string {
  const preferredSkus = ['SFP-532T', 'SFP-533T', 'SFP-532', 'SFP-533', 'SFP-502T', 'Q28-502T'];
  for (const sku of preferredSkus) {
    for (const b of supportedBoards) {
      const match = b.supportedOptics.find((opt) => opt.split(' ')[0].toUpperCase() === sku);
      if (match) return match;
    }
  }
  return supportedBoards[0]?.supportedOptics[0] || 'SFP-532T (10G SFP+ SR)';
}

interface BoardSlotCapacity {
  boardName: string;
  slotIndex: number; // 0 for base/main board, 1..N for expansion slots
  totalSfp: number;
  remainingSfp: number;
  totalQsfp: number;
  remainingQsfp: number;
  supportedOptics: string[];
}

/**
 * Distributes required transceivers cleanly across available physical boards.
 * Fills the Main/Base board first, then expansion slots in ascending slot order.
 */
export function distributeOpticsAcrossBoards(
  model: string,
  hwData: HardwareNodeData,
  requiredOptics: RequiredOpticItem[],
): { installedOptics: InstalledOptic[]; affectedBoards: string[] } {
  const supportedBoards = getSupportedBoards(model, hwData.portCapacity as string);
  const chassisPorts = getChassisPorts(model, hwData);
  const installedBoards = hwData.installedBoards || {};

  // Build ordered list of physical boards
  const boardSlots: BoardSlotCapacity[] = [];

  const mainBoardName = getMainBoardName(supportedBoards);
  const mainBoardObj = supportedBoards.find((b) => b.board === mainBoardName) || supportedBoards[0];
  const mainPorts = chassisPorts.filter((p) => p.board === mainBoardName || p.board.toLowerCase().includes('base') || p.board.toLowerCase().includes('main'));
  const mainSfpCount = mainPorts.filter((p) => p.cage === 'SFP').length;
  const mainQsfpCount = mainPorts.filter((p) => p.cage === 'QSFP').length;

  if (mainPorts.length > 0) {
    boardSlots.push({
      boardName: mainBoardName,
      slotIndex: 0,
      totalSfp: mainSfpCount,
      remainingSfp: mainSfpCount,
      totalQsfp: mainQsfpCount,
      remainingQsfp: mainQsfpCount,
      supportedOptics: mainBoardObj ? mainBoardObj.supportedOptics : [],
    });
  }

  // Add installed expansion modules sorted by slot number (1, 2, 3...)
  const slotEntries = Object.entries(installedBoards)
    .filter(([_, boardSku]) => !!boardSku)
    .sort(([slotA], [slotB]) => parseInt(slotA, 10) - parseInt(slotB, 10));

  slotEntries.forEach(([slotIdx, boardSku]) => {
    const slotNum = parseInt(slotIdx, 10);
    const boardKey = `${boardSku} (Slot ${slotIdx})`;
    const moduleTemplate = supportedBoards.find((b) => b.board === boardSku);
    const modulePorts = chassisPorts.filter((p) => p.board === boardKey);
    const modSfpCount = modulePorts.filter((p) => p.cage === 'SFP').length;
    const modQsfpCount = modulePorts.filter((p) => p.cage === 'QSFP').length;

    if (modulePorts.length > 0) {
      boardSlots.push({
        boardName: boardKey,
        slotIndex: slotNum,
        totalSfp: modSfpCount,
        remainingSfp: modSfpCount,
        totalQsfp: modQsfpCount,
        remainingQsfp: modQsfpCount,
        supportedOptics: moduleTemplate ? moduleTemplate.supportedOptics : [],
      });
    }
  });

  // Track allocations: Map<boardName, { autoMap: Map<opticLabel, number>, manualMap: Map<opticLabel, number> }>
  const placedMap = new Map<string, { autoMap: Map<string, number>; manualMap: Map<string, number> }>();
  boardSlots.forEach((b) =>
    placedMap.set(b.boardName, { autoMap: new Map<string, number>(), manualMap: new Map<string, number>() }),
  );

  // Consolidate required optics by key: `${optic}:::${isAuto ? '1' : '0'}`
  const consolidated = new Map<string, { optic: string; isAuto: boolean; qty: number }>();
  requiredOptics.forEach((item) => {
    const isAuto = item.purpose === 'tap';
    const key = `${item.optic}:::${isAuto ? '1' : '0'}`;
    const cur = consolidated.get(key);
    if (cur) {
      cur.qty += item.qty;
    } else {
      consolidated.set(key, { optic: item.optic, isAuto, qty: item.qty });
    }
  });

  // Sort optics: Place QSFP optics first, then SFP optics
  const sortedOptics = Array.from(consolidated.values()).sort((a, b) => {
    const cageA = getOpticCage(a.optic);
    const cageB = getOpticCage(b.optic);
    if (cageA === 'QSFP' && cageB !== 'QSFP') return -1;
    if (cageA !== 'QSFP' && cageB === 'QSFP') return 1;
    return a.optic.localeCompare(b.optic);
  });

  // Distribute each optic into the best available board
  for (const item of sortedOptics) {
    let unitsRemaining = item.qty;
    const cage = getOpticCage(item.optic);

    for (const board of boardSlots) {
      if (unitsRemaining <= 0) break;
      const isSupported = board.supportedOptics.some(
        (opt) => opt.split(' ')[0] === item.optic.split(' ')[0] || opt === item.optic,
      );
      if (!isSupported) continue;

      const freeCages = cage === 'QSFP' ? board.remainingQsfp : board.remainingSfp;
      if (freeCages <= 0) continue;

      const toPlace = Math.min(unitsRemaining, freeCages);
      if (cage === 'QSFP') {
        board.remainingQsfp -= toPlace;
      } else {
        board.remainingSfp -= toPlace;
      }
      unitsRemaining -= toPlace;

      const boardMaps = placedMap.get(board.boardName)!;
      const targetMap = item.isAuto ? boardMaps.autoMap : boardMaps.manualMap;
      targetMap.set(item.optic, (targetMap.get(item.optic) || 0) + toPlace);
    }

    // If units still remain because all boards are full, place on first board with capacity as fallback
    if (unitsRemaining > 0 && boardSlots.length > 0) {
      const fallbackBoard =
        boardSlots.find((b) => b.totalSfp > 0 || b.totalQsfp > 0)?.boardName || boardSlots[0].boardName;
      const boardMaps = placedMap.get(fallbackBoard);
      if (boardMaps) {
        const targetMap = item.isAuto ? boardMaps.autoMap : boardMaps.manualMap;
        targetMap.set(item.optic, (targetMap.get(item.optic) || 0) + unitsRemaining);
      }
    }
  }

  // Construct final InstalledOptic array
  const installedOptics: InstalledOptic[] = [];
  const affectedBoards = new Set<string>();

  boardSlots.forEach((b) => {
    const boardMaps = placedMap.get(b.boardName);
    if (!boardMaps) return;

    // First push manual/tool/uplink optics
    boardMaps.manualMap.forEach((qty, optic) => {
      if (qty > 0) {
        installedOptics.push({
          board: b.boardName,
          optic,
          qty,
        });
        affectedBoards.add(b.boardName);
      }
    });

    // Then push auto-added TAP optics
    boardMaps.autoMap.forEach((qty, optic) => {
      if (qty > 0) {
        installedOptics.push({
          board: b.boardName,
          optic,
          qty,
          isAutoAdded: true,
        });
        affectedBoards.add(b.boardName);
      }
    });
  });

  return {
    installedOptics,
    affectedBoards: Array.from(affectedBoards),
  };
}

/**
 * Re-allocates and optimises all transceivers and port mappings for a single chassis node.
 */
export function reallocateChassisOpticsAndPorts(
  targetNodeId: string,
  nodes: CustomNode[],
  edges: Edge[],
): ReallocationResult {
  const targetNode = nodes.find((n) => n.id === targetNodeId);
  if (!targetNode || targetNode.type !== NODE_TYPES.HARDWARE || String(targetNode.data?.model || '').includes('TAP')) {
    return {
      updatedNodes: nodes,
      updatedEdges: edges,
      totalOpticsCount: 0,
      reallocatedLinksCount: 0,
      affectedBoards: [],
      chassisUpdatedCount: 0,
    };
  }

  const model = String(targetNode.data?.model || '');
  const hwData = targetNode.data as HardwareNodeData;

  // 1. Derive exact required optics from connected topology
  const required = deriveChassisRequiredOptics(targetNode, nodes, edges);

  // 2. Distribute optics cleanly across available boards (Main board first, then expansion slots)
  const { installedOptics, affectedBoards } = distributeOpticsAcrossBoards(model, hwData, required);

  // 3. Update the node's installed optics
  const updatedNodes = nodes.map((node) => {
    if (node.id !== targetNodeId) return node;
    return {
      ...node,
      data: {
        ...node.data,
        optics: installedOptics,
      },
    };
  });

  // 4. Reset connected edge port links for this chassis to allow fresh sequential auto-allocation
  let reallocatedLinksCount = 0;
  const unpinnedEdges = edges.map((edge) => {
    if (edge.source !== targetNodeId && edge.target !== targetNodeId) return edge;
    const isSource = edge.source === targetNodeId;
    const isTarget = edge.target === targetNodeId;
    const links = ((edge.data?.portLinks as PortLink[]) || []).map((link) => {
      reallocatedLinksCount++;
      return {
        ...link,
        sourcePortId: isSource ? '' : link.sourcePortId,
        targetPortId: isTarget ? '' : link.targetPortId,
        pinned: false,
      };
    });
    return {
      ...edge,
      data: {
        ...edge.data,
        portLinks: links,
      },
    };
  });

  // 5. Re-derive all port links deterministically
  const syncedEdges = syncPortAssignments(updatedNodes, unpinnedEdges);

  const totalOpticsCount = installedOptics.reduce((sum, o) => sum + o.qty, 0);

  return {
    updatedNodes,
    updatedEdges: syncedEdges,
    totalOpticsCount,
    reallocatedLinksCount,
    affectedBoards,
    chassisUpdatedCount: 1,
  };
}

/**
 * Re-allocates and optimises transceivers and port mappings project-wide across all chassis.
 */
export function reallocateAllProjectOpticsAndPorts(
  nodes: CustomNode[],
  edges: Edge[],
): ReallocationResult {
  let currentNodes = [...nodes];
  let currentEdges = [...edges];
  let totalOpticsCount = 0;
  let reallocatedLinksCount = 0;
  const affectedBoards = new Set<string>();
  let chassisUpdatedCount = 0;

  const chassisNodes = nodes.filter(
    (n) => n.type === NODE_TYPES.HARDWARE && !String(n.data?.model || '').includes('TAP') && !isBreakoutPanelModel(String(n.data?.model || '')),
  );

  for (const chassis of chassisNodes) {
    const res = reallocateChassisOpticsAndPorts(chassis.id, currentNodes, currentEdges);
    currentNodes = res.updatedNodes;
    currentEdges = res.updatedEdges;
    totalOpticsCount += res.totalOpticsCount;
    reallocatedLinksCount += res.reallocatedLinksCount;
    res.affectedBoards.forEach((b) => affectedBoards.add(b));
    chassisUpdatedCount++;
  }

  return {
    updatedNodes: currentNodes,
    updatedEdges: currentEdges,
    totalOpticsCount,
    reallocatedLinksCount,
    affectedBoards: Array.from(affectedBoards),
    chassisUpdatedCount,
  };
}
