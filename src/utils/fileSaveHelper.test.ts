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

  it('uses showSaveFilePicker when available and executes lazy generator only after handle is acquired', async () => {
    const writeMock = vi.fn().mockResolvedValue(undefined);
    const closeMock = vi.fn().mockResolvedValue(undefined);
    const createWritableMock = vi.fn().mockResolvedValue({
      write: writeMock,
      close: closeMock,
    });
    const handleMock = {
      name: 'CustomLocationFile.pdf',
      createWritable: createWritableMock,
    };
    const showSaveFilePickerMock = vi.fn().mockResolvedValue(handleMock);

    (globalThis as unknown as Record<string, unknown>).window = {
      showSaveFilePicker: showSaveFilePickerMock,
    };

    let generatorExecuted = false;
    const generator = vi.fn().mockImplementation(async () => {
      generatorExecuted = true;
      return new Blob(['test-pdf-bytes'], { type: 'application/pdf' });
    });

    const result = await saveWithFilePickerOrPrompt(generator, 'DefaultReport.pdf', {
      extension: '.pdf',
      mimeType: 'application/pdf',
      description: 'PDF Report',
    });

    expect(showSaveFilePickerMock).toHaveBeenCalledWith({
      suggestedName: 'DefaultReport.pdf',
      types: [
        {
          description: 'PDF Report',
          accept: {
            'application/pdf': ['.pdf'],
          },
        },
      ],
    });
    expect(generator).toHaveBeenCalled();
    expect(generatorExecuted).toBe(true);
    expect(createWritableMock).toHaveBeenCalled();
    expect(writeMock).toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalled();
    expect(result.saved).toBe(true);
    expect(result.filename).toBe('CustomLocationFile.pdf');
  });

  it('handles user cancellation in showSaveFilePicker without executing generator', async () => {
    const abortErr = new Error('The user aborted a request.');
    abortErr.name = 'AbortError';
    const showSaveFilePickerMock = vi.fn().mockRejectedValue(abortErr);

    (globalThis as unknown as Record<string, unknown>).window = {
      showSaveFilePicker: showSaveFilePickerMock,
    };

    const generator = vi.fn().mockResolvedValue('data');

    const result = await saveWithFilePickerOrPrompt(generator, 'DefaultReport.pdf', {
      extension: '.pdf',
      mimeType: 'application/pdf',
    });

    expect(result.saved).toBe(false);
    expect(result.cancelled).toBe(true);
    expect(generator).not.toHaveBeenCalled();
  });
});

