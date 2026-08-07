/**
 * breakoutRules.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared classification rules for MPO breakout panels (PNL-M341T multimode /
 * PNL-M343T singlemode). A panel is passive: it has no optics of its own, so
 * correctness lives entirely in what's plugged into the *other* end of each of
 * its links - the parallel-fibre parent optic on the GigaVUE chassis side, and
 * the matching LC-speed optic on whichever device sits on the LC side.
 *
 * See src/utils/ports.ts (getPanelPorts) for the panel's own port model and
 * src/utils/bom/configValidator.ts (validateBreakoutPanels) for how these
 * rules get enforced against an actual topology.
 */
import type { Edge } from '@xyflow/react';
import type { ChassisPort, CustomNode } from '../store/types';
import { getOpticSpeed, getOpticFiberType, isBreakoutPanelModel } from './hardwareUtils';

/** A panel has exactly 3 independent MPO sections, matching the physical unit. */
export const PANEL_MPO_GROUPS = 3;
/** Each MPO section fans out to exactly 4 LC connections. */
export const PANEL_LC_PER_GROUP = 4;

export type BreakoutParentSpeed = '40G' | '100G' | '400G';
export type BreakoutLaneSpeed = '10G' | '25G' | '100G';

/**
 * Parallel-fibre standards - the only optics legal as the parent (MPO-side)
 * optic of a breakout/aggregation link. Ordinary single-lambda optics (LR4,
 * CWDM4, SWDM4, FR4, ER4, and single-lane DR1/FR1) are NOT valid here, even
 * though several of them are otherwise perfectly normal optics elsewhere -
 * MPO breakout can't physically wire from a single-lambda transceiver.
 * Matches on a distinct "4" or "+" suffix so it never accidentally matches a
 * single-lane sibling (e.g. 'SR4' but not 'SR', 'DR4'/'DR4+' but not 'DR1').
 */
const PARALLEL_STANDARD = /\b(SR4|PLR4|PSM4|DR4\+?)\b/i;

export function isParallelBreakoutOptic(opticStr: string): boolean {
  return PARALLEL_STANDARD.test(opticStr);
}

const LANE_SPEED_BY_PARENT: Record<BreakoutParentSpeed, BreakoutLaneSpeed> = {
  '40G': '10G',
  '100G': '25G',
  '400G': '100G',
};

/** The speed each of a parent optic's 4 breakout lanes runs at. */
export function getBreakoutLaneSpeed(parentSpeed: BreakoutParentSpeed): BreakoutLaneSpeed {
  return LANE_SPEED_BY_PARENT[parentSpeed];
}

/**
 * The LC-side optic-string options for a given parent (MPO-side) optic,
 * keyed by its speed and fibre type. The 400G tier's LC-side optic is a
 * single-lane QSFP28 (Q28-*), not an SFP28, despite landing on the panel's
 * same physical LC duplex connector as the 10G/25G tiers - see the comment
 * on getPanelPorts() in ports.ts for how that's handled in the port model.
 */
export function getBreakoutLcOptics(parentOpticStr: string): string[] {
  const speed = getOpticSpeed(parentOpticStr);
  const fiberType = getOpticFiberType(parentOpticStr);
  const isMM = fiberType === 'MM';

  if (speed === '40G') {
    return isMM
      ? ['SFP-532 (10G SFP+ SR)', 'SFP-532T (10G SFP+ SR)']
      : ['SFP-533 (10G SFP+ LR)', 'SFP-533T (10G SFP+ LR)'];
  }
  if (speed === '100G') {
    return isMM
      ? ['SFP-552 (25G SFP28 SR)', 'SFP-552T (25G SFP28 SR)']
      : ['SFP-553T (25G SFP28 LR)'];
  }
  if (speed === '400G') {
    return isMM
      ? ['Q28-515 (100G QSFP28 SR)']
      : ['Q28-511T (100G QSFP28 DR1)', 'Q28-514 (100G QSFP28 FR1)'];
  }
  return [];
}

/** A port id ending in '/m<n>' (e.g. '1/1/m1') is a breakout panel's MPO
 *  connector, as opposed to one of its '/m<n>/<lane>' LC legs. */
export const isMpoPortId = (portId: string) => /\/m\d+$/.test(portId);

/**
 * True when the given board already has a cage wired (via an edge) to a
 * breakout panel's MPO connector - meaning whatever optic goes in that cage
 * must be a parallel-fibre part (SR4/PLR4/PSM4/DR4/DR4+), since that's what
 * physically feeds the panel's MPO trunk. Used by OpticsPanel.tsx to filter
 * the "Add Optic" dropdown down to valid choices once a cage is committed
 * to feeding a panel.
 */
export function boardFeedsBreakoutPanel(
  targetBoard: string,
  chassisPorts: ChassisPort[],
  nodeId: string,
  nodes: CustomNode[],
  edges: Edge[],
): boolean {
  const boardPortIds = new Set(chassisPorts.filter(p => p.board === targetBoard).map(p => p.id));
  if (boardPortIds.size === 0) return false;
  return edges.some(edge => {
    if (edge.source !== nodeId && edge.target !== nodeId) return false;
    const isSource = edge.source === nodeId;
    const peer = nodes.find(n => n.id === (isSource ? edge.target : edge.source));
    if (!peer || peer.type !== 'hardwareNode' || !isBreakoutPanelModel(String(peer.data?.model || ''))) return false;
    const links = (edge.data?.portLinks as { sourcePortId: string; targetPortId: string }[]) || [];
    return links.some(link => {
      const myPortId = isSource ? link.sourcePortId : link.targetPortId;
      const peerPortId = isSource ? link.targetPortId : link.sourcePortId;
      return !!myPortId && boardPortIds.has(myPortId) && !!peerPortId && isMpoPortId(peerPortId);
    });
  });
}

/**
 * MM for PNL-M341T, SM for PNL-M343T - derived from the model naming
 * convention (Gigamon's own: M341 = multimode, M343 = singlemode) rather
 * than a catalogue lookup, since it's the model number itself that's
 * authoritative and this keeps the module free of a hardwareCatalogue import.
 */
export function panelFiberType(model: string): 'MM' | 'SM' | undefined {
  if (model.startsWith('PNL-M341')) return 'MM';
  if (model.startsWith('PNL-M343')) return 'SM';
  return undefined;
}
