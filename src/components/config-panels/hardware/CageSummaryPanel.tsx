import React from 'react';
import type { CustomNode } from '../../../store/store';
import type { HardwareNodeData, InstalledOptic } from '../../../store/types';
import { getOpticSpeed, getBoardPortCapacity, getOpticFiberType } from '../../../utils/hardwareUtils';
import { getSupportedBoards } from '../../../utils/opticValidation';

interface CageSummaryPanelProps {
  selectedNode: CustomNode;
}

export const CageSummaryPanel: React.FC<CageSummaryPanelProps> = ({ selectedNode }) => {
  const model = String(selectedNode.data?.model || '');
  const hwData = selectedNode.data as HardwareNodeData;
  const installedOptics: InstalledOptic[] = hwData.optics || [];
  const installedBoards = hwData.installedBoards || {};
  const isPlus = model.includes('Plus');

  if (model.includes('TAP')) return null;

  // Build available optic boards list
  const supportedBoards = getSupportedBoards(model, hwData.portCapacity as string, installedOptics);
  const availableOpticBoards: { board: string; supportedOptics: string[] }[] = [];

  const mainBoardObj = supportedBoards.find(b => b.board.toLowerCase().includes('main') || b.board.toLowerCase().includes('base'));
  if (mainBoardObj) {
    availableOpticBoards.push({ board: mainBoardObj.board, supportedOptics: mainBoardObj.supportedOptics });
  }
  Object.entries(installedBoards).forEach(([slotIdx, boardName]) => {
    if (!boardName) return;
    const boardTemplate = supportedBoards.find(b => b.board === boardName);
    if (boardTemplate) {
      availableOpticBoards.push({ board: `${boardName} (Slot ${slotIdx})`, supportedOptics: boardTemplate.supportedOptics });
    }
  });

  // Calculate physical cages
  let totalSfpCages = 0;
  let totalQsfpCages = 0;
  let hasBuiltInCopper = false;
  let usedBuiltInCopper = 0;

  availableOpticBoards.forEach(b => {
    const cages = getBoardPortCapacity(b.board, model, isPlus);
    totalSfpCages += cages.sfp;
    totalQsfpCages += cages.qsfp;

    const name = b.board.toLowerCase();
    const modelLower = model.toLowerCase();
    if ((name.includes('main') || name.includes('base') || name.includes('hc1-x12g4')) && !isPlus && !modelLower.includes('hct') && !modelLower.includes('tap')) {
      hasBuiltInCopper = true;
    }
  });

  let usedSfpOptics = 0;
  let usedQsfpOptics = 0;
  let usedBreakouts = 0;

  installedOptics.forEach(opt => {
    if (opt.optic.includes('PNL-M341') || opt.optic.includes('PNL-M343')) {
      usedBreakouts += opt.qty;
    } else {
      const speed = getOpticSpeed(opt.optic);
      const isQsfp = speed === '100G' || speed === '40G' || speed === '400G';
      const isCopper = getOpticFiberType(opt.optic) === 'Copper';

      if (isQsfp) {
        usedQsfpOptics += opt.qty;
      } else {
        if (hasBuiltInCopper && isCopper && opt.optic.includes('SFP-501')) {
          const countForBuiltIn = Math.min(opt.qty, 4 - usedBuiltInCopper);
          usedBuiltInCopper += countForBuiltIn;
          usedSfpOptics += (opt.qty - countForBuiltIn);
        } else {
          usedSfpOptics += opt.qty;
        }
      }
    }
  });

  const totalUsedQsfpCages = usedQsfpOptics + usedBreakouts;
  const remainingQsfpCages = Math.max(0, totalQsfpCages - totalUsedQsfpCages);
  const breakoutSfpExpansion = usedBreakouts * 4;
  const totalExpandedSfpPorts = totalSfpCages + breakoutSfpExpansion;
  const remainingSfpPorts = Math.max(0, totalExpandedSfpPorts - usedSfpOptics);

  return (
    <div style={{ borderTop: '1px solid rgba(255, 152, 0, 0.2)', paddingTop: '10px', marginTop: '10px' }}>
      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>Physical Cages &amp; Ports</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#111', padding: '10px', borderRadius: '4px', border: '1px solid #333', fontSize: '11px', color: '#ccc' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#aaa' }}>QSFP Cages (40G/100G/400G):</span>
          <strong style={{ color: remainingQsfpCages === 0 ? '#ef5350' : '#4caf50', fontFamily: 'monospace' }}>
            {totalUsedQsfpCages} / {totalQsfpCages} Used ({remainingQsfpCages} Free)
          </strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#aaa' }}>SFP Cages (1G/10G/25G):</span>
          <strong style={{ color: remainingSfpPorts === 0 ? '#ef5350' : '#4caf50', fontFamily: 'monospace' }}>
            {usedSfpOptics} / {totalExpandedSfpPorts} Used ({remainingSfpPorts} Free)
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
