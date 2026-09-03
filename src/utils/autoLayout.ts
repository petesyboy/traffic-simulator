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
const COLUMN_GAP = 140;
const ROW_GAP = 36;
const LEFT_MARGIN = 60;
const TOP_MARGIN = 80;
const ORDERING_PASSES = 4;

interface NodeSize {
  width: number;
  height: number;
}

function nodeSize(node: CustomNode, isExportMode = false): NodeSize {
  // Query DOM element if running in browser to get real layout measurements
  if (typeof document !== 'undefined') {
    const domEl = document.querySelector(`[data-id="${node.id}"]`) as HTMLElement;
    if (domEl && domEl.offsetWidth > 0 && domEl.offsetHeight > 0) {
      return {
        width: Math.max(domEl.offsetWidth, DEFAULT_NODE_WIDTH),
        height: Math.max(domEl.offsetHeight, DEFAULT_NODE_HEIGHT),
      };
    }
  }

  const model = String(node.data?.model || '').toUpperCase();
  const isChassis = (model.includes('HC') || model.includes('TA')) && !model.includes('TAP');
  const isTap = model.includes('TAP') || String(node.data?.configType || '').toUpperCase().includes('TAP');

  let width = node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH;
  let height = node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT;

  if (isChassis) {
    width = Math.max(width, 380);
    height = Math.max(height, 260);
  } else if (node.type === 'clusterNode') {
    width = Math.max(width, 310);
    height = Math.max(height, 280);
  } else if (isTap) {
    width = Math.max(width, 220);
    height = Math.max(height, 160);
  } else if (node.type === 'inputNode') {
    width = Math.max(width, 240);
    height = Math.max(height, 150);
  } else if (node.type === 'toolNode') {
    width = Math.max(width, 220);
    height = Math.max(height, 160);
  } else if (node.type === 'mapNode' || node.type === 'filterNode' || node.type === 'gigaSmartNode') {
    width = Math.max(width, 240);
    height = Math.max(height, 200);
  } else if (node.type === NODE_TYPES.DWDM_NETWORK || node.type === 'dwdmNetworkNode') {
    width = Math.max(width, 280);
    height = Math.max(height, 135);
  }

  if (isExportMode) {
    if (isChassis) height = Math.max(height, 380);
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
const SITE_GAP_X = 140;
const HUB_GAP_X = 160;

function computeSiteRanks(
  siteNames: string[],
  siteGroups: Map<string, CustomNode[]>,
  hubNodes: CustomNode[],
  edges: Edge[],
  parentOf: Map<string, string>,
): { siteRank: Map<string, number>; siteMedianY: Map<string, number> } {
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

  // Trace inter-site dependencies through transport hubs (e.g. srcSite -> Hub -> tgtSite)
  if (hubNodes.length > 0) {
    hubNodes.forEach((h) => {
      const hubInSites = new Set<string>();
      const hubOutSites = new Set<string>();

      edges.forEach((e) => {
        const src = layoutId(e.source, parentOf);
        const tgt = layoutId(e.target, parentOf);
        if (tgt === h.id) {
          const s = nodeToSite.get(src);
          if (s) hubInSites.add(s);
        }
        if (src === h.id) {
          const s = nodeToSite.get(tgt);
          if (s) hubOutSites.add(s);
        }
      });

      hubInSites.forEach((inSite) => {
        hubOutSites.forEach((outSite) => {
          if (inSite !== outSite) {
            siteSucc.get(inSite)?.add(outSite);
            sitePred.get(outSite)?.add(inSite);
          }
        });
      });
    });
  }

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

  // Measure median Y coordinate on canvas for each site
  const siteMedianY = new Map<string, number>();
  siteNames.forEach((s) => {
    const nodes = siteGroups.get(s) || [];
    if (nodes.length === 0) {
      siteMedianY.set(s, 0);
    } else {
      const ys = nodes.map((n) => n.position.y).sort((a, b) => a - b);
      siteMedianY.set(s, ys[Math.floor(ys.length / 2)]);
    }
  });

  return { siteRank, siteMedianY };
}

function getSiteHubRole(
  _siteName: string,
  siteNodes: CustomNode[],
  hubNodes: CustomNode[],
  edges: Edge[],
  parentOf: Map<string, string>,
): 'source' | 'sink' | 'peer' | 'none' {
  if (hubNodes.length === 0) return 'none';
  const siteNodeIds = new Set(siteNodes.map((n) => n.id));
  const hubNodeIds = new Set(hubNodes.map((h) => h.id));

  let sendsToHub = false;
  let receivesFromHub = false;

  edges.forEach((e) => {
    const src = layoutId(e.source, parentOf);
    const tgt = layoutId(e.target, parentOf);
    if (siteNodeIds.has(src) && hubNodeIds.has(tgt)) sendsToHub = true;
    if (hubNodeIds.has(src) && siteNodeIds.has(tgt)) receivesFromHub = true;
  });

  if (sendsToHub && receivesFromHub) return 'peer';
  if (sendsToHub) return 'source';
  if (receivesFromHub) return 'sink';
  return 'none';
}

interface SiteLayoutResult {
  width: number;
  height: number;
  nodeLocalPositions: Map<string, { x: number; y: number }>;
}

function layoutSiteInternally(
  siteNodes: CustomNode[],
  edges: Edge[],
  parentOf: Map<string, string>,
  sizeOf: Map<string, NodeSize>,
  nodeDirections: Map<string, NodeFlow>,
): SiteLayoutResult {
  const siteNodeIds = siteNodes.map((n) => n.id);

  // Local adjacency inside site
  const { succ, pred } = buildAdjacency(siteNodeIds, edges, parentOf);
  const localRank = computeRanks(siteNodeIds, pred);

  // Mirror ranks if flow direction is RTL
  const mirroredRank = mirrorRanksForFlow(localRank, nodeDirections);
  const maxRank = Math.max(0, ...Array.from(mirroredRank.values()));

  const columns: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  const byCurrentY = [...siteNodes].sort((a, b) => a.position.y - b.position.y);
  byCurrentY.forEach((n) => columns[mirroredRank.get(n.id)!].push(n.id));

  orderColumns(columns, succ, pred);

  // Measure column widths
  const colWidths = columns.map((col) =>
    Math.max(DEFAULT_NODE_WIDTH, ...col.map((id) => sizeOf.get(id)?.width ?? DEFAULT_NODE_WIDTH)),
  );

  const colX: number[] = [];
  let curX = 0;
  columns.forEach((_col, i) => {
    colX[i] = curX;
    curX += colWidths[i] + COLUMN_GAP;
  });

  const totalWidth = curX > 0 ? curX - COLUMN_GAP : DEFAULT_NODE_WIDTH;

  const colHeights = columns.map(
    (col) =>
      col.reduce((sum, id) => sum + (sizeOf.get(id)?.height ?? DEFAULT_NODE_HEIGHT), 0) +
      Math.max(0, col.length - 1) * ROW_GAP,
  );
  const totalHeight = Math.max(DEFAULT_NODE_HEIGHT, ...colHeights);

  const nodeLocalPositions = new Map<string, { x: number; y: number }>();
  columns.forEach((col, c) => {
    let y = (totalHeight - colHeights[c]) / 2;
    col.forEach((id) => {
      nodeLocalPositions.set(id, { x: colX[c], y });
      y += (sizeOf.get(id)?.height ?? DEFAULT_NODE_HEIGHT) + ROW_GAP;
    });
  });

  return { width: totalWidth, height: totalHeight, nodeLocalPositions };
}

type NodeFlow = 'ltr' | 'rtl';

/**
 * Which way each node should be laid out.
 *
 * Scoped strictly per site so flow direction cannot bleed across data centre
 * boundaries or through central DWDM / WAN transport hubs.
 */
function resolveFlowDirections(
  nodes: CustomNode[],
  succ: Map<string, string[]>,
  pred: Map<string, string[]>,
  nodeSiteMap?: Map<string, string>,
  hubIdSet?: Set<string>,
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
    const idSite = nodeSiteMap?.get(id);
    for (const neighbour of [...(succ.get(id) || []), ...(pred.get(id) || [])]) {
      // Never propagate into or through transport hubs
      if (hubIdSet?.has(neighbour)) continue;
      // Confine propagation strictly within the same site
      if (nodeSiteMap && idSite && nodeSiteMap.get(neighbour) !== idSite) continue;

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
 * is present (e.g. `DC1`, `DC2`, `DC3`), nodes are clustered by data centre in
 * a balanced 2D architecture. Sites are partitioned into West (upstream/sources)
 * and East (downstream/destinations) with any central transport hub (e.g. DWDM Optical Ring)
 * positioned cleanly in the middle channel.
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

  // Identify transport hubs vs non-hub equipment
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

  const explicitSites = new Set(
    nonHubTopLevelNodes
      .map((n) => ((n.data?.site as string) || '').trim())
      .filter(Boolean),
  );

  const nodeSiteMap = new Map<string, string>();
  if (explicitSites.size >= 1) {
    // Pass 1: explicit sites
    nonHubTopLevelNodes.forEach((n) => {
      const s = ((n.data?.site as string) || '').trim();
      if (s) nodeSiteMap.set(n.id, s);
    });

    // Pass 2: infer site for unassigned nodes if neighbours belong to a single site
    nonHubTopLevelNodes.forEach((n) => {
      if (!nodeSiteMap.has(n.id)) {
        const neighbors = [...(succ.get(n.id) || []), ...(pred.get(n.id) || [])];
        const neighborSites = new Set(neighbors.map((nb) => nodeSiteMap.get(nb)).filter(Boolean));
        if (neighborSites.size === 1) {
          nodeSiteMap.set(n.id, Array.from(neighborSites)[0] as string);
        } else if (neighborSites.size >= 2) {
          hubNodes.push(n);
        } else if (explicitSites.size > 0) {
          nodeSiteMap.set(n.id, Array.from(explicitSites)[0] as string);
        }
      }
    });
  }

  const hubIdSet = new Set(hubNodes.map((h) => h.id));

  // Resolve user-locked & intra-site flow directions (strictly scoped per site)
  const flowDirections = resolveFlowDirections(topLevelNodes, succ, pred, nodeSiteMap, hubIdSet);

  if (explicitSites.size >= 2) {
    const genuineSiteNodes = nonHubTopLevelNodes.filter((n) => nodeSiteMap.has(n.id) && !hubIdSet.has(n.id));
    const siteGroups = new Map<string, CustomNode[]>();
    genuineSiteNodes.forEach((n) => {
      const site = nodeSiteMap.get(n.id)!;
      if (!siteGroups.has(site)) siteGroups.set(site, []);
      siteGroups.get(site)!.push(n);
    });

    const allSiteNames = Array.from(siteGroups.keys());
    const { siteRank, siteMedianY } = computeSiteRanks(allSiteNames, siteGroups, hubNodes, edges, parentOf);

    const westSites: string[] = [];
    const eastSites: string[] = [];

    if (hubNodes.length > 0) {
      // Hub topology: classify each site relative to the hub
      const sources: string[] = [];
      const sinks: string[] = [];
      const peers: string[] = [];

      allSiteNames.forEach((s) => {
        const role = getSiteHubRole(s, siteGroups.get(s) || [], hubNodes, edges, parentOf);
        if (role === 'source') sources.push(s);
        else if (role === 'sink') sinks.push(s);
        else peers.push(s);
      });

      let westCount = 0;
      let eastCount = 0;

      if (sources.length > 0 && sinks.length > 0) {
        // Clear upstream/downstream flow through hub: sources West, sinks East
        sources.forEach((s) => {
          westSites.push(s);
          westCount += siteGroups.get(s)?.length ?? 0;
        });
        sinks.forEach((s) => {
          eastSites.push(s);
          eastCount += siteGroups.get(s)?.length ?? 0;
        });
      } else {
        // Ring or peer topology: treat all sites as candidate peers to balance across hub
        peers.push(...sources, ...sinks);
      }

      // Greedily balance peer sites by node count descending
      const sortedPeers = [...peers].sort((a, b) => {
        const countDiff = (siteGroups.get(b)?.length ?? 0) - (siteGroups.get(a)?.length ?? 0);
        if (countDiff !== 0) return countDiff;
        const rankDiff = (siteRank.get(a) ?? 0) - (siteRank.get(b) ?? 0);
        if (rankDiff !== 0) return rankDiff;
        return (siteMedianY.get(a) ?? 0) - (siteMedianY.get(b) ?? 0);
      });

      sortedPeers.forEach((s) => {
        const count = siteGroups.get(s)?.length ?? 0;
        if (westCount <= eastCount) {
          westSites.push(s);
          westCount += count;
        } else {
          eastSites.push(s);
          eastCount += count;
        }
      });
    } else {
      // Direct inter-site links (no hub): topological rank 0 West, downstream rank > 0 East
      const hasDownstream = Array.from(siteRank.values()).some((r) => r > 0);
      if (hasDownstream) {
        allSiteNames.forEach((s) => {
          if ((siteRank.get(s) ?? 0) === 0) {
            westSites.push(s);
          } else {
            eastSites.push(s);
          }
        });
      } else {
        // All sites independent: stack vertically on West
        allSiteNames.forEach((s) => westSites.push(s));
      }
    }

    // Sort sites within West and East by median Y
    westSites.sort((a, b) => (siteMedianY.get(a) ?? 0) - (siteMedianY.get(b) ?? 0));
    eastSites.sort((a, b) => (siteMedianY.get(a) ?? 0) - (siteMedianY.get(b) ?? 0));

    // Default site flow direction is LTR unless a site has nodes locked as RTL
    const engineSiteDirection = new Map<string, NodeFlow>();
    allSiteNames.forEach((s) => engineSiteDirection.set(s, 'ltr'));

    // Build effective direction map per node
    const effectiveNodeFlow = new Map<string, NodeFlow>();
    genuineSiteNodes.forEach((n) => {
      const site = nodeSiteMap.get(n.id);
      const siteDir = (site ? engineSiteDirection.get(site) : undefined) ?? 'ltr';
      if (n.data?.flowDirectionLocked) {
        effectiveNodeFlow.set(n.id, (n.data?.flowDirection as string) === 'rtl' ? 'rtl' : 'ltr');
      } else if (flowDirections.has(n.id) && flowDirections.get(n.id) !== 'ltr') {
        effectiveNodeFlow.set(n.id, flowDirections.get(n.id)!);
      } else {
        effectiveNodeFlow.set(n.id, siteDir);
      }
    });

    // Lay out all sites internally in local coordinate space
    const siteLayouts = new Map<string, SiteLayoutResult>();
    allSiteNames.forEach((s) => {
      const sNodes = siteGroups.get(s) || [];
      siteLayouts.set(s, layoutSiteInternally(sNodes, edges, parentOf, sizeOf, effectiveNodeFlow));
    });

    // Calculate West stack geometry
    let westWidth = 0;
    let westTotalHeight = 0;
    const westSitePositions = new Map<string, { x: number; y: number }>();
    let curY = TOP_MARGIN;

    westSites.forEach((s, idx) => {
      const layout = siteLayouts.get(s)!;
      westWidth = Math.max(westWidth, layout.width);
      westSitePositions.set(s, { x: LEFT_MARGIN, y: curY });
      curY += layout.height;
      if (idx < westSites.length - 1) curY += SITE_GAP_Y;
    });
    westTotalHeight = curY - TOP_MARGIN;

    // Calculate East stack geometry
    let eastWidth = 0;
    let eastTotalHeight = 0;
    const eastSitePositions = new Map<string, { x: number; y: number }>();
    curY = TOP_MARGIN;

    eastSites.forEach((s, idx) => {
      const layout = siteLayouts.get(s)!;
      eastWidth = Math.max(eastWidth, layout.width);
      eastSitePositions.set(s, { x: 0, y: curY });
      curY += layout.height;
      if (idx < eastSites.length - 1) curY += SITE_GAP_Y;
    });
    eastTotalHeight = curY - TOP_MARGIN;

    const hasWest = westSites.length > 0;
    const hasEast = eastSites.length > 0;
    const hasHub = hubNodes.length > 0;

    let hubX = LEFT_MARGIN;
    let eastStartX = LEFT_MARGIN;

    const maxHubWidth = hasHub
      ? Math.max(...hubNodes.map((h) => sizeOf.get(h.id)?.width ?? DEFAULT_NODE_WIDTH))
      : 0;

    if (hasWest && hasHub && hasEast) {
      hubX = LEFT_MARGIN + westWidth + HUB_GAP_X;
      eastStartX = hubX + maxHubWidth + HUB_GAP_X;
    } else if (hasWest && hasHub) {
      hubX = LEFT_MARGIN + westWidth + HUB_GAP_X;
    } else if (hasHub && hasEast) {
      hubX = LEFT_MARGIN;
      eastStartX = hubX + maxHubWidth + HUB_GAP_X;
    } else if (hasWest && hasEast) {
      eastStartX = LEFT_MARGIN + westWidth + SITE_GAP_X;
    }

    // Vertically balance West and East stacks
    const maxHeight = Math.max(westTotalHeight, eastTotalHeight);
    if (hasWest && hasEast) {
      if (westTotalHeight < maxHeight) {
        const shiftY = (maxHeight - westTotalHeight) / 2;
        westSites.forEach((s) => {
          const p = westSitePositions.get(s)!;
          westSitePositions.set(s, { x: p.x, y: p.y + shiftY });
        });
      }
      if (eastTotalHeight < maxHeight) {
        const shiftY = (maxHeight - eastTotalHeight) / 2;
        eastSites.forEach((s) => {
          const p = eastSitePositions.get(s)!;
          eastSitePositions.set(s, { x: eastStartX, y: p.y + shiftY });
        });
      } else {
        eastSites.forEach((s) => {
          const p = eastSitePositions.get(s)!;
          eastSitePositions.set(s, { x: eastStartX, y: p.y });
        });
      }
    } else if (hasEast) {
      eastSites.forEach((s) => {
        const p = eastSitePositions.get(s)!;
        eastSitePositions.set(s, { x: eastStartX, y: p.y });
      });
    }

    // Position hub(s) vertically centered in the middle channel
    const hubPositions = new Map<string, { x: number; y: number }>();
    if (hasHub) {
      const totalHubH = hubNodes.reduce(
        (sum, h) => sum + (sizeOf.get(h.id)?.height ?? DEFAULT_NODE_HEIGHT),
        0,
      ) + Math.max(0, hubNodes.length - 1) * ROW_GAP;

      let hY = TOP_MARGIN + (maxHeight - totalHubH) / 2;
      if (hY < TOP_MARGIN) hY = TOP_MARGIN;

      hubNodes.forEach((h) => {
        hubPositions.set(h.id, { x: hubX, y: hY });
        hY += (sizeOf.get(h.id)?.height ?? DEFAULT_NODE_HEIGHT) + ROW_GAP;
      });
    }

    // Apply absolute positions
    const positions = new Map<string, { x: number; y: number }>();

    westSites.forEach((s) => {
      const origin = westSitePositions.get(s)!;
      const layout = siteLayouts.get(s)!;
      layout.nodeLocalPositions.forEach((localPos, nodeId) => {
        positions.set(nodeId, { x: origin.x + localPos.x, y: origin.y + localPos.y });
      });
    });

    eastSites.forEach((s) => {
      const origin = eastSitePositions.get(s)!;
      const layout = siteLayouts.get(s)!;
      layout.nodeLocalPositions.forEach((localPos, nodeId) => {
        positions.set(nodeId, { x: origin.x + localPos.x, y: origin.y + localPos.y });
      });
    });

    hubPositions.forEach((pos, hubId) => {
      positions.set(hubId, pos);
    });

    return nodes.map((n) => withLayoutResult(n, positions.get(n.id), effectiveNodeFlow.get(n.id)));
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


