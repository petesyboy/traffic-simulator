import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getAllTemplates,
  saveTemplate,
  deleteTemplate,
  exportTemplateToJson,
  importTemplateFromFile,
  BUILT_IN_TEMPLATES,
  ALL_SECTIONS_ENABLED,
  type ReportTemplate,
} from './reportTemplates';

/** Same in-memory localStorage stub used by skuOverrides.test.ts, for the same reason:
 *  this sandbox's Node localStorage global has no working getItem/setItem/removeItem. */
function installFakeLocalStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  });
}

const customTemplate: ReportTemplate = {
  id: 'custom-test-1',
  name: 'Acme Cyber Solutions - Standard',
  partnerName: 'Acme Cyber Solutions',
  coBrandingMode: 'co-branded',
  execSummaryTemplateMarkdown: 'Prepared by {{partnerName}} for {{projectName}}.',
  sections: { ...ALL_SECTIONS_ENABLED, rackElevation: false },
};

describe('reportTemplates', () => {
  beforeEach(() => {
    installFakeLocalStorage();
    for (const t of getAllTemplates()) {
      if (!t.isBuiltIn) deleteTemplate(t.id);
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns only built-in templates when nothing has been saved', () => {
    expect(getAllTemplates()).toEqual(BUILT_IN_TEMPLATES);
  });

  it('saves a custom template and merges it alongside the built-ins', () => {
    saveTemplate(customTemplate);
    const all = getAllTemplates();
    expect(all).toHaveLength(BUILT_IN_TEMPLATES.length + 1);
    expect(all.find((t) => t.id === 'custom-test-1')).toMatchObject({ name: customTemplate.name, isBuiltIn: false });
  });

  it('deletes a custom template', () => {
    saveTemplate(customTemplate);
    deleteTemplate('custom-test-1');
    expect(getAllTemplates()).toEqual(BUILT_IN_TEMPLATES);
  });

  it('round-trips a template through export and import', async () => {
    const json = exportTemplateToJson(customTemplate);
    const file = new File([json], 'template.json', { type: 'application/json' });

    const imported = await importTemplateFromFile(file);

    expect(imported.name).toBe(customTemplate.name);
    expect(imported.partnerName).toBe(customTemplate.partnerName);
    expect(imported.coBrandingMode).toBe('co-branded');
    expect(imported.sections).toEqual(customTemplate.sections);
    expect(imported.isBuiltIn).toBe(false);
  });

  it('rejects a file that is not valid JSON', async () => {
    const file = new File(['not json'], 'bad.json', { type: 'application/json' });
    await expect(importTemplateFromFile(file)).rejects.toThrow('not valid JSON');
  });

  it('rejects a JSON file that is not a recognised report template', async () => {
    const file = new File([JSON.stringify({ foo: 'bar' })], 'bad.json', { type: 'application/json' });
    await expect(importTemplateFromFile(file)).rejects.toThrow('not a recognised report template');
  });
});
