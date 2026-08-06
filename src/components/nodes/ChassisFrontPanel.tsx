/**
 * ChassisFrontPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Composites a chassis's front-panel photo with the faceplate image of whatever
 * module is fitted in each bay, positioned by the slot's `box` from the hardware
 * catalogue. Used inline in the chassis summary and, at native resolution, in the
 * enlarged view - so the two can never drift apart.
 */

import React from 'react';
import type { HardwareNodeData } from '../../store/types';
import { getBoardIcon } from '../../utils/hardwareUtils';
import { resolveHardwareIcon } from '../../assets/hardwareIcons';

export interface SlotPosition {
  number: number;
  label: string;
  box?: { x: number; y: number; width: number; height: number };
}

interface ChassisFrontPanelProps {
  chassisImage: string;
  model: string;
  slotPositions: SlotPosition[];
  installedBoards: NonNullable<HardwareNodeData['installedBoards']>;
}

export const ChassisFrontPanel: React.FC<ChassisFrontPanelProps> = ({
  chassisImage,
  model,
  slotPositions,
  installedBoards,
}) => (
  <div style={{ position: 'relative', width: '100%', background: '#111', lineHeight: 0 }}>
    <img src={chassisImage} alt={model} style={{ display: 'block', width: '100%', height: 'auto' }} />
    {slotPositions.map(({ number, label, box }) => {
      const boardName = installedBoards[number];
      const rawIcon = boardName ? getBoardIcon(boardName) : undefined;
      const moduleIcon = rawIcon ? resolveHardwareIcon(rawIcon) : undefined;
      if (!moduleIcon || !box) return null;
      return (
        <img
          key={number}
          src={moduleIcon}
          alt={boardName}
          title={`Slot ${number}${label ? ` (${label})` : ''}: ${boardName}`}
          style={{
            position: 'absolute',
            left: `${box.x * 100}%`,
            top: `${box.y * 100}%`,
            width: `${box.width * 100}%`,
            height: `${box.height * 100}%`,
            objectFit: 'fill',
          }}
        />
      );
    })}
  </div>
);
