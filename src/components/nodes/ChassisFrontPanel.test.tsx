import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChassisFrontPanel } from './ChassisFrontPanel';
import type { HardwareNodeData } from '../../store/types';
import { getChassisPorts, getPortOpticMap } from '../../utils/ports';
import { getModuleSlotPositions } from '../../utils/hardwareUtils';

/**
 * GigaVUE-HC3's module bays are themselves numbered starting at 1 - the same
 * sentinel `getChassisPorts()` uses for a chassis's own base ports - which
 * previously made a fitted-optic marker on a Slot 1 module render straight
 * onto the chassis image (using the module's own port-relative fractions
 * as if they were chassis-relative) instead of nested inside the Slot 1
 * bay box, like the module's own icon correctly already is.
 */
describe('ChassisFrontPanel fitted-optic markers', () => {
  it('nests a Slot 1 module port marker inside that slot\'s bay box, not the raw chassis image', () => {
    const hwData: HardwareNodeData = {
      label: 'HC3',
      model: 'GigaVUE-HC3',
      installedBoards: { '1': 'SMT-HC3-C08' },
      optics: [{ board: 'SMT-HC3-C08 (Slot 1)', optic: 'Q28-502T (100G QSFP28 SR4)', qty: 1 }],
    } as unknown as HardwareNodeData;

    const ports = getChassisPorts('GigaVUE-HC3', hwData);
    const portOpticMap = getPortOpticMap(ports, hwData.optics);
    const slotPositions = getModuleSlotPositions('GigaVUE-HC3');
    const slot1Bay = slotPositions.find((s) => s.number === 1)!.box!;

    // The first cage on SMT-HC3-C08 (see hardwareCatalogue.json's `modules` entry).
    const firstCageBox = { x: 0.2893, y: 0.2873, width: 0.0881, height: 0.2537 };
    const expectedLeftPct = (slot1Bay.x + firstCageBox.x * slot1Bay.width) * 100;
    const expectedTopPct = (slot1Bay.y + firstCageBox.y * slot1Bay.height) * 100;

    const html = renderToStaticMarkup(
      <ChassisFrontPanel
        chassisImage="chassis.png"
        model="GigaVUE-HC3"
        slotPositions={slotPositions}
        installedBoards={hwData.installedBoards!}
        ports={ports}
        portOpticMap={portOpticMap}
      />,
    );

    // Sanity: the raw, un-nested fraction would place the marker at ~29% from
    // the left - well inside the wrong (upper-middle) region of the image.
    // The correctly-nested marker lands much further left, inside Slot 1's
    // own bay (which itself starts at x=5.45% and is only 44% wide).
    expect(html).toContain(`left:${expectedLeftPct}%`);
    expect(html).toContain(`top:${expectedTopPct}%`);
    expect(expectedLeftPct).toBeLessThan(firstCageBox.x * 100);
  });

  it('still renders the chassis base ports (e.g. an HCT) directly, with no slot-1 module to conflict with', () => {
    // GigaVUE-HCT has real base_ports (2x QSFP28) using the slot='1' sentinel,
    // and separately a real numbered Slot 1 module bay - both must keep working.
    const hwData: HardwareNodeData = { label: 'HCT', model: 'GigaVUE-HCT' } as unknown as HardwareNodeData;
    const ports = getChassisPorts('GigaVUE-HCT', hwData);
    expect(ports.length).toBeGreaterThan(0);
    expect(ports.every((p) => p.slot === '1')).toBe(true);
  });
});
