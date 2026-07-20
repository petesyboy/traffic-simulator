/**
 * header/index.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Barrel re-export for all header sub-components.
 */

export { default as ConfirmModal } from './ConfirmModal';
export { default as DuplicateModal } from './DuplicateModal';
export { default as ProjectSettingsModal } from './ProjectSettingsModal';
export { default as BomModal } from './BomModal';

export {
  PlayIcon,
  PauseIcon,
  CopyIcon,
  ClipboardIcon,
  GridIcon,
  ServerRackIcon,
  PresentationIcon,
  StopIcon,
  CameraIcon,
  SaveIcon,
  FolderOpenIcon,
  GearIcon,
  RefreshIcon,
  TrashIcon,
} from './HeaderIcons';

export type { ConfirmModalProps } from './ConfirmModal';
export type { DuplicateModalProps } from './DuplicateModal';
export type { ProjectSettingsModalProps } from './ProjectSettingsModal';
export type { BomModalProps } from './BomModal';
