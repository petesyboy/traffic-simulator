import { type NodeProcessor } from '../types';
import { matchesVlan, matchesIp, matchesPort } from '../matching';

export const processFilterNode: NodeProcessor = (
  node,
  item,
  nodeMetric
) => {
  const data = node.data;
  const configType = data.configType;
  let isMatch = false;

  if (configType === 'VLAN Filter') {
    isMatch = matchesVlan(item.stream.vlan, data.vlanIds);
  } else if (configType === 'IP Subnet Filter') {
    isMatch = matchesIp(item.stream.ipSrc, data.ipSubnet) || 
              matchesIp(item.stream.ipDst, data.ipSubnet);
  } else if (configType === 'Port Filter') {
    isMatch = matchesPort(item.stream.portSrc, data.ports) || 
              matchesPort(item.stream.portDst, data.ports);
  }

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
