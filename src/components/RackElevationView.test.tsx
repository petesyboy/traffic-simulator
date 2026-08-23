import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RackElevationView from './RackElevationView';
import { useStore } from '../store/store';
import type { CustomNode } from '../store/types';

const initialState = useStore.getState();

describe('RackElevationView', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
  });

  it('renders site selector and zoom controls with default 100% and preset buttons', () => {
    const html = renderToStaticMarkup(<RackElevationView />);

    expect(html).toContain('📍 Select Site:');
    expect(html).toContain('🔍 Zoom:');
    expect(html).toContain('100%');
    expect(html).toContain('75%');
    expect(html).toContain('150%');
    expect(html).toContain('200%');
    expect(html).toContain('(Ctrl + Scroll)');
    expect(html).toContain('Hide Labels');
    expect(html).toContain('⚡ Auto-Deploy');
    expect(html).toContain('✕ Clear Rack');
  });

  it('renders racked hardware with front panel, inspect button, and rack metrics', () => {
    const node: CustomNode = {
      id: 'hc1-node',
      type: 'hardwareNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Core Aggregation HC1',
        model: 'GigaVUE-HC1',
        sku: 'GVS-HC101',
        site: 'Primary DC',
        rackId: 'rack_Primary DC',
        rackU: 20,
        image: 'GigaVUE-HC1.png',
        optics: [
          { board: 'Base Ports', optic: 'SFP-532T (10G SFP+ SR)', qty: 2 },
        ],
      } as unknown as CustomNode['data'],
    };

    const html = renderToStaticMarkup(<RackElevationView nodes={[node]} />);

    expect(html).toContain('Primary DC');
    expect(html).toContain('GigaVUE-HC1');
    expect(html).toContain('Core Aggregation HC1');
    expect(html).toContain('Inspect chassis details and front panel');
    expect(html).toContain('Remove from Rack');
  });

  it('renders TAP-M200T 1U tray with 2 rows of 3 bays and slotted TAP modules', () => {
    const trayNode: CustomNode = {
      id: 'tray-node',
      type: 'hardwareNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Main TAP Tray',
        model: 'TAP-M200T',
        sku: 'TAP-M200T',
        site: 'Primary DC',
        rackId: 'rack_Primary DC',
        rackU: 10,
        image: 'TAP-M200T.png',
      } as unknown as CustomNode['data'],
    };

    const moduleTop: CustomNode = {
      id: 'mod-1',
      type: 'hardwareNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Bay 1 Module',
        model: 'TAP-M253T',
        sku: 'TAP-M253T',
        site: 'Primary DC',
        trayId: 'tray-node',
        traySlot: 1,
      } as unknown as CustomNode['data'],
    };

    const moduleBottom: CustomNode = {
      id: 'mod-5',
      type: 'hardwareNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Bay 5 Module',
        model: 'PNL-M341T',
        sku: 'PNL-M341T',
        site: 'Primary DC',
        trayId: 'tray-node',
        traySlot: 5,
      } as unknown as CustomNode['data'],
    };

    const html = renderToStaticMarkup(<RackElevationView nodes={[trayNode, moduleTop, moduleBottom]} />);

    expect(html).toContain('TAP-M253T');
    expect(html).toContain('PNL-M341T');
    expect(html).toContain('Bay 1: TAP-M253T - Bay 1 Module (click to remove)');
    expect(html).toContain('Bay 5: PNL-M341T - Bay 5 Module (click to remove)');
    expect(html).toContain('Remove tray from rack');
  });

  it('excludes custom tools and probes (e.g. Ericsson probes) from Unracked Hardware', () => {
    const probeNode: CustomNode = {
      id: 'ericsson-probe-1',
      type: 'toolNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Ericsson Probe 1',
        toolName: 'Ericsson Probe',
        configType: 'Packet Tool',
        site: 'Primary DC',
      } as unknown as CustomNode['data'],
    };

    const html = renderToStaticMarkup(<RackElevationView nodes={[probeNode]} />);

    expect(html).not.toContain('Ericsson Probe 1');
    expect(html).toContain('All site hardware is racked.');
  });
});
