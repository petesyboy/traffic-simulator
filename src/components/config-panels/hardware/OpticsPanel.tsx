import React, { useState } from 'react';
import type { CustomNode } from '../../../store/store';
import type { Edge } from '@xyflow/react';
import type { BaseNodeData, HardwareNodeData, InstalledOptic } from '../../../store/types';
import { getSupportedBoards, validateOptic } from '../../../utils/opticValidation';
import { getOpticSpeed, formatOpticLabel, getBoardPortCapacity, getCageCapacityBreakdown } from '../../../utils/hardwareUtils';
import { SUPPORTED_TAP_OPTICS } from '../../../constants/nodeTypes';

interface OpticsPanelProps {
  selectedNode: CustomNode;
  updateNodeData: (nodeId: string, data: Partial<BaseNodeData>) => void;
  nodes: CustomNode[];
  edges: Edge[];
}

export const OpticsPanel: React.FC<OpticsPanelProps> = ({ selectedNode, updateNodeData, nodes, edges }) => {
  const model = String(selectedNode.data?.model || '');
  const hwData = selectedNode.data as HardwareNodeData;
  const installedOptics: InstalledOptic[] = hwData.optics || [];
  const installedBoards = hwData.installedBoards || {};
  const isPlus = model.includes('Plus');

  const [selectedOpticBoard, setSelectedOpticBoard] = useState('');
  const [selectedOptic, setSelectedOptic] = useState('');
  const [qtyStr, setQtyStr] = useState('1');
  const [errorMsg, setErrorMsg] = useState('');

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

  const activeOpticBoardObj = availableOpticBoards.length === 1
    ? availableOpticBoards[0]
    : availableOpticBoards.find(b => b.board === selectedOpticBoard);

  // ─── Optics status calculations ───────────────────────────────────
  const incomingTapEdges = edges.filter(e => e.target === selectedNode.id);
  const uniqueIncomingTapSources = Array.from(new Set(incomingTapEdges.map(e => e.source)));
  let tappedLinks = 0;
  let requiredMMOptics = 0;
  let requiredSMOptics = 0;
  let requiredCopperOptics = 0;

  uniqueIncomingTapSources.forEach(srcId => {
    const sourceNode = nodes.find(n => n.id === srcId);
    if (sourceNode?.data?.model?.includes('TAP')) {
      const tapSku = String(sourceNode.data?.sku || '');
      const tapModel = String(sourceNode.data?.model || '');
      const isSMTap = tapSku.includes('253') || tapSku.includes('273') || tapSku.includes('453') || tapModel.toLowerCase().includes('single-mode') || tapModel.toLowerCase().includes('sm') || tapModel.includes('253T') || tapModel.includes('273T') || tapModel.includes('453T');

      const allocations = ((sourceNode.data as HardwareNodeData).tappedLinkAllocations) || [
        {
          qty: (sourceNode.data as HardwareNodeData).tappedLinksCount ?? 1,
          optic: (sourceNode.data as HardwareNodeData).tappedLinkOptic || (isSMTap ? 'SFP-533 (10G SFP+ LR)' : 'SFP-532 (10G SFP+ SR)')
        }
      ];

      for (const alloc of allocations) {
        const opticToValidate = alloc.toolOptic || alloc.optic;
        const matched = SUPPORTED_TAP_OPTICS.find((o: { value: string }) => o.value === opticToValidate);
        const isCopper = matched ? !!matched.isCopper : opticToValidate.includes('Copper');
        const isSM = matched ? matched.isSM : isSMTap;
        tappedLinks += alloc.qty;
        if (isCopper) {
          requiredCopperOptics += alloc.qty * 2;
        } else if (isSM) {
          requiredSMOptics += alloc.qty * 2;
        } else {
          requiredMMOptics += alloc.qty * 2;
        }
      }
    }
  });

  const outgoingToolLinks = edges.filter(e => e.source === selectedNode.id && nodes.find(n => n.id === e.target)?.type === 'toolNode').length;

  let installedMMOptics = 0;
  let installedSMOptics = 0;
  let installedCopperOptics = 0;
  installedOptics.forEach(opt => {
    const name = opt.optic.toUpperCase();
    const isOpticCopper = name.includes('COPPER') || name.includes('BASE-T') || name.includes('BASET') || name.includes('ACTIVE CABLE') || name.includes('DIRECT ATTACH') || name.includes('DAC');
    const isOpticMM = !isOpticCopper && (name.includes('SR') || name.includes('SX') || name.includes('SWDM') || name.includes('FX') || name.includes('LRM') || name.includes('BIDI'));
    const isOpticSM = !isOpticCopper && (name.includes('LR') || name.includes('LX') || name.includes('ER') || name.includes('PLR') || name.includes('DR1') || name.includes('CWDM') || name.includes('FR'));
    if (isOpticCopper) installedCopperOptics += opt.qty;
    else if (isOpticMM) installedMMOptics += opt.qty;
    else if (isOpticSM) installedSMOptics += opt.qty;
  });

  const missingMM = Math.max(0, requiredMMOptics - installedMMOptics);
  const missingSM = Math.max(0, requiredSMOptics - installedSMOptics);
  const missingCopper = Math.max(0, requiredCopperOptics - installedCopperOptics);
  const totalOptics = installedOptics.reduce((sum, opt) => sum + opt.qty, 0);
  const totalOpticsNeeded = (requiredMMOptics + requiredSMOptics + requiredCopperOptics) + outgoingToolLinks;
  const isOpticsInvalid = (totalOptics < totalOpticsNeeded) || (missingMM > 0) || (missingSM > 0) || (missingCopper > 0);

  // ─── Speed capacity calculations ──────────────────────────────────
  const getBoardCageCapacities = (boardName: string): {
    ports1G: number; ports10G: number; ports25G: number; ports40G: number; ports100G: number;
  } => {
    const caps = { ports1G: 0, ports10G: 0, ports25G: 0, ports40G: 0, ports100G: 0 };
    const name = boardName.toLowerCase();
    const modelLower = model.toLowerCase();
    const cages = getBoardPortCapacity(boardName, model, isPlus);

    caps.ports100G = cages.qsfp;
    caps.ports40G = cages.qsfp;
    caps.ports25G = cages.sfp;
    caps.ports10G = cages.sfp;
    caps.ports1G = cages.sfp;

    if ((name.includes('main') || name.includes('base') || name.includes('hc1-x12g4')) && !isPlus && !modelLower.includes('hct')) {
      caps.ports1G = 12 + 4;
    }

    return caps;
  };

  let total100G = 0, total40G = 0, total25G = 0, total10G = 0, total1G = 0;
  availableOpticBoards.forEach(b => {
    const caps = getBoardCageCapacities(b.board);
    total100G += caps.ports100G;
    total40G += caps.ports40G;
    total25G += caps.ports25G;
    total10G += caps.ports10G;
    total1G += caps.ports1G;
  });

  const numBreakouts = installedOptics.reduce((sum, opt) => {
    if (opt.optic.includes('PNL-M341') || opt.optic.includes('PNL-M343')) return sum + opt.qty;
    return sum;
  }, 0);
  total25G += numBreakouts * 4;
  total10G += numBreakouts * 4;

  const modelLowerStr = model.toLowerCase();
  if (modelLowerStr.includes('ta25e')) {
    total25G = Math.min(total25G, 80); total10G = Math.min(total10G, 80);
  } else if (modelLowerStr.includes('ta25')) {
    total25G = Math.min(total25G, 56); total10G = Math.min(total10G, 56);
  } else if (modelLowerStr.includes('ta200e') || modelLowerStr.includes('ta200')) {
    total25G = Math.min(total25G, 128); total10G = Math.min(total10G, 128); total1G = 0;
  } else if (modelLowerStr.includes('ta400e')) {
    total100G = Math.min(total100G, 128); total25G = Math.min(total25G, 130); total10G = Math.min(total10G, 130); total1G = 0;
  } else if (modelLowerStr.includes('ta400')) {
    total100G = Math.min(total100G, 128); total25G = Math.min(total25G, 128); total10G = Math.min(total10G, 128); total1G = 0;
  } else if (modelLowerStr.includes('hct')) {
    total100G = Math.min(total100G, 2); total40G = Math.min(total40G, 6); total25G = Math.min(total25G, 12); total10G = Math.min(total10G, 32); total1G = Math.min(total1G, 12);
  } else if (modelLowerStr.includes('hc1-plus') || modelLowerStr.includes('hc1 plus')) {
    total100G = Math.min(total100G, 12); total40G = Math.min(total40G, 12); total25G = Math.min(total25G, 72); total10G = Math.min(total10G, 72); total1G = Math.min(total1G, 32);
  } else if (modelLowerStr.includes('hc1')) {
    total40G = Math.min(total40G, 8); total25G = 0; total10G = Math.min(total10G, 60); total1G = Math.min(total1G, 40);
  } else if (modelLowerStr.includes('hc3')) {
    total100G = Math.min(total100G, 64); total40G = Math.min(total40G, 64); total25G = Math.min(total25G, 128); total10G = Math.min(total10G, 128);
  }

  let used100G = 0, used40G = 0, used25G = 0, used10G = 0, used1G = 0;
  installedOptics.forEach(opt => {
    if (opt.optic.includes('PNL-M34')) return;
    const speed = getOpticSpeed(opt.optic);
    if (speed === '100G') used100G += opt.qty;
    else if (speed === '40G') used40G += opt.qty;
    else if (speed === '25G') used25G += opt.qty;
    else if (speed === '10G') used10G += opt.qty;
    else if (speed === '1G') used1G += opt.qty;
  });

  // ─── Handlers ─────────────────────────────────────────────────────
  const handleAddOptic = () => {
    setErrorMsg('');
    const targetBoard = availableOpticBoards.length === 1 ? availableOpticBoards[0].board : selectedOpticBoard;
    if (!targetBoard || !selectedOptic) {
      setErrorMsg('Please select a board and an optic.');
      return;
    }
    const validation = validateOptic(model, targetBoard, selectedOptic, hwData.portCapacity as string, installedOptics);
    if (!validation.valid) {
      setErrorMsg(validation.message || 'Invalid optic combination.');
      return;
    }

    let qty = parseInt(qtyStr);
    if (isNaN(qty) || qty < 1) qty = 1;

    const cages = getBoardPortCapacity(targetBoard, model, isPlus);
    let currentSfp = 0;
    let currentQsfp = 0;
    installedOptics.forEach(opt => {
      if (opt.board === targetBoard) {
        if (opt.optic.includes('PNL-M34')) return;
        const speed = getOpticSpeed(opt.optic);
        if (speed === '100G' || speed === '40G') {
          currentQsfp += opt.qty;
        } else {
          currentSfp += opt.qty;
        }
      }
    });

    const newSpeed = getOpticSpeed(selectedOptic);
    const isNewQsfp = newSpeed === '100G' || newSpeed === '40G';

    if (isNewQsfp) {
      if (currentQsfp + qty > cages.qsfp) {
        setErrorMsg(`Cannot add optic. Board/Module "${targetBoard}" only has ${cages.qsfp} QSFP cage(s) (currently using ${currentQsfp}, attempting to add ${qty}).`);
        return;
      }
    } else {
      const numBreakoutPanels = installedOptics.reduce((sum, opt) => {
        if (opt.board === targetBoard && (opt.optic.includes('PNL-M341') || opt.optic.includes('PNL-M343'))) return sum + opt.qty;
        return sum;
      }, 0);
      const allowedSfp = cages.sfp + numBreakoutPanels * 4;
      if (currentSfp + qty > allowedSfp) {
        setErrorMsg(`Cannot add optic. Board/Module "${targetBoard}" only has ${allowedSfp} SFP cage(s) (currently using ${currentSfp}, attempting to add ${qty}).`);
        return;
      }
    }

    const existingOpticIdx = installedOptics.findIndex(opt => (opt.board || 'Base Ports') === targetBoard && opt.optic === selectedOptic);
    let newOptics = [...installedOptics];
    if (existingOpticIdx >= 0) {
      newOptics[existingOpticIdx] = { ...newOptics[existingOpticIdx], qty: newOptics[existingOpticIdx].qty + qty };
    } else {
      newOptics.push({ board: targetBoard, optic: selectedOptic, qty });
    }

    // Auto-add corresponding parent optic if a breakout panel is added
    if (selectedOptic.includes('PNL-M341') || selectedOptic.includes('PNL-M343')) {
      let parentOptic = '';
      if (selectedOptic.includes('PNL-M341')) {
        const activeBoardObj = availableOpticBoards.find(b => b.board === targetBoard);
        const supports100G = activeBoardObj?.supportedOptics.some(opt => opt.includes('Q28-502T'));
        parentOptic = supports100G ? 'Q28-502T (100G QSFP28 SR4)' : 'QSF-502T (40G QSFP+ SR4)';
      } else {
        const activeBoardObj = availableOpticBoards.find(b => b.board === targetBoard);
        const supports100G = activeBoardObj?.supportedOptics.some(opt => opt.includes('Q28-506'));
        parentOptic = supports100G ? 'Q28-506 (100G QSFP28 PLR4)' : 'QSF-506T (40G QSFP+ PSM4)';
      }

      if (parentOptic) {
        const parentIdx = newOptics.findIndex(opt => (opt.board || 'Base Ports') === targetBoard && opt.optic === parentOptic);
        if (parentIdx >= 0) {
          newOptics[parentIdx] = { ...newOptics[parentIdx], qty: newOptics[parentIdx].qty + qty };
        } else {
          newOptics.push({ board: targetBoard, optic: parentOptic, qty });
        }
      }
    }

    updateNodeData(selectedNode.id, { optics: newOptics });
    setSelectedOptic('');
    setQtyStr('1');
  };

  const handleRemoveOptic = (index: number) => {
    const newOptics = [...installedOptics];
    newOptics.splice(index, 1);
    updateNodeData(selectedNode.id, { optics: newOptics });
  };

  // ─── Tool links check for suggestions ─────────────────────────────
  const toolsReached = new Set<string>();
  const visited = new Set<string>();
  const queue = [selectedNode.id];
  visited.add(selectedNode.id);
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const outbound = edges.filter(e => e.source === currentId);
    outbound.forEach(e => {
      if (!visited.has(e.target)) {
        visited.add(e.target);
        const targetNode = nodes.find(n => n.id === e.target);
        if (targetNode) {
          if (targetNode.type === 'toolNode') toolsReached.add(targetNode.id);
          else if (targetNode.type !== 'hardwareNode') queue.push(e.target);
        }
      }
    });
  }
  const numToolLinks = toolsReached.size;
  const requiredTapOptics = requiredMMOptics + requiredSMOptics + requiredCopperOptics;
  const totalRequiredOptics = requiredTapOptics + numToolLinks;

  return (
    <>
      {/* Link and Optic Verification Panel */}
      <div style={{
        background: isOpticsInvalid ? 'rgba(255, 152, 0, 0.05)' : 'rgba(76, 175, 80, 0.05)',
        border: isOpticsInvalid ? '1px dashed rgba(255, 152, 0, 0.3)' : '1px dashed rgba(76, 175, 80, 0.3)',
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '16px',
        fontSize: '11px',
        color: '#ccc',
        lineHeight: '1.4'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px', color: isOpticsInvalid ? '#ffa726' : '#66bb6a', fontSize: '12px' }}>
          {isOpticsInvalid ? '⚠️ Optics Sanity Alert' : '✅ Optics Configuration Valid'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
          <div>
            <span style={{ color: '#888' }}>Tapped Links (In):</span>
            <strong style={{ color: '#fff', marginLeft: '4px', fontFamily: 'monospace' }}>{tappedLinks}</strong>
            <span style={{ color: '#666', fontSize: '9px', marginLeft: '2px' }}>(needs {tappedLinks * 2} optics)</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Tool Links (Out):</span>
            <strong style={{ color: '#fff', marginLeft: '4px', fontFamily: 'monospace' }}>{outgoingToolLinks}</strong>
            <span style={{ color: '#666', fontSize: '9px', marginLeft: '2px' }}>(needs {outgoingToolLinks} optics)</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Optics Needed:</span>
            <strong style={{ color: '#fff', marginLeft: '4px', fontFamily: 'monospace' }}>{totalOpticsNeeded}</strong>
            <span style={{ color: '#666', fontSize: '9px', marginLeft: '2px' }}>(MM: {requiredMMOptics}, SM: {requiredSMOptics}, CU: {requiredCopperOptics}, Tool: {outgoingToolLinks})</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Optics Deployed:</span>
            <strong style={{ color: isOpticsInvalid ? '#ffb74d' : '#81c784', marginLeft: '4px', fontFamily: 'monospace' }}>{totalOptics}</strong>
          </div>
        </div>
        <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
          <span style={{ color: '#888' }}>Sanity Check Status:</span>
          <strong style={{ color: isOpticsInvalid ? '#ef5350' : '#81c784', marginLeft: '4px' }}>
            {totalOptics < totalOpticsNeeded
              ? `Insufficient transceivers: Missing ${totalOpticsNeeded - totalOptics} optics`
              : (missingMM > 0 || missingSM > 0 || missingCopper > 0)
                ? 'Fiber type or speed mismatch on TAP links'
                : 'All links fully allocated and verified'}
          </strong>
        </div>
      </div>

      {/* Chassis Cage Capacity */}
      {(total100G > 0 || total40G > 0 || total25G > 0 || total10G > 0 || total1G > 0) && (
        <div style={{ borderTop: '1px solid rgba(255, 152, 0, 0.2)', paddingTop: '10px', marginTop: '10px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>Chassis Cage Capacity</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', textAlign: 'center', background: '#111', padding: '8px', borderRadius: '4px', border: '1px solid #333' }}>
            {total100G > 0 && <div><div style={{ color: '#888', fontWeight: 'bold', fontSize: '10px' }}>100G</div><div style={{ color: used100G > total100G ? '#ef5350' : '#fff', fontSize: '11px', marginTop: '2px', fontFamily: 'monospace' }}>{used100G}/{total100G}</div></div>}
            {total40G > 0 && <div><div style={{ color: '#888', fontWeight: 'bold', fontSize: '10px' }}>40G</div><div style={{ color: used40G > total40G ? '#ef5350' : '#fff', fontSize: '11px', marginTop: '2px', fontFamily: 'monospace' }}>{used40G}/{total40G}</div></div>}
            {total25G > 0 && <div><div style={{ color: '#888', fontWeight: 'bold', fontSize: '10px' }}>25G</div><div style={{ color: used25G > total25G ? '#ef5350' : '#fff', fontSize: '11px', marginTop: '2px', fontFamily: 'monospace' }}>{used25G}/{total25G}</div></div>}
            {total10G > 0 && <div><div style={{ color: '#888', fontWeight: 'bold', fontSize: '10px' }}>10G</div><div style={{ color: used10G > total10G ? '#ef5350' : '#fff', fontSize: '11px', marginTop: '2px', fontFamily: 'monospace' }}>{used10G}/{total10G}</div></div>}
            {total1G > 0 && <div><div style={{ color: '#888', fontWeight: 'bold', fontSize: '10px' }}>1G</div><div style={{ color: used1G > total1G ? '#ef5350' : '#fff', fontSize: '11px', marginTop: '2px', fontFamily: 'monospace' }}>{used1G}/{total1G}</div></div>}
          </div>
        </div>
      )}

      {/* Optics Deployment Status */}
      <div style={{ borderTop: '1px solid rgba(255, 152, 0, 0.2)', paddingTop: '10px', marginTop: '10px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>Optics Deployment Status</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#111', padding: '10px', borderRadius: '4px', border: '1px solid #333', fontSize: '11px', color: '#ccc' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Total Deployed Optics:</span>
            <strong style={{ color: '#00e5ff', fontFamily: 'monospace' }}>{totalOptics}</strong>
          </div>
          {tappedLinks > 0 && (() => {
            const terminatedMM = Math.min(Math.floor(requiredMMOptics / 2), Math.floor(installedMMOptics / 2));
            const terminatedSM = Math.min(Math.floor(requiredSMOptics / 2), Math.floor(installedSMOptics / 2));
            const terminatedCU = Math.min(Math.floor(requiredCopperOptics / 2), Math.floor(installedCopperOptics / 2));
            const totalTerminated = terminatedMM + terminatedSM + terminatedCU;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #222', paddingTop: '6px', marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tapped Links Terminated:</span>
                  <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{totalTerminated} / {tappedLinks}</strong>
                </div>
                {missingMM > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef5350', fontSize: '10px', fontWeight: 'bold', marginTop: '2px' }}>
                    <span>⚠️ Multi-mode links lack optics: need {missingMM} more Multi-mode optic(s).</span>
                  </div>
                )}
                {missingSM > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef5350', fontSize: '10px', fontWeight: 'bold', marginTop: '2px' }}>
                    <span>⚠️ Single-mode links lack optics: need {missingSM} more Single-mode optic(s).</span>
                  </div>
                )}
                {missingCopper > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef5350', fontSize: '10px', fontWeight: 'bold', marginTop: '2px' }}>
                    <span>⚠️ Copper links lack optics: need {missingCopper} more Copper optic(s).</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Install Optics */}
      {availableOpticBoards.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255, 152, 0, 0.2)', paddingTop: '10px', marginTop: '10px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>Install Optics</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {availableOpticBoards.length > 1 ? (
              <select value={selectedOpticBoard} onChange={e => { setSelectedOpticBoard(e.target.value); setSelectedOptic(''); setErrorMsg(''); }} style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}>
                <option value="">-- Select Target Cage --</option>
                {availableOpticBoards.map(b => <option key={b.board} value={b.board}>{b.board}</option>)}
              </select>
            ) : (
              <div style={{ fontSize: '11px', color: '#aaa', padding: '4px 0' }}>Target Cage: <strong style={{ color: '#fff' }}>{availableOpticBoards[0]?.board || 'Base Ports'}</strong></div>
            )}
            <select value={selectedOptic} onChange={e => { setSelectedOptic(e.target.value); setErrorMsg(''); }} style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }} disabled={availableOpticBoards.length === 0 || (availableOpticBoards.length > 1 && !selectedOpticBoard)}>
              <option value="">-- Select Optic --</option>
              {activeOpticBoardObj?.supportedOptics.map(opt => <option key={opt} value={opt}>{formatOpticLabel(opt)}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', color: '#ccc' }}>Qty:</label>
              <input type="number" min={1} value={qtyStr} onChange={e => setQtyStr(e.target.value)} style={{ width: '40px', fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }} />
              <button onClick={handleAddOptic} style={{ flex: 1, padding: '4px 8px', background: 'rgba(255, 152, 0, 0.2)', border: '1px solid rgba(255, 152, 0, 0.4)', borderRadius: '3px', color: '#ffb74d', fontSize: '11px', cursor: 'pointer' }}>Add Optic</button>
            </div>
            {errorMsg && <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(239, 83, 80, 0.1)', border: '1px solid rgba(239, 83, 80, 0.3)', borderRadius: '4px', color: '#ef5350', fontSize: '11px', whiteSpace: 'pre-wrap' }}>⚠️ {errorMsg}</div>}
          </div>

          {installedOptics.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <h5 style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#ccc' }}>Installed Optics:</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {installedOptics.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', border: '1px solid #333' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#fff' }}>{opt.qty}x {formatOpticLabel(opt.optic)}</span>
                      <span style={{ color: '#888' }}>{opt.board}</span>
                    </div>
                    <button onClick={() => handleRemoveOptic(i)} style={{ background: 'none', border: 'none', color: '#ef5350', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }} title="Remove Optic">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {(() => {
            if (missingMM > 0 || missingSM > 0 || missingCopper > 0) {
              return (
                <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(239, 83, 80, 0.1)', border: '1px solid rgba(239, 83, 80, 0.3)', borderRadius: '6px', color: '#ef5350', fontSize: '11px', lineHeight: '1.5' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '12px' }}>⚠️ Optic Type Mismatch</div>
                  {missingMM > 0 && <div>• You need <strong>{missingMM}</strong> more Multi-mode optic(s) (e.g. SR/SX).</div>}
                  {missingSM > 0 && <div>• You need <strong>{missingSM}</strong> more Single-mode optic(s) (e.g. LR/LX).</div>}
                  {missingCopper > 0 && <div>• You need <strong>{missingCopper}</strong> more Copper optic(s).</div>}
                </div>
              );
            } else if (numToolLinks > 0 && totalOptics < totalRequiredOptics) {
              const diff = totalRequiredOptics - totalOptics;
              return <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(0, 150, 136, 0.1)', border: '1px solid rgba(0, 150, 136, 0.3)', borderRadius: '4px', color: '#80cbc4', fontSize: '11px' }}><strong>💡 Suggestion:</strong> You have <strong>{numToolLinks}</strong> tool output(s). You need to install at least <strong>{diff}</strong> more optic(s) to support the tools.</div>;
            }
            return null;
          })()}
        </div>
      )}
    </>
  );
};
