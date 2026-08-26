/**
 * fileSaveHelper.ts
 *
 * Provides file saving functionality that prompts the user with the native OS
 * "Save As" file picker (supporting directory selection and overwriting existing files),
 * with a graceful window.prompt() fallback for browsers or file:// contexts without File System Access API.
 */

export interface FilePickerTypeOption {
  description: string;
  mimeType: string;
  extension: string;
}

export interface SaveFileResult {
  saved: boolean;
  filename: string;
  cancelled?: boolean;
}

/**
 * Saves a Blob or string to disk, asking the user for a filename / location.
 *
 * 1. Uses window.showSaveFilePicker when available, which opens the native OS Save dialog
 *    allowing the user to overwrite existing files or select a target folder.
 * 2. Falls back to window.prompt() to ask for a filename before triggering a standard download.
 *
 * @param content The file content as a Blob or UTF-8 string
 * @param defaultFilename The suggested initial filename
 * @param options Description, MIME type, and extension for the file picker
 */
export async function saveWithFilePickerOrPrompt(
  content: Blob | string,
  defaultFilename: string,
  options?: Partial<FilePickerTypeOption>,
): Promise<SaveFileResult> {
  const ext = options?.extension || (defaultFilename.includes('.') ? '.' + defaultFilename.split('.').pop()! : '');
  const mime = options?.mimeType || (content instanceof Blob ? content.type : 'application/octet-stream') || 'application/octet-stream';
  const desc = options?.description || 'File';

  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content;

  // 1. Try modern File System Access API (supported in Chrome/Edge on macOS, Windows, Linux)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as unknown as {
        showSaveFilePicker: (pickerOptions: {
          suggestedName: string;
          types: { description: string; accept: Record<string, string[]> }[];
        }) => Promise<FileSystemFileHandle>;
      }).showSaveFilePicker({
        suggestedName: defaultFilename,
        types: [
          {
            description: desc,
            accept: {
              [mime]: [ext],
            },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();

      return {
        saved: true,
        filename: handle.name,
      };
    } catch (err: unknown) {
      // AbortError indicates user clicked "Cancel" in the native OS Save dialog
      if (err instanceof Error && err.name === 'AbortError') {
        return {
          saved: false,
          filename: defaultFilename,
          cancelled: true,
        };
      }
      // Otherwise (e.g. SecurityError on file:// origin), fall through to prompt fallback
    }
  }

  // 2. Fallback: Prompt user for filename so they can choose or confirm the name
  let targetFilename = defaultFilename;
  if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
    const userInput = window.prompt('Save as file name (enter name to save or overwrite):', defaultFilename);
    if (userInput === null) {
      // User clicked cancel
      return {
        saved: false,
        filename: defaultFilename,
        cancelled: true,
      };
    }
    const trimmed = userInput.trim();
    if (trimmed) {
      targetFilename = trimmed;
    }
  }

  // Ensure extension is present
  if (ext && !targetFilename.toLowerCase().endsWith(ext.toLowerCase())) {
    targetFilename += ext;
  }

  // Trigger standard anchor download with chosen filename
  if (typeof document !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = targetFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return {
    saved: true,
    filename: targetFilename,
  };
}
