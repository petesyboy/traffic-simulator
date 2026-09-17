import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isFileSystemAccessSupported,
  storeDirectoryHandle,
  getDirectoryHandle,
  removeDirectoryHandle,
  verifyAndRequestDirectoryPermission,
  testDirectoryAccess,
  clearInMemoryHandleCache,
} from './projectDirectoryStorage';

describe('projectDirectoryStorage', () => {
  beforeEach(() => {
    clearInMemoryHandleCache();
    vi.restoreAllMocks();
  });

  it('detects file system access support correctly', () => {
    const originalWindow = globalThis.window;

    // Supported
    (globalThis as unknown as Record<string, unknown>).window = {
      showDirectoryPicker: vi.fn(),
    };
    expect(isFileSystemAccessSupported()).toBe(true);

    // Not supported
    (globalThis as unknown as Record<string, unknown>).window = {};
    expect(isFileSystemAccessSupported()).toBe(false);

    (globalThis as unknown as Record<string, unknown>).window = originalWindow;
  });

  it('stores and retrieves directory handles from active cache', async () => {
    const mockHandle = {
      name: 'OneDrive-Gigamon-Project',
      kind: 'directory',
    } as unknown as FileSystemDirectoryHandle;

    await storeDirectoryHandle('proj-123', mockHandle);
    const retrieved = await getDirectoryHandle('proj-123');

    expect(retrieved).toBe(mockHandle);
    expect(retrieved?.name).toBe('OneDrive-Gigamon-Project');
  });

  it('removes directory handles from cache', async () => {
    const mockHandle = {
      name: 'GoogleDrive-Folder',
      kind: 'directory',
    } as unknown as FileSystemDirectoryHandle;

    await storeDirectoryHandle('proj-456', mockHandle);
    expect(await getDirectoryHandle('proj-456')).toBe(mockHandle);

    await removeDirectoryHandle('proj-456');
    expect(await getDirectoryHandle('proj-456')).toBeNull();
  });

  it('verifies permission when queryPermission returns granted', async () => {
    const mockHandle = {
      queryPermission: vi.fn().mockResolvedValue('granted'),
    } as unknown as FileSystemDirectoryHandle;

    const granted = await verifyAndRequestDirectoryPermission(mockHandle);
    expect(granted).toBe(true);
  });

  it('requests permission when queryPermission returns prompt', async () => {
    const requestPermissionMock = vi.fn().mockResolvedValue('granted');
    const mockHandle = {
      queryPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission: requestPermissionMock,
    } as unknown as FileSystemDirectoryHandle;

    const granted = await verifyAndRequestDirectoryPermission(mockHandle);
    expect(granted).toBe(true);
    expect(requestPermissionMock).toHaveBeenCalledWith({ mode: 'readwrite' });
  });

  it('returns false when permission is denied', async () => {
    const mockHandle = {
      queryPermission: vi.fn().mockResolvedValue('denied'),
    } as unknown as FileSystemDirectoryHandle;

    const granted = await verifyAndRequestDirectoryPermission(mockHandle);
    expect(granted).toBe(false);
  });

  it('tests directory access and returns accessible when valid', async () => {
    const mockHandle = {
      queryPermission: vi.fn().mockResolvedValue('granted'),
      values: vi.fn().mockReturnValue({
        [Symbol.asyncIterator]: () => ({
          next: vi.fn().mockResolvedValue({ done: true }),
        }),
      }),
    } as unknown as FileSystemDirectoryHandle;

    const result = await testDirectoryAccess(mockHandle);
    expect(result.accessible).toBe(true);
  });

  it('tests directory access and catches unmounted/stale directory error', async () => {
    const notFoundErr = new Error('Directory moved or unmounted');
    notFoundErr.name = 'NotFoundError';

    const mockHandle = {
      queryPermission: vi.fn().mockResolvedValue('granted'),
      values: vi.fn().mockReturnValue({
        [Symbol.asyncIterator]: () => ({
          next: vi.fn().mockRejectedValue(notFoundErr),
        }),
      }),
    } as unknown as FileSystemDirectoryHandle;

    const result = await testDirectoryAccess(mockHandle);
    expect(result.accessible).toBe(false);
    expect(result.error).toContain('Directory moved or unmounted');
  });
});
