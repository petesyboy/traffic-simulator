import { type NodeProcessor, type TrajectoryStream } from '../types';
import { evaluateMapConditions } from '../conditions';
import { runGigaSmartApps } from '../gigaSmartAppsPipeline';

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
  let generatedMetadataStreams: TrajectoryStream[] = [];

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

      const totalLoad = node.data.gigaSmartApps.reduce((acc: number, app: { actionType?: string }) => acc + getEngineLoad(app.actionType || ''), 0);
      const isMultiPass = totalLoad > 100;

      if (isMultiPass) {
        // rxMbps is already incremented in the simulation loop before the processor runs,
        // so no additional increment is needed here.
      }

      const result = runGigaSmartApps(item.stream, node.data.gigaSmartApps, nodeMetric);
      forwardStream = result.forwardStream;
      generatedMetadataStreams = result.generatedMetadataStreams;
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
