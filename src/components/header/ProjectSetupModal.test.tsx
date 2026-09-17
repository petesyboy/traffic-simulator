import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ProjectSetupModal from './ProjectSetupModal';
import { useStore } from '../../store/store';

const initialState = useStore.getState();

describe('ProjectSetupModal', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
    vi.clearAllMocks();
  });

  it('renders modal with default name Untitled Project', () => {
    const html = renderToStaticMarkup(
      <ProjectSetupModal onConfirm={() => {}} onCancel={() => {}} />,
    );

    expect(html).toContain('Set Up New Project');
    expect(html).toContain('value="Untitled Project"');
    expect(html).not.toContain('Please specify a descriptive customer or project name');
  });

  it('renders custom initialName if provided', () => {
    const html = renderToStaticMarkup(
      <ProjectSetupModal
        initialName="Untitled Project"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(html).toContain('value="Untitled Project"');
  });
});
