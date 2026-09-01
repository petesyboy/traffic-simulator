/**
 * fileSaveHelper.ts
 *
 * Provides file saving functionality that prompts the user with the native OS
 * "Save As" file picker (supporting directory selection and overwriting existing files),
 * with a graceful window.prompt() fallback for browsers or file:// contexts without File System Access API.
 */

export type FileContentInput =
  | Blob
  | string
  | (() => Promise<Blob | string>)
  | (() => Blob | string);

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

function convertContentToBlob(content: Blob | string, defaultMime: string): Blob {
  if (content instanceof Blob) return content;
  if (typeof content === 'string' && content.startsWith('data:')) {
    try {
      const arr = content.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : defaultMime;
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch {
      // Fall through to plain text blob on failure
    }
  }
  return new Blob([content], { type: defaultMime });
}

/**
 * Saves a Blob, string, or dynamically generated content to disk, asking the user for a filename / location.
 *
 * 1. Uses window.showSaveFilePicker when available, which opens the native OS Save dialog
 *    allowing the user to overwrite existing files or select a target folder.
 *    If a generator function is provided, showSaveFilePicker is invoked IMMEDIATELY while
 *    the user click gesture is active, before executing heavy rendering/generation.
 * 2. Falls back to window.prompt() to ask for a filename before triggering a standard download.
 *
 * @param contentOrGenerator The file content (Blob / string) or an async generator function returning Blob/string
 * @param defaultFilename The suggested initial filename
 * @param options Description, MIME type, and extension for the file picker
 */
export async function saveWithFilePickerOrPrompt(
  contentOrGenerator: FileContentInput,
  defaultFilename: string,
  options?: Partial<FilePickerTypeOption>,
): Promise<SaveFileResult> {
  const rawExt = options?.extension || (defaultFilename.includes('.') ? '.' + defaultFilename.split('.').pop()! : '');
  const ext = rawExt.startsWith('.') ? rawExt : `.${rawExt}`;
  const mime = options?.mimeType || 'application/octet-stream';
  const desc = options?.description || 'File';

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

      // User chose destination and clicked Save: now generate or resolve content
      const resolvedContent = typeof contentOrGenerator === 'function'
        ? await contentOrGenerator()
        : contentOrGenerator;

      const blob = convertContentToBlob(resolvedContent, mime);

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
      console.warn('showSaveFilePicker unavailable or threw, falling back to prompt download:', err);
    }
  }

  // 2. Fallback: Prompt user for filename so they can choose or confirm the name
  const resolvedContent = typeof contentOrGenerator === 'function'
    ? await contentOrGenerator()
    : contentOrGenerator;

  const blob = convertContentToBlob(resolvedContent, mime);

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
