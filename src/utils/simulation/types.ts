import { type Edge } from '@xyflow/react';
import { 
  type TrafficStream, 
  type NodeMetrics, 
  type CustomNode 
} from '../../store/types';

export interface TrajectoryStream extends TrafficStream {
  trafficType?: 'packet' | 'metadata';
  metadataFormat?: 'CEF' | 'JSON';
  firstEdgeId?: string;
}

export interface QueueItem {
  nodeId: string;
  stream: TrajectoryStream;
  edgePath: string[];
}

export interface NodeProcessingResult {
  forwardStream: TrajectoryStream | null;
  dropBandwidth?: number;
  generatedMetadataStreams?: TrajectoryStream[];
  handledQueueExternally?: boolean;
}

export type NodeProcessor = (
  node: CustomNode,
  item: QueueItem,
  nodeMetric: NodeMetrics,
  toolReceivedStreams: Record<string, TrajectoryStream[]>,
  deliveredStreamIds: Set<string>,
  outboundEdges: Edge[],
  activeEdgeSet: Set<string>,
  edgeTraffic: Record<string, number>,
  queue: QueueItem[],
  nodes: CustomNode[],
  edgeEncryptedTraffic: Record<string, number>
) => NodeProcessingResult;

export interface SimulationStepResult {
  metrics: Record<string, NodeMetrics>;
  edgeMetrics: Record<string, number>;
  edgeEncryptedMbps: Record<string, number>;
  activeEdges: string[];
  blockedEdges: string[];
  encryptedEdges: string[];
  decryptedEdges: string[];
  deliveredStreamIds: string[];
  nodeDataPatches: Record<string, Record<string, unknown>>;
  uniqueEgressMbps: number;
}
