import React from 'react';
import { useStore, type TrafficStream } from '../store/store';

const TrafficGenerator: React.FC = () => {
  const trafficStreams = useStore((state) => state.trafficStreams);
  const nodes = useStore((state) => state.nodes);
  const addTrafficStream = useStore((state) => state.addTrafficStream);
  const updateTrafficStream = useStore((state) => state.updateTrafficStream);
  const deleteTrafficStream = useStore((state) => state.deleteTrafficStream);
  const deliveredStreams = useStore((state) => state.deliveredStreams);
  const isRunning = useStore((state) => state.isRunning);
  const toggleSimulation = useStore((state) => state.toggleSimulation);

  const inputPorts = nodes.filter((node) => node.type === 'inputNode');

  const handleAddStream = () => {
    if (inputPorts.length === 0) {
      alert('Please add at least one Network Input port (SPAN Port or Network Tap) to the canvas first.');
      return;
    }

    const newStream: TrafficStream = {
      id: `t-${Date.now()}`,
      name: `Traffic Stream ${trafficStreams.length + 1}`,
      sourceNodeId: inputPorts[0].id,
      vlan: '100',
      ipSrc: '192.168.1.50',
      ipDst: '10.0.0.100',
      portSrc: '50231',
      portDst: '443',
      protocol: 'tcp',
      bandwidth: 100, // 100 Mbps
      active: true,
    };

    addTrafficStream(newStream);
  };

  const handleFieldChange = (id: string, field: keyof TrafficStream, value: string | number | boolean) => {
    updateTrafficStream(id, { [field]: value });
  };

  return (
    <div className="bottom-drawer">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          📊 Live Traffic Generator & Injector
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`sim-btn ${isRunning ? 'running' : ''}`} 
            style={{ 
              padding: '6px 12px', 
              fontSize: '12px', 
              backgroundColor: isRunning ? 'rgba(239, 83, 80, 0.2)' : 'rgba(37, 179, 75, 0.2)', 
              border: isRunning ? '1px solid rgba(239, 83, 80, 0.4)' : '1px solid rgba(37, 179, 75, 0.4)',
              color: isRunning ? '#ef5350' : 'var(--color-green)',
              borderRadius: '4px', 
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }} 
            onClick={toggleSimulation}
          >
            {isRunning ? '⏸ Pause Simulation' : '▶ Run Simulation'}
          </button>
          <button className="primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleAddStream}>
            + Inject Traffic Stream
          </button>
        </div>
      </div>

      {trafficStreams.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '15px 0', fontSize: '13px' }}>
          No traffic streams currently injected. Click "+ Inject Traffic Stream" to simulate network load.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', color: 'var(--text-secondary)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                <th style={{ padding: '6px 4px' }}>Name</th>
                <th style={{ padding: '6px 4px' }}>Ingress Port</th>
                <th style={{ padding: '6px 4px', width: '70px' }}>VLAN</th>
                <th style={{ padding: '6px 4px', width: '70px' }}>Proto</th>
                <th style={{ padding: '6px 4px' }}>Source IP</th>
                <th style={{ padding: '6px 4px' }}>Dest IP</th>
                <th style={{ padding: '6px 4px', width: '70px' }}>Dst Port</th>
                <th style={{ padding: '6px 4px', width: '100px' }}>Rate (Mbps)</th>
                <th style={{ padding: '6px 4px', width: '90px' }}>Status</th>
                <th style={{ padding: '6px 4px', width: '60px', textAlign: 'center' }}>Active</th>
                <th style={{ padding: '6px 4px', width: '60px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {trafficStreams.map((stream) => (
                <tr key={stream.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '4px 2px' }}>
                    <input
                      type="text"
                      value={stream.name}
                      onChange={(e) => handleFieldChange(stream.id, 'name', e.target.value)}
                      style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '12px', width: '105px', borderBottom: '1px solid transparent' }}
                      onFocus={(e) => e.target.style.borderBottom = '1px solid var(--text-muted)'}
                      onBlur={(e) => e.target.style.borderBottom = '1px solid transparent'}
                    />
                  </td>
                  <td style={{ padding: '4px 2px' }}>
                    <select
                      value={stream.sourceNodeId}
                      onChange={(e) => handleFieldChange(stream.id, 'sourceNodeId', e.target.value)}
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', width: '120px' }}
                    >
                      {inputPorts.map((port) => (
                        <option key={port.id} value={port.id}>
                          {port.data.label as string}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '4px 2px' }}>
                    <input
                      type="text"
                      value={stream.vlan}
                      onChange={(e) => handleFieldChange(stream.id, 'vlan', e.target.value)}
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', width: '50px' }}
                    />
                  </td>
                  <td style={{ padding: '4px 2px' }}>
                    <select
                      value={stream.protocol}
                      onChange={(e) => handleFieldChange(stream.id, 'protocol', e.target.value)}
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', width: '60px' }}
                    >
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                      <option value="icmp">ICMP</option>
                    </select>
                  </td>
                  <td style={{ padding: '4px 2px' }}>
                    <input
                      type="text"
                      value={stream.ipSrc}
                      onChange={(e) => handleFieldChange(stream.id, 'ipSrc', e.target.value)}
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', width: '100px' }}
                    />
                  </td>
                  <td style={{ padding: '4px 2px' }}>
                    <input
                      type="text"
                      value={stream.ipDst}
                      onChange={(e) => handleFieldChange(stream.id, 'ipDst', e.target.value)}
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', width: '100px' }}
                    />
                  </td>
                  <td style={{ padding: '4px 2px' }}>
                    <input
                      type="text"
                      value={stream.portDst}
                      onChange={(e) => handleFieldChange(stream.id, 'portDst', e.target.value)}
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', width: '50px' }}
                    />
                  </td>
                  <td style={{ padding: '4px 2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        value={stream.bandwidth}
                        onChange={(e) => handleFieldChange(stream.id, 'bandwidth', Number(e.target.value))}
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '11px', padding: '2px 4px', borderRadius: '4px', width: '50px' }}
                      />
                      <span>M</span>
                    </div>
                  </td>
                  <td style={{ padding: '4px 2px' }}>
                    {!isRunning ? (
                      <span style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', fontSize: '10px', color: '#888', display: 'inline-block' }}>
                        Idle
                      </span>
                    ) : !stream.active ? (
                      <span style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '3px', fontSize: '10px', color: '#666', display: 'inline-block' }}>
                        Inactive
                      </span>
                    ) : deliveredStreams.includes(stream.id) ? (
                      <span style={{ padding: '2px 6px', background: 'rgba(76, 175, 80, 0.12)', border: '1px solid rgba(76, 175, 80, 0.25)', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', color: '#4caf50', display: 'inline-block', whiteSpace: 'nowrap' }}>
                        ✓ Passed
                      </span>
                    ) : (
                      <span style={{ padding: '2px 6px', background: 'rgba(239, 83, 80, 0.12)', border: '1px solid rgba(239, 83, 80, 0.25)', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', color: '#ef5350', display: 'inline-block', whiteSpace: 'nowrap' }}>
                        ❌ Filtered
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '4px 2px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={stream.active}
                      onChange={(e) => handleFieldChange(stream.id, 'active', e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '4px 2px' }}>
                    <button className="danger" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={() => deleteTrafficStream(stream.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TrafficGenerator;
