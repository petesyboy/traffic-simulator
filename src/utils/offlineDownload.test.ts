import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadOfflineApp } from './offlineDownload';
import * as fileSaveHelper from './fileSaveHelper';

describe('offlineDownload', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches standalone HTML when available and saves with versioned filename', async () => {
    const mockHtml = '<!DOCTYPE html><html><head><title>Test</title></head><body>App</body></html>';
    const mockSave = vi.spyOn(fileSaveHelper, 'saveWithFilePickerOrPrompt').mockResolvedValue({
      saved: true,
      filename: 'traffic-reduction-simulator-v1.0.787.html',
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    });

    const result = await downloadOfflineApp('1.0.787');
    expect(result.success).toBe(true);
    expect(result.source).toBe('fetch');
    expect(mockSave).toHaveBeenCalledWith(
      mockHtml,
      'traffic-reduction-simulator-v1.0.787.html',
      expect.objectContaining({ extension: '.html' }),
    );
  });

  it('falls back to DOM serialization when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    // Mock DOM elements
    const mockDoc = {
      doctype: { name: 'html', publicId: '', systemId: '' },
      documentElement: { outerHTML: '<html><head></head><body>Live App</body></html>' },
    };
    vi.stubGlobal('document', mockDoc);

    const mockSave = vi.spyOn(fileSaveHelper, 'saveWithFilePickerOrPrompt').mockResolvedValue({
      saved: true,
      filename: 'traffic-reduction-simulator-v1.0.787.html',
    });

    const result = await downloadOfflineApp('1.0.787');
    expect(result.success).toBe(true);
    expect(result.source).toBe('dom-serialization');
    expect(mockSave).toHaveBeenCalledWith(
      expect.stringContaining('Live App'),
      'traffic-reduction-simulator-v1.0.787.html',
      expect.any(Object),
    );
  });
});
