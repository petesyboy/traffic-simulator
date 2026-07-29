import { type NodeProcessor } from '../types';
import { isPacketToolConfig, isMetadataToolConfig, isStorageToolConfig } from '../utils';
import { runGigaSmartApps } from '../gigaSmartAppsPipeline';

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

  // The GigaSMART Appliance (GSA) is a hybrid: it consumes packets, runs a
  // fixed GigaSMART pipeline (Dedup/AFI/AMI/AMX/AppViz) on them, sends the
  // processed packet stream back out (e.g. to the TA/HC or a downstream probe),
  // and separately emits any generated metadata streams - unlike every other
  // packet-consuming tool, which is a pure leaf/sink node.
  if (data.toolName === 'GigaSMART Appliance' && Array.isArray(data.gigaSmartApps) && rType === 'packet') {
    return runGigaSmartApps(item.stream, data.gigaSmartApps, nodeMetric);
  }
  
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
