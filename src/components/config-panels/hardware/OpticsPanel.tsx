import React, { useState } from 'react';
import { useStore, type CustomNode } from '../../../store/store';
import type { Edge } from '@xyflow/react';
import type { BaseNodeData, HardwareNodeData, InstalledOptic } from '../../../store/types';
import { getSupportedBoards, validateOptic } from '../../../utils/opticValidation';
import { getOpticSpeed, formatOpticLabel, getCageCapacityBreakdown, getOpticFiberType, getBoardSpeedSubCap, isBreakoutPanelModel } from '../../../utils/hardwareUtils';
import { getChassisPorts, getPortOpticMap, getOpticCage, allowedBreakoutLcOptics } from '../../../utils/ports';
import { isParallelBreakoutOptic, boardFeedsBreakoutPanel } from '../../../utils/breakoutRules';
import { SUPPORTED_TAP_OPTICS, NODE_TYPES } from '../../../constants/nodeTypes';
import { getCandidateReplacementOptics, performOpticBulkReplace } from '../../../utils/opticBulkReplace';

/** How long a newly-fitted port stays highlighted on the canvas node's port map. */
const FLASH_DURATION_MS = 2500;

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

  const [selectedOpticBoard, setSelectedOpticBoard] = useState('');
  const [selectedPortId, setSelectedPortId] = useState('');
  const [selectedOptic, setSelectedOptic] = useState('');
  const [qtyStr, setQtyStr] = useState('1');
  const [errorMsg, setErrorMsg] = useState('');

  // Bulk Replace state
  const [bulkReplaceSource, setBulkReplaceSource] = useState<string | null>(null);
  const [bulkReplaceTarget, setBulkReplaceTarget] = useState<string>('');
  const [bulkReplaceScope, setBulkReplaceScope] = useState<'node' | 'project'>('node');
  const [syncConnectedTaps, setSyncConnectedTaps] = useState<boolean>(true);
  const [replaceFeedback, setReplaceFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (model.includes('TAP') || isBreakoutPanelModel(model)) return null;

  // Build available optic boards list
  const supportedBoards = getSupportedBoards(model, hwData.portCapacity as string);
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

  const targetBoard = availableOpticBoards.length === 1 ? availableOpticBoards[0].board : selectedOpticBoard;
  const chassisPortsForFeedCheck = getChassisPorts(model, hwData);
  // Both checks are scoped to a specific cage FAMILY, not the whole board - a
  // board like a TA25E's "Base Ports" mixes SFP and QSFP cages, so wiring one
  // QSFP cage to a panel must not restrict that board's unrelated SFP cages.
  const feedsBreakoutPanel = !!targetBoard &&
    boardFeedsBreakoutPanel(targetBoard, chassisPortsForFeedCheck, selectedNode.id, nodes, edges);
  const lcRestriction = targetBoard
    ? allowedBreakoutLcOptics(targetBoard, chassisPortsForFeedCheck, selectedNode.id, nodes, edges)
    : null;

  // Ports on the target board with nothing in them yet, offered for the
  // optional "pick an exact port" flow instead of the default auto-assign.
  const currentOccupancy = getPortOpticMap(chassisPortsForFeedCheck, installedOptics);
  const freePortsForBoard = targetBoard
    ? chassisPortsForFeedCheck.filter(p => p.board === targetBoard && p.cage !== 'RJ45' && !currentOccupancy.has(p.id))
    : [];
  const selectedPort = selectedPortId ? chassisPortsForFeedCheck.find(p => p.id === selectedPortId) : undefined;

  const dropdownOptics = activeOpticBoardObj
    ? activeOpticBoardObj.supportedOptics.filter(opt => {
        const cage = getOpticCage(opt);
        if (selectedPort && cage !== selectedPort.cage) return false;
        if (feedsBreakoutPanel && cage === 'QSFP') return isParallelBreakoutOptic(opt);
        if (lcRestriction && cage === lcRestriction.cage) return lcRestriction.optics.includes(opt);
        return true;
      })
    : [];

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
    const type = getOpticFiberType(opt.optic);
    if (type === 'Copper') installedCopperOptics += opt.qty;
    else if (type === 'MM') installedMMOptics += opt.qty;
    else if (type === 'SM') installedSMOptics += opt.qty;
  });

  const missingMM = Math.max(0, requiredMMOptics - installedMMOptics);
  const missingSM = Math.max(0, requiredSMOptics - installedSMOptics);
  const missingCopper = Math.max(0, requiredCopperOptics - installedCopperOptics);
  const totalOptics = installedOptics.reduce((sum, opt) => sum + opt.qty, 0);
  const totalOpticsNeeded = (requiredMMOptics + requiredSMOptics + requiredCopperOptics) + outgoingToolLinks;
  const isOpticsInvalid = (totalOptics < totalOpticsNeeded) || (missingMM > 0) || (missingSM > 0) || (missingCopper > 0);

  const handleAddOptic = () => {
    setErrorMsg('');
    const targetBoard = availableOpticBoards.length === 1 ? availableOpticBoards[0].board : selectedOpticBoard;
    if (!targetBoard || !selectedOptic) {
      setErrorMsg('Please select a board and an optic.');
      return;
    }
    const validation = validateOptic(model, targetBoard, selectedOptic, hwData.portCapacity as string);
    if (!validation.valid) {
      setErrorMsg(validation.message || 'Invalid optic combination.');
      return;
    }

    const selectedCage = getOpticCage(selectedOptic);
    if (feedsBreakoutPanel && selectedCage === 'QSFP' && !isParallelBreakoutOptic(selectedOptic)) {
      setErrorMsg(`"${selectedOptic.split(' ')[0]}" can't be used here - this QSFP cage feeds a breakout panel, which needs a parallel-fibre optic (SR4 for multimode, PLR4/PSM4/DR4/DR4+ for singlemode). LR4/CWDM4/SWDM4/FR4 optics can't be broken out this way.`);
      return;
    }
    if (lcRestriction && selectedCage === lcRestriction.cage && !lcRestriction.optics.includes(selectedOptic)) {
      setErrorMsg(lcRestriction.optics.length > 0
        ? `"${selectedOptic.split(' ')[0]}" can't be used here - this cage is one of a breakout panel's LC legs, which needs: ${lcRestriction.optics.map(o => o.split(' ')[0]).join(', ')}.`
        : `This cage is one of a breakout panel's LC legs, but its MPO side has no valid optic installed yet - fit the parent optic on that chassis first.`);
      return;
    }

    let qty = parseInt(qtyStr);
    if (isNaN(qty) || qty < 1) qty = 1;
    // Pinning targets exactly one port, regardless of whatever qty was left
    // over in the field from a previous auto-assign add.
    if (selectedPortId) qty = 1;

    if (selectedPortId) {
      // Defensive re-check - installedOptics could have changed since the
      // port list was last derived for render (e.g. a rapid double-click).
      const stillFree = !getPortOpticMap(chassisPortsForFeedCheck, installedOptics).has(selectedPortId);
      if (!stillFree) {
        setErrorMsg(`Port ${selectedPortId} is no longer free - pick another port.`);
        return;
      }
    }

    const capacity = getCageCapacityBreakdown(model, hwData);
    const newSpeed = getOpticSpeed(selectedOptic);
    const isNewQsfp = newSpeed === '100G' || newSpeed === '40G' || newSpeed === '400G';

    if (isNewQsfp) {
      if (qty > capacity.remainingQsfpCages) {
        setErrorMsg(`Cannot add optic. Not enough free QSFP cages. Available: ${capacity.remainingQsfpCages}, trying to add: ${qty}.`);
        return;
      }
    } else {
      if (qty > capacity.remainingSfpCages) {
        setErrorMsg(`Cannot add optic. Not enough free SFP cages. Available: ${capacity.remainingSfpCages}, trying to add: ${qty}.`);
        return;
      }

      const subCap = getBoardSpeedSubCap(model, targetBoard, newSpeed);
      if (subCap !== Infinity) {
        const existingAtSpeed = installedOptics
          .filter(opt => opt.board === targetBoard && getOpticSpeed(opt.optic) === newSpeed)
          .reduce((sum, opt) => sum + opt.qty, 0);
        if (existingAtSpeed + qty > subCap) {
          setErrorMsg(`Cannot add optic. This board only supports ${newSpeed} on ${subCap} of its cages on ${model} (the rest run at a lower speed). Already installed: ${existingAtSpeed}, trying to add: ${qty}.`);
          return;
        }
      }
    }

    let newOptics: InstalledOptic[];
    if (selectedPortId) {
      // A pinned entry is always its own row - never folded into an
      // aggregate (board, optic) bucket, since that would lose its
      // single-port meaning (and corrupt qty for the merged entry).
      newOptics = [...installedOptics, { board: targetBoard, optic: selectedOptic, qty: 1, pinnedPortId: selectedPortId }];
    } else {
      // Never merge into an isAutoAdded bucket - that flag means
      // syncOpticsOnTapConnection owns and freely recomputes this entry's qty
      // from scratch on every sync (e.g. on load), so folding a manual add into
      // it would get silently discarded on the very next save/reload the
      // moment the auto-calculated requirement doesn't happen to already
      // include the extra unit the user just added.
      const existingOpticIdx = installedOptics.findIndex(
        opt => !opt.pinnedPortId && !opt.isAutoAdded && (opt.board || 'Base Ports') === targetBoard && opt.optic === selectedOptic,
      );
      newOptics = [...installedOptics];
      if (existingOpticIdx >= 0) {
        newOptics[existingOpticIdx] = { ...newOptics[existingOpticIdx], qty: newOptics[existingOpticIdx].qty + qty };
      } else {
        newOptics.push({ board: targetBoard, optic: selectedOptic, qty });
      }
    }

    // Diff the port-optic assignment before/after so the newly-fitted cages can
    // be flashed on the canvas node's port map - assignment is deterministic
    // (see getPortOpticMap), so this is exactly which ports the add just filled.
    const chassisPorts = getChassisPorts(model, hwData);
    const oldPortMap = getPortOpticMap(chassisPorts, installedOptics);
    const newPortMap = getPortOpticMap(chassisPorts, newOptics);
    const newlyFilledPortIds = Array.from(newPortMap.keys()).filter(portId => oldPortMap.get(portId) !== newPortMap.get(portId));

    updateNodeData(selectedNode.id, { optics: newOptics });
    setSelectedOptic('');
    setQtyStr('1');
    setSelectedPortId('');

    if (newlyFilledPortIds.length > 0) {
      const nodeId = selectedNode.id;
      useStore.getState().setFlashPorts({ nodeId, portIds: newlyFilledPortIds });
      setTimeout(() => {
        if (useStore.getState().flashPorts?.nodeId === nodeId) useStore.getState().setFlashPorts(null);
      }, FLASH_DURATION_MS);
    }
  };

  const handleRemoveOptic = (index: number) => {
    const newOptics = [...installedOptics];
    newOptics.splice(index, 1);
    updateNodeData(selectedNode.id, { optics: newOptics });
  };

  // ─── Bulk Replace Handlers ──────────────────────────────────────────
  const handleStartBulkReplace = (opticName: string) => {
    setBulkReplaceSource(opticName);
    const candidates = getCandidateReplacementOptics(model, opticName);
    setBulkReplaceTarget(candidates[0] || '');
    setBulkReplaceScope('node');
    setSyncConnectedTaps(true);
    setReplaceFeedback(null);
  };

  const handleExecuteBulkReplace = () => {
    if (!bulkReplaceSource || !bulkReplaceTarget) return;

    try {
      const result = performOpticBulkReplace(nodes, edges, {
        targetNodeId: bulkReplaceScope === 'node' ? selectedNode.id : undefined,
        sourceOptic: bulkReplaceSource,
        targetOptic: bulkReplaceTarget,
        syncConnectedTaps,
      });

      useStore.getState().setNodes(result.updatedNodes);
      setBulkReplaceSource(null);
      setReplaceFeedback({
        type: 'success',
        message: `Successfully replaced ${result.replacedChassisOpticCount}x ${bulkReplaceSource.split(' ')[0]} with ${bulkReplaceTarget.split(' ')[0]}${result.updatedTapCount > 0 ? ` and synchronised ${result.updatedTapCount} connected TAP(s)` : ''}.`,
      });
      setTimeout(() => setReplaceFeedback(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setReplaceFeedback({ type: 'error', message: `Bulk replacement failed: ${msg}` });
    }
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

      {/* Optics Deployment Status */}
      <div className="panel-section">
        <h3 className="text-base font-semibold mb-2">📡 Optics Deployment Status</h3>
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
        <div className="panel-section">
          <h3 className="text-base font-semibold mb-2">➕ Install Optics</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {availableOpticBoards.length > 1 ? (
              <select value={selectedOpticBoard} onChange={e => { setSelectedOpticBoard(e.target.value); setSelectedOptic(''); setSelectedPortId(''); setErrorMsg(''); }} style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}>
                <option value="">-- Select Target Cage --</option>
                {availableOpticBoards.map(b => <option key={b.board} value={b.board}>{b.board}</option>)}
              </select>
            ) : (
              <div style={{ fontSize: '11px', color: '#aaa', padding: '4px 0' }}>Target Cage: <strong style={{ color: '#fff' }}>{availableOpticBoards[0]?.board || 'Base Ports'}</strong></div>
            )}
            {!!targetBoard && (
              <select
                value={selectedPortId}
                onChange={e => { setSelectedPortId(e.target.value); setSelectedOptic(''); setErrorMsg(''); }}
                style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}
                title="Optional - pick an exact port instead of letting it auto-assign to the next free one"
              >
                <option value="">-- Auto-assign port --</option>
                {freePortsForBoard.map(p => (
                  <option key={p.id} value={p.id}>{p.id} ({p.cage}{p.licensed ? '' : ', unlicensed'})</option>
                ))}
              </select>
            )}
            <select value={selectedOptic} onChange={e => { setSelectedOptic(e.target.value); setErrorMsg(''); }} style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }} disabled={availableOpticBoards.length === 0 || (availableOpticBoards.length > 1 && !selectedOpticBoard)}>
              <option value="">-- Select Optic --</option>
              {dropdownOptics.map(opt => (
                <option key={opt} value={opt}>
                  {formatOpticLabel(opt)}{isParallelBreakoutOptic(opt) ? ' ⚡ breakout-capable' : ''}
                </option>
              ))}
            </select>
            {feedsBreakoutPanel && (
              <div style={{ fontSize: '10px', color: '#00e5ff', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: '4px', padding: '6px 8px', lineHeight: 1.4 }}>
                ⚡ This board's QSFP cages feed a breakout panel - only parallel-fibre optics (SR4 multimode, PLR4/PSM4/DR4/DR4+ singlemode) are offered for them. LR4/CWDM4/SWDM4/FR4 optics can't be broken out this way. Any SFP cages on this board are unaffected.
              </div>
            )}
            {lcRestriction && (
              <div style={{ fontSize: '10px', color: '#00e5ff', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: '4px', padding: '6px 8px', lineHeight: 1.4 }}>
                {lcRestriction.optics.length > 0
                  ? `⚡ This board's ${lcRestriction.cage} cages are one of a breakout panel's LC legs - only optics matching that group's speed/fibre type are offered for them.`
                  : `⚠️ This board's ${lcRestriction.cage} cages are one of a breakout panel's LC legs, but its MPO side has no valid optic installed yet - fit the parent optic on that chassis first.`}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', color: '#ccc' }}>Qty:</label>
              <input
                type="number"
                min={1}
                value={selectedPortId ? '1' : qtyStr}
                onChange={e => setQtyStr(e.target.value)}
                disabled={!!selectedPortId}
                title={selectedPortId ? 'A pinned port always takes exactly one optic' : undefined}
                style={{ width: '40px', fontSize: '11px', padding: '4px', background: selectedPortId ? '#1a1a1a' : '#222', color: selectedPortId ? '#777' : '#fff', border: '1px solid #444', borderRadius: '3px' }}
              />
              <button onClick={handleAddOptic} style={{ flex: 1, padding: '4px 8px', background: 'rgba(255, 152, 0, 0.2)', border: '1px solid rgba(255, 152, 0, 0.4)', borderRadius: '3px', color: '#ffb74d', fontSize: '11px', cursor: 'pointer' }}>Add Optic</button>
            </div>
            {errorMsg && <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(239, 83, 80, 0.1)', border: '1px solid rgba(239, 83, 80, 0.3)', borderRadius: '4px', color: '#ef5350', fontSize: '11px', whiteSpace: 'pre-wrap' }}>⚠️ {errorMsg}</div>}
          </div>

          {replaceFeedback && (
            <div
              style={{
                marginTop: '10px',
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                background: replaceFeedback.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${replaceFeedback.type === 'success' ? '#22c55e' : '#ef4444'}`,
                color: replaceFeedback.type === 'success' ? '#4ade80' : '#f87171',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{replaceFeedback.type === 'success' ? '✓ ' : '⚠️ '}{replaceFeedback.message}</span>
              <button
                onClick={() => setReplaceFeedback(null)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>
          )}

          {installedOptics.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 6px 0' }}>
                <h5 style={{ margin: 0, fontSize: '11px', color: '#ccc' }}>Installed Optics:</h5>
                <span style={{ fontSize: '10px', color: '#888' }}>Click 🔄 to bulk replace</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {installedOptics.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a', padding: '5px 8px', borderRadius: '4px', fontSize: '10px', border: '1px solid #333' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{opt.qty}x {formatOpticLabel(opt.optic)}</span>
                      <span style={{ color: '#888' }}>
                        {opt.board}
                        {opt.pinnedPortId && <span style={{ color: '#00e5ff' }}> · 📌 {opt.pinnedPortId}</span>}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => handleStartBulkReplace(opt.optic)}
                        style={{
                          background: 'rgba(56, 189, 248, 0.15)',
                          border: '1px solid #38bdf8',
                          color: '#38bdf8',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '10px',
                          padding: '2px 6px',
                          fontWeight: 600,
                        }}
                        title={`Bulk replace all ${opt.optic.split(' ')[0]} transceivers on this chassis or project-wide`}
                      >
                        🔄 Replace
                      </button>
                      <button onClick={() => handleRemoveOptic(i)} style={{ background: 'none', border: 'none', color: '#ef5350', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }} title="Remove Optic">×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bulk Replace Transceiver Modal Dialog */}
          {bulkReplaceSource && (() => {
            const sourceSku = bulkReplaceSource.split(' ')[0].toUpperCase();
            const candidates = getCandidateReplacementOptics(model, bulkReplaceSource);
            const sourceFiber = getOpticFiberType(bulkReplaceSource);
            const targetFiber = bulkReplaceTarget ? getOpticFiberType(bulkReplaceTarget) : '';
            const isFiberChange = sourceFiber !== targetFiber && !!sourceFiber && !!targetFiber;

            const thisNodeCount = installedOptics
              .filter(o => o.optic.split(' ')[0].toUpperCase() === sourceSku)
              .reduce((sum, o) => sum + o.qty, 0);

            const projectCount = nodes
              .filter(n => n.type === NODE_TYPES.HARDWARE && !String(n.data?.model || '').includes('TAP'))
              .reduce((sum, n) => {
                const nOptics = (n.data as HardwareNodeData).optics || [];
                return sum + nOptics.filter(o => o.optic.split(' ')[0].toUpperCase() === sourceSku).reduce((s, o) => s + o.qty, 0);
              }, 0);

            return (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.75)',
                  zIndex: 2000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px',
                }}
              >
                <div
                  style={{
                    background: '#181f2a',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    padding: '16px 20px',
                    width: '460px',
                    maxWidth: '92vw',
                    boxShadow: '0 12px 36px rgba(0,0,0,0.8)',
                    color: '#f3f4f6',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '16px' }}>🔄</span>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#38bdf8' }}>
                        Bulk Replace Transceiver
                      </h4>
                    </div>
                    <button
                      onClick={() => setBulkReplaceSource(null)}
                      style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '16px' }}
                    >
                      ✕
                    </button>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>Current Transceiver:</div>
                    <div style={{ background: '#111827', padding: '8px 10px', borderRadius: '4px', border: '1px solid #374151', fontSize: '12px', color: '#fff', fontWeight: 'bold' }}>
                      {formatOpticLabel(bulkReplaceSource)}
                      <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 'normal', marginTop: '3px' }}>
                        Installed on this chassis: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{thisNodeCount} units</span>
                        {projectCount > thisNodeCount && (
                          <span> • Project-wide: <span style={{ color: '#34d399', fontWeight: 600 }}>{projectCount} units</span></span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>Replace With:</div>
                    {candidates.length > 0 ? (
                      <select
                        value={bulkReplaceTarget}
                        onChange={(e) => setBulkReplaceTarget(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          background: '#111827',
                          border: '1px solid #4b5563',
                          borderRadius: '4px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                      >
                        {candidates.map((c) => (
                          <option key={c} value={c}>
                            {formatOpticLabel(c)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', color: '#f87171', fontSize: '11px' }}>
                        No compatible replacement transceivers found for this cage family.
                      </div>
                    )}
                  </div>

                  {isFiberChange && (
                    <div
                      style={{
                        padding: '10px',
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid #f59e0b',
                        borderRadius: '6px',
                        fontSize: '11px',
                        color: '#fbbf24',
                        lineHeight: '1.4',
                      }}
                    >
                      <div style={{ fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        ⚠️ Fibre Mode Transition: {sourceFiber === 'SM' ? 'Single-mode' : 'Multi-mode'} ➔ {targetFiber === 'SM' ? 'Single-mode' : 'Multi-mode'}
                      </div>
                      <div>
                        Replacing with {targetFiber === 'SM' ? 'Single-mode' : 'Multi-mode'} optics will require matching optical TAP splitters to maintain network link compatibility.
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', cursor: 'pointer', color: '#fff', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={syncConnectedTaps}
                          onChange={(e) => setSyncConnectedTaps(e.target.checked)}
                          style={{ cursor: 'pointer', accentColor: '#f59e0b' }}
                        />
                        Automatically synchronise connected TAP nodes & link allocations to matching {targetFiber === 'SM' ? 'Single-mode' : 'Multi-mode'} media
                      </label>
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>Replacement Scope:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="replaceScope"
                          value="node"
                          checked={bulkReplaceScope === 'node'}
                          onChange={() => setBulkReplaceScope('node')}
                          style={{ accentColor: '#38bdf8' }}
                        />
                        <span>This chassis only (<strong>{selectedNode.data.label || model}</strong> · {thisNodeCount} units)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="replaceScope"
                          value="project"
                          checked={bulkReplaceScope === 'project'}
                          onChange={() => setBulkReplaceScope('project')}
                          style={{ accentColor: '#38bdf8' }}
                        />
                        <span>Project-wide (all chassis and connected TAPs in design · <strong>{projectCount} units</strong>)</span>
                      </label>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px', borderTop: '1px solid #374151', paddingTop: '10px' }}>
                    <button
                      onClick={() => setBulkReplaceSource(null)}
                      className="btn btn-ghost"
                      style={{ fontSize: '11px', padding: '5px 12px', color: '#9ca3af' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleExecuteBulkReplace}
                      disabled={!bulkReplaceTarget}
                      className="btn btn-primary"
                      style={{
                        fontSize: '11px',
                        padding: '5px 14px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        border: '1px solid #34d399',
                        color: '#fff',
                        fontWeight: 'bold',
                        cursor: !bulkReplaceTarget ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Confirm Bulk Replacement
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

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
