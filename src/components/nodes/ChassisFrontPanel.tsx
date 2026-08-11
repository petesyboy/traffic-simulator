/**
 * ChassisFrontPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Composites a chassis's front-panel photo with the faceplate image of whatever
 * module is fitted in each bay, positioned by the slot's `box` from the hardware
 * catalogue. Used inline in the chassis summary and, at native resolution, in the
 * enlarged view - so the two can never drift apart.
 */

import React from 'react';
import type { ChassisPort, HardwareNodeData, PortBox } from '../../store/types';
import { getBoardIcon } from '../../utils/hardwareUtils';
import { resolveHardwareIcon } from '../../assets/hardwareIcons';

export interface SlotPosition {
  number: number;
  label: string;
  box?: PortBox;
}

interface ChassisFrontPanelProps {
  chassisImage: string;
  model: string;
  slotPositions: SlotPosition[];
  installedBoards: NonNullable<HardwareNodeData['installedBoards']>;
  /** When provided (with `portOpticMap`), draws a translucent "fitted" marker over
   *  every cage that's calibrated (has a `box`) and currently holds an optic - only
   *  the boards that have been pixel-calibrated in the catalogue show anything. */
  ports?: ChassisPort[];
  portOpticMap?: Map<string, string>;
}

/** A cage's box, transformed into chassis-image coordinates - directly for base ports
 *  (slot '1', box already relative to the chassis image), or nested inside its
 *  module's bay box for a board in a slot (box relative to the module's own image). */
function resolveAbsoluteBox(port: ChassisPort, slotPositions: SlotPosition[]): PortBox | undefined {
  if (!port.box) return undefined;
  if (port.slot === '1') return port.box;
  const bay = slotPositions.find(s => String(s.number) === port.slot)?.box;
  if (!bay) return undefined;
  return {
    x: bay.x + port.box.x * bay.width,
    y: bay.y + port.box.y * bay.height,
    width: port.box.width * bay.width,
    height: port.box.height * bay.height,
  };
}

export const ChassisFrontPanel: React.FC<ChassisFrontPanelProps> = ({
  chassisImage,
  model,
  slotPositions,
  installedBoards,
  ports,
  portOpticMap,
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
    {ports && portOpticMap && ports.map(port => {
      const optic = portOpticMap.get(port.id);
      if (!optic) return null;
      const abs = resolveAbsoluteBox(port, slotPositions);
      if (!abs) return null;
      return (
        <div
          key={port.id}
          title={`${port.id}: ${optic}`}
          style={{
            position: 'absolute',
            left: `${abs.x * 100}%`,
            top: `${abs.y * 100}%`,
            width: `${abs.width * 100}%`,
            height: `${abs.height * 100}%`,
            // Blue + a checkmark glyph rather than a green outline: blue-on-orange
            // keeps working under red-green colour vision deficiency (protanopia/
            // deuteranopia), where green markers can wash out against this chassis
            // orange, and the glyph means "fitted" doesn't rely on colour at all.
            background: 'rgba(0, 40, 90, 0.6)',
            border: '2px solid #29b6f6',
            borderRadius: '2px',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
          }}
        >
          <svg viewBox="0 0 24 24" style={{ width: '65%', height: '65%' }} fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 12 10 18 20 6" />
          </svg>
        </div>
      );
    })}
  </div>
);
