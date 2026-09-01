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
    } else if (actionType === 'Packet Slicing' || actionType === 'Advanced Flow Slicing' || actionType === 'Slicing') {
      const sliceSize = Number(app.sliceSize) || 128;
      const ratio = Math.max(0.01, Math.min(1.0, sliceSize / 1518));
      const drop = stream.bandwidth * (1 - ratio);
      nodeMetric.droppedPackets += drop * 250;
      nodeMetric.gigaSmartDroppedMbps = (nodeMetric.gigaSmartDroppedMbps || 0) + drop;
      stream.bandwidth *= ratio;
    } else if (actionType === 'Header Stripping' || actionType === 'Header/Trailer Remove') {
      const protocol = (app.headerStripProtocol as string) || 'VXLAN';
      const protocolScales: Record<string, number> = {
        VXLAN: 0.95,
        ERSPAN: 0.955,
        'GTP-U': 0.96,
        MPLS: 0.985,
        VLAN: 0.992,
        Custom: app.headerStripRate !== undefined ? (1 - (app.headerStripRate / 100)) : 0.94,
      };
      const scale = protocolScales[protocol] ?? 0.95;
      const drop = stream.bandwidth * (1 - scale);
      nodeMetric.droppedPackets += drop * 250;
      nodeMetric.gigaSmartDroppedMbps = (nodeMetric.gigaSmartDroppedMbps || 0) + drop;
      stream.bandwidth *= scale;
    } else if (actionType === 'GTP Flow Sampling' || actionType === 'IP FlowVUE') {
      const sampleRate = ((app.gtpSamplePercent !== undefined ? app.gtpSamplePercent : 10)) / 100;
      const drop = stream.bandwidth * (1 - sampleRate);
      nodeMetric.droppedPackets += drop * 250;
      nodeMetric.gigaSmartDroppedMbps = (nodeMetric.gigaSmartDroppedMbps || 0) + drop;
      stream.bandwidth *= sampleRate;
    } else if (actionType === 'GTP Whitelisting') {
      const passRate = ((app.gtpWhitelistPassPercent !== undefined ? app.gtpWhitelistPassPercent : 25)) / 100;
      const drop = stream.bandwidth * (1 - passRate);
      nodeMetric.droppedPackets += drop * 250;
      nodeMetric.gigaSmartDroppedMbps = (nodeMetric.gigaSmartDroppedMbps || 0) + drop;
      stream.bandwidth *= passRate;
    } else if (
      actionType === 'Tunneling' ||
      actionType === 'Tunneling (ERSPAN Decap)' ||
      actionType === 'ERSPAN Tunnel Decapsulation' ||
      actionType === 'L2GRE Tunnel Decapsulation' ||
      actionType === 'VXLAN Tunnel Decapsulation' ||
      actionType === 'GRE-In-UDP Tunnel Decapsulation'
    ) {
      const scale = 0.955; // strips ~42B ERSPAN/GRE or ~50B VXLAN outer encapsulation overhead
      const drop = stream.bandwidth * (1 - scale);
      nodeMetric.droppedPackets += drop * 250;
      nodeMetric.gigaSmartDroppedMbps = (nodeMetric.gigaSmartDroppedMbps || 0) + drop;
      stream.bandwidth *= scale;
    } else {
      let scale = 1.0;
      if (actionType === 'SSL Decrypt' || actionType === 'Masking') scale = 0.95;
      const outBandwidth = stream.bandwidth * scale;
      if (scale < 1.0) {
        const drop = stream.bandwidth * (1 - scale);
        nodeMetric.droppedPackets += drop * 250;
        nodeMetric.gigaSmartDroppedMbps = (nodeMetric.gigaSmartDroppedMbps || 0) + drop;
      }
      stream.bandwidth = outBandwidth;
      if (actionType === 'SSL Decrypt') {
        stream.isEncrypted = false;
      }
    }
  }

  return { forwardStream: { ...stream }, generatedMetadataStreams };
}
