/**
 * reportTemplates.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Lets a user (internal SE or partner) save named, brandable presets for the
 * Signal Path & Architecture report: which sections to include, a partner
 * logo/name, and a markdown executive-summary template with token placeholders.
 *
 * Follows the same layered pattern as skuOverrides.ts: built-in templates are
 * hardcoded, custom ones are persisted to localStorage, and a getter merges
 * both. The Gigamon badge on the report itself is never configurable here —
 * `coBrandingMode` only controls whether a partner logo/name is added
 * alongside it, never whether Gigamon's own branding is removed.
 */

export interface ReportSectionToggles {
  executiveSummary: boolean;
  topologyDiagram: boolean;
  componentNarrative: boolean;
  billOfMaterials: boolean;
  rackElevation: boolean;
}

export const ALL_SECTIONS_ENABLED: ReportSectionToggles = {
  executiveSummary: true,
  topologyDiagram: true,
  componentNarrative: true,
  billOfMaterials: true,
  rackElevation: true,
};

export interface ReportTemplate {
  id: string;
  name: string;
  partnerName?: string;
  partnerLogoDataUrl?: string;
  /** 'co-branded' adds the partner logo/name alongside the Gigamon badge; it never replaces it. */
  coBrandingMode: 'gigamon-only' | 'co-branded';
  primaryColour?: string;
  execSummaryTemplateMarkdown: string;
  sections: ReportSectionToggles;
  isBuiltIn?: boolean;
}

const DEFAULT_EXEC_SUMMARY =
  '# Visibility Fabric Architecture for {{projectName}}\n\n' +
  'This document details the signal path architecture, capturing **{{totalLinks}} monitored links** ' +
  'across **{{siteCount}} site(s)** into a centralised visibility pipeline.';

export const BUILT_IN_TEMPLATES: ReportTemplate[] = [
  {
    id: 'default-signal-path',
    name: 'Standard (Gigamon)',
    coBrandingMode: 'gigamon-only',
    execSummaryTemplateMarkdown: DEFAULT_EXEC_SUMMARY,
    sections: ALL_SECTIONS_ENABLED,
    isBuiltIn: true,
  },
  {
    id: 'executive-overview',
    name: 'Executive Overview (No BOM)',
    coBrandingMode: 'gigamon-only',
    execSummaryTemplateMarkdown: DEFAULT_EXEC_SUMMARY,
    sections: { ...ALL_SECTIONS_ENABLED, billOfMaterials: false, rackElevation: false },
    isBuiltIn: true,
  },
  {
    id: 'commercial-bom-only',
    name: 'Commercial Proposal (BOM Focus)',
    coBrandingMode: 'gigamon-only',
    execSummaryTemplateMarkdown: DEFAULT_EXEC_SUMMARY,
    sections: { ...ALL_SECTIONS_ENABLED, componentNarrative: false },
    isBuiltIn: true,
  },
];

const STORAGE_KEY = 'fm-simulator-report-templates';

interface StoredTemplates {
  [id: string]: ReportTemplate;
}

function loadStoredTemplates(): StoredTemplates {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as StoredTemplates;
  } catch {
    return {};
  }
}

let customTemplates: StoredTemplates = loadStoredTemplates();

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customTemplates));
  } catch {
    // Storage unavailable or quota exceeded — template stays available for this session only.
  }
}

/** Returns built-in templates followed by all saved custom templates. */
export function getAllTemplates(): ReportTemplate[] {
  return [...BUILT_IN_TEMPLATES, ...Object.values(customTemplates)];
}

export function getTemplateById(id: string): ReportTemplate | undefined {
  return getAllTemplates().find((t) => t.id === id);
}

/** Saves a custom template (built-ins can't be overwritten — always creates/updates a custom entry). */
export function saveTemplate(template: ReportTemplate): ReportTemplate {
  const saved: ReportTemplate = { ...template, isBuiltIn: false };
  customTemplates = { ...customTemplates, [saved.id]: saved };
  persist();
  return saved;
}

export function deleteTemplate(id: string): void {
  if (!(id in customTemplates)) return;
  const next = { ...customTemplates };
  delete next[id];
  customTemplates = next;
  persist();
}

function isReportTemplate(value: unknown): value is ReportTemplate {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    (v.coBrandingMode === 'gigamon-only' || v.coBrandingMode === 'co-branded') &&
    typeof v.execSummaryTemplateMarkdown === 'string' &&
    typeof v.sections === 'object' &&
    v.sections !== null
  );
}

/** Parses and validates a previously-exported template JSON file. Throws with a user-facing message on failure. */
export async function importTemplateFromFile(file: File): Promise<ReportTemplate> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!isReportTemplate(parsed)) {
    throw new Error('That file is not a recognised report template.');
  }
  return { ...parsed, sections: { ...ALL_SECTIONS_ENABLED, ...parsed.sections }, isBuiltIn: false };
}

/** Serialises a template to a JSON string suitable for download. */
export function exportTemplateToJson(template: ReportTemplate): string {
  return JSON.stringify({ ...template, isBuiltIn: false }, null, 2);
}
