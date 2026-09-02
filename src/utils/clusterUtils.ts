/**
 * clusterUtils.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Helpers for creating, summarizing, exploding (expanding), collapsing, and
 * routing edges for TAP and Tool clusters.
 */
import { v4 as uuidv4 } from 'uuid';
import type { Edge } from '@xyflow/react';
import type { CustomNode, ClusterNodeData, ClusterBreakdownItem, ToolNodeData } from '../store/types';
import { NODE_TYPES } from '../constants/nodeTypes';
import { isTapModule, getTapLinkCapacity } from './hardwareUtils';
import { getSkus } from './bom/skuUtils';
import { getDefaultIngestLimitMbps } from '../constants/toolIngestLimits';

export function isTapNode(node: CustomNode): boolean {
  if (node.type !== NODE_TYPES.HARDWARE) return false;
  const model = String(node.data?.model || '');
  const sku = String(node.data?.sku || '');
  return model.includes('TAP') || isTapModule(model, sku);
}

export function isToolNode(node: CustomNode): boolean {
  return node.type === NODE_TYPES.TOOL;
}

export function extractTapFiberAndSplit(node: CustomNode): { fiberType: string; splitRatio: string; links: number } {
  const skus = getSkus();
  const model = String(node.data?.model || '');
  const sku = String(node.data?.sku || model);
  const desc = skus[sku] || (node.data?.description as string) || '';

  let fiberType = 'Multimode';
  if (desc.includes('SM') || desc.includes('Singlemode') || model.includes('M253') || model.includes('M273') || model.includes('M503') || model.includes('M506')) {
    fiberType = 'Singlemode';
  } else if (desc.includes('OM5')) {
    fiberType = 'Multimode (OM5)';
  } else if (desc.includes('OM1')) {
    fiberType = 'Multimode (OM1 62.5µm)';
  } else if (desc.includes('MM')) {
    fiberType = 'Multimode (50/125µm)';
  }

  let splitRatio = '50/50';
  if (desc.includes('70/30') || model.includes('70/30') || model.includes('73') || model.includes('71')) {
    splitRatio = '70/30';
  } else if (desc.includes('60/40') || model.includes('60/40')) {
    splitRatio = '60/40';
  } else if (desc.includes('80/20')) {
    splitRatio = '80/20';
  } else if (desc.includes('90/10')) {
    splitRatio = '90/10';
  }

  let links = Number(node.data?.tappedLinksCount);
  if (!links || links <= 0) {
    links = getTapLinkCapacity(desc);
  }
  if (!links || links <= 0) {
    if (model.includes('251') || model.includes('253') || model.includes('271') || model.includes('273')) {
      links = desc.includes('6 links') ? 6 : 2;
    } else if (model.includes('501') || model.includes('503') || model.includes('506')) {
      links = 3;
    } else {
      links = 2;
    }
  }

  return { fiberType, splitRatio, links };
}

export function buildClusterSummary(
  memberNodes: CustomNode[],
  clusterType: 'tap' | 'tool',
): ClusterNodeData['summary'] {
  const count = memberNodes.length;

  if (clusterType === 'tap') {
    let totalLinks = 0;
    const fiberTypesSet = new Set<string>();
    const splitRatiosSet = new Set<string>();
    const breakdownMap = new Map<string, ClusterBreakdownItem>();

    memberNodes.forEach((node) => {
      const model = String(node.data?.model || 'TAP');
      const { fiberType, splitRatio, links } = extractTapFiberAndSplit(node);
      totalLinks += links;
      fiberTypesSet.add(fiberType);
      splitRatiosSet.add(splitRatio);

      const key = `${model}_${fiberType}_${splitRatio}`;
      const existing = breakdownMap.get(key);
      if (existing) {
        existing.count += 1;
        existing.totalLinks = (existing.totalLinks || 0) + links;
      } else {
        breakdownMap.set(key, {
          model,
          count: 1,
          fiberType,
          splitRatio,
          linksCount: links,
          totalLinks: links,
        });
      }
    });

    const breakdown = Array.from(breakdownMap.values());
    const isMixed = breakdown.length > 1;

    return {
      count,
      totalLinks,
      fiberTypes: Array.from(fiberTypesSet),
      splitRatios: Array.from(splitRatiosSet),
      isMixed,
      breakdown,
    };
  }

  // Tool Cluster
  const toolNamesSet = new Set<string>();
  let totalIngest = 0;
  const breakdownMap = new Map<string, ClusterBreakdownItem>();

  memberNodes.forEach((node) => {
    const tData = node.data as ToolNodeData;
    const toolName = String(tData?.toolName || tData?.label || 'Tool');
    const rawLimit = tData?.ingestLimitMbps;
    const ingestLimit = (typeof rawLimit === 'number' && rawLimit > 0)
      ? rawLimit
      : getDefaultIngestLimitMbps(toolName);
    totalIngest += ingestLimit;
    toolNamesSet.add(toolName);

    const key = `${toolName}_${ingestLimit}`;
    const existing = breakdownMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      breakdownMap.set(key, {
        model: toolName,
        toolName,
        count: 1,
        ingestLimitMbps: ingestLimit,
      });
    }
  });

  const breakdown = Array.from(breakdownMap.values());
  const isMixed = breakdown.length > 1;

  return {
    count,
    toolNames: Array.from(toolNamesSet),
    totalIngestLimitMbps: totalIngest,
    isMixed,
    breakdown,
  };
}

export interface CreateClusterResult {
  clusterNode: CustomNode;
  updatedNodes: CustomNode[];
  updatedEdges: Edge[];
}

export function buildClusterNode(
  memberNodes: CustomNode[],
  allEdges: Edge[],
  typeOverride?: 'tap' | 'tool',
): CreateClusterResult {
  const clusterType: 'tap' | 'tool' = typeOverride || (memberNodes.every(isTapNode) ? 'tap' : 'tool');
  const clusterId = `cluster-${uuidv4()}`;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const expandedLayout: Record<string, { x: number; y: number }> = {};

  memberNodes.forEach((n) => {
    const { x, y } = n.position;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    expandedLayout[n.id] = { x, y };
  });

  const summary = buildClusterSummary(memberNodes, clusterType);
  const primaryModel = summary.breakdown[0]?.model || (clusterType === 'tap' ? 'TAP Module' : 'Tool');
  const label = summary.isMixed
    ? (clusterType === 'tap' ? `${summary.count}x TAP Modules (Mixed)` : `${summary.count}x Tools (Mixed)`)
    : `${summary.count}x ${primaryModel}`;

  // Center the compact cluster card vertically relative to the span of its member nodes
  const centerY = isFinite(minY) && isFinite(maxY) ? (minY + maxY) / 2 - 70 : minY;
  const posX = isFinite(minX) ? minX : 0;

  const clusterNode: CustomNode = {
    id: clusterId,
    type: NODE_TYPES.CLUSTER,
    position: { x: posX, y: Math.max(0, centerY) },
    data: {
      label,
      configType: 'Cluster Group',
      clusterType,
      isCollapsed: true,
      memberNodeIds: memberNodes.map((n) => n.id),
      expandedLayout,
      summary,
    } as ClusterNodeData,
  };

  const memberIdList = memberNodes.map((n) => n.id);
  const memberIds = new Set(memberIdList);

  // Hide member nodes and assign clusterId
  const updatedNodes = memberNodes.map((node) => ({
    ...node,
    hidden: true,
    data: {
      ...node.data,
      clusterId,
    },
  }));

  // Route edges:
  // When collapsed, member external edges connect to the cluster card
  const updatedEdges = allEdges.map((edge) => {
    if (memberIds.has(edge.source) && !memberIds.has(edge.target)) {
      return {
        ...edge,
        source: clusterId,
        sourceHandle: 'out',
        data: {
          ...edge.data,
          originalSource: edge.source,
          originalSourceHandle: edge.sourceHandle || 'out',
        },
      };
    }
    if (memberIds.has(edge.target) && !memberIds.has(edge.source)) {
      return {
        ...edge,
        target: clusterId,
        targetHandle: 'in',
        data: {
          ...edge.data,
          originalTarget: edge.target,
          originalTargetHandle: edge.targetHandle || 'in',
        },
      };
    }
    return edge;
  });

  return {
    clusterNode,
    updatedNodes,
    updatedEdges,
  };
}

export function expandClusterNode(
  clusterNode: CustomNode,
  allNodes: CustomNode[],
  allEdges: Edge[],
): { nodes: CustomNode[]; edges: Edge[] } {
  const data = clusterNode.data as ClusterNodeData;
  const memberIdList = data.memberNodeIds || [];
  const memberIds = new Set(memberIdList);
  const basePos = clusterNode.position;

  // Unhide member nodes and arrange neatly relative to cluster anchor
  const spacingY = 110;
  const offsetX = 280;

  let minSavedX = Infinity;
  let minSavedY = Infinity;
  memberIdList.forEach((id) => {
    const s = data.expandedLayout?.[id];
    if (s) {
      minSavedX = Math.min(minSavedX, s.x);
      minSavedY = Math.min(minSavedY, s.y);
    }
  });

  const headerPos = isFinite(minSavedX) && isFinite(minSavedY)
    ? { x: minSavedX, y: Math.max(0, minSavedY - 50) }
    : { x: basePos.x, y: Math.max(0, basePos.y - 50) };

  let idx = 0;
  const updatedNodes = allNodes.map((node) => {
    if (node.id === clusterNode.id) {
      return {
        ...node,
        position: headerPos,
        data: {
          ...node.data,
          isCollapsed: false,
        },
      };
    }
    if (memberIds.has(node.id)) {
      const saved = data.expandedLayout?.[node.id];
      const targetPos = saved
        ? { x: saved.x, y: saved.y }
        : { x: basePos.x + offsetX, y: basePos.y + idx * spacingY };
      idx += 1;
      return {
        ...node,
        hidden: false,
        position: targetPos,
      };
    }
    return node;
  });

  let unassignedSourceIdx = 0;
  let unassignedTargetIdx = 0;

  // Restore edge endpoints to original individual nodes
  const updatedEdges = allEdges.map((edge) => {
    let e = { ...edge };
    if (edge.source === clusterNode.id) {
      const targetMemberId = (edge.data?.originalSource as string) || (memberIdList.length > 0 ? memberIdList[unassignedSourceIdx % memberIdList.length] : clusterNode.id);
      unassignedSourceIdx++;
      e = {
        ...e,
        source: targetMemberId,
        sourceHandle: (edge.data?.originalSourceHandle as string) || 'out',
        data: {
          ...edge.data,
          originalSource: targetMemberId,
          originalSourceHandle: (edge.data?.originalSourceHandle as string) || 'out',
        },
      };
    }
    if (edge.target === clusterNode.id) {
      const targetMemberId = (edge.data?.originalTarget as string) || (memberIdList.length > 0 ? memberIdList[unassignedTargetIdx % memberIdList.length] : clusterNode.id);
      unassignedTargetIdx++;
      e = {
        ...e,
        target: targetMemberId,
        targetHandle: (edge.data?.originalTargetHandle as string) || 'in',
        data: {
          ...edge.data,
          originalTarget: targetMemberId,
          originalTargetHandle: (edge.data?.originalTargetHandle as string) || 'in',
        },
      };
    }
    return e;
  });

  return { nodes: updatedNodes, edges: updatedEdges };
}

export function collapseClusterNode(
  clusterNode: CustomNode,
  allNodes: CustomNode[],
  allEdges: Edge[],
): { nodes: CustomNode[]; edges: Edge[] } {
  const data = clusterNode.data as ClusterNodeData;
  const memberIdList = data.memberNodeIds || [];
  const memberIds = new Set(memberIdList);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Save current expanded positions and hide member nodes
  const currentExpandedLayout: Record<string, { x: number; y: number }> = {};
  allNodes.forEach((n) => {
    if (memberIds.has(n.id)) {
      const { x, y } = n.position;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      currentExpandedLayout[n.id] = { x, y };
    }
  });

  // Recompute summary in case member node configs changed while expanded
  const members = allNodes.filter((n) => memberIds.has(n.id));
  const summary = buildClusterSummary(members, data.clusterType || 'tap');

  const centerY = isFinite(minY) && isFinite(maxY) ? (minY + maxY) / 2 - 70 : clusterNode.position.y;
  const posX = isFinite(minX) ? minX : clusterNode.position.x;

  const updatedNodes = allNodes.map((node) => {
    if (node.id === clusterNode.id) {
      return {
        ...node,
        position: { x: posX, y: Math.max(0, centerY) },
        data: {
          ...node.data,
          isCollapsed: true,
          expandedLayout: currentExpandedLayout,
          summary,
        },
      };
    }
    if (memberIds.has(node.id)) {
      return {
        ...node,
        hidden: true,
      };
    }
    return node;
  });

  // Reconnect edges to cluster node
  const updatedEdges = allEdges.map((edge) => {
    if (memberIds.has(edge.source) && !memberIds.has(edge.target)) {
      return {
        ...edge,
        source: clusterNode.id,
        sourceHandle: 'out',
        data: {
          ...edge.data,
          originalSource: edge.source,
          originalSourceHandle: edge.sourceHandle || 'out',
        },
      };
    }
    if (memberIds.has(edge.target) && !memberIds.has(edge.source)) {
      return {
        ...edge,
        target: clusterNode.id,
        targetHandle: 'in',
        data: {
          ...edge.data,
          originalTarget: edge.target,
          originalTargetHandle: edge.targetHandle || 'in',
        },
      };
    }
    return edge;
  });

  return { nodes: updatedNodes, edges: updatedEdges };
}

export function dissolveClusterNode(
  clusterNodeId: string,
  allNodes: CustomNode[],
  allEdges: Edge[],
): { nodes: CustomNode[]; edges: Edge[] } {
  const clusterNode = allNodes.find((n) => n.id === clusterNodeId);
  if (!clusterNode) return { nodes: allNodes, edges: allEdges };

  const data = clusterNode.data as ClusterNodeData;
  const memberIdList = data.memberNodeIds || [];
  const memberIds = new Set(memberIdList);
  const basePos = clusterNode.position;

  let idx = 0;
  const spacingY = 110;
  const offsetX = 50;

  const updatedNodes = allNodes
    .filter((n) => n.id !== clusterNodeId)
    .map((node) => {
      if (memberIds.has(node.id)) {
        const saved = data.expandedLayout?.[node.id];
        const pos = saved || { x: basePos.x + offsetX, y: basePos.y + idx * spacingY };
        idx += 1;
        return {
          ...node,
          hidden: false,
          position: pos,
          data: {
            ...node.data,
            clusterId: undefined,
          },
        };
      }
      return node;
    });

  let unassignedSourceIdx = 0;
  let unassignedTargetIdx = 0;

  // Restore edge endpoints to original member nodes
  const updatedEdges = allEdges.map((edge) => {
    let e = { ...edge };
    if (edge.source === clusterNodeId) {
      const targetMemberId = (edge.data?.originalSource as string) || (memberIdList.length > 0 ? memberIdList[unassignedSourceIdx % memberIdList.length] : edge.source);
      unassignedSourceIdx++;
      e = {
        ...e,
        source: targetMemberId,
        sourceHandle: (edge.data?.originalSourceHandle as string) || 'out',
      };
    }
    if (edge.target === clusterNodeId) {
      const targetMemberId = (edge.data?.originalTarget as string) || (memberIdList.length > 0 ? memberIdList[unassignedTargetIdx % memberIdList.length] : edge.target);
      unassignedTargetIdx++;
      e = {
        ...e,
        target: targetMemberId,
        targetHandle: (edge.data?.originalTargetHandle as string) || 'in',
      };
    }
    return e;
  });

  return { nodes: updatedNodes, edges: updatedEdges };
}

/**
 * Calculates the number of tapped links represented by an edge (for single TAPs or cluster TAP links).
 */
export function getEdgeTapLinksCount(
  e: Edge,
  srcNode?: CustomNode,
  allNodes: CustomNode[] = [],
): number {
  if (!srcNode) return 1;
  const isClusterTap = srcNode.type === NODE_TYPES.CLUSTER && srcNode.data?.clusterType === 'tap';
  let tapNode: CustomNode | undefined;
  if (isClusterTap) {
    const origId = (e.data?.originalSource as string) || (e.data?.originalTarget as string);
    if (origId) {
      tapNode = allNodes.find((n) => n.id === origId);
    }
    if (!tapNode) {
      const summary = (srcNode.data as ClusterNodeData)?.summary;
      const memberCount = ((srcNode.data as ClusterNodeData)?.memberNodeIds || []).length || 1;
      const totalLinks = summary?.totalLinks || memberCount;
      if (origId || memberCount > 1) {
        return Math.max(1, Math.round(totalLinks / memberCount));
      }
      return totalLinks;
    }
  } else if (isTapNode(srcNode) || srcNode.type === NODE_TYPES.INPUT) {
    tapNode = srcNode;
  }

  if (tapNode) {
    const hwData = tapNode.data as Record<string, unknown>;
    const allocs = hwData?.tappedLinkAllocations as Array<{ qty?: number }> | undefined;
    if (allocs && allocs.length > 0) {
      const sum = allocs.reduce((acc, a) => acc + (a.qty || 0), 0);
      if (sum > 0) return sum;
    }
    if (typeof hwData?.tappedLinksCount === 'number' && hwData.tappedLinksCount > 0) {
      return hwData.tappedLinksCount;
    }
    const model = String(hwData?.model || '');
    if (model.includes('M506') || model.includes('M273') || model.includes('M253') || model.includes('M453')) return 6;
    return 1;
  }
  return 1;
}

/**
 * Returns a human-friendly link prefix for diagram edges and inspection panels:
 * - For TAP stacks: "Links 1 to 6", "Links 7 to 12", "Links 13 to 18", etc.
 * - For single multi-link TAPs: "Links 1 to 6"
 * - For general parallel links: "Link 1/4", "Link 2/4", etc.
 */
export function formatEdgeLinkPrefix(
  edge: Edge,
  parallelEdges: Edge[],
  nodes: CustomNode[],
): string {
  const totalParallel = parallelEdges.length;
  const parallelIndex = parallelEdges.findIndex((e) => e.id === edge.id);
  if (parallelIndex < 0 && totalParallel <= 1) {
    const srcNode = nodes.find((n) => n.id === edge.source);
    if (srcNode && (isTapNode(srcNode) || (srcNode.type === NODE_TYPES.CLUSTER && srcNode.data?.clusterType === 'tap'))) {
      const count = getEdgeTapLinksCount(edge, srcNode, nodes);
      if (count > 1) return `Links 1 to ${count}`;
    }
    return '';
  }

  const srcNode = nodes.find((n) => n.id === edge.source);
  const isClusterTap = srcNode?.type === NODE_TYPES.CLUSTER && srcNode.data?.clusterType === 'tap';
  const isDirectTap = isTapNode(srcNode as CustomNode) || srcNode?.type === NODE_TYPES.INPUT;

  if (isClusterTap || isDirectTap) {
    let startLink = 1;
    for (let i = 0; i < parallelIndex; i++) {
      const pEdge = parallelEdges[i];
      startLink += getEdgeTapLinksCount(pEdge, srcNode, nodes);
    }
    const currentCount = getEdgeTapLinksCount(edge, srcNode, nodes);
    const endLink = startLink + currentCount - 1;

    if (currentCount > 1) {
      return `Links ${startLink} to ${endLink}`;
    }
    if (totalParallel > 1) {
      return `Link ${startLink}`;
    }
    return '';
  }

  if (totalParallel > 1) {
    return `Link ${parallelIndex + 1}/${totalParallel}`;
  }
  return '';
}

