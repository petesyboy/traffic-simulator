/**
 * sidebar/index.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Barrel file for the sidebar module.  Re-exports the main Sidebar component
 * so existing `import Sidebar from './components/Sidebar'` paths can migrate
 * to `import { Sidebar } from './components/sidebar'` over time.
 */

export { default as Sidebar } from '../Sidebar';
export { default as CatalogueSection } from './CatalogueSection';
export type { HardwareCatalogueItem, CatalogueSectionProps } from './CatalogueSection';
