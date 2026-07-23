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
  const installedBoards = hwData.installedBoards || {};
  const installedOptics: InstalledOptic[] = hwData.optics || [];

  // Find catalogue details to get module_slots count
  const details = useMemo(() => {
    if (model?.includes('TA')) return (hardwareCatalogue as any).ta_series?.find((t: { sku: string }) => t.sku === sku) || null;
    if (model?.includes('HC')) return (hardwareCatalogue as any).hc_series?.find((t: { sku: string }) => t.sku === sku) || null;
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

  const slots = [];
  for (let i = 1; i <= details.module_slots; i++) {
    slots.push(
      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
        <label style={{ fontSize: '11px', color: '#ccc' }}>Slot {i}</label>
        <select
          value={installedBoards[i] || ''}
          onChange={e => handleBoardSelect(i, e.target.value)}
          style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}
        >
          <option value="">-- Empty Slot --</option>
          {installableBoards.map(b => (
            <option key={b.board} value={b.board}>{getBoardDescription(b.board, model || '')}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div style={{ borderTop: '1px solid rgba(255, 152, 0, 0.2)', paddingTop: '10px', marginTop: '10px' }}>
      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>Module Slots</h4>
      {slots}
    </div>
  );
};
