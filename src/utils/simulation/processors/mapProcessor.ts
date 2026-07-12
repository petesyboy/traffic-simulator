import { type NodeProcessor } from '../types';
import { evaluateMapConditions } from '../conditions';

export const processMapNode: NodeProcessor = (
  node,
  item,
  nodeMetric
) => {
  const data = node.data;
  const isMatch = evaluateMapConditions(item.stream, data.conditions);
  if (isMatch) {
    nodeMetric.txMbps += item.stream.bandwidth;
    nodeMetric.txPackets += item.stream.bandwidth * 250;
    return { forwardStream: item.stream };
  } else {
    const dropBandwidth = item.stream.bandwidth;
    nodeMetric.droppedPackets += dropBandwidth * 250;
    nodeMetric.filterDroppedMbps = (nodeMetric.filterDroppedMbps || 0) + dropBandwidth;
    return { forwardStream: null, dropBandwidth };
  }
};
