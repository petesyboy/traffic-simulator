import { type NodeProcessor } from '../types';

export const processGigaStreamNode: NodeProcessor = (
  node,
  item,
  nodeMetric,
  _,
  __,
  outboundEdges,
  activeEdgeSet,
  edgeTraffic,
  queue
) => {
  if (outboundEdges.length > 0) {
    nodeMetric.txMbps += item.stream.bandwidth;
    nodeMetric.txPackets += item.stream.bandwidth * 250;
    
    const algorithm = (node.data?.algorithm as string) || 'Round Robin';

    if (algorithm.toLowerCase().includes('hash')) {
      const str = `${item.stream.ipSrc || ''}-${item.stream.ipDst || ''}-${item.stream.portSrc || ''}-${item.stream.portDst || ''}-${item.stream.protocol || ''}-${item.stream.vlan || ''}`;
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      const selectedIndex = Math.abs(hash) % outboundEdges.length;
      const selectedEdge = outboundEdges[selectedIndex];

      activeEdgeSet.add(selectedEdge.id);
      edgeTraffic[selectedEdge.id] = (edgeTraffic[selectedEdge.id] || 0) + item.stream.bandwidth;
      queue.push({
        nodeId: selectedEdge.target,
        stream: { ...item.stream, firstEdgeId: item.stream.firstEdgeId || selectedEdge.id },
        edgePath: [...item.edgePath, selectedEdge.id],
      });
    } else {
      const splitBandwidth = item.stream.bandwidth / outboundEdges.length;
      outboundEdges.forEach((edge) => {
        activeEdgeSet.add(edge.id);
        edgeTraffic[edge.id] = (edgeTraffic[edge.id] || 0) + splitBandwidth;
        queue.push({
          nodeId: edge.target,
          stream: { ...item.stream, bandwidth: splitBandwidth, firstEdgeId: item.stream.firstEdgeId || edge.id },
          edgePath: [...item.edgePath, edge.id],
        });
      });
    }
    return { forwardStream: null, handledQueueExternally: true };
  }
  return { forwardStream: null, dropBandwidth: item.stream.bandwidth };
};
