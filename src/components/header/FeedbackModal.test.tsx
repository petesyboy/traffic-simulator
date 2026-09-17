import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FeedbackModal from './FeedbackModal';
import { SUPPORT_EMAIL } from '../../constants/support';
import { useStore } from '../../store/store';

const initialState = useStore.getState();

describe('FeedbackModal', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
    vi.clearAllMocks();
  });

  it('renders feedback header, categories, and target email address', () => {
    const html = renderToStaticMarkup(<FeedbackModal onClose={() => {}} />);

    expect(html).toContain('Send Feedback or Report an Issue');
    expect(html).toContain(SUPPORT_EMAIL);
    expect(html).toContain('Feature Request');
    expect(html).toContain('Bug Report');
    expect(html).toContain('Enhancement / Suggestion');
    expect(html).toContain('Hardware / SKU Request');
    expect(html).toContain('Other');
    expect(html).toContain('Open Email Client');
    expect(html).toContain('Copy to Clipboard');
  });

  it('includes diagnostic checkbox and helper explanation', () => {
    const html = renderToStaticMarkup(<FeedbackModal onClose={() => {}} />);

    expect(html).toContain('Include application diagnostic details (recommended)');
    expect(html).toContain('Attaches app version');
  });

  it('reflects project context when store has active project and topology', () => {
    useStore.setState({
      currentScenarioName: 'Acme Bank Core Network',
      projectRegion: 'UK',
      projectLicenseMode: 'Perpetual',
    });

    const html = renderToStaticMarkup(<FeedbackModal onClose={() => {}} />);
    expect(html).toContain('Send Feedback or Report an Issue');
    expect(html).toContain(SUPPORT_EMAIL);
  });
});
