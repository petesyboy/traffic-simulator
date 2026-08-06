import React, { useMemo, useCallback } from 'react';
import type { CustomNode } from '../../../store/store';
import type { BaseNodeData, HardwareNodeData, InstalledOptic } from '../../../store/types';
import { getSupportedBoards } from '../../../utils/opticValidation';
import { getBoardDescription } from '../../../utils/hardwareUtils';
import hardwareCatalogue from '../../../constants/hardwareCatalogue.json';

interface BoardSlotsPanelProps {
  selectedNode: CustomNode;
  updateNodeData: (nodeId: string, data: Partial<BaseNodeData>) => void;
}

export const BoardSlotsPanel: React.FC<BoardSlotsPanelProps> = ({ selectedNode, updateNodeData }) => {
  const model = selectedNode.data?.model as string;
  const sku = selectedNode.data?.sku as string;
  const hwData = selectedNode.data as HardwareNodeData;
  const installedBoards = useMemo(() => hwData.installedBoards || {}, [hwData.installedBoards]);
  const installedOptics: InstalledOptic[] = useMemo(() => hwData.optics || [], [hwData.optics]);

  // Find catalogue details to get module_slots count (only hc_series entries have it)
  const details = useMemo((): { model?: string; module_slots?: number; module_slot_positions?: { number: number; label: string }[] } | null => {
    if (model?.includes('TA')) return hardwareCatalogue.ta_series?.find((t) => t.sku === sku) || null;
    if (model?.includes('HC')) return hardwareCatalogue.hc_series?.find((t) => t.sku === sku) || null;
    return null;
  }, [model, sku]);

  const supportedBoards = useMemo(() => {
    return getSupportedBoards(model || '', hwData.portCapacity as string, installedOptics);
  }, [model, hwData.portCapacity, installedOptics]);

  const installableBoards = useMemo(() => {
    return supportedBoards.filter(b => !b.board.toLowerCase().includes('main') && !b.board.toLowerCase().includes('base'));
  }, [supportedBoards]);

  const handleBoardSelect = useCallback((slotIndex: number, boardName: string) => {
    const newBoards = { ...installedBoards };
    if (boardName) {
      newBoards[slotIndex] = boardName;
    } else {
      delete newBoards[slotIndex];
    }

    const slotSuffix = `(Slot ${slotIndex})`;
    const nextOptics = installedOptics.filter(opt => !opt.board.includes(slotSuffix));

    updateNodeData(selectedNode.id, {
      installedBoards: newBoards,
      optics: nextOptics
    });
  }, [installedBoards, installedOptics, selectedNode.id, updateNodeData]);

  // Checked after all hooks above so this component always calls the same hooks on every
  // render, regardless of node type - an early return before a hook call here previously
  // caused "Rendered more hooks than during the previous render" (React error #310) when
  // switching the selected node between a chassis with module_slots (HC-series) and one
  // without (TA-series) while this panel stayed mounted.
  if (!details?.module_slots) return null;

  // Slot numbers reflect the chassis's physical silkscreen numbering, which isn't always
  // a plain 1..N sequence - e.g. HC1/HC1-Plus reserve slot 1 for the fixed base chassis,
  // so their two expansion bays are physically numbered 2 (left) and 3 (right).
  const slotPositions =
    details.module_slot_positions ||
    Array.from({ length: details.module_slots }, (_, i) => ({ number: i + 1, label: '' }));

  const slots = slotPositions.map(({ number, label }) => (
    <div key={number} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
      <label style={{ fontSize: '11px', color: '#ccc' }}>
        Slot {number}
        {label && <span style={{ color: '#888' }}> ({label})</span>}
      </label>
      <select
        value={installedBoards[number] || ''}
        onChange={e => handleBoardSelect(number, e.target.value)}
        style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}
      >
        <option value="">-- Empty Slot --</option>
        {installableBoards.map(b => (
          <option key={b.board} value={b.board}>{getBoardDescription(b.board, model || '')}</option>
        ))}
      </select>
    </div>
  ));

  return (
    <div className="panel-section">
      <h3 className="text-base font-semibold mb-2">🧩 Module Slots</h3>
      {slots}
    </div>
  );
};
