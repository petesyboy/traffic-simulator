/**
 * defaultToolPreference.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Which packet-consuming tool appears pre-wired into the default canvas, the
 * "Load Demo" scenario, and the guided Trade Show Demo. Gigamon sells alongside
 * many NDR/NPM vendors, so a partner reselling Corelight or Vectra (say) rather
 * than ExtraHop can set their own default here instead of every fresh canvas
 * pointing at a competitor's tool. Stored per installation (like the theme and
 * colour vision preference) rather than per project, so it follows the partner
 * across every new topology they start.
 */
export const DEFAULT_PACKET_TOOL = 'ExtraHop';

const STORAGE_KEY = 'fm-simulator-default-tool';

export const getStoredDefaultPacketTool = (): string => {
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return saved;
    } catch {
      // ignore
    }
  }
  return DEFAULT_PACKET_TOOL;
};

export const setStoredDefaultPacketTool = (toolName: string): void => {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, toolName);
    } catch {
      // ignore
    }
  }
};
