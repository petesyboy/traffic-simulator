import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChassisFaceplate } from './ChassisFaceplate';
import type { CustomNode, HardwareNodeData } from '../../store/types';
import { getChassisPorts, getPortOccupancy } from '../../utils/ports';
import { syncPortAssignments } from '../../utils/portSync';

const hw = (data: Partial<HardwareNodeData>): HardwareNodeData => data as HardwareNodeData;

/** Count the coloured port cells by their inline background colour. */
const countByColour = (html: string, rgb: string) =>
  html.split(`background:${rgb}`).length - 1;

const CYAN = '#00e5ff';   // linked
const AMBER = '#ff9800';  // optic fitted, not connected
const GREY = '#2a2a2a';   // empty licensed cage

describe('ChassisFaceplate', () => {
  it('renders one cell per physical port of a TA25E', () => {
    const ports = getChassisPorts('GigaVUE-TA25E', hw({}));
    const html = renderToStaticMarkup(<ChassisFaceplate ports={ports} occupancy={new Map()} />);

    // 56 cages, all empty and licensed.
    expect(countByColour(html, GREY)).toBe(56);
    expect(html).toContain('56 free');
    expect(html).toContain('QSFP');
    expect(html).toContain('SFP');
  });

  it('shows the 4-link TAP scenario as 8 linked ports with useful tooltips', () => {
    const tap: CustomNode = {
      id: 'tap', type: 'hardwareNode', position: { x: 0, y: 0 },
      data: { label: 'Edge TAP', model: 'G-TAP A-SF2', tappedLinkAllocations: [{ qty: 4, optic: 'SFP-532T (10G SFP+ SR)' }] },
    } as CustomNode;
    const ta: CustomNode = {
      id: 'ta', type: 'hardwareNode', position: { x: 0, y: 0 },
      data: {
        label: 'Core TA25E', model: 'GigaVUE-TA25E',
        optics: [{ board: 'Base Ports', optic: 'SFP-532T (10G SFP+ SR)', qty: 8 }],
      },
    } as CustomNode;

    const nodes = [tap, ta];
    const edges = syncPortAssignments(nodes, [{ id: 'e1', source: 'tap', target: 'ta' }]);

    const ports = getChassisPorts('GigaVUE-TA25E', ta.data as HardwareNodeData);
    const occupancy = getPortOccupancy(ta, nodes, edges, ports);
    const html = renderToStaticMarkup(<ChassisFaceplate ports={ports} occupancy={occupancy} />);

    // 8 ports carrying the tapped links, 48 still empty.
    expect(countByColour(html, CYAN)).toBe(8);
    expect(countByColour(html, GREY)).toBe(48);
    expect(html).toContain('8 linked');
    expect(html).toContain('48 free');

    // Tooltips name the port, its optic and what it reaches.
    expect(html).toContain('1/1/x1 — SFP-532T (10G SFP+ SR) → Edge TAP');
    expect(html).toContain('1/1/x8 — SFP-532T (10G SFP+ SR) → Edge TAP');
    expect(html).toContain('1/1/x9 — empty cage');
  });

  it('distinguishes a fitted-but-unconnected optic from a linked one', () => {
    const ta: CustomNode = {
      id: 'ta', type: 'hardwareNode', position: { x: 0, y: 0 },
      data: { label: 'TA25E', model: 'GigaVUE-TA25E', optics: [{ board: 'Base Ports', optic: 'SFP-532T (10G SFP+ SR)', qty: 3 }] },
    } as CustomNode;

    const ports = getChassisPorts('GigaVUE-TA25E', ta.data as HardwareNodeData);
    const html = renderToStaticMarkup(
      <ChassisFaceplate ports={ports} occupancy={getPortOccupancy(ta, [ta], [], ports)} />,
    );

    expect(countByColour(html, AMBER)).toBe(3);
    expect(countByColour(html, CYAN)).toBe(0);
    expect(html).toContain('3 fitted');
    // A fitted port names its optic and, with no peer to show, says so explicitly
    // rather than reading like it's connected just because an optic is present.
    expect(html).toContain('1/1/x1 — SFP-532T (10G SFP+ SR) (fitted but unused)"');
    expect(html).toContain('1/1/x4 — empty cage');
  });

  it('marks ports outside the licence tier as unlicensed', () => {
    const ports = getChassisPorts('GigaVUE-TA25E', hw({ portCapacity: 'Quarter' }));
    const html = renderToStaticMarkup(<ChassisFaceplate ports={ports} occupancy={new Map()} />);

    // 12 SFP + 2 QSFP licensed, the remaining 42 shown but inert.
    expect(html).toContain('14 free');
    expect(html).toContain('42 unlicensed');
    expect(html).toContain('not licensed');
  });

  it('groups an HC3 by module so each slot reads separately', () => {
    const ports = getChassisPorts('GigaVUE-HC3', hw({ installedBoards: { '1': 'PRT-HC3-C16', '2': 'SMT-HC3-C05' } }));
    const html = renderToStaticMarkup(<ChassisFaceplate ports={ports} occupancy={new Map()} />);

    expect(html).toContain('PRT-HC3-C16 (Slot 1)');
    expect(html).toContain('SMT-HC3-C05 (Slot 2)');
    expect(html).toContain('1/1/c16');
    expect(html).toContain('1/2/c5');
  });

  it('renders nothing for a chassis with no ports, so TAPs stay unaffected', () => {
    expect(renderToStaticMarkup(<ChassisFaceplate ports={[]} occupancy={new Map()} />)).toBe('');
  });

  it('renders a breakout panel with its own MPO row alongside the LC (SFP-family) row', () => {
    const ports = getChassisPorts('PNL-M341T', hw({}));
    const html = renderToStaticMarkup(<ChassisFaceplate ports={ports} occupancy={new Map()} />);

    expect(html).toContain('MPO');
    expect(countByColour(html, GREY)).toBe(15); // 3 MPO + 12 LC, all unwired
  });

  it('renders a TA200 64-port QSFP faceplate in two stacked rows of 32', () => {
    const ports = getChassisPorts('GigaVUE-TA200E', hw({ portCapacity: 'Half' }));
    const html = renderToStaticMarkup(<ChassisFaceplate ports={ports} occupancy={new Map()} />);

    expect(html).toContain('QSFP');
    expect(ports.length).toBe(64);
    // 32 ports licensed (grey), 32 unlicensed (red)
    expect(countByColour(html, GREY)).toBe(32);
    expect(html).toContain('32 free');
    expect(html).toContain('32 unlicensed');

    // Both top row (odd ports) and bottom row (even ports) are rendered
    expect(html).toContain('1/1/c1');
    expect(html).toContain('1/1/c2');
    expect(html).toContain('1/1/c63');
    expect(html).toContain('1/1/c64');
  });

  it('renders TA25E 48 SFP ports in 3 physical rows of 16', () => {
    const ports = getChassisPorts('GigaVUE-TA25E', hw({}));
    const sfpPorts = ports.filter((p) => p.cage === 'SFP');
    expect(sfpPorts.length).toBe(48);

    const html = renderToStaticMarkup(<ChassisFaceplate ports={ports} occupancy={new Map()} />);
    expect(html).toContain('SFP');
    expect(html).toContain('QSFP');

    // Ports x1 (top), x2 (mid), x3 (bot) exist in respective rows
    expect(html).toContain('1/1/x1');
    expect(html).toContain('1/1/x2');
    expect(html).toContain('1/1/x3');
    expect(html).toContain('1/1/x46');
    expect(html).toContain('1/1/x47');
    expect(html).toContain('1/1/x48');
  });
});
