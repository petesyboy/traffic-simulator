import React from 'react';
import { useStore } from '../store/store';

const ConfigPanel: React.FC = () => {
  const selectedNodeId = useStore((state) => state.selectedNodeId);
  const nodes = useStore((state) => state.nodes);
  const updateNodeData = useStore((state) => state.updateNodeData);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (!selectedNodeId || !selectedNode) {
    return null;
  }

  // Use the immutable configType if available, fallback to label for older nodes
  const configType = (selectedNode.data?.configType as string) || (selectedNode.data?.label as string);

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(selectedNodeId, { label: e.target.value });
  };

  const handleVlanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(selectedNodeId, { vlanIds: e.target.value });
  };
  const handleIpSubnetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(selectedNodeId, { ipSubnet: e.target.value });
  };
  const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(selectedNodeId, { ports: e.target.value });
  };

  // Configuration schema for Map node criteria
  const mapCriteria = [
    { key: 'dscp', label: 'dscp', placeholder: '<af11 | af12 | ... | ef>' },
    { key: 'ethertype', label: 'ethertype', placeholder: '<2-byte-hex>' },
    { key: 'ip6dst', label: 'IPV6 Destination', placeholder: '<IPv6 address> <netmask>' },
    { key: 'ip6src', label: 'IPV6 Sourcesrc', placeholder: '<IPv6 address> <netmask>' },
    { key: 'ipdst', label: 'IPV4 Destination', placeholder: '<IP address> <netmask>' },
    { key: 'ipfrag', label: 'IP Fragmentaion Flag', placeholder: '<no-frag | all-frag | ...>' },
    { key: 'ipsrc', label: 'IPV4 Source', placeholder: '<IP address> <netmask>' },
    { key: 'ipver', label: 'IP Version (V4 or V6)', placeholder: '<4 | 6>' },
    { key: 'l2gre-id', label: 'L2GRE ID', placeholder: '<1-4294967295>' },
    { key: 'macdst', label: 'MAC Destination', placeholder: '<MAC address> <netmask>' },
    { key: 'macsrc', label: 'MAC Source', placeholder: '<MAC address> <netmask>' },
    { key: 'mpls-label-id', label: 'MPLS Label ID', placeholder: '<0~1048575 | x..y> ...' },
    { key: 'portdst', label: 'Port Destination', placeholder: '<0-65535 | x..y> ...' },
    { key: 'portsrc', label: 'Port Source', placeholder: '<0-65535 | x..y> ...' },
    { key: 'protocol', label: 'IP Protocol', placeholder: '<ipv6-hop | icmp-ipv4 | ...>' },
    { key: 'tosval', label: 'TOS Value', placeholder: '<1-byte-hex>' },
    { key: 'ttl', label: 'TTL', placeholder: '<ttl | ttl1..ttl2>' },
    { key: 'vlan', label: 'VLAN ID', placeholder: '<vlan | vlan1..vlan2> ...' },
    { key: 'vxlan', label: 'VXLAN ID', placeholder: '<1-16777215>' },
  ];

  const handleAddCondition = () => {
    const conditions = (selectedNode.data?.conditions as any[]) || [];
    updateNodeData(selectedNodeId, { conditions: [...conditions, { logic: 'AND', field: 'vlan', value: '' }] });
  };

  const handleConditionChange = (index: number, key: string, value: string) => {
    const conditions = [...((selectedNode.data?.conditions as any[]) || [])];
    conditions[index] = { ...conditions[index], [key]: value };
    updateNodeData(selectedNodeId, { conditions });
  };

  const handleRemoveCondition = (index: number) => {
    const conditions = [...((selectedNode.data?.conditions as any[]) || [])];
    conditions.splice(index, 1);
    updateNodeData(selectedNodeId, { conditions });
  };

  return (
    <aside className="config-panel">
      <h2>Configuration</h2>
      <div style={{ marginTop: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>Node Label</label>
        <input
          type="text"
          value={(selectedNode.data?.label as string) || ''}
          onChange={handleLabelChange}
          style={{ width: '100%', padding: '5px' }}
        />
      </div>

      {configType === 'VLAN Filter' && (
        <div style={{ marginTop: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>VLAN IDs</label>
          <input
            type="text"
            placeholder="e.g. 100, 200-205"
            value={(selectedNode.data?.vlanIds as string) || ''}
            onChange={handleVlanChange}
            style={{ width: '100%', padding: '5px' }}
          />
        </div>
      )}

      {configType === 'IP Subnet Filter' && (
        <div style={{ marginTop: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>IP Subnets</label>
          <input
            type="text"
            placeholder="e.g. 192.168.1.0/24"
            value={(selectedNode.data?.ipSubnet as string) || ''}
            onChange={handleIpSubnetChange}
            style={{ width: '100%', padding: '5px' }}
          />
        </div>
      )}

      {configType === 'Port Filter' && (
        <div style={{ marginTop: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Ports</label>
          <input
            type="text"
            placeholder="e.g. 80, 443"
            value={(selectedNode.data?.ports as string) || ''}
            onChange={handlePortChange}
            style={{ width: '100%', padding: '5px' }}
          />
        </div>
      )}

      {configType === 'Traffic Map' && (
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '10px', color: '#444' }}>Map Criteria</h3>
          {((selectedNode.data?.conditions as any[]) || []).map((condition, index) => (
            <div key={index} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #eee', borderRadius: '4px', backgroundColor: '#fafafa' }}>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                {index > 0 && (
                  <select
                    value={condition.logic}
                    onChange={(e) => handleConditionChange(index, 'logic', e.target.value)}
                    style={{ padding: '4px', fontSize: '11px', flex: '0 0 60px' }}
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                )}
                <select
                  value={condition.field}
                  onChange={(e) => handleConditionChange(index, 'field', e.target.value)}
                  style={{ padding: '4px', fontSize: '11px', flex: '1' }}
                >
                  {mapCriteria.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
                <button 
                  onClick={() => handleRemoveCondition(index)}
                  style={{ padding: '4px 8px', fontSize: '11px', background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  X
                </button>
              </div>
              <input
                type="text"
                placeholder={mapCriteria.find(c => c.key === condition.field)?.placeholder || ''}
                value={condition.value}
                onChange={(e) => handleConditionChange(index, 'value', e.target.value)}
                style={{ width: '100%', padding: '5px', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>
          ))}
          <button 
            onClick={handleAddCondition}
            style={{ width: '100%', padding: '8px', fontSize: '12px', background: '#f0f0f0', border: '1px dashed #ccc', borderRadius: '4px', cursor: 'pointer' }}
          >
            + Add Condition
          </button>
        </div>
      )}
    </aside>
  );
};

export default ConfigPanel;