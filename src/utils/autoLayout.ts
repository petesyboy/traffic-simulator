/**
 * autoLayout.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * "Tidy Layout" - unlike Snap All to Grid (which just rounds each node's
 * *existing* position to the nearest grid point independently), this
 * re-arranges the whole topology into clean left-to-right columns by pipeline
 * stage (rank = longest path from a source node), so every TAP/TA/HC etc. at
 * the same stage lines up on both axes and edges read as a tidy left-to-right
 * flow instead of whatever tangle manual dragging produced.
 *
 * A small custom layered (Sugiyama-style) layout rather than a dependency
 * like dagre/elkjs - this app already ships as a single ~5.7MB HTML file, and
 * the graphs here are small (tens of nodes) with no need for general-purpose
 * layout features those libraries offer.
 */
import type { Edge } from '@xyflow/react';
import type { CustomNode } from '../store/types';
import { NODE_TYPES } from '../constants/nodeTypes';

const DEFAULT_NODE_WIDTH = 220;
const DEFAULT_NODE_HEIGHT = 80;
const COLUMN_GAP = 90;
const ROW_GAP = 40;
const LEFT_MARGIN = 60;
const TOP_MARGIN = 80;
const ORDERING_PASSES = 4;

interface NodeSize {
  width: number;
  height: number;
}

function nodeSize(node: CustomNode, isExportMode = false): NodeSize {
  let width = node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH;
  let height = node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT;

  if (isExportMode) {
    const model = String(node.data?.model || '').toUpperCase();
    const isChassis = (model.includes('HC') || model.includes('TA')) && !model.includes('TAP');
    const isTap = model.includes('TAP') || String(node.data?.configType || '').toUpperCase().includes('TAP');
    if (node.type === 'clusterNode') height = Math.max(height, 310);
    else if (isChassis) height = Math.max(height, 380);
    else if (isTap) height = Math.max(height, 190);
    else if (node.type === 'inputNode') height = Math.max(height, 175);
    else if (node.type === 'toolNode') height = Math.max(height, 190);
    else if (node.type === 'mapNode' || node.type === 'filterNode' || node.type === 'gigaSmartNode') height = Math.max(height, 220);
  }

  return { width, height };
}

/** A child (grouped) node is laid out as part of its parent, not independently. */
function layoutId(id: string, parentOf: Map<string, string>): string {
  return parentOf.get(id) ?? id;
}

function buildAdjacency(
  layoutIds: string[],
  edges: Edge[],
  parentOf: Map<string, string>,
): { succ: Map<string, string[]>; pred: Map<string, string[]> } {
  const succ = new Map<string, string[]>();
  const pred = new Map<string, string[]>();
  const idSet = new Set(layoutIds);
  layoutIds.forEach((id) => {
    succ.set(id, []);
    pred.set(id, []);
  });

  const seen = new Set<string>();
  edges.forEach((edge) => {
    const from = layoutId(edge.source, parentOf);
    const to = layoutId(edge.target, parentOf);
    if (from === to || !idSet.has(from) || !idSet.has(to)) return;
    const key = `${from}->${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    succ.get(from)!.push(to);
    pred.get(to)!.push(from);
  });

  return { succ, pred };
}

/** Rank = 1 + longest predecessor chain, via DFS with a cycle guard (a back edge just contributes rank 0). */
function computeRanks(layoutIds: string[], pred: Map<string, string[]>): Map<string, number> {
  const rank = new Map<string, number>();
  const visiting = new Set<string>();

  function dfs(id: string): number {
    const cached = rank.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let r = 0;
    for (const p of pred.get(id) || []) {
      r = Math.max(r, dfs(p) + 1);
    }
    visiting.delete(id);
    rank.set(id, r);
    return r;
  }

  layoutIds.forEach(dfs);
  return rank;
}

/** Barycenter-heuristic pass to reduce edge crossings, alternating forward/backward a few times. */
function orderColumns(columns: string[][], succ: Map<string, string[]>, pred: Map<string, string[]>): string[][] {
  const orderIndex = new Map<string, number>();
  columns.forEach((col) => col.forEach((id, i) => orderIndex.set(id, i)));

  for (let pass = 0; pass < ORDERING_PASSES; pass++) {
    const forward = pass % 2 === 0;
    const neighborsOf = forward ? pred : succ;
    const rankSequence = forward ? columns.map((_, i) => i) : columns.map((_, i) => i).reverse();

    for (const r of rankSequence) {
      const col = columns[r];
      if (col.length <= 1) continue;
      const scored = col.map((id) => {
        const neighbors = (neighborsOf.get(id) || []).filter((n) => orderIndex.has(n));
        const avg = neighbors.length
          ? neighbors.reduce((sum, n) => sum + orderIndex.get(n)!, 0) / neighbors.length
          : orderIndex.get(id)!;
        return { id, avg };
      });
      scored.sort((a, b) => a.avg - b.avg);
      columns[r] = scored.map((s) => s.id);
      columns[r].forEach((id, i) => orderIndex.set(id, i));
    }
  }

  return columns;
}

function assignPositions(columns: string[][], sizeOf: Map<string, NodeSize>): Map<string, { x: number; y: number }> {
  const colWidths = columns.map((col) => Math.max(DEFAULT_NODE_WIDTH, ...col.map((id) => sizeOf.get(id)!.width)));
  const colX: number[] = [];
  let x = LEFT_MARGIN;
  columns.forEach((_col, i) => {
    colX[i] = x;
    x += colWidths[i] + COLUMN_GAP;
  });

  const colTotalHeight = columns.map(
    (col) => col.reduce((sum, id) => sum + sizeOf.get(id)!.height, 0) + Math.max(0, col.length - 1) * ROW_GAP,
  );
  const maxTotalHeight = Math.max(0, ...colTotalHeight);

  const positions = new Map<string, { x: number; y: number }>();
  columns.forEach((col, i) => {
    let y = TOP_MARGIN + (maxTotalHeight - colTotalHeight[i]) / 2;
    col.forEach((id) => {
      positions.set(id, { x: colX[i], y });
      y += sizeOf.get(id)!.height + ROW_GAP;
    });
  });

  return positions;
}

const SITE_GAP_Y = 100;

function computeSiteOrder(
  siteNames: string[],
  siteGroups: Map<string, CustomNode[]>,
  edges: Edge[],
  parentOf: Map<string, string>,
): string[] {
  // Map node ID to its site
  const nodeToSite = new Map<string, string>();
  siteGroups.forEach((nodes, site) => {
    nodes.forEach((n) => nodeToSite.set(n.id, site));
  });

  // Build inter-site directed graph
  const siteSucc = new Map<string, Set<string>>();
  const sitePred = new Map<string, Set<string>>();
  siteNames.forEach((s) => {
    siteSucc.set(s, new Set());
    sitePred.set(s, new Set());
  });

  edges.forEach((e) => {
    const src = layoutId(e.source, parentOf);
    const tgt = layoutId(e.target, parentOf);
    const srcSite = nodeToSite.get(src);
    const tgtSite = nodeToSite.get(tgt);
    if (srcSite && tgtSite && srcSite !== tgtSite) {
      siteSucc.get(srcSite)?.add(tgtSite);
      sitePred.get(tgtSite)?.add(srcSite);
    }
  });

  // Compute site ranks (distance from upstream leaf sites)
  const siteRank = new Map<string, number>();
  const visiting = new Set<string>();

  function dfsSite(s: string): number {
    const cached = siteRank.get(s);
    if (cached !== undefined) return cached;
    if (visiting.has(s)) return 0;
    visiting.add(s);
    let r = 0;
    for (const p of sitePred.get(s) || []) {
      r = Math.max(r, dfsSite(p) + 1);
    }
    visiting.delete(s);
    siteRank.set(s, r);
    return r;
  }

  siteNames.forEach(dfsSite);

  // For sites with the same topological rank, sort by their current median Y on canvas
  function medianY(site: string): number {
    const nodes = siteGroups.get(site) || [];
    if (nodes.length === 0) return 0;
    const ys = nodes.map((n) => n.position.y).sort((a, b) => a - b);
    return ys[Math.floor(ys.length / 2)];
  }

  return [...siteNames].sort((a, b) => {
    const rankDiff = (siteRank.get(a) ?? 0) - (siteRank.get(b) ?? 0);
    if (rankDiff !== 0) return rankDiff;
    return medianY(a) - medianY(b);
  });
}

function assignSiteAwarePositions(
  siteOrder: string[],
  siteGroups: Map<string, CustomNode[]>,
  hubNodes: CustomNode[],
  hubBoundaryMap: Map<string, number>,
  globalRank: Map<string, number>,
  sizeOf: Map<string, NodeSize>,
  succ: Map<string, string[]>,
  pred: Map<string, string[]>,
): Map<string, { x: number; y: number }> {
  // Max rank across all nodes (including hubs)
  const allNodes: CustomNode[] = [];
  siteGroups.forEach((nodes) => allNodes.push(...nodes));
  allNodes.push(...hubNodes);

  const maxRank = Math.max(0, ...allNodes.map((n) => globalRank.get(n.id) ?? 0));

  // Column widths include both site nodes AND hub nodes so wide DWDM nodes don't overlap adjacent columns
  const colWidths: number[] = Array.from({ length: maxRank + 1 }, () => DEFAULT_NODE_WIDTH);
  allNodes.forEach((n) => {
    const r = globalRank.get(n.id) ?? 0;
    const w = sizeOf.get(n.id)?.width ?? DEFAULT_NODE_WIDTH;
    if (r < colWidths.length && w > colWidths[r]) {
      colWidths[r] = w;
    }
  });

  const colX: number[] = [];
  let currentX = LEFT_MARGIN;
  colWidths.forEach((w, i) => {
    colX[i] = currentX;
    currentX += w + COLUMN_GAP;
  });

  const positions = new Map<string, { x: number; y: number }>();
  let currentY = TOP_MARGIN;

  siteOrder.forEach((siteName, siteIndex) => {
    const siteNodes = siteGroups.get(siteName) || [];
    if (siteNodes.length === 0) return;

    // Group site nodes by their global column rank
    const siteColumns: string[][] = Array.from({ length: maxRank + 1 }, () => []);
    const byCurrentY = [...siteNodes].sort((a, b) => a.position.y - b.position.y);
    byCurrentY.forEach((n) => {
      const r = globalRank.get(n.id) ?? 0;
      siteColumns[r].push(n.id);
    });

    // Apply barycenter heuristic to reduce edge crossings within this site
    orderColumns(siteColumns, succ, pred);

    // Measure height of each column in this site band
    const colTotalHeights = siteColumns.map(
      (col) =>
        col.reduce((sum, id) => sum + (sizeOf.get(id)?.height ?? DEFAULT_NODE_HEIGHT), 0) +
        Math.max(0, col.length - 1) * ROW_GAP,
    );
    const siteMaxHeight = Math.max(0, ...colTotalHeights);

    // Place nodes centered vertically within this site's band
    siteColumns.forEach((col, r) => {
      if (col.length === 0) return;
      let y = currentY + (siteMaxHeight - colTotalHeights[r]) / 2;
      col.forEach((id) => {
        positions.set(id, { x: colX[r], y });
        y += (sizeOf.get(id)?.height ?? DEFAULT_NODE_HEIGHT) + ROW_GAP;
      });
    });

    currentY += siteMaxHeight;

    // Check if any hub nodes belong in the gutter after this site band
    const hubsInThisGap = hubNodes.filter((h) => (hubBoundaryMap.get(h.id) ?? 0) === siteIndex);
    if (hubsInThisGap.length > 0 && siteIndex < siteOrder.length - 1) {
      const maxHubH = Math.max(...hubsInThisGap.map((h) => sizeOf.get(h.id)?.height ?? DEFAULT_NODE_HEIGHT));
      const gapHeight = Math.max(SITE_GAP_Y, maxHubH + 120);

      hubsInThisGap.forEach((h) => {
        const hHeight = sizeOf.get(h.id)?.height ?? DEFAULT_NODE_HEIGHT;
        const hubY = currentY + (gapHeight - hHeight) / 2;
        const hubR = globalRank.get(h.id) ?? 0;
        const hubX = colX[hubR] ?? LEFT_MARGIN;
        positions.set(h.id, { x: hubX, y: hubY });
      });

      currentY += gapHeight;
    } else {
      currentY += SITE_GAP_Y;
    }
  });

  // Fallback for any hub nodes not assigned to an inter-site gap
  hubNodes.forEach((h) => {
    if (!positions.has(h.id)) {
      const hubR = globalRank.get(h.id) ?? 0;
      const hubX = colX[hubR] ?? LEFT_MARGIN;
      positions.set(h.id, { x: hubX, y: currentY });
      currentY += (sizeOf.get(h.id)?.height ?? DEFAULT_NODE_HEIGHT) + SITE_GAP_Y;
    }
  });

  return positions;
}

type NodeFlow = 'ltr' | 'rtl';

/**
 * Which way each node should be laid out.
 *
 * A clean link needs the source's egress and the target's ingress to face each
 * other, and that only holds when both ends read the same way round - a
 * mirrored node feeding an unmirrored one has no placement that satisfies both.
 * So a hand-locked mirrored node spreads 'rtl' through its unlocked neighbours,
 * making the chain around it consistent. Locking a node left-to-right pins the
 * boundary and stops the spread there.
 */
function resolveFlowDirections(
  nodes: CustomNode[],
  succ: Map<string, string[]>,
  pred: Map<string, string[]>,
): Map<string, NodeFlow> {
  const locked = new Map<string, NodeFlow>();
  nodes.forEach((n) => {
    if (n.data?.flowDirectionLocked) {
      locked.set(n.id, (n.data?.flowDirection as string) === 'rtl' ? 'rtl' : 'ltr');
    }
  });

  const directions = new Map<string, NodeFlow>();
  nodes.forEach((n) => directions.set(n.id, locked.get(n.id) ?? 'ltr'));
  if (locked.size === 0) return directions;

  const queue = [...locked.entries()].filter(([, dir]) => dir === 'rtl').map(([id]) => id);
  const seen = new Set(queue);
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const neighbour of [...(succ.get(id) || []), ...(pred.get(id) || [])]) {
      if (seen.has(neighbour) || locked.has(neighbour)) continue;
      seen.add(neighbour);
      directions.set(neighbour, 'rtl');
      queue.push(neighbour);
    }
  }

  return directions;
}

/**
 * Flips the column of every mirrored node about the widest column, so a
 * right-to-left chain is laid out with its sources on the right and its tools
 * on the left - the order its handles actually point in.
 */
function mirrorRanksForFlow(rank: Map<string, number>, directions: Map<string, NodeFlow>): Map<string, number> {
  if (![...directions.values()].includes('rtl')) return rank;
  const maxRank = Math.max(0, ...Array.from(rank.values()));
  const mirrored = new Map<string, number>();
  rank.forEach((r, id) => mirrored.set(id, directions.get(id) === 'rtl' ? maxRank - r : r));
  return mirrored;
}

/**
 * Applies a laid-out position, and for a node the engine is free to move, the
 * direction it was laid out in. A node placed on the mirrored side has to be
 * drawn mirrored too, or its links leave the wrong edge and double back. A
 * hand-locked node keeps whatever direction its owner chose.
 */
function withLayoutResult(
  node: CustomNode,
  position: { x: number; y: number } | undefined,
  direction: NodeFlow | undefined,
): CustomNode {
  if (!position) return node;
  const next = { ...node, position } as CustomNode;
  if (node.data?.flowDirectionLocked || !direction) return next;

  const current = (node.data?.flowDirection as string) || 'ltr';
  if (current === direction) return next;

  const data = { ...node.data } as Record<string, unknown>;
  // 'ltr' is the default, so it is stored as absence rather than a value.
  if (direction === 'rtl') data.flowDirection = 'rtl';
  else delete data.flowDirection;
  return { ...next, data } as CustomNode;
}

/**
 * Re-arranges top-level nodes (anything without a `parentId`, i.e. not
 * nested inside a group) into tidy left-to-right columns by pipeline stage.
 *
 * When equipment across 2 or more distinct physical data centres / sites
 * is present (e.g. `DC1`, `DC2`, `DC3`), nodes are clustered by data centre,
 * keeping equipment from the same facility together in dedicated horizontal
 * bands with clean inter-site routing, instead of piling all nodes into one giant column.
 *
 * Multi-site transport nodes (such as DWDM Optical Networks) are positioned
 * in reserved inter-site gutters between the data centres they bridge,
 * ensuring they never overlap local chassis or intrude on site boundaries.
 *
 * Grouped child nodes are left untouched - their position is relative to
 * their parent, which moves with the rest of its column as a single unit.
 */
export function computeTidyLayout(nodes: CustomNode[], edges: Edge[], isExportMode = false): CustomNode[] {
  const topLevelNodes = nodes.filter((n) => !n.parentId && !n.hidden);
  if (topLevelNodes.length === 0) return nodes;

  const parentOf = new Map<string, string>();
  nodes.forEach((n) => {
    if (n.parentId) parentOf.set(n.id, n.parentId);
  });

  const layoutIds = topLevelNodes.map((n) => n.id);
  const sizeOf = new Map<string, NodeSize>(topLevelNodes.map((n) => [n.id, nodeSize(n, isExportMode)]));

  const { succ, pred } = buildAdjacency(layoutIds, edges, parentOf);
  const rank = computeRanks(layoutIds, pred);
  // A mirrored node reads right-to-left, so its column has to be flipped or
  // every link into it doubles back on itself.
  const flowDirections = resolveFlowDirections(topLevelNodes, succ, pred);

  // Check for multi-site topologies
  const explicitSites = new Set(
    topLevelNodes
      .map((n) => ((n.data?.site as string) || '').trim())
      .filter(Boolean),
  );

  if (explicitSites.size >= 2) {
    // Multi-site layout: separate genuine data centre nodes from transport hub nodes
    const isDwdmOrWanNode = (n: CustomNode): boolean => {
      if (n.type === NODE_TYPES.DWDM_NETWORK || n.type === 'dwdmNetworkNode') return true;
      const s = ((n.data?.site as string) || '').trim().toUpperCase();
      if (s === 'WAN' || s === 'TRANSPORT') return true;
      return false;
    };

    const hubNodes: CustomNode[] = [];
    const nonHubTopLevelNodes: CustomNode[] = [];
    topLevelNodes.forEach((n) => {
      if (isDwdmOrWanNode(n)) {
        hubNodes.push(n);
      } else {
        nonHubTopLevelNodes.push(n);
      }
    });

    const nodeSiteMap = new Map<string, string>();

    // Pass 1: Tag non-hub nodes with their explicit site
    nonHubTopLevelNodes.forEach((n) => {
      const s = ((n.data?.site as string) || '').trim();
      if (s) nodeSiteMap.set(n.id, s);
    });

    // Pass 2: For unassigned non-hub nodes, infer site if they only connect to one site
    nonHubTopLevelNodes.forEach((n) => {
      if (!nodeSiteMap.has(n.id)) {
        const neighbors = [...(succ.get(n.id) || []), ...(pred.get(n.id) || [])];
        const neighborSites = new Set(neighbors.map((nb) => nodeSiteMap.get(nb)).filter(Boolean));
        if (neighborSites.size === 1) {
          nodeSiteMap.set(n.id, Array.from(neighborSites)[0] as string);
        } else if (neighborSites.size >= 2) {
          hubNodes.push(n);
        } else {
          nodeSiteMap.set(n.id, Array.from(explicitSites)[0] as string);
        }
      }
    });

    const genuineSiteNodes = nonHubTopLevelNodes.filter((n) => nodeSiteMap.has(n.id) && !hubNodes.includes(n));
    const siteGroups = new Map<string, CustomNode[]>();
    genuineSiteNodes.forEach((n) => {
      const site = nodeSiteMap.get(n.id)!;
      if (!siteGroups.has(site)) siteGroups.set(site, []);
      siteGroups.get(site)!.push(n);
    });

    const allSiteNames = Array.from(siteGroups.keys());
    const siteOrder = computeSiteOrder(allSiteNames, siteGroups, edges, parentOf);

    // Compute hub column rank from peer non-hub nodes (cycle-safe)
    const hubIdSet = new Set(hubNodes.map((h) => h.id));
    hubNodes.forEach((h) => {
      const pRanks = (pred.get(h.id) || []).filter((id) => !hubIdSet.has(id)).map((id) => rank.get(id) ?? 0);
      const sRanks = (succ.get(h.id) || []).filter((id) => !hubIdSet.has(id)).map((id) => rank.get(id) ?? 0);
      const allPeerRanks = [...pRanks, ...sRanks];

      let hubRank = 1;
      if (pRanks.length > 0 && sRanks.length > 0) {
        const maxP = Math.max(...pRanks);
        const minS = Math.min(...sRanks);
        if (maxP < minS) {
          hubRank = maxP + 1;
        } else {
          // Bidirectional ring: derive from median peer rank
          const sorted = [...allPeerRanks].sort((a, b) => a - b);
          hubRank = sorted[Math.floor(sorted.length / 2)] ?? 1;
        }
      } else if (pRanks.length > 0) {
        hubRank = Math.max(...pRanks) + 1;
      } else if (sRanks.length > 0) {
        hubRank = Math.max(0, Math.min(...sRanks) - 1);
      } else if (allPeerRanks.length > 0) {
        const sorted = [...allPeerRanks].sort((a, b) => a - b);
        hubRank = sorted[Math.floor(sorted.length / 2)] ?? 1;
      }
      rank.set(h.id, hubRank);
    });

    // Determine target boundary gap for each hub (widen inter-site gutter nearest peers)
    const hubBoundaryMap = new Map<string, number>();
    hubNodes.forEach((h) => {
      const neighbors = [...(succ.get(h.id) || []), ...(pred.get(h.id) || [])].filter((id) => !hubIdSet.has(id));
      const peerSiteIndices = neighbors
        .map((id) => {
          const s = nodeSiteMap.get(id);
          return s ? siteOrder.indexOf(s) : -1;
        })
        .filter((idx) => idx >= 0)
        .sort((a, b) => a - b);

      let targetGap = 0;
      if (peerSiteIndices.length > 0) {
        const minIdx = peerSiteIndices[0];
        const maxIdx = peerSiteIndices[peerSiteIndices.length - 1];
        targetGap = Math.min(siteOrder.length - 2, Math.max(0, Math.floor((minIdx + maxIdx) / 2)));
      }
      hubBoundaryMap.set(h.id, targetGap);
    });

    const positions = assignSiteAwarePositions(
      siteOrder,
      siteGroups,
      hubNodes,
      hubBoundaryMap,
      mirrorRanksForFlow(rank, flowDirections),
      sizeOf,
      succ,
      pred,
    );

    return nodes.map((n) => withLayoutResult(n, positions.get(n.id), flowDirections.get(n.id)));
  }

  // Single-site or untagged topology: classic single-pipeline layout
  const layoutRank = mirrorRanksForFlow(rank, flowDirections);
  const maxRank = Math.max(0, ...Array.from(layoutRank.values()));
  const columns: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  const byCurrentY = [...topLevelNodes].sort((a, b) => a.position.y - b.position.y);
  byCurrentY.forEach((n) => columns[layoutRank.get(n.id)!].push(n.id));

  orderColumns(columns, succ, pred);
  const positions = assignPositions(columns, sizeOf);

  return nodes.map((n) => withLayoutResult(n, positions.get(n.id), flowDirections.get(n.id)));
}

/**
 * Automatically adjusts the vertical and horizontal spacing of nodes in columns
 * so that description boxes rendered below nodes in Export Diagram Mode never overlap
 * or obscure nodes below or adjacent to them.
 */
export function autoSpaceNodesForExport(nodes: CustomNode[]): CustomNode[] {
  const topLevelNodes = nodes.filter((n) => !n.parentId);
  if (topLevelNodes.length <= 1) return nodes;

  // Measure or estimate height for each node including export description box
  function getNodeHeight(n: CustomNode): number {
    const model = String(n.data?.model || '').toUpperCase();
    const isChassis = (model.includes('HC') || model.includes('TA')) && !model.includes('TAP');
    const isTap = model.includes('TAP') || String(n.data?.configType || '').toUpperCase().includes('TAP');

    let minExpectedHeight = 170;
    if (n.type === 'clusterNode') minExpectedHeight = 310;
    else if (isChassis) minExpectedHeight = 380;
    else if (isTap) minExpectedHeight = 190;
    else if (n.type === 'inputNode') minExpectedHeight = 175;
    else if (n.type === 'toolNode') minExpectedHeight = 190;
    else if (n.type === 'mapNode' || n.type === 'filterNode' || n.type === 'gigaSmartNode') minExpectedHeight = 220;

    const domEl =
      typeof document !== 'undefined'
        ? (document.querySelector(`[data-id="${n.id}"]`) as HTMLElement)
        : null;
    if (domEl && domEl.offsetHeight > minExpectedHeight) {
      return domEl.offsetHeight;
    }
    return minExpectedHeight;
  }

  function getNodeWidth(n: CustomNode): number {
    const model = String(n.data?.model || '').toUpperCase();
    const isChassis = (model.includes('HC') || model.includes('TA')) && !model.includes('TAP');
    let minExpectedWidth = 240;
    if (isChassis) minExpectedWidth = 330;
    else if (n.type === 'clusterNode') minExpectedWidth = 310;
    else if (n.type === 'toolNode') minExpectedWidth = 210;
    else if (model.includes('TAP')) minExpectedWidth = 200;

    const domEl =
      typeof document !== 'undefined'
        ? (document.querySelector(`[data-id="${n.id}"]`) as HTMLElement)
        : null;
    if (domEl && domEl.offsetWidth > minExpectedWidth) {
      return domEl.offsetWidth;
    }
    return minExpectedWidth;
  }

  // Cluster nodes into columns based on X position (within 80px tolerance)
  const columns: CustomNode[][] = [];
  const sortedByX = [...topLevelNodes].sort((a, b) => a.position.x - b.position.x);

  sortedByX.forEach((node) => {
    let placed = false;
    for (const col of columns) {
      const avgX = col.reduce((sum, n) => sum + n.position.x, 0) / col.length;
      if (Math.abs(node.position.x - avgX) < 80) {
        col.push(node);
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([node]);
    }
  });

  // Sort columns left to right by their average X
  columns.sort((a, b) => {
    const avgA = a.reduce((sum, n) => sum + n.position.x, 0) / a.length;
    const avgB = b.reduce((sum, n) => sum + n.position.x, 0) / b.length;
    return avgA - avgB;
  });

  const newPositions = new Map<string, { x: number; y: number }>();
  const VERTICAL_GAP = 40;
  const HORIZONTAL_GAP = 70;

  let prevColRight = -Infinity;

  columns.forEach((col) => {
    // Sort vertically by current Y position
    col.sort((a, b) => a.position.y - b.position.y);

    const colWidth = Math.max(...col.map(getNodeWidth));
    const originalColX = Math.min(...col.map((n) => n.position.x));
    const colX = isFinite(prevColRight) && prevColRight > -Infinity
      ? Math.max(originalColX, prevColRight + HORIZONTAL_GAP)
      : originalColX;

    let currentY = col[0].position.y;
    col.forEach((node, idx) => {
      if (idx === 0) {
        newPositions.set(node.id, { x: colX, y: currentY });
        currentY = currentY + getNodeHeight(node) + VERTICAL_GAP;
      } else {
        const targetY = Math.max(node.position.y, currentY);
        newPositions.set(node.id, { x: colX, y: targetY });
        currentY = targetY + getNodeHeight(node) + VERTICAL_GAP;
      }
    });

    prevColRight = colX + colWidth;
  });

  return nodes.map((n) => {
    const pos = newPositions.get(n.id);
    return pos ? { ...n, position: pos } : n;
  });
}

/**
 * Optimises source and target handles on edges connecting into or out of
 * DWDM Optical Transport Network nodes (which declare in-top, in-bottom,
 * in-left, in-right, out-top, out-bottom, out-left, out-right).
 *
 * Gated strictly to nodes of type DWDM_NETWORK so peer chassis and tools
 * retain their standard handles.
 */
export function optimizeDwdmEdgeHandles(nodes: CustomNode[], edges: Edge[]): Edge[] {
  const nodeMap = new Map<string, CustomNode>(nodes.map((n) => [n.id, n]));
  const sizeMap = new Map<string, NodeSize>(nodes.map((n) => [n.id, nodeSize(n)]));

  let changed = false;
  const newEdges = edges.map((edge) => {
    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);
    if (!srcNode || !tgtNode) return edge;

    const isSrcDwdm = srcNode.type === NODE_TYPES.DWDM_NETWORK || srcNode.type === 'dwdmNetworkNode';
    const isTgtDwdm = tgtNode.type === NODE_TYPES.DWDM_NETWORK || tgtNode.type === 'dwdmNetworkNode';

    // Gate strictly to DWDM nodes
    if (!isSrcDwdm && !isTgtDwdm) return edge;

    const srcPos = srcNode.position;
    const tgtPos = tgtNode.position;
    const srcSize = sizeMap.get(srcNode.id) || { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
    const tgtSize = sizeMap.get(tgtNode.id) || { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };

    const srcCenter = { x: srcPos.x + srcSize.width / 2, y: srcPos.y + srcSize.height / 2 };
    const tgtCenter = { x: tgtPos.x + tgtSize.width / 2, y: tgtPos.y + tgtSize.height / 2 };

    let newSourceHandle = edge.sourceHandle;
    let newTargetHandle = edge.targetHandle;

    if (isTgtDwdm) {
      // Edge enters DWDM: evaluate vector from DWDM centre to source centre
      const dx = srcCenter.x - tgtCenter.x;
      const dy = srcCenter.y - tgtCenter.y;
      const hThreshold = tgtSize.height * 0.35;

      if (dy < -hThreshold && Math.abs(dy) > Math.abs(dx) * 0.35) {
        newTargetHandle = 'in-top';
      } else if (dy > hThreshold && Math.abs(dy) > Math.abs(dx) * 0.35) {
        newTargetHandle = 'in-bottom';
      } else if (dx < 0) {
        newTargetHandle = 'in-left';
      } else {
        newTargetHandle = 'in-right';
      }
    }

    if (isSrcDwdm) {
      // Edge leaves DWDM: evaluate vector from DWDM centre to target centre
      const dx = tgtCenter.x - srcCenter.x;
      const dy = tgtCenter.y - srcCenter.y;
      const hThreshold = srcSize.height * 0.35;

      if (dy < -hThreshold && Math.abs(dy) > Math.abs(dx) * 0.35) {
        newSourceHandle = 'out-top';
      } else if (dy > hThreshold && Math.abs(dy) > Math.abs(dx) * 0.35) {
        newSourceHandle = 'out-bottom';
      } else if (dx > 0) {
        newSourceHandle = 'out-right';
      } else {
        newSourceHandle = 'out-left';
      }
    }

    if (newSourceHandle !== edge.sourceHandle || newTargetHandle !== edge.targetHandle) {
      changed = true;
      return {
        ...edge,
        sourceHandle: newSourceHandle,
        targetHandle: newTargetHandle,
      };
    }
    return edge;
  });

  return changed ? newEdges : edges;
}


