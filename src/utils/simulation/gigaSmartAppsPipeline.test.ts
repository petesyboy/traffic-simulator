import { describe, it, expect } from 'vitest';
import { runGigaSmartApps } from './gigaSmartAppsPipeline';
import type { GigaSmartNodeData, NodeMetrics } from '../../store/types';
import type { TrajectoryStream } from './types';

const makeStream = (bandwidth: number): TrajectoryStream => ({
  id: 'stream-1',
  name: 'Traffic Flow',
  sourceNodeId: 'src-1',
  vlan: '100',
  ipSrc: '10.0.0.1',
  ipDst: '10.0.0.2',
  portSrc: '80',
  portDst: '80',
  protocol: 'tcp',
  bandwidth,
  active: true,
});

const makeMetric = (): NodeMetrics => ({
  rxMbps: 0,
  txMbps: 0,
  rxPackets: 0,
  txPackets: 0,
  droppedPackets: 0,
});

describe('runGigaSmartApps', () => {
  it('runs the GigaSMART Appliance seed pipeline (Dedup -> AFI -> AMI -> AMX -> AppViz) in order', () => {
    const apps: GigaSmartNodeData[] = [
      { id: 'dedup-1', configType: 'GigaSMART', label: 'Deduplication', actionType: 'Deduplication', dedupRate: 25 },
      { id: 'afi-1', configType: 'GigaSMART', label: 'AFI', actionType: 'Application Filtering Intelligence' },
      { id: 'ami-1', configType: 'GigaSMART', label: 'AMI', actionType: 'AMI', metadataFormat: 'CEF', metadataRate: 4 },
      { id: 'amx-1', configType: 'GigaSMART', label: 'AMX', actionType: 'AMX', metadataFormat: 'JSON', metadataRate: 2 },
      { id: 'appviz-1', configType: 'GigaSMART', label: 'AppViz', actionType: 'Application Visualization' },
    ];

    const nodeMetric = makeMetric();
    const { forwardStream, generatedMetadataStreams } = runGigaSmartApps(makeStream(10000), apps, nodeMetric);

    // Dedup 25% of 10000 -> 7500. AFI/AppViz are pass-through, so the final
    // forwarded packet stream reflects only the Dedup reduction.
    expect(forwardStream.bandwidth).toBe(7500);
    expect(nodeMetric.dedupDroppedMbps).toBe(2500);

    // AMI and AMX each spin off their own metadata stream, sized off the
    // already-deduped 7500 Mbps (not the original 10000).
    expect(generatedMetadataStreams).toHaveLength(2);
    const [ami, amx] = generatedMetadataStreams;
    expect(ami.bandwidth).toBeCloseTo(7500 * 0.04, 6);
    expect(ami.trafficType).toBe('metadata');
    expect(ami.metadataFormat).toBe('CEF');
    expect(amx.bandwidth).toBeCloseTo(7500 * 0.02, 6);
    expect(amx.metadataFormat).toBe('JSON');
  });

  it('leaves the stream unchanged when every app is a pass-through (AFI/AppViz only)', () => {
    const apps: GigaSmartNodeData[] = [
      { id: 'afi-1', configType: 'GigaSMART', label: 'AFI', actionType: 'Application Filtering Intelligence' },
      { id: 'appviz-1', configType: 'GigaSMART', label: 'AppViz', actionType: 'Application Visualization' },
    ];

    const nodeMetric = makeMetric();
    const { forwardStream, generatedMetadataStreams } = runGigaSmartApps(makeStream(5000), apps, nodeMetric);

    expect(forwardStream.bandwidth).toBe(5000);
    expect(generatedMetadataStreams).toHaveLength(0);
  });
});
