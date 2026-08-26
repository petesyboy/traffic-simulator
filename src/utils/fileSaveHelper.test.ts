import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveWithFilePickerOrPrompt } from './fileSaveHelper';

describe('fileSaveHelper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete (globalThis as unknown as Record<string, unknown>).window;
  });

  it('falls back to window.prompt and downloads with user confirmed filename', async () => {
    const promptMock = vi.fn().mockReturnValue('MyCustomQuote.json');
    (globalThis as unknown as Record<string, unknown>).window = {
      prompt: promptMock,
    };

    const result = await saveWithFilePickerOrPrompt('{"test":123}', 'DefaultQuote.json', {
      extension: '.json',
      mimeType: 'application/json',
    });

    expect(result.saved).toBe(true);
    expect(result.filename).toBe('MyCustomQuote.json');
    expect(promptMock).toHaveBeenCalledWith(
      'Save as file name (enter name to save or overwrite):',
      'DefaultQuote.json',
    );
  });

  it('appends extension if missing in user prompt input', async () => {
    const promptMock = vi.fn().mockReturnValue('MyCustomQuote');
    (globalThis as unknown as Record<string, unknown>).window = {
      prompt: promptMock,
    };

    const result = await saveWithFilePickerOrPrompt('{"test":123}', 'DefaultQuote.json', {
      extension: '.json',
      mimeType: 'application/json',
    });

    expect(result.saved).toBe(true);
    expect(result.filename).toBe('MyCustomQuote.json');
  });

  it('cancels gracefully if user clicks cancel on prompt', async () => {
    const promptMock = vi.fn().mockReturnValue(null);
    (globalThis as unknown as Record<string, unknown>).window = {
      prompt: promptMock,
    };

    const result = await saveWithFilePickerOrPrompt('{"test":123}', 'DefaultQuote.json', {
      extension: '.json',
      mimeType: 'application/json',
    });

    expect(result.saved).toBe(false);
    expect(result.cancelled).toBe(true);
  });
});
