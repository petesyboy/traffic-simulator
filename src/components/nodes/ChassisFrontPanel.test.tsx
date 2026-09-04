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
    expect(html).toContain(`left:${Number(expectedLeftPct.toFixed(4))}%`);
    expect(html).toContain(`top:${Number(expectedTopPct.toFixed(4))}%`);
    expect(expectedLeftPct).toBeLessThan(firstCageBox.x * 100);
  });

  it('renders fitted-optic markers for HCT base ports and nested Slot 1 module ports concurrently', () => {
    const hwData: HardwareNodeData = {
      label: 'HCT',
      model: 'GigaVUE-HCT',
      installedBoards: { '1': 'PRT-HC1-X12' },
      optics: [
        { board: 'Base', optic: 'Q28-502T (100G QSFP28 SR4)', qty: 1 },
        { board: 'PRT-HC1-X12 (Slot 1)', optic: 'SFP-532T (10G SFP+ SR)', qty: 1 },
      ],
    } as unknown as HardwareNodeData;

    const ports = getChassisPorts('GigaVUE-HCT', hwData);
    const portOpticMap = getPortOpticMap(ports, hwData.optics);
    const slotPositions = getModuleSlotPositions('GigaVUE-HCT');

    const html = renderToStaticMarkup(
      <ChassisFrontPanel
        chassisImage="hct.png"
        model="GigaVUE-HCT"
        slotPositions={slotPositions}
        installedBoards={hwData.installedBoards!}
        ports={ports}
        portOpticMap={portOpticMap}
      />,
    );

    // HCT base QSFP28 box at x: 61.2%
    expect(html).toContain('left:61.2%');
    expect(html).toContain('top:28%');
  });

  it('renders fitted-optic markers for TA25E fixed SFP28 and QSFP28 ports', () => {
    const hwData: HardwareNodeData = {
      label: 'TA25E',
      model: 'GigaVUE-TA25E',
      optics: [
        { board: 'Base', optic: 'SFP-532T (10G SFP+ SR)', qty: 1 },
        { board: 'Base', optic: 'Q28-502T (100G QSFP28 SR4)', qty: 1 },
      ],
    } as unknown as HardwareNodeData;

    const ports = getChassisPorts('GigaVUE-TA25E', hwData);
    const portOpticMap = getPortOpticMap(ports, hwData.optics);
    const slotPositions = getModuleSlotPositions('GigaVUE-TA25E');

    const html = renderToStaticMarkup(
      <ChassisFrontPanel
        chassisImage="ta25e.png"
        model="GigaVUE-TA25E"
        slotPositions={slotPositions}
        installedBoards={{}}
        ports={ports}
        portOpticMap={portOpticMap}
      />,
    );

    expect(html).toContain('left:8.02%');
    expect(html).toContain('left:68.27%');
  });

  it('renders fitted-optic markers for TA200 fixed QSFP28 ports', () => {
    const hwData: HardwareNodeData = {
      label: 'TA200',
      model: 'GigaVUE-TA200',
      optics: [
        { board: 'Base', optic: 'Q28-502T (100G QSFP28 SR4)', qty: 2 },
      ],
    } as unknown as HardwareNodeData;

    const ports = getChassisPorts('GigaVUE-TA200', hwData);
    const portOpticMap = getPortOpticMap(ports, hwData.optics);
    const slotPositions = getModuleSlotPositions('GigaVUE-TA200');

    const html = renderToStaticMarkup(
      <ChassisFrontPanel
        chassisImage="ta200.png"
        model="GigaVUE-TA200"
        slotPositions={slotPositions}
        installedBoards={{}}
        ports={ports}
        portOpticMap={portOpticMap}
      />,
    );

    expect(html).toContain('left:7.5%');
    expect(html).toContain('top:26.5%');
    expect(html).toContain('top:57.5%');
  });

  it('correctly nests PRT-HC1-G12 module SFP cages when installed in HC1 Slot 2', () => {
    const hwData: HardwareNodeData = {
      label: 'HC1',
      model: 'GigaVUE-HC1',
      installedBoards: { '2': 'PRT-HC1-G12' },
      optics: [
        { board: 'PRT-HC1-G12 (Slot 2)', optic: 'SFP-532T (10G SFP+ SR)', qty: 1 },
      ],
    } as unknown as HardwareNodeData;

    const ports = getChassisPorts('GigaVUE-HC1', hwData);
    const portOpticMap = getPortOpticMap(ports, hwData.optics);
    const slotPositions = getModuleSlotPositions('GigaVUE-HC1');
    const slot2Bay = slotPositions.find((s) => s.number === 2)!.box!;

    const firstSfpBox = { x: 0.5568, y: 0.2350, width: 0.1179, height: 0.2100 };
    const expectedLeftPct = (slot2Bay.x + firstSfpBox.x * slot2Bay.width) * 100;

    const html = renderToStaticMarkup(
      <ChassisFrontPanel
        chassisImage="hc1.png"
        model="GigaVUE-HC1"
        slotPositions={slotPositions}
        installedBoards={hwData.installedBoards!}
        ports={ports}
        portOpticMap={portOpticMap}
      />,
    );

    expect(html).toContain(`left:${expectedLeftPct.toFixed(4)}%`);
  });

  it('renders correctly aligned fitted-optic markers for GigaVUE-TA200E QSFP28 cages', () => {
    const hwData: HardwareNodeData = {
      label: 'TA200E',
      model: 'GigaVUE-TA200E',
      optics: [
        { board: 'Base', optic: 'Q28-502T (100G QSFP28 SR4)', qty: 4 },
      ],
    } as unknown as HardwareNodeData;

    const ports = getChassisPorts('GigaVUE-TA200E', hwData);
    const portOpticMap = getPortOpticMap(ports, hwData.optics);
    const slotPositions = getModuleSlotPositions('GigaVUE-TA200E');

    const html = renderToStaticMarkup(
      <ChassisFrontPanel
        chassisImage="ta200e.png"
        model="GigaVUE-TA200E"
        slotPositions={slotPositions}
        installedBoards={{}}
        ports={ports}
        portOpticMap={portOpticMap}
      />,
    );

    // Port c1 (Col 1, Row 1 - Tier 1 Top)
    expect(html).toContain('left:10.52%');
    expect(html).toContain('top:14.06%');
    // Port c2 (Col 1, Row 2 - Tier 1 Bottom)
    expect(html).toContain('top:34.38%');
  });
});

