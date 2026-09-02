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

function nodeSize(node: CustomNode): NodeSize {
  const width = node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH;
  const height = node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT;
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

const SITE_GAP_Y = 120;

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
  globalRank: Map<string, number>,
  sizeOf: Map<string, NodeSize>,
  succ: Map<string, string[]>,
  pred: Map<string, string[]>,
): Map<string, { x: number; y: number }> {
  const maxRank = Math.max(0, ...Array.from(globalRank.values()));

  // Column widths match the widest node at each global pipeline stage across all sites
  const colWidths: number[] = Array.from({ length: maxRank + 1 }, () => DEFAULT_NODE_WIDTH);
  siteGroups.forEach((nodes) => {
    nodes.forEach((n) => {
      const r = globalRank.get(n.id) ?? 0;
      const w = sizeOf.get(n.id)?.width ?? DEFAULT_NODE_WIDTH;
      if (w > colWidths[r]) colWidths[r] = w;
    });
  });

  const colX: number[] = [];
  let currentX = LEFT_MARGIN;
  colWidths.forEach((w, i) => {
    colX[i] = currentX;
    currentX += w + COLUMN_GAP;
  });

  const positions = new Map<string, { x: number; y: number }>();
  let currentY = TOP_MARGIN;

  siteOrder.forEach((siteName) => {
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

    currentY += siteMaxHeight + SITE_GAP_Y;
  });

  return positions;
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
 * Grouped child nodes are left untouched - their position is relative to
 * their parent, which moves with the rest of its column as a single unit.
 */
export function computeTidyLayout(nodes: CustomNode[], edges: Edge[]): CustomNode[] {
  const topLevelNodes = nodes.filter((n) => !n.parentId && !n.hidden);
  if (topLevelNodes.length === 0) return nodes;

  const parentOf = new Map<string, string>();
  nodes.forEach((n) => {
    if (n.parentId) parentOf.set(n.id, n.parentId);
  });

  const layoutIds = topLevelNodes.map((n) => n.id);
  const sizeOf = new Map<string, NodeSize>(topLevelNodes.map((n) => [n.id, nodeSize(n)]));

  const { succ, pred } = buildAdjacency(layoutIds, edges, parentOf);
  const rank = computeRanks(layoutIds, pred);

  // Check for multi-site topologies
  const explicitSites = new Set(
    topLevelNodes
      .map((n) => ((n.data?.site as string) || '').trim())
      .filter(Boolean),
  );

  if (explicitSites.size >= 2) {
    // Multi-site layout: partition nodes into site groups
    const nodeSiteMap = new Map<string, string>();

    // Pass 1: Tag nodes with their explicit site
    topLevelNodes.forEach((n) => {
      const s = ((n.data?.site as string) || '').trim();
      if (s) nodeSiteMap.set(n.id, s);
    });

    // Pass 2: For unassigned nodes, infer site if they only connect to one site
    topLevelNodes.forEach((n) => {
      if (!nodeSiteMap.has(n.id)) {
        const neighbors = [...(succ.get(n.id) || []), ...(pred.get(n.id) || [])];
        const neighborSites = new Set(neighbors.map((nb) => nodeSiteMap.get(nb)).filter(Boolean));
        if (neighborSites.size === 1) {
          nodeSiteMap.set(n.id, Array.from(neighborSites)[0] as string);
        } else {
          nodeSiteMap.set(n.id, 'Shared / Transport');
        }
      }
    });

    const siteGroups = new Map<string, CustomNode[]>();
    topLevelNodes.forEach((n) => {
      const site = nodeSiteMap.get(n.id) || 'Shared / Transport';
      if (!siteGroups.has(site)) siteGroups.set(site, []);
      siteGroups.get(site)!.push(n);
    });

    const allSiteNames = Array.from(siteGroups.keys());
    const siteOrder = computeSiteOrder(allSiteNames, siteGroups, edges, parentOf);

    const positions = assignSiteAwarePositions(siteOrder, siteGroups, rank, sizeOf, succ, pred);

    return nodes.map((n) => {
      const pos = positions.get(n.id);
      return pos ? { ...n, position: pos } : n;
    });
  }

  // Single-site or untagged topology: classic single-pipeline layout
  const maxRank = Math.max(0, ...Array.from(rank.values()));
  const columns: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  const byCurrentY = [...topLevelNodes].sort((a, b) => a.position.y - b.position.y);
  byCurrentY.forEach((n) => columns[rank.get(n.id)!].push(n.id));

  orderColumns(columns, succ, pred);
  const positions = assignPositions(columns, sizeOf);

  return nodes.map((n) => {
    const pos = positions.get(n.id);
    return pos ? { ...n, position: pos } : n;
  });
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
    const domEl =
      typeof document !== 'undefined'
        ? (document.querySelector(`[data-id="${n.id}"]`) as HTMLElement)
        : null;
    if (domEl && domEl.offsetHeight > 50) {
      return domEl.offsetHeight;
    }
    const model = String(n.data?.model || '').toUpperCase();
    const isChassis = (model.includes('HC') || model.includes('TA')) && !model.includes('TAP');
    const isTap = model.includes('TAP');
    if (n.type === 'clusterNode') return 310;
    if (isChassis) return 370;
    if (isTap) return 190;
    if (n.type === 'toolNode') return 190;
    if (n.type === 'mapNode' || n.type === 'filterNode') return 220;
    return n.measured?.height || 180;
  }

  function getNodeWidth(n: CustomNode): number {
    const domEl =
      typeof document !== 'undefined'
        ? (document.querySelector(`[data-id="${n.id}"]`) as HTMLElement)
        : null;
    if (domEl && domEl.offsetWidth > 50) {
      return domEl.offsetWidth;
    }
    const model = String(n.data?.model || '').toUpperCase();
    const isChassis = (model.includes('HC') || model.includes('TA')) && !model.includes('TAP');
    if (isChassis) return 330;
    if (n.type === 'clusterNode') return 310;
    if (n.type === 'toolNode') return 210;
    if (model.includes('TAP')) return 200;
    return n.measured?.width || 240;
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

