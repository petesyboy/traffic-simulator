/**
 * offlineDownload.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Facilitates direct downloading of the standalone, offline-capable single-file
 * HTML application for Partners and Sales teams when accessing the hosted web app.
 */

import { saveWithFilePickerOrPrompt } from './fileSaveHelper';

export interface OfflineDownloadResult {
  success: boolean;
  filename: string;
  source: 'fetch' | 'dom-serialization';
  error?: string;
}

/**
 * Downloads the current application as a standalone, runnable HTML file that
 * does not require an active internet connection.
 *
 * Tries:
 * 1. Fetching `traffic-reduction-simulator.html` from the relative path.
 * 2. Fetching `index.html` from the relative path.
 * 3. Fallback: Serializing the live document DOM (`<!DOCTYPE html>` + `outerHTML`).
 */
export async function downloadOfflineApp(version?: string): Promise<OfflineDownloadResult> {
  const versionTag = version ? `-v${version}` : '';
  const defaultFilename = `traffic-reduction-simulator${versionTag}.html`;

  const candidateUrls = [
    'traffic-reduction-simulator.html',
    './traffic-reduction-simulator.html',
    '/traffic-reduction-simulator.html',
    'partner-edition/traffic-reduction-simulator.html',
    './partner-edition/traffic-reduction-simulator.html',
    '/partner-edition/traffic-reduction-simulator.html',
    'index.html',
    './index.html',
    '/index.html',
  ];

  let htmlContent: string | null = null;
  let source: 'fetch' | 'dom-serialization' = 'fetch';

  // Step 1: Attempt to fetch pre-built standalone HTML file
  if (typeof fetch !== 'undefined') {
    for (const url of candidateUrls) {
      try {
        const response = await fetch(url, { cache: 'no-cache' });
        if (response.ok) {
          const text = await response.text();
          // Ensure it's valid HTML with standard structure
          if (text && text.includes('<html') && text.includes('</html>')) {
            htmlContent = text;
            break;
          }
        }
      } catch {
        // Continue to next candidate URL
      }
    }
  }

  // Step 2: Fallback to serializing current document DOM if fetch is blocked or running via file://
  if (!htmlContent && typeof document !== 'undefined' && document.documentElement) {
    source = 'dom-serialization';
    const doctype = document.doctype
      ? `<!DOCTYPE ${document.doctype.name}${document.doctype.publicId ? ` PUBLIC "${document.doctype.publicId}"` : ''}${
          document.doctype.systemId ? ` "${document.doctype.systemId}"` : ''
        }>\n`
      : '<!DOCTYPE html>\n';
    htmlContent = doctype + document.documentElement.outerHTML;
  }

  if (!htmlContent) {
    return {
      success: false,
      filename: defaultFilename,
      source,
      error: 'Unable to capture application content for offline download.',
    };
  }

  try {
    const result = await saveWithFilePickerOrPrompt(htmlContent, defaultFilename, {
      description: 'Standalone Offline HTML Application',
      mimeType: 'text/html',
      extension: '.html',
    });

    return {
      success: result.saved,
      filename: result.filename,
      source,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      filename: defaultFilename,
      source,
      error: message,
    };
  }
}
