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
  style?: React.CSSProperties;
  fillContainer?: boolean;
}

/** A board name of the form "<sku> (Slot N)" identifies a port belonging to an
 *  installed add-in module, as opposed to the chassis's own fixed/base ports. */
const MODULE_BOARD_RE = /\(Slot \d+\)$/;

/** A cage's box, transformed into chassis-image coordinates - directly for the
 *  chassis's own base ports (box already relative to the chassis image), or
 *  nested inside its module's bay box for a port on an installed board.
 *
 *  Distinguishing these by `port.board` rather than `port.slot === '1'`
 *  matters because on GigaVUE-HC3/HC1-Plus etc. the module bays are *also*
 *  numbered starting at 1 - the same sentinel slot value `getChassisPorts()`
 *  uses for the chassis's base ports - so a slot-number check alone can't
 *  tell "this chassis's built-in ports" apart from "the module sitting in
 *  its numbered Slot 1", and previously mis-rendered a Slot 1 module's
 *  fitted-optic markers straight onto the chassis image instead of nesting
 *  them inside that module's own bay. */
function resolveAbsoluteBox(port: ChassisPort, slotPositions: SlotPosition[]): PortBox | undefined {
  if (!port.box) return undefined;
  if (!MODULE_BOARD_RE.test(port.board)) return port.box;
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
  style,
  fillContainer,
}) => (
  <div
    style={{
      position: 'relative',
      width: '100%',
      height: fillContainer ? '100%' : undefined,
      background: '#111',
      lineHeight: 0,
      ...style,
    }}
  >
    <img
      src={chassisImage}
      alt={model}
      style={{
        display: 'block',
        width: '100%',
        height: fillContainer ? '100%' : 'auto',
        objectFit: fillContainer ? 'fill' : undefined,
      }}
    />
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
            left: `${Number((box.x * 100).toFixed(4))}%`,
            top: `${Number((box.y * 100).toFixed(4))}%`,
            width: `${Number((box.width * 100).toFixed(4))}%`,
            height: `${Number((box.height * 100).toFixed(4))}%`,
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
            left: `${Number((abs.x * 100).toFixed(4))}%`,
            top: `${Number((abs.y * 100).toFixed(4))}%`,
            width: `${Number((abs.width * 100).toFixed(4))}%`,
            height: `${Number((abs.height * 100).toFixed(4))}%`,
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
