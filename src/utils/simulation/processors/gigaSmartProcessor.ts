import { type NodeProcessor, type TrajectoryStream } from '../types';
import { type GigaSmartNodeData } from '../../../store/types';

export const processGigaSmartNode: NodeProcessor = (
  node,
  item,
  nodeMetric,
  _,
  __,
  outboundEdges,
  activeEdgeSet,
  edgeTraffic,
  queue,
  _nodes,
  edgeEncryptedTraffic
) => {
  const data = node.data as GigaSmartNodeData;
  const actionType = data.actionType || 'Deduplication';

  if (actionType === 'Load Balancing (Stateless)' || actionType === 'Load Balancing (Stateful)') {
    if (outboundEdges.length > 0) {
      nodeMetric.txMbps += item.stream.bandwidth;
      nodeMetric.txPackets += item.stream.bandwidth * 250;
      
      const algorithm = (data.algorithm as string) || 'Round Robin';

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
        if (item.stream.isEncrypted) edgeEncryptedTraffic[selectedEdge.id] = (edgeEncryptedTraffic[selectedEdge.id] || 0) + item.stream.bandwidth;
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
          if (item.stream.isEncrypted) edgeEncryptedTraffic[edge.id] = (edgeEncryptedTraffic[edge.id] || 0) + splitBandwidth;
          queue.push({
            nodeId: edge.target,
            stream: { ...item.stream, bandwidth: splitBandwidth, firstEdgeId: edge.id },
            edgePath: [...item.edgePath, edge.id],
          });
        });
      }
      return { forwardStream: null, handledQueueExternally: true };
    }
    return { forwardStream: null, dropBandwidth: item.stream.bandwidth };
  }

  if (actionType === 'SSL Decrypt' && item.stream.isEncrypted) {
    const decryptionRate = (data.decryptionRate ?? 60) / 100;
    const originalBandwidth = item.stream.bandwidth;
    const decryptedBandwidth = originalBandwidth * decryptionRate;
    const encryptedBandwidth = originalBandwidth * (1 - decryptionRate);

    nodeMetric.txMbps += originalBandwidth;
    nodeMetric.txPackets += originalBandwidth * 250;

    outboundEdges.forEach((edge) => {
      activeEdgeSet.add(edge.id);
      
      if (decryptedBandwidth > 0) {
        edgeTraffic[edge.id] = (edgeTraffic[edge.id] || 0) + decryptedBandwidth;
        queue.push({
          nodeId: edge.target,
          stream: { 
            ...item.stream, 
            id: `${item.stream.id}-dec`,
            bandwidth: decryptedBandwidth, 
            isEncrypted: false,
            firstEdgeId: item.stream.firstEdgeId || edge.id 
          },
          edgePath: [...item.edgePath, edge.id],
        });
      }

      if (encryptedBandwidth > 0) {
        edgeTraffic[edge.id] = (edgeTraffic[edge.id] || 0) + encryptedBandwidth;
        edgeEncryptedTraffic[edge.id] = (edgeEncryptedTraffic[edge.id] || 0) + encryptedBandwidth;
        queue.push({
          nodeId: edge.target,
          stream: {
            ...item.stream,
            id: `${item.stream.id}-enc-passthrough`,
            bandwidth: encryptedBandwidth,
            isEncrypted: true,
            firstEdgeId: item.stream.firstEdgeId || edge.id
          },
          edgePath: [...item.edgePath, edge.id],
        });
      }
    });

    return { forwardStream: null, handledQueueExternally: true };
  }

  let forwardStream: TrajectoryStream | null;
  let dropBandwidth = 0;
  
  if (actionType === 'Deduplication' || actionType === 'Dedup') {
    const dedupRate = data.dedupRate || 20;
    const dropFraction = dedupRate / 100;

    dropBandwidth = item.stream.bandwidth * dropFraction;
    const validBandwidth = item.stream.bandwidth * (1 - dropFraction);

    nodeMetric.droppedPackets += dropBandwidth * 250;
    nodeMetric.dedupDroppedMbps = (nodeMetric.dedupDroppedMbps || 0) + dropBandwidth;
    nodeMetric.txMbps += validBandwidth;
    nodeMetric.txPackets += validBandwidth * 250;
    forwardStream = { ...item.stream, bandwidth: validBandwidth };
  } 
  else if (actionType === 'Application Metadata' || actionType === 'AMX' || actionType === 'AMI') {
    const format = data.metadataFormat || 'CEF';
    const defaultScale = (actionType === 'AMX' || actionType === 'AMI') ? 0.015 : 0.03;
    const ratePercent = data.metadataRate !== undefined ? Number(data.metadataRate) : (defaultScale * 100);
    const scale = ratePercent / 100;
    const metadataBandwidth = item.stream.bandwidth * scale;

    dropBandwidth = item.stream.bandwidth * (1 - scale);
    nodeMetric.droppedPackets += dropBandwidth * 250;
    nodeMetric.txMbps += metadataBandwidth;
    nodeMetric.txPackets += metadataBandwidth * 250;
    forwardStream = { 
      ...item.stream, 
      bandwidth: metadataBandwidth, 
      trafficType: 'metadata', 
      metadataFormat: format as 'CEF' | 'JSON'
    };
  }
  else if (actionType === 'Packet Slicing' || actionType === 'Advanced Flow Slicing' || actionType === 'Slicing') {
    const sliceSize = Number(data.sliceSize) || 128;
    const ratio = Math.max(0.01, Math.min(1.0, sliceSize / 1518));
    const slicedBandwidth = item.stream.bandwidth * ratio;
    dropBandwidth = item.stream.bandwidth * (1 - ratio);
    
    nodeMetric.txMbps += slicedBandwidth;
    nodeMetric.txPackets += item.stream.bandwidth * 250;
    nodeMetric.droppedPackets += dropBandwidth * 250;
    
    forwardStream = { ...item.stream, bandwidth: slicedBandwidth };
  } 
  else if (actionType === 'Header Stripping' || actionType === 'Header/Trailer Remove') {
    const protocol = data.headerStripProtocol || 'VXLAN';
    const protocolScales: Record<string, number> = {
      VXLAN: 0.95,
      ERSPAN: 0.955,
      'GTP-U': 0.96,
      MPLS: 0.985,
      VLAN: 0.992,
      Custom: data.headerStripRate !== undefined ? (1 - (data.headerStripRate / 100)) : 0.94,
    };
    const scale = protocolScales[protocol] ?? 0.95;
    const strippedBandwidth = item.stream.bandwidth * scale;
    dropBandwidth = item.stream.bandwidth * (1 - scale);

    nodeMetric.droppedPackets += dropBandwidth * 250;
    nodeMetric.txMbps += strippedBandwidth;
    nodeMetric.txPackets += item.stream.bandwidth * 250;
    forwardStream = { ...item.stream, bandwidth: strippedBandwidth };
  }
  else if (actionType === 'GTP Flow Sampling' || actionType === 'IP FlowVUE') {
    const sampleRate = ((data.gtpSamplePercent !== undefined ? data.gtpSamplePercent : 10)) / 100;
    const sampledBandwidth = item.stream.bandwidth * sampleRate;
    dropBandwidth = item.stream.bandwidth * (1 - sampleRate);

    nodeMetric.droppedPackets += dropBandwidth * 250;
    nodeMetric.txMbps += sampledBandwidth;
    nodeMetric.txPackets += item.stream.bandwidth * 250 * sampleRate;
    forwardStream = { ...item.stream, bandwidth: sampledBandwidth };
  }
  else if (actionType === 'GTP Whitelisting') {
    const passRate = ((data.gtpWhitelistPassPercent !== undefined ? data.gtpWhitelistPassPercent : 25)) / 100;
    const whitelistBandwidth = item.stream.bandwidth * passRate;
    dropBandwidth = item.stream.bandwidth * (1 - passRate);

    nodeMetric.droppedPackets += dropBandwidth * 250;
    nodeMetric.txMbps += whitelistBandwidth;
    nodeMetric.txPackets += item.stream.bandwidth * 250 * passRate;
    forwardStream = { ...item.stream, bandwidth: whitelistBandwidth };
  }
  else {
    let scale = 1.0;
    if (actionType === 'Masking') scale = 0.95;
    const outputBandwidth = item.stream.bandwidth * scale;
    if (scale < 1.0) {
      dropBandwidth = item.stream.bandwidth * (1 - scale);
      nodeMetric.droppedPackets += dropBandwidth * 250;
    }
    nodeMetric.txMbps += outputBandwidth;
    nodeMetric.txPackets += item.stream.bandwidth * 250;
    forwardStream = { ...item.stream, bandwidth: outputBandwidth };
  }
  return { forwardStream, dropBandwidth };
};

