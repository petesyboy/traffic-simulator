import { type TrajectoryStream } from './types';
import { type GigaSmartNodeData, type NodeMetrics } from '../../store/types';

/**
 * Runs a sequential GigaSMART application pipeline (Dedup, AFI, AMI, AMX,
 * Packet Slicing, etc.) over a single stream, mutating it in place and
 * collecting any generated metadata streams along the way.
 *
 * Extracted from hardwareProcessor.ts so the same pipeline can run both on a
 * hardware node's onboard GigaSMART engine and on a standalone tool node (the
 * GigaSMART Appliance) without duplicating this logic.
 */
export function runGigaSmartApps(
  stream: TrajectoryStream,
  apps: GigaSmartNodeData[],
  nodeMetric: NodeMetrics
): { forwardStream: TrajectoryStream; generatedMetadataStreams: TrajectoryStream[] } {
  const generatedMetadataStreams: TrajectoryStream[] = [];

  for (const app of apps) {
    if (stream.bandwidth <= 0) break;
    const actionType = (app.actionType as string) || 'Deduplication';
    if (actionType === 'Deduplication' || actionType === 'Dedup') {
      const dropFraction = (app.dedupRate || 20) / 100;
      const drop = stream.bandwidth * dropFraction;
      nodeMetric.droppedPackets += drop * 250;
      nodeMetric.dedupDroppedMbps = (nodeMetric.dedupDroppedMbps || 0) + drop;
      stream.bandwidth -= drop;
    } else if (actionType === 'Application Metadata' || actionType === 'AMX' || actionType === 'AMI') {
      const defaultScale = (actionType === 'AMX' || actionType === 'AMI') ? 0.015 : 0.03;
      const ratePercent = app.metadataRate !== undefined ? Number(app.metadataRate) : (defaultScale * 100);
      const scale = ratePercent / 100;
      const metadataBandwidth = stream.bandwidth * scale;
      generatedMetadataStreams.push({
        ...stream,
        id: `${stream.id}-meta-${Math.random().toString(36).substring(7)}`,
        bandwidth: metadataBandwidth,
        trafficType: 'metadata',
        metadataFormat: (app.metadataFormat as 'CEF' | 'JSON') || 'CEF'
      });
    } else if (actionType === 'Packet Slicing') {
      const sliceSize = Number(app.sliceSize) || 128;
      const ratio = Math.max(0.01, Math.min(1.0, sliceSize / 1518));
      const drop = stream.bandwidth * (1 - ratio);
      nodeMetric.droppedPackets += drop * 250;
      stream.bandwidth *= ratio;
    } else if (actionType === 'Header Stripping') {
      stream.bandwidth *= 0.95;
    } else {
      let scale = 1.0;
      if (actionType === 'SSL Decrypt' || actionType === 'Masking') scale = 0.95;
      const outBandwidth = stream.bandwidth * scale;
      if (scale < 1.0) {
        nodeMetric.droppedPackets += stream.bandwidth * (1 - scale) * 250;
      }
      stream.bandwidth = outBandwidth;
      if (actionType === 'SSL Decrypt') {
        stream.isEncrypted = false;
      }
    }
  }

  return { forwardStream: { ...stream }, generatedMetadataStreams };
}
