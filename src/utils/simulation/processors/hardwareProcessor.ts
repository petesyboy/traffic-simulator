import { type NodeProcessor, type TrajectoryStream } from '../types';
import { evaluateMapConditions } from '../conditions';

export const processHardwareNode: NodeProcessor = (
  node,
  item,
  nodeMetric
) => {
  const isTap = String(node.data?.model || '').includes('TAP');
  const conditions = node.data?.conditions;
  
  const isMatch = isTap ? true : evaluateMapConditions(item.stream, conditions);
  let forwardStream: TrajectoryStream | null = item.stream;
  let dropBandwidth = 0;
  const generatedMetadataStreams: TrajectoryStream[] = [];
  
  if (isMatch) {
    if (node.data?.gigaSmartApps && Array.isArray(node.data.gigaSmartApps)) {
      const getEngineLoad = (actionType: string) => {
        if (actionType.includes('Decapsulation')) return 40;
        if (actionType.includes('Slicing')) return 20;
        if (actionType.includes('Masking')) return 30;
        if (actionType.includes('Dedup')) return 50;
        if (actionType.includes('NetFlow')) return 60;
        if (actionType.includes('Metadata') || actionType.includes('AMI')) return 80;
        return 30;
      };
      
      const totalLoad = node.data.gigaSmartApps.reduce((acc: number, app: any) => acc + getEngineLoad(app.actionType as string), 0);
      const isMultiPass = totalLoad > 100;
      
      if (isMultiPass) {
        nodeMetric.rxMbps += item.stream.bandwidth;
      }

      for (const app of node.data.gigaSmartApps) {
        if (item.stream.bandwidth <= 0) break;
        const actionType = (app.actionType as string) || 'Deduplication';
        if (actionType === 'Deduplication' || actionType === 'Dedup') {
          const dropFraction = (app.dedupRate || 20) / 100;
          const drop = item.stream.bandwidth * dropFraction;
          nodeMetric.droppedPackets += drop * 250;
          nodeMetric.dedupDroppedMbps = (nodeMetric.dedupDroppedMbps || 0) + drop;
          item.stream.bandwidth -= drop;
        } else if (actionType === 'Application Metadata' || actionType === 'AMX' || actionType === 'AMI') {
          const defaultScale = (actionType === 'AMX' || actionType === 'AMI') ? 0.015 : 0.03;
          const ratePercent = app.metadataRate !== undefined ? Number(app.metadataRate) : (defaultScale * 100);
          const scale = ratePercent / 100;
          const metadataBandwidth = item.stream.bandwidth * scale;
          generatedMetadataStreams.push({
            ...item.stream,
            id: `${item.stream.id}-meta-${Math.random().toString(36).substring(7)}`,
            bandwidth: metadataBandwidth,
            trafficType: 'metadata',
            metadataFormat: (app.metadataFormat as 'CEF' | 'JSON') || 'CEF'
          });
        } else if (actionType === 'Packet Slicing') {
          const sliceSize = Number(app.sliceSize) || 128;
          const ratio = Math.max(0.01, Math.min(1.0, sliceSize / 1518));
          const drop = item.stream.bandwidth * (1 - ratio);
          nodeMetric.droppedPackets += drop * 250;
          item.stream.bandwidth *= ratio;
        } else if (actionType === 'Header Stripping') {
          item.stream.bandwidth *= 0.95;
        } else {
          let scale = 1.0;
          if (actionType === 'SSL Decrypt' || actionType === 'Masking') scale = 0.95;
          const outBandwidth = item.stream.bandwidth * scale;
          if (scale < 1.0) {
             nodeMetric.droppedPackets += item.stream.bandwidth * (1 - scale) * 250;
          }
          item.stream.bandwidth = outBandwidth;
          if (actionType === 'SSL Decrypt') {
            item.stream.isEncrypted = false;
          }
        }
      }
      forwardStream = { ...item.stream };
    }

    const alreadyAddedAtTop = node.id === item.stream.sourceNodeId && item.edgePath.length === 0;
    if (!alreadyAddedAtTop) {
      nodeMetric.txMbps += item.stream.bandwidth;
      nodeMetric.txPackets += item.stream.bandwidth * 250;
    }
  } else {
    dropBandwidth = item.stream.bandwidth;
    nodeMetric.droppedPackets += dropBandwidth * 250;
    nodeMetric.filterDroppedMbps = (nodeMetric.filterDroppedMbps || 0) + dropBandwidth;
    forwardStream = null;
  }

  return { forwardStream, dropBandwidth, generatedMetadataStreams };
};
