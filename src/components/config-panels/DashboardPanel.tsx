import React from 'react';
import { useStore } from '../../store/store';
import { formatBandwidth, formatPackets } from '../../utils/format';
import { NODE_TYPES } from '../../constants/nodeTypes';

interface DashboardPanelProps {
  isRunning: boolean;
}

export const DashboardPanel: React.FC<DashboardPanelProps> = ({ isRunning }) => {
  const nodes           = useStore((state) => state.nodes);
  const nodeMetrics     = useStore((state) => state.nodeMetrics);

  let totalIngest = 0;
  let totalDedupDrops = 0;
  let totalFilterDrops = 0;
  let totalGigaSmartDrops = 0;

  nodes.forEach((n) => {
    const metric = nodeMetrics[n.id];
    if (!metric) return;

    totalDedupDrops += metric.dedupDroppedMbps || 0;
    totalFilterDrops += metric.filterDroppedMbps || 0;
    totalGigaSmartDrops += metric.gigaSmartDroppedMbps || 0;

    if (
      n.type === NODE_TYPES.INPUT ||
      n.type === 'missionCloudNode' ||
      (n.type === NODE_TYPES.HARDWARE && typeof n.data?.model === 'string' && n.data.model.includes('TAP'))
    ) {
      totalIngest += metric.txMbps;
    }
  });

  // Reduction is what was actually dropped (dedup + filter + GigaSMART sampling/slicing)
  // relative to ingest - not ingest-minus-delivered, since "delivered" is a fan-out
  // total that multiplies with tool count and isn't a meaningful baseline.
  const reductionRaw     = totalDedupDrops + totalFilterDrops + totalGigaSmartDrops;
  const reductionPercent = totalIngest > 0 ? (reductionRaw / totalIngest) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '320px', height: '100%', padding: '20px', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div>
        <h2 style={{ fontSize: '13px', margin: 0, paddingBottom: '8px' }}>Global Pipeline Dashboard</h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
          Real-time visibility into the entire network visibility fabric.
        </p>
      </div>

      {isRunning ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pipeline Flow Statistics
          </h3>

          <div style={{ padding: '12px 16px', background: 'rgba(0, 124, 255, 0.03)', borderRadius: '6px', border: '1px solid rgba(0, 124, 255, 0.15)', borderLeft: '4px solid var(--color-input)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Total Ingest Traffic</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary, #ffffff)', fontFamily: 'monospace' }}>{formatBandwidth(totalIngest)}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{formatPackets(totalIngest * 250)} packet rate</div>
          </div>

          <div style={{ padding: '12px 16px', background: 'rgba(255, 145, 0, 0.03)', borderRadius: '6px', border: '1px solid rgba(255, 145, 0, 0.15)', borderLeft: '4px solid var(--color-orange)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Traffic Volume Reduction</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-orange)', fontFamily: 'monospace' }}>
                {reductionPercent.toFixed(1)}%
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                ({formatBandwidth(reductionRaw)} saved)
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div>Deduped: {formatBandwidth(totalDedupDrops)} ({formatPackets(totalDedupDrops * 250)})</div>
              <div>Filtered: {formatBandwidth(totalFilterDrops)} ({formatPackets(totalFilterDrops * 250)})</div>
              {totalGigaSmartDrops > 0 && (
                <div>Sampled / Sliced: {formatBandwidth(totalGigaSmartDrops)} ({formatPackets(totalGigaSmartDrops * 250)})</div>
              )}
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', overflow: 'hidden', marginTop: '6px' }}>
              <div style={{ height: '100%', width: `${Math.min(100, reductionPercent)}%`, background: 'linear-gradient(90deg, #ff9100 0%, #ff5d00 100%)', borderRadius: '3px', transition: 'width 0.3s ease' }} />
            </div>
          </div>

          <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4', marginTop: '10px' }}>
            💡 <b>Security Optimisation Tip:</b>
            <p style={{ margin: '4px 0 0 0' }}>
              Filtering out non-malicious duplicate and background protocol traffic before sending it to analysis tools reduces tool CPU utilisation and prevents packet drops at high traffic volumes.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ padding: '20px', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px dashed var(--border-color)', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
          <span style={{ fontSize: '24px', marginBottom: '8px' }}>📊</span>
          <b>Simulation Offline</b>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Start the simulation in the top header to inject traffic and view real-time pipeline analytics.
          </span>
        </div>
      )}
    </div>
  );
};
