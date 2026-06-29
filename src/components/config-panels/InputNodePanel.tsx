import React from 'react';
import { type CustomNode } from '../../store/store';
import { CONFIG_TYPES, SUPPORTED_TAP_OPTICS } from '../../constants/nodeTypes';
import { FormGroup } from './LiveMetrics';

interface InputNodePanelProps {
  node: CustomNode;
  onGenericChange: (key: string, val: string) => void;
}

export const InputNodePanel: React.FC<InputNodePanelProps> = ({ node, onGenericChange }) => {
  const configType = (node.data?.configType as string) || CONFIG_TYPES.SPAN;

  // Derive TAP specific settings for simple mode
  const tapFiberMode = (node.data?.tapFiberMode as string) || 'Multimode';
  const isSMTap = tapFiberMode === 'Singlemode';
  const selectedOpticVal = (node.data?.tappedLinkOptic as string) || (isSMTap ? 'SFP-533 (10G SFP+ LR)' : 'SFP-532 (10G SFP+ SR)');
  const matchedOptic = SUPPORTED_TAP_OPTICS.find(o => o.value === selectedOpticVal);
  const hasMismatch = matchedOptic ? (matchedOptic.isSM !== isSMTap) : false;

  return (
    <>
      <FormGroup label="Input Port Class">
        <select
          value={configType}
          onChange={(e) => onGenericChange('configType', e.target.value)}
        >
          <option value={CONFIG_TYPES.SPAN}>SPAN Port</option>
          <option value={CONFIG_TYPES.TAP}>TAP Hardware Device</option>
          <option value={CONFIG_TYPES.ERSPAN}>ERSPAN Tunnel Source</option>
          <option value={CONFIG_TYPES.EAST_WEST}>East/West Traffic Source</option>
          <option value={CONFIG_TYPES.VMWARE}>VMWare Virtual Estate</option>
        </select>
      </FormGroup>

      {(configType === CONFIG_TYPES.SPAN || configType === CONFIG_TYPES.TAP || configType === CONFIG_TYPES.ERSPAN || configType === CONFIG_TYPES.EAST_WEST || configType === CONFIG_TYPES.VMWARE) && (
        <FormGroup label="Port Speed">
          <select
            value={(node.data?.portSpeed as string) || '10G'}
            onChange={(e) => onGenericChange('portSpeed', e.target.value)}
          >
            <option value="1G">1 Gbps</option>
            <option value="10G">10 Gbps</option>
            <option value="25G">25 Gbps</option>
            <option value="40G">40 Gbps</option>
            <option value="100G">100 Gbps</option>
            <option value="400G">400 Gbps</option>
          </select>
        </FormGroup>
      )}

      {configType === CONFIG_TYPES.TAP && (
        <>
          <FormGroup label="TAP Mode">
            <select
              value={(node.data?.tapMode as string) || 'Passive'}
              onChange={(e) => onGenericChange('tapMode', e.target.value)}
            >
              <option value="Passive">Passive (Failsafe Optical)</option>
              <option value="Active">Active Bypass (Inline)</option>
            </select>
          </FormGroup>

          <FormGroup label="Fiber Type">
            <select
              value={tapFiberMode}
              onChange={(e) => onGenericChange('tapFiberMode', e.target.value)}
            >
              <option value="Multimode">Multimode</option>
              <option value="Singlemode">Singlemode</option>
            </select>
          </FormGroup>

          <FormGroup label="Tapped Links">
            <select
              value={(node.data?.tappedLinksCount as number) ?? 1}
              onChange={(e) => onGenericChange('tappedLinksCount', e.target.value)}
            >
              {[1, 2, 3, 4, 5, 6].map(num => <option key={num} value={num}>{num}</option>)}
            </select>
          </FormGroup>

          <FormGroup label="Target Optic">
            <select
              value={selectedOpticVal}
              onChange={(e) => onGenericChange('tappedLinkOptic', e.target.value)}
            >
              {SUPPORTED_TAP_OPTICS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </FormGroup>

          {hasMismatch && (
            <div style={{ marginTop: '8px', padding: '6px', background: 'rgba(239, 83, 80, 0.1)', border: '1px solid rgba(239, 83, 80, 0.3)', borderRadius: '4px', color: '#ef5350', fontSize: '10px' }}>
              ⚠️ Fiber mode mismatch: TAP is {tapFiberMode} but target optic is {matchedOptic?.isSM ? 'Single-mode' : 'Multi-mode'}.
            </div>
          )}
        </>
      )}

      {configType === CONFIG_TYPES.ERSPAN && (
        <>
          <FormGroup label="Tunnel ID (Session ID)">
            <input
              type="number"
              placeholder="e.g. 10"
              value={(node.data?.erspanId as number) || 10}
              onChange={(e) => onGenericChange('erspanId', e.target.value)}
            />
          </FormGroup>
          <FormGroup label="ERSPAN Source IP">
            <input
              type="text"
              placeholder="e.g. 192.168.10.5"
              value={(node.data?.erspanSrcIp as string) || '192.168.10.5'}
              onChange={(e) => onGenericChange('erspanSrcIp', e.target.value)}
            />
          </FormGroup>
        </>
      )}
    </>
  );
};
