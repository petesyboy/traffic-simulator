/**
 * exportNaming.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Standardized filename generation for all simulator exports, reports, quotes,
 * and project save files.
 *
 * Unified naming convention:
 *   <Document_Type_Prefix>_<Sanitized_Solution_Name>.<ext>
 *
 * Examples:
 *   - Solution_Overview_City_of_Gothenburg.json
 *   - Bill_of_Materials_City_of_Gothenburg.csv
 *   - Bill_of_Materials_Deployment_Report_City_of_Gothenburg.csv
 *   - Gigamon_Architecture_Solution_Report_City_of_Gothenburg.pdf
 *   - Gigamon_Architecture_Uplink_Report_City_of_Gothenburg.pdf
 *   - Gigamon_Architecture_Patch_Sheet_City_of_Gothenburg.pdf
 *   - Gigamon_Architecture_Crossover_Report_City_of_Gothenburg.pdf
 *   - Gigamon_Architecture_Diagram_City_of_Gothenburg.png
 *   - Commercial_Quote_City_of_Gothenburg.pdf
 *   - Commercial_Quote_City_of_Gothenburg.csv
 *   - Commercial_Quote_City_of_Gothenburg.json
 */

/**
 * Sanitizes a project / scenario / solution name for clean filesystem and report usage.
 * Replaces spaces and non-alphanumeric characters with underscores, collapsing repeats.
 */
export function sanitizeSolutionName(scenarioName?: string | null, fallback = 'Solution'): string {
  if (!scenarioName || !scenarioName.trim()) return fallback;

  let clean = scenarioName
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!clean) return fallback;

  return clean;
}

export type ExportDocumentType =
  | 'topology-json'
  | 'bom-csv'
  | 'bom-deployment-csv'
  | 'architecture-pdf'
  | 'uplink-pdf'
  | 'patch-sheet-pdf'
  | 'crossover-pdf'
  | 'quote-pdf'
  | 'quote-csv'
  | 'quote-json'
  | 'diagram-png';

/**
 * Generates the canonical standardized export filename for any simulator document.
 *
 * @param type The document / export type
 * @param scenarioName The user-defined project / solution / scenario name
 */
export function getStandardExportFilename(
  type: ExportDocumentType,
  scenarioName?: string | null,
): string {
  const cleanName = sanitizeSolutionName(scenarioName);

  switch (type) {
    case 'topology-json':
      return `Solution_Overview_${cleanName}.json`;
    case 'bom-csv':
      return `Bill_of_Materials_${cleanName}.csv`;
    case 'bom-deployment-csv':
      return `Bill_of_Materials_Deployment_Report_${cleanName}.csv`;
    case 'architecture-pdf':
      return `Gigamon_Architecture_Solution_Report_${cleanName}.pdf`;
    case 'uplink-pdf':
      return `Gigamon_Architecture_Uplink_Report_${cleanName}.pdf`;
    case 'patch-sheet-pdf':
      return `Gigamon_Architecture_Patch_Sheet_${cleanName}.pdf`;
    case 'crossover-pdf':
      return `Gigamon_Architecture_Crossover_Report_${cleanName}.pdf`;
    case 'quote-pdf':
      return `Commercial_Quote_${cleanName}.pdf`;
    case 'quote-csv':
      return `Commercial_Quote_${cleanName}.csv`;
    case 'quote-json':
      return `Commercial_Quote_${cleanName}.json`;
    case 'diagram-png':
      return `Gigamon_Architecture_Diagram_${cleanName}.png`;
    default:
      return `Solution_Overview_${cleanName}.json`;
  }
}
