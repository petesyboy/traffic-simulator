/**
 * projectDirectoryStorage.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * IndexedDB persistence and permission management for project FileSystemDirectoryHandles.
 *
 * Supports:
 *  - Local physical disks (C:\, D:\, etc.)
 *  - Mapped network drives (Z:\, SMB shares)
 *  - Cloud-synchronised folders (OneDrive, Google Drive for Desktop, Dropbox, etc.)
 *
 * Keyed by stable project UUID (`projectId`) so project renaming preserves the association.
 */

const DB_NAME = 'fm-simulator-storage';
const DB_VERSION = 1;
const STORE_NAME = 'project-directories';

// In-memory cache of active handles for fast access within a session
const activeHandles = new Map<string, FileSystemDirectoryHandle>();

export interface StoredDirectoryRecord {
  projectId: string;
  directoryName: string;
  handle: FileSystemDirectoryHandle;
  updatedAt: number;
}

/**
 * Checks whether the modern Web File System Access API is supported in the current browser.
 */
export function isFileSystemAccessSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
  );
}

/**
 * Opens an IndexedDB connection to the directory storage database.
 */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Opens the native OS directory chooser (supporting local drives, mapped network shares, OneDrive, Google Drive).
 * Must be called synchronously within a user activation gesture.
 */
export async function pickWorkingDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) return null;

  try {
    const handle = await (window as unknown as {
      showDirectoryPicker: (options: { mode: 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
    }).showDirectoryPicker({
      mode: 'readwrite',
    });
    return handle;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      // User cancelled picker
      return null;
    }
    console.warn('showDirectoryPicker threw:', err);
    throw err;
  }
}

/**
 * Stores a directory handle in IndexedDB associated with a project ID.
 */
export async function storeDirectoryHandle(
  projectId: string,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  if (!projectId || !handle) return;

  activeHandles.set(projectId, handle);

  if (typeof indexedDB === 'undefined') return;

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: StoredDirectoryRecord = {
        projectId,
        directoryName: handle.name,
        handle,
        updatedAt: Date.now(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to store directory handle in IndexedDB:', err);
  }
}

/**
 * Retrieves a stored directory handle for a given project ID.
 */
export async function getDirectoryHandle(
  projectId: string,
): Promise<FileSystemDirectoryHandle | null> {
  if (!projectId) return null;

  if (activeHandles.has(projectId)) {
    return activeHandles.get(projectId)!;
  }

  if (typeof indexedDB === 'undefined') return null;

  try {
    const db = await openDb();
    const record = await new Promise<StoredDirectoryRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(projectId);
      req.onsuccess = () => resolve(req.result as StoredDirectoryRecord | undefined);
      req.onerror = () => reject(req.error);
    });

    if (record?.handle) {
      activeHandles.set(projectId, record.handle);
      return record.handle;
    }
    return null;
  } catch (err) {
    console.warn('Failed to retrieve directory handle from IndexedDB:', err);
    return null;
  }
}

/**
 * Removes a directory handle from IndexedDB and the active cache.
 */
export async function removeDirectoryHandle(projectId: string): Promise<void> {
  if (!projectId) return;

  activeHandles.delete(projectId);

  if (typeof indexedDB === 'undefined') return;

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(projectId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to delete directory handle from IndexedDB:', err);
  }
}

/**
 * Checks permission and prompts the user if required.
 * MUST be called directly within a user interaction context if re-requesting permission.
 */
export async function verifyAndRequestDirectoryPermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  try {
    const typedHandle = handle as unknown as {
      queryPermission: (opts: { mode: string }) => Promise<'granted' | 'denied' | 'prompt'>;
      requestPermission: (opts: { mode: string }) => Promise<'granted' | 'denied' | 'prompt'>;
    };

    if (typeof typedHandle.queryPermission === 'function') {
      const status = await typedHandle.queryPermission({ mode: 'readwrite' });
      if (status === 'granted') return true;
      if (status === 'denied') return false;

      // Status is 'prompt': must request permission
      if (typeof typedHandle.requestPermission === 'function') {
        const reqStatus = await typedHandle.requestPermission({ mode: 'readwrite' });
        return reqStatus === 'granted';
      }
    }
    return true;
  } catch (err) {
    console.warn('Permission verification threw:', err);
    return false;
  }
}

/**
 * Verifies that the directory handle is still valid, mounted, and accessible.
 * If the folder was moved or unmounted, throws or returns false.
 */
export async function testDirectoryAccess(
  handle: FileSystemDirectoryHandle,
): Promise<{ accessible: boolean; error?: string }> {
  try {
    const permitted = await verifyAndRequestDirectoryPermission(handle);
    if (!permitted) {
      return { accessible: false, error: 'Permission denied or dismissed by user.' };
    }

    // Test access by attempting to list or check presence
    const typedHandle = handle as unknown as {
      values?: () => AsyncIterable<unknown>;
      entries?: () => AsyncIterable<unknown>;
    };

    if (typeof typedHandle.values === 'function') {
      const iterable = typedHandle.values();
      if (iterable && typeof iterable[Symbol.asyncIterator] === 'function') {
        const iterator = iterable[Symbol.asyncIterator]();
        await iterator.next();
      }
    }

    return { accessible: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown directory access error';
    return { accessible: false, error: msg };
  }
}

/**
 * Clears in-memory cache (useful in unit tests).
 */
export function clearInMemoryHandleCache(): void {
  activeHandles.clear();
}
