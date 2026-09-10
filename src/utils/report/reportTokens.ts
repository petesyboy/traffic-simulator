/**
 * reportTokens.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Replaces `{{token}}` placeholders in a user-authored markdown executive
 * summary with live project values before it's handed to markdownToPdfmake.
 */

export interface ReportTokenValues {
  projectName: string;
  partnerName: string;
  siteCount: string;
  totalLinks: string;
  hardwareCount: string;
  licenseModel: string;
  date: string;
}

export function interpolateTokens(markdown: string, values: ReportTokenValues): string {
  return markdown.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, token: string) => {
    return token in values ? values[token as keyof ReportTokenValues] : match;
  });
}
