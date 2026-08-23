/**
 * CatalogueSection.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable sub-accordion component for hardware catalogue sections in the
 * sidebar (TAPs, TA Series, HC Series).
 *
 * Extracts the repeated pattern of:
 *   1. A clickable sub-accordion header
 *   2. A filtered list of draggable hardware items
 */

import React from 'react';
import { resolveHardwareIcon } from '../../assets/hardwareIcons';

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface HardwareCatalogueItem {
  model: string;
  sku: string;
  ru?: number;
  image?: string;
  [key: string]: unknown;
}

export interface CatalogueSectionProps {
  /** Display title for the sub-accordion header */
  title: string;
  /** Full list of hardware items to display */
  items: HardwareCatalogueItem[];
  /** Whether this sub-accordion section is currently expanded */
  isOpen: boolean;
  /** Callback to toggle section open/closed */
  onToggle: () => void;
  /** Search query string (already lower-cased) to filter items by model name */
  searchQuery: string;
  /** Optional additional filter applied before rendering (e.g. excluding trays) */
  filterFn?: (item: HardwareCatalogueItem) => boolean;
  /** Drag start handler – receives the drag event plus node metadata */
  onDragStart: (
    event: React.DragEvent,
    nodeType: string,
    label: string,
    initialData?: Record<string, unknown>,
  ) => void;
  /** The node type constant to use for dragged items (e.g. NODE_TYPES.HARDWARE) */
  nodeType: string;
  /** Fallback icon component when the item has no image */
  fallbackIcon: React.FC<{ size: number }>;
  /** SKU-to-description lookup for tooltip text */
  skus: Record<string, string>;
  /**
   * Optional renderer for the item label.
   * If not provided, falls back to showing `item.model` with an optional RU suffix.
   */
  renderLabel?: (item: HardwareCatalogueItem) => React.ReactNode;
  /**
   * Optional builder for the initial data payload attached to the drag event.
   * Defaults to `{ configType: 'Hardware', model, sku, image }`.
   */
  buildInitialData?: (item: HardwareCatalogueItem) => Record<string, unknown>;
}

/* ── Sub-accordion header styling (matches existing sidebar styles) ──────── */

const headerStyle: React.CSSProperties = {
  padding: '8px 12px 6px 12px',
  fontSize: '10px',
  color: 'var(--text-secondary)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
};

/* ── Component ─────────────────────────────────────────────────────────────── */

const CatalogueSection: React.FC<CatalogueSectionProps> = ({
  title,
  items,
  isOpen,
  onToggle,
  searchQuery,
  filterFn,
  onDragStart,
  nodeType,
  fallbackIcon: FallbackIcon,
  skus,
  renderLabel,
  buildInitialData,
}) => {
  const defaultBuildInitialData = (item: HardwareCatalogueItem): Record<string, unknown> => ({
    configType: 'Hardware',
    model: item.model,
    sku: item.sku,
    image: item.image,
  });

  const getInitialData = buildInitialData ?? defaultBuildInitialData;

  const filteredItems = items
    .filter((item) => (filterFn ? filterFn(item) : true))
    .filter((item) => item.model.toLowerCase().includes(searchQuery));

  return (
    <>
      <div
        className="demo-group-label"
        onClick={onToggle}
        style={headerStyle}
      >
        <span
          className={`chevron ${isOpen ? 'open' : ''}`}
          style={{ marginRight: '6px' }}
        >
          ▶
        </span>
        {title}
      </div>
      {isOpen &&
        filteredItems.map((item) => (
          <div
            key={item.sku}
            className="tree-draggable"
            draggable
            onDragStart={(e) =>
              onDragStart(e, nodeType, item.model, getInitialData(item))
            }
            title={skus[item.sku] || ''}
          >
            {resolveHardwareIcon(item.image) ? (
              <img
                src={resolveHardwareIcon(item.image)}
                style={{ height: '16px', objectFit: 'contain' }}
                alt={item.model}
              />
            ) : (
              <FallbackIcon size={18} />
            )}
            <span>
              {renderLabel
                ? renderLabel(item)
                : item.model}
            </span>
          </div>
        ))}
    </>
  );
};

export default CatalogueSection;
