import { type NodeProcessor } from '../types';
import { isPacketToolConfig, isMetadataToolConfig, isStorageToolConfig } from '../utils';

export const processToolNode: NodeProcessor = (
  node,
  item,
  nodeMetric,
  toolReceivedStreams,
  deliveredStreamIds
) => {
  const data = node.data;
  const configType = data.configType || '';
  const isPacketTool = isPacketToolConfig(configType) || data.expectedType === 'packet';
  const isMetadataTool = isMetadataToolConfig(configType) || data.expectedType === 'metadata';
  const isStorageTool = isStorageToolConfig(configType) || data.expectedType === 'objects';
  const rType = item.stream.trafficType || 'packet';
  
  let isValidForTool = true;
  if (isPacketTool && rType !== 'packet') isValidForTool = false;
  if (isMetadataTool && rType !== 'metadata') isValidForTool = false;
  if (isStorageTool && rType !== 'metadata' && rType !== 'packet') isValidForTool = false;

  if (!toolReceivedStreams[node.id]) {
    toolReceivedStreams[node.id] = [];
  }
  
  if (isValidForTool) {
    toolReceivedStreams[node.id].push(item.stream);
    deliveredStreamIds.add(item.stream.id);
  } else {
    nodeMetric.rxMbps -= item.stream.bandwidth;
    nodeMetric.rxPackets -= item.stream.bandwidth * 250;
  }
  return { forwardStream: null, handledQueueExternally: true };
};
