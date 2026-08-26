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
export { default as SkuUpdateModal } from './SkuUpdateModal';
export { default as ReportModal } from './ReportModal';
export { default as MixedSiteConfirmModal } from './MixedSiteConfirmModal';
export { SaveSlotModal } from './SaveSlotModal';


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
  PriceListIcon,
  ReportIcon,
  SunIcon,
  MoonIcon,
  ChevronDownIcon,
} from './HeaderIcons';

export type { ConfirmModalProps } from './ConfirmModal';
export type { DuplicateModalProps } from './DuplicateModal';
export type { ProjectSettingsModalProps } from './ProjectSettingsModal';
export type { BomModalProps } from './BomModal';
export type { AboutModalProps } from './AboutModal';
export type { SkuUpdateModalProps } from './SkuUpdateModal';
export type { ReportModalProps } from './ReportModal';
export type { MixedSiteConfirmModalProps } from './MixedSiteConfirmModal';
export type { SaveSlotModalProps } from './SaveSlotModal';

