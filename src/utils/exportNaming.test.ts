import { describe, it, expect } from 'vitest';
import { sanitizeSolutionName, getStandardExportFilename } from './exportNaming';

describe('exportNaming', () => {
  describe('sanitizeSolutionName', () => {
    it('sanitizes solution names with spaces and special characters', () => {
      expect(sanitizeSolutionName('City of Gothenburg')).toBe('City_of_Gothenburg');
      expect(sanitizeSolutionName('Customer #1 (Site A/B)')).toBe('Customer_1_Site_A_B');
      expect(sanitizeSolutionName('  DC - Core & Edge  ')).toBe('DC_Core_Edge');
    });

    it('falls back to default when empty or invalid', () => {
      expect(sanitizeSolutionName('')).toBe('Solution');
      expect(sanitizeSolutionName(null)).toBe('Solution');
      expect(sanitizeSolutionName('   ')).toBe('Solution');
      expect(sanitizeSolutionName('###')).toBe('Solution');
      expect(sanitizeSolutionName(undefined, 'CustomFallback')).toBe('CustomFallback');
    });
  });

  describe('getStandardExportFilename', () => {
    const solution = 'City of Gothenburg';

    it('generates standard Bill of Materials filenames starting with Bill_of_Materials_', () => {
      expect(getStandardExportFilename('bom-csv', solution)).toBe('Bill_of_Materials_City_of_Gothenburg.csv');
      expect(getStandardExportFilename('bom-deployment-csv', solution)).toBe(
        'Bill_of_Materials_Deployment_Report_City_of_Gothenburg.csv',
      );
    });

    it('generates standard canvas/topology JSON filename starting with Solution_Overview_', () => {
      expect(getStandardExportFilename('topology-json', solution)).toBe(
        'Solution_Overview_City_of_Gothenburg.json',
      );
    });

    it('generates standard Architecture PDF report filenames starting with Gigamon_Architecture_', () => {
      expect(getStandardExportFilename('architecture-pdf', solution)).toBe(
        'Gigamon_Architecture_Solution_Report_City_of_Gothenburg.pdf',
      );
      expect(getStandardExportFilename('uplink-pdf', solution)).toBe(
        'Gigamon_Architecture_Uplink_Report_City_of_Gothenburg.pdf',
      );
      expect(getStandardExportFilename('patch-sheet-pdf', solution)).toBe(
        'Gigamon_Architecture_Patch_Sheet_City_of_Gothenburg.pdf',
      );
      expect(getStandardExportFilename('crossover-pdf', solution)).toBe(
        'Gigamon_Architecture_Crossover_Report_City_of_Gothenburg.pdf',
      );
    });

    it('generates standard Commercial Quote filenames starting with Commercial_Quote_', () => {
      expect(getStandardExportFilename('quote-pdf', solution)).toBe('Commercial_Quote_City_of_Gothenburg.pdf');
      expect(getStandardExportFilename('quote-csv', solution)).toBe('Commercial_Quote_City_of_Gothenburg.csv');
      expect(getStandardExportFilename('quote-json', solution)).toBe('Commercial_Quote_City_of_Gothenburg.json');
    });

    it('generates standard Architecture Diagram PNG filename', () => {
      expect(getStandardExportFilename('diagram-png', solution)).toBe(
        'Gigamon_Architecture_Diagram_City_of_Gothenburg.png',
      );
    });
  });
});
