/**
 * header/index.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Barrel re-export for all header sub-components.
 */

export { default as ConfirmModal } from './ConfirmModal';
export { default as DuplicateModal } from './DuplicateModal';
export { default as ProjectSettingsModal } from './ProjectSettingsModal';
export { default as BomModal } from './BomModal';
export { default as AboutModal } from './AboutModal';

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
  UndoIcon,
  RedoIcon,
} from './HeaderIcons';

export type { ConfirmModalProps } from './ConfirmModal';
export type { DuplicateModalProps } from './DuplicateModal';
export type { ProjectSettingsModalProps } from './ProjectSettingsModal';
export type { BomModalProps } from './BomModal';
export type { AboutModalProps } from './AboutModal';
