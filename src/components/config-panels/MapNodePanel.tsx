import React from 'react';
import { type CustomNode, type MapCondition } from '../../store/store';

const MAP_CRITERIA = [
  { key: 'vlan',     label: 'VLAN ID',           placeholder: 'e.g. 100' },
  { key: 'protocol', label: 'IP Protocol',        placeholder: 'e.g. tcp, udp, icmp' },
  { key: 'portdst',  label: 'Destination Port',   placeholder: 'e.g. 80, 443' },
  { key: 'portsrc',  label: 'Source Port',         placeholder: 'e.g. 1024..65535' },
  { key: 'ipdst',    label: 'Destination IPv4',    placeholder: 'e.g. 192.168.1.0/24' },
  { key: 'ipsrc',    label: 'Source IPv4',         placeholder: 'e.g. 10.0.0.5' },
  { key: 'ipver',    label: 'IP Version',          placeholder: 'ipv4 or ipv6' },
];

interface MapNodePanelProps {
  node: CustomNode;
  onConditionChange: (index: number, key: string, value: string) => void;
  onAddCondition: () => void;
  onRemoveCondition: (index: number) => void;
}

export const MapNodePanel: React.FC<MapNodePanelProps> = ({ 
  node, 
  onConditionChange, 
  onAddCondition, 
  onRemoveCondition 
}) => {
  const conditions = (node.data?.conditions as MapCondition[]) || [];

  return (
    <div>
      <h4 className="form-label" style={{ margin: '4px 0 8px 0' }}>Map Criteria (OR-rules list)</h4>
      {conditions.map((condition, index) => (
        <div key={index} className="condition-card">
          <div className="condition-card-row">
            {index > 0 && (
              <select
                value={condition.logic}
                onChange={(e) => onConditionChange(index, 'logic', e.target.value)}
                style={{ flex: '0 0 65px', padding: '4px' }}
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            )}
            <select
              value={condition.field}
              onChange={(e) => onConditionChange(index, 'field', e.target.value)}
              style={{ flex: 1, padding: '4px' }}
            >
              {MAP_CRITERIA.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            <button className="danger" onClick={() => onRemoveCondition(index)} style={{ padding: '4px 8px' }}>
              Remove
            </button>
          </div>

          {condition.field === 'ipver' ? (
            <select
              value={condition.value || 'ipv4'}
              onChange={(e) => onConditionChange(index, 'value', e.target.value)}
              style={{ width: '100%', padding: '6px 10px', marginTop: '4px', backgroundColor: '#1a1a1a', border: '1px solid var(--border-color)', borderRadius: '3px', color: 'var(--text-primary)', fontSize: '12px' }}
            >
              <option value="ipv4">IPv4</option>
              <option value="ipv6">IPv6</option>
            </select>
          ) : (
            <input
              type="text"
              placeholder={MAP_CRITERIA.find((c) => c.key === condition.field)?.placeholder || ''}
              value={condition.value}
              onChange={(e) => onConditionChange(index, 'value', e.target.value)}
            />
          )}

          <div className="condition-card-row" style={{ marginTop: '2px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', flex: '0 0 45px' }}>Action:</span>
            <select
              value={condition.action || 'pass'}
              onChange={(e) => onConditionChange(index, 'action', e.target.value)}
              style={{
                flex: 1,
                padding: '4px 6px',
                fontSize: '11px',
                backgroundColor: condition.action === 'drop' ? 'rgba(239, 83, 80, 0.15)' : 'rgba(76, 175, 80, 0.15)',
                border: condition.action === 'drop' ? '1px solid rgba(239, 83, 80, 0.3)' : '1px solid rgba(76, 175, 80, 0.3)',
                color: condition.action === 'drop' ? '#ef5350' : '#4caf50',
                fontWeight: 'bold',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              <option value="pass" style={{ backgroundColor: '#1a1a1a', color: '#4caf50' }}>🟢 PASS</option>
              <option value="drop" style={{ backgroundColor: '#1a1a1a', color: '#ef5350' }}>🔴 DROP</option>
            </select>
          </div>
        </div>
      ))}
      <button className="secondary" onClick={onAddCondition} style={{ width: '100%', marginTop: '5px' }}>
        + Add Match Condition
      </button>
    </div>
  );
};
