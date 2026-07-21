import React from 'react';
import type { CustomNode } from '../../../store/store';
import type { HardwareNodeData } from '../../../store/types';
import { getCageCapacityBreakdown } from '../../../utils/hardwareUtils';

interface CageSummaryPanelProps {
  selectedNode: CustomNode;
}

export const CageSummaryPanel: React.FC<CageSummaryPanelProps> = ({ selectedNode }) => {
  const model = String(selectedNode.data?.model || '');
  const hwData = selectedNode.data as HardwareNodeData;

  if (model.includes('TAP')) return null;

  const {
    totalQsfpCages,
    usedQsfpOptics,
    usedBreakouts,
    hasBuiltInCopper,
    usedBuiltInCopper,
    totalExpandedSfpPorts,
    usedSfpOptics,
    breakoutSfpExpansion,
    remainingSfpCages,
    remainingQsfpCages,
    licensedSfpCages,
    licensedQsfpCages,
    remainingLicensedSfpCages,
    remainingLicensedQsfpCages,
    licensedQsfp400gCages,
    remainingLicensedQsfp400gCages,
    isLicensed,
    used400G,
  } = getCageCapacityBreakdown(model, hwData);

  const totalUsedQsfpCages = usedQsfpOptics + usedBreakouts;

  return (
    <div style={{ borderTop: '1px solid rgba(255, 152, 0, 0.2)', paddingTop: '10px', marginTop: '10px' }}>
      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>Physical Cages &amp; Ports</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#111', padding: '10px', borderRadius: '4px', border: '1px solid #333', fontSize: '11px', color: '#ccc' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#aaa' }}>QSFP Cages (40G/100G/400G):</span>
          <strong style={{ color: remainingQsfpCages === 0 ? '#ef5350' : '#4caf50', fontFamily: 'monospace' }}>
            {totalUsedQsfpCages} / {isLicensed ? `${licensedQsfpCages} (${totalQsfpCages} phys)` : totalQsfpCages} Used ({isLicensed ? `${remainingLicensedQsfpCages} lic, ` : ''}{remainingQsfpCages} Free)
          </strong>
        </div>
        {isLicensed && model.includes('TA400E') && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#aaa' }}>400G Licensed Ports:</span>
            <strong style={{ color: remainingLicensedQsfp400gCages === 0 ? '#ef5350' : '#4caf50', fontFamily: 'monospace' }}>
              {used400G} / {licensedQsfp400gCages} Used ({remainingLicensedQsfp400gCages} Free)
            </strong>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#aaa' }}>SFP Cages (1G/10G/25G):</span>
          <strong style={{ color: remainingSfpCages === 0 ? '#ef5350' : '#4caf50', fontFamily: 'monospace' }}>
            {usedSfpOptics} / {isLicensed ? `${licensedSfpCages} (${totalExpandedSfpPorts} phys)` : totalExpandedSfpPorts} Used ({isLicensed ? `${remainingLicensedSfpCages} lic, ` : ''}{remainingSfpCages} Free)
          </strong>
        </div>
        {usedBreakouts > 0 && (
          <div style={{ color: '#00e5ff', fontSize: '10px', borderTop: '1px solid #222', paddingTop: '4px', marginTop: '2px' }}>
            ℹ️ SFP capacity expanded by +{breakoutSfpExpansion} ports from {usedBreakouts} breakout panel{usedBreakouts > 1 ? 's' : ''}.
          </div>
        )}
        {hasBuiltInCopper && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #222', paddingTop: '4px', marginTop: '2px' }}>
            <span style={{ color: '#aaa' }}>Built-in 1G RJ45 Ports:</span>
            <strong style={{ color: (4 - usedBuiltInCopper) === 0 ? '#ef5350' : '#4caf50', fontFamily: 'monospace' }}>
              {usedBuiltInCopper} / 4 Used ({4 - usedBuiltInCopper} Free)
            </strong>
          </div>
        )}
      </div>
    </div>
  );
};
