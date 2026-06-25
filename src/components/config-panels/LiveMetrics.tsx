import React from 'react';
import { type NodeMetrics } from '../../store/store';
import { formatBandwidth, formatPackets } from '../../utils/format';
import { NODE_TYPES } from '../../constants/nodeTypes';

export const FormGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="form-group">
    <label>{label}</label>
    {children}
  </div>
);

interface LiveMetricsProps {
  nodeType: string;
  metrics: NodeMetrics;
}

export const LiveMetrics: React.FC<LiveMetricsProps> = ({ nodeType, metrics }) => (
  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px', marginTop: '10px' }}>
    <h3>Live Node Statistics</h3>
    <div className="form-group" style={{ gap: '8px' }}>
      {nodeType !== NODE_TYPES.INPUT && (
        <div className="metric-badge">
          <span className="label">Rx Throughput:</span>
          <span className="value">{formatBandwidth(metrics.rxBps)}</span>
        </div>
      )}
      {nodeType !== NODE_TYPES.INPUT && (
        <div className="metric-badge">
          <span className="label">Rx Packet Rate:</span>
          <span className="value">{formatPackets(metrics.rxPackets)}</span>
        </div>
      )}
      {nodeType !== NODE_TYPES.TOOL && (
        <div className="metric-badge">
          <span className="label">Tx Throughput:</span>
          <span className="value" style={{ color: 'var(--color-input)' }}>
            {formatBandwidth(metrics.txBps)}
          </span>
        </div>
      )}
      {nodeType !== NODE_TYPES.TOOL && (
        <div className="metric-badge">
          <span className="label">Tx Packet Rate:</span>
          <span className="value" style={{ color: 'var(--color-input)' }}>
            {formatPackets(metrics.txPackets)}
          </span>
        </div>
      )}
      {(metrics.droppedPackets > 0 || nodeType === NODE_TYPES.FILTER) && (
        <>
          <div className="metric-badge">
            <span className="label">Dropped Traffic:</span>
            <span className="value" style={{ color: '#ef5350' }}>
              {formatBandwidth(metrics.droppedPackets / 250)}
            </span>
          </div>
          <div className="metric-badge">
            <span className="label">Dropped Packet Rate:</span>
            <span className="value" style={{ color: '#ef5350' }}>
              {formatPackets(metrics.droppedPackets)}
            </span>
          </div>
        </>
      )}
    </div>
  </div>
);
