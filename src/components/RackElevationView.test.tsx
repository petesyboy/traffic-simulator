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
});
