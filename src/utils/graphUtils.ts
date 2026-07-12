import { type Edge } from '@xyflow/react';
import { type CustomNode } from '../store/types';

/**
 * Traverses back from a source node to determine if the traffic originating 
 * from it or passing through it is metadata (GigaSMART Application Metadata).
 */
export const isMetadataEdge = (
  edge: Edge,
  nodes: CustomNode[],
  edges: Edge[]
): boolean => {
  const srcNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);

  if (!srcNode) return false;

  // Immediate check for GigaSMART metadata nodes
  if (srcNode.type === 'gigaSmartNode') {
    const actionType = srcNode.data?.actionType;
    if (actionType === 'Application Metadata' || actionType === 'AMX' || actionType === 'AMI') {
      return true;
    }
  }

  // Check for hardware nodes with metadata apps
  if (srcNode.type === 'hardwareNode') {
    const apps = (srcNode.data?.gigaSmartApps as any[]) || [];
    const hasMetadataApp = apps.some(app => 
      app.actionType === 'Application Metadata' || app.actionType === 'AMX' || app.actionType === 'AMI'
    );
    if (hasMetadataApp && targetNode?.type === 'toolNode' && 
        (targetNode.data?.configType === 'Metadata Tool' || targetNode.data?.configType === 'Objects' || targetNode.data?.configType === 'Storage Tool')) {
      return true;
    }
  }
  
  // General traceback for nested logical pipelines
  const visited = new Set<string>();
  const queue: string[] = [edge.source];
  visited.add(edge.source);
  let hasMetadataOrigin = false;
  let hasPacketOrigin = false;

  while (queue.length > 0) {
    const currId = queue.shift()!;
    const currNode = nodes.find(n => n.id === currId);
    if (!currNode) continue;

    if (currNode.type === 'inputNode') {
      hasPacketOrigin = true;
    } else if (currNode.type === 'gigaSmartNode') {
      const actionType = currNode.data?.actionType;
      if (actionType === 'Application Metadata' || actionType === 'AMX' || actionType === 'AMI') {
        hasMetadataOrigin = true;
      } else {
        hasPacketOrigin = true;
      }
    } else if (currNode.type === 'hardwareNode') {
      const apps = (currNode.data?.gigaSmartApps as any[]) || [];
      if (apps.some(app => app.actionType === 'Application Metadata' || app.actionType === 'AMX' || app.actionType === 'AMI')) {
        hasMetadataOrigin = true;
      }
      const incoming = edges.filter(e => e.target === currId);
      if (incoming.length === 0) {
        hasPacketOrigin = true;
      }
    }

    const incomingEdges = edges.filter(e => e.target === currId);
    incomingEdges.forEach(e => {
      if (!visited.has(e.source)) {
        visited.add(e.source);
        queue.push(e.source);
      }
    });
  }

  return (hasMetadataOrigin && !hasPacketOrigin) || 
         (targetNode?.type === 'toolNode' && 
          (targetNode.data?.configType === 'Metadata Tool' || 
           ((targetNode.data?.configType === 'Objects' || targetNode.data?.configType === 'Storage Tool') && hasMetadataOrigin)));
};

/**
 * Calculates animation duration for edges based on bandwidth.
 * 10 Mbps -> ~2.0s duration, 100 Gbps -> 0.2s duration.
 */
export const calculateAnimationDuration = (bps: number): string => {
  const minLog = Math.log10(10);
  const maxLog = Math.log10(100000);
  const currentLog = Math.log10(Math.max(10, bps));
  const normalized = Math.min(1.0, Math.max(0, (currentLog - minLog) / (maxLog - minLog)));
  const duration = 2.0 - 1.8 * normalized;
  return `${duration.toFixed(2)}s`;
};
