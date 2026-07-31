/**
 * Physical port modelling.
 *
 * The rest of the app tracks ports as aggregate counts - `optics` is a bag of
 * `(board, optic, qty)` tuples and edges carry no port data at all. This module
 * expands that into individual, addressable ports so a link can be tied to a
 * specific cage.
 *
 * Ports are always *derived* from the hardware catalogue plus the node's
 * `installedBoards`/`portCapacity`. Nothing here is persisted on the node, so
 * saved projects need no migration and the port list can never drift out of
 * sync with the modules actually fitted.
 */
import type { Edge } from '@xyflow/react';
import type { ChassisPort, CustomNode, HardwareNodeData, InstalledOptic, PortInfo } from '../store/types';
import hardwareCatalogue from '../constants/hardwareCatalogue.json';
import { getOpticSpeed, getTaLicenseLimits } from './hardwareUtils';
import { getSupportedBoards } from './opticValidation';

/** GigaVUE-OS port-id prefixes: x = SFP family, c = QSFP family, g = 1G copper. */
const CAGE_PREFIX: Record<ChassisPort['cage'], string> = { SFP: 'x', QSFP: 'c', RJ45: 'g' };

/** Coarse cage family a catalogue port type belongs to. */
export function getCageFamily(portType: string): ChassisPort['cage'] {
  const upper = portType.toUpperCase();
  if (upper.includes('QSFP')) return 'QSFP';
  if (upper.includes('SFP')) return 'SFP';
  return 'RJ45';
}

/** Which cage an optic needs, by speed. Breakout panels occupy a QSFP cage. */
export function getOpticCage(optic: string): ChassisPort['cage'] {
  if (optic.includes('PNL-M341') || optic.includes('PNL-M343')) return 'QSFP';
  const speed = getOpticSpeed(optic);
  return speed === '40G' || speed === '100G' || speed === '400G' ? 'QSFP' : 'SFP';
}

/** Catalogue entry for a chassis, across both TA and HC series. */
function findChassis(model: string) {
  return [...hardwareCatalogue.ta_series, ...hardwareCatalogue.hc_series].find(c => c.model === model);
}

/**
 * The board key base ports belong to, matching how OpticsPanel and
 * opticRules.json name it ("Base Ports", "HC1-X12G4 (Main board)", ...), so a
 * port's `board` lines up with `InstalledOptic.board`.
 */
function getMainBoardName(model: string, hwData: HardwareNodeData): string {
  const boards = getSupportedBoards(model, hwData.portCapacity as string, hwData.optics);
  const main = boards.find(b => b.board.toLowerCase().includes('main') || b.board.toLowerCase().includes('base'));
  return main?.board || 'Base Ports';
}

/** Expand one catalogue `ports[]` list into individual ports on a given board. */
function expandPorts(
  rawPorts: (PortInfo | number)[] | undefined,
  board: string,
  slot: string,
  licenceLimits: Record<string, number>,
  hasLicenceTiers: boolean,
): ChassisPort[] {
  if (!rawPorts) return [];
  const ports: ChassisPort[] = [];
  // Numbering runs per cage family within a board, so a board with both SFP and
  // QSFP gives x1..xN and c1..cM rather than one interleaved sequence.
  const nextIndex: Record<string, number> = {};
  // Licence tiers are expressed per catalogue port type, so consumption has to
  // be counted the same way - a board's first N of that type are the licensed ones.
  const licensedSoFar: Record<string, number> = {};

  for (const raw of rawPorts) {
    // Some TAP entries use a bare number for `ports`; those chassis have no
    // typed port list and are handled by the TAP branch instead.
    if (typeof raw === 'number') continue;

    const cage = getCageFamily(raw.type);
    for (let i = 0; i < raw.count; i++) {
      const index = (nextIndex[cage] || 0) + 1;
      nextIndex[cage] = index;

      let licensed = true;
      if (hasLicenceTiers) {
        const limit = licenceLimits[raw.type];
        if (typeof limit === 'number') {
          const used = licensedSoFar[raw.type] || 0;
          licensed = used < limit;
          if (licensed) licensedSoFar[raw.type] = used + 1;
        }
      }

      ports.push({
        id: `1/${slot}/${CAGE_PREFIX[cage]}${index}`,
        board,
        slot,
        type: raw.type,
        cage,
        index,
        speeds: raw.speeds || [],
        licensed,
      });
    }
  }
  return ports;
}

/**
 * Every physical port on a chassis: its base ports plus one group per installed
 * module. Returns [] for TAPs and unknown models - TAP entries carry no typed
 * port list in the catalogue.
 */
export function getChassisPorts(model: string, hwData: HardwareNodeData): ChassisPort[] {
  if (!model || model.includes('TAP')) return [];
  const chassis = findChassis(model);
  if (!chassis) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- catalogue entries mix `ports` (TA) and `base_ports` (HC)
  const chassisAny = chassis as any;
  const basePorts: (PortInfo | number)[] | undefined = chassisAny.ports || chassisAny.base_ports;

  // Only TA-series chassis carry licence tiers; HC ports are all usable.
  const licenceLimits = getTaLicenseLimits(model, (hwData.portCapacity as string) || 'Full');
  const hasLicenceTiers = Object.keys(licenceLimits).some(k => k !== 'qsfp_400g');

  const ports: ChassisPort[] = [
    ...expandPorts(basePorts, getMainBoardName(model, hwData), '1', licenceLimits, hasLicenceTiers),
  ];

  Object.entries(hwData.installedBoards || {}).forEach(([slotIdx, boardSku]) => {
    if (!boardSku) return;
    const module = hardwareCatalogue.modules.find(m => m.sku === boardSku);
    if (!module) return;
    // Module ports are never licence-limited - the tiers only cover base ports.
    ports.push(...expandPorts(module.ports, `${boardSku} (Slot ${slotIdx})`, slotIdx, {}, false));
  });

  return ports;
}

/**
 * How many tapped links a TAP node expresses, following the same
 * allocations-then-legacy-scalar fallback used across the BOM and panels.
 */
export function getTappedLinkCount(node: CustomNode): number {
  const data = node.data as HardwareNodeData | undefined;
  const allocations = data?.tappedLinkAllocations;
  if (Array.isArray(allocations) && allocations.length > 0) {
    return allocations.reduce((sum, a) => sum + (a.qty || 0), 0);
  }
  return (data?.tappedLinksCount as number) ?? 1;
}

/** True for both hardware TAP chassis and the inputNode "Network TAP" form. */
export function isTapNode(node: CustomNode | undefined): boolean {
  if (!node) return false;
  if (node.type === 'hardwareNode') return String(node.data?.model || '').includes('TAP');
  return node.type === 'inputNode' && String(node.data?.configType || '').startsWith('TAP');
}

/**
 * How many physical ports a link between two nodes consumes at the chassis end.
 *
 * Every tapped link is bidirectional - a north and a south feed - so it lands on
 * two chassis ports. This is the single home for that rule, which was otherwise
 * re-implemented as an ad-hoc `* 2` in the BOM generator, the config validator,
 * graphSlice's connection handler and OpticsPanel.
 */
export function getRequiredPortCount(sourceNode: CustomNode | undefined, targetNode: CustomNode | undefined): number {
  if (isTapNode(sourceNode)) return getTappedLinkCount(sourceNode!) * 2;
  if (isTapNode(targetNode)) return getTappedLinkCount(targetNode!) * 2;
  return 1;
}

/** Synthetic port ids for a TAP's link ends, which have no catalogue ports. */
export function getTapPortIds(node: CustomNode): string[] {
  const ids: string[] = [];
  for (let link = 1; link <= getTappedLinkCount(node); link++) {
    ids.push(`L${link}-N`, `L${link}-S`);
  }
  return ids;
}

/**
 * Which optic sits in which port. Optics are stored per board as quantities, so
 * they're laid into that board's matching cages in order - deterministic, and
 * stable as long as the optics list is.
 */
export function getPortOpticMap(ports: ChassisPort[], optics: InstalledOptic[] | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!optics?.length) return map;

  const filled = new Set<string>();
  for (const entry of optics) {
    if (!entry.optic) continue;
    const cage = getOpticCage(entry.optic);
    let remaining = entry.qty;
    for (const port of ports) {
      if (remaining <= 0) break;
      if (port.cage !== cage || filled.has(port.id)) continue;
      // Optics recorded against a board belong in that board's cages; fall back
      // to any free cage of the right family when the board no longer exists
      // (e.g. a module was swapped out from under them).
      if (port.board !== entry.board && optics.some(o => o.board === port.board)) continue;
      map.set(port.id, entry.optic);
      filled.add(port.id);
      remaining--;
    }
  }
  return map;
}

export interface PortOccupant {
  optic?: string;
  peerNodeId?: string;
  peerLabel?: string;
  edgeId?: string;
}

/**
 * What each port on a node is currently doing: which optic it holds and, if
 * an edge has been allocated to it, which node it reaches.
 */
export function getPortOccupancy(
  node: CustomNode,
  nodes: CustomNode[],
  edges: Edge[],
  ports?: ChassisPort[],
): Map<string, PortOccupant> {
  const resolvedPorts = ports || getChassisPorts(String(node.data?.model || ''), node.data as HardwareNodeData);
  const occupancy = new Map<string, PortOccupant>();

  getPortOpticMap(resolvedPorts, (node.data as HardwareNodeData)?.optics).forEach((optic, portId) => {
    occupancy.set(portId, { optic });
  });

  for (const edge of edges) {
    if (edge.source !== node.id && edge.target !== node.id) continue;
    const links = (edge.data?.portLinks as { sourcePortId: string; targetPortId: string }[]) || [];
    const isSource = edge.source === node.id;
    const peerId = isSource ? edge.target : edge.source;
    const peer = nodes.find(n => n.id === peerId);
    const peerLabel = String(peer?.data?.label || peer?.data?.model || peerId);

    for (const link of links) {
      const portId = isSource ? link.sourcePortId : link.targetPortId;
      if (!portId) continue;
      occupancy.set(portId, { ...occupancy.get(portId), peerNodeId: peerId, peerLabel, edgeId: edge.id });
    }
  }

  return occupancy;
}

/**
 * Pick the next free ports for a new link: licensed cages first, then in port
 * order, so allocation is deterministic and predictable. Returns fewer than
 * requested when the chassis genuinely runs out - callers surface that as a
 * validation error rather than silently over-subscribing.
 */
export function allocatePorts(
  ports: ChassisPort[],
  occupiedIds: Set<string>,
  count: number,
  cage?: ChassisPort['cage'],
): ChassisPort[] {
  if (count <= 0) return [];
  const candidates = ports.filter(
    // RJ45 management/copper ports are shown for realism but never auto-allocated.
    p => p.cage !== 'RJ45' && !occupiedIds.has(p.id) && (!cage || p.cage === cage),
  );
  const licensedFirst = [
    ...candidates.filter(p => p.licensed),
    ...candidates.filter(p => !p.licensed),
  ];
  return licensedFirst.slice(0, count);
}
