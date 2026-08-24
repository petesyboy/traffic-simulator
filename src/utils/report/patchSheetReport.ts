/**
 * patchSheetReport.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * "Patch Sheet" report format for field installation and commissioning
 * technicians. Monospace-throughout work order with document-control strip,
 * high-contrast photocopier-safe styling, concrete field checklist, and port
 * mapping matrix.
 *
 * Design Tokens:
 * • Paper: #FFFFFF, Ink: #101010, Accent: #E1592A
 * • Photocopier-safe: 100% solid hairlines, zero faint grays
 */
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { ReportInput } from './buildReportDocDefinition';
import { buildTopologyStats } from './describeTopology';
import { generateBom, validateConfiguration } from '../../utils/bomEngine';
import { isAutoTrayModel } from '../trayModels';
import { NODE_TYPES } from '../../constants/nodeTypes';
import { REPORT_PATCH_COLOURS, patchSheetStyleDictionary, REPORT_PAGE_MARGINS } from './reportStyles';

export function buildPatchSheetReportDocDefinition(input: ReportInput): TDocumentDefinitions {
  const {
    nodes,
    edges,
    trafficStreams,
    projectName,
    projectRegion,
    projectLicenseMode,
    defaultTermDuration,
    peakNodeRxMbps,
    siteRackImages,
  } = input;

  const stats = buildTopologyStats(nodes, edges, trafficStreams);
  const bomRowsRaw = generateBom(
    nodes,
    edges,
    projectLicenseMode,
    defaultTermDuration,
    projectRegion as 'US' | 'EU' | 'UK',
    true,
    peakNodeRxMbps,
  );

  const validationErrors = validateConfiguration(nodes, edges);

  const now = new Date();
  const dateFormatted = now.toISOString().split('T')[0];

  const uniqueSites = Array.from(
    new Set(nodes.map((n) => (n.data?.site as string || '').trim()).filter(Boolean)),
  );
  if (uniqueSites.length === 0) uniqueSites.push('Global / Primary Site');

  const content: Content[] = [];

  // ═══════════════════════════════════════════════════════════════
  // DOCUMENT-CONTROL STRIP (Bordered Work-Order Header)
  // ═══════════════════════════════════════════════════════════════
  content.push({
    table: {
      widths: ['25%', '25%', '25%', '25%'],
      body: [
        [
          {
            stack: [
              { text: 'SITE / FACILITY', style: 'docControlLabel' },
              { text: uniqueSites.join(' · ').toUpperCase(), style: 'docControlValue' },
            ],
            borderColor: ['#101010', '#101010', '#101010', '#101010'],
          },
          {
            stack: [
              { text: 'WORK ORDER REV', style: 'docControlLabel' },
              { text: 'REV 1.0 (PRODUCTION)', style: 'docControlValue' },
            ],
            borderColor: ['#101010', '#101010', '#101010', '#101010'],
          },
          {
            stack: [
              { text: 'ISSUE DATE', style: 'docControlLabel' },
              { text: dateFormatted, style: 'docControlValue' },
            ],
            borderColor: ['#101010', '#101010', '#101010', '#101010'],
          },
          {
            stack: [
              { text: 'SYSTEM / FABRIC', style: 'docControlLabel' },
              { text: 'GIGAMON VISIBILITY', style: 'docControlValue' },
            ],
            borderColor: ['#101010', '#101010', '#101010', '#101010'],
          },
        ],
      ],
    },
    layout: {
      defaultBorder: true,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
    margin: [0, 0, 0, 14],
  });

  // Title & Scope line
  content.push({ text: `FIELD INSTALLATION & PATCH SHEET — ${projectName.toUpperCase()}`, style: 'workOrderTitle' });
  content.push({
    text: `SCOPE: ${stats.monitoredLinkCount} Monitored Links (${stats.totalFeedCount} Feeds) | ${stats.tapUnitCount} TAPs | ${Object.keys(stats.chassisCounts).length} Chassis Types | ${stats.toolCount} Monitoring Tools`,
    style: 'workOrderScope',
  });

  // ═══════════════════════════════════════════════════════════════
  // PRE-INSTALL VERIFICATION & FIELD FLAGS
  // ═══════════════════════════════════════════════════════════════
  if (validationErrors.length > 0) {
    content.push({
      table: {
        widths: ['100%'],
        body: [
          [
            {
              border: [true, true, true, true],
              borderColor: [REPORT_PATCH_COLOURS.accent, REPORT_PATCH_COLOURS.accent, REPORT_PATCH_COLOURS.accent, REPORT_PATCH_COLOURS.accent],
              fillColor: REPORT_PATCH_COLOURS.accentBg,
              margin: [10, 8, 10, 8],
              stack: [
                {
                  text: '[ ! ] FIELD ACTION REQUIRED BEFORE RACKING / POWER-ON:',
                  style: 'checkItemBold',
                  color: REPORT_PATCH_COLOURS.accent,
                },
                {
                  ul: validationErrors.map((v) => `[ ] ${v}`),
                  style: 'body',
                  margin: [0, 4, 0, 0],
                },
              ],
            },
          ],
        ],
      },
      margin: [0, 0, 0, 14],
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // CONCRETE FIELD COMMISSIONING CHECKLIST
  // ═══════════════════════════════════════════════════════════════
  content.push({ text: 'SECTION 01: COMMISSIONING & PHYSICAL MOUNTING CHECKLIST', style: 'sectionHeading' });

  const hardwareNodes = nodes.filter((n) => n.type === NODE_TYPES.HARDWARE);
  const checklistItems: string[] = [
    '[ ] Verify rack space allocations and install chassis mounting rails / brackets.',
    '[ ] Connect dual redundant power supplies (A/B power feeds) to each appliance.',
    '[ ] Ground chassis to rack ear grounding points as per facility standard.',
  ];

  // Specific chassis and module seating checks
  hardwareNodes.forEach((node) => {
    const data = node.data as { model?: string; label?: string; site?: string };
    const model = data.model || 'Gigamon Chassis';
    const label = data.label || model;
    if (isAutoTrayModel(model)) {
      checklistItems.push(`[ ] Mount TAP Tray "${label}" (${model}) and secure optical TAP modules into designated tray slots.`);
    } else if (model.includes('HC') || model.includes('TA')) {
      checklistItems.push(`[ ] Seat and lock modules/cards in "${label}" (${model}) — verify SFP/QSFP transceiver seating.`);
    }
  });

  // Fiber cabling checks
  checklistItems.push(
    `[ ] Dress and route incoming tapped fiber links (${stats.totalFeedCount} optical simplex/duplex strands) into TAP modules with standard bend radius.`,
    `[ ] Patch northbound and southbound TAP monitor ports to aggregation chassis ingress ports using labeled patch cables.`,
    `[ ] Connect egress tool interfaces to target security/monitoring systems (${stats.toolCount} active destinations).`,
    `[ ] Power on units, observe boot diagnostics, and verify solid green link LEDs across all active ingress/egress ports.`,
    `[ ] Perform optical power budget check (Rx power within optic specification) on aggregation ports.`,
  );

  content.push({
    table: {
      widths: ['100%'],
      body: [
        [
          {
            border: [true, true, true, true],
            borderColor: ['#101010', '#101010', '#101010', '#101010'],
            margin: [8, 8, 8, 8],
            stack: checklistItems.map((item) => ({
              text: item,
              style: 'checkItem',
              margin: [0, 2, 0, 2],
            })),
          },
        ],
      ],
    },
    margin: [0, 0, 0, 16],
  });

  // ═══════════════════════════════════════════════════════════════
  // BILL OF MATERIALS & HARDWARE MANIFEST (Work-Order Table)
  // ═══════════════════════════════════════════════════════════════
  content.push({ text: 'SECTION 02: HARDWARE MANIFEST & TRANSCEIVER ALLOCATION', style: 'sectionHeading', pageBreak: 'before' });

  const bomHeaders = [
    { text: 'SITE', style: 'tableHeader' },
    { text: 'SKU', style: 'tableHeader' },
    { text: 'DESCRIPTION', style: 'tableHeader' },
    { text: 'QTY', style: 'tableHeader', alignment: 'right' as const },
  ];

  const bomRows = (bomRowsRaw || []).map((item) => [
    { text: item.site || 'Global', style: 'tableCell' },
    { text: item.sku, style: 'tableCell', bold: true },
    { text: item.description, style: 'tableCell' },
    { text: String(item.qty), style: 'tableCell', alignment: 'right' as const, bold: true },
  ]);

  content.push({
    table: {
      headerRows: 1,
      widths: ['22%', '20%', '48%', '10%'],
      dontBreakRows: true,
      body: [bomHeaders, ...bomRows],
    },
    layout: {
      hLineWidth: () => 1,
      vLineWidth: () => 1,
      hLineColor: () => '#101010',
      vLineColor: () => '#101010',
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 0, 0, 16],
  });

  // ═══════════════════════════════════════════════════════════════
  // RACK ELEVATION DIAGRAM (If Available)
  // ═══════════════════════════════════════════════════════════════
  if (siteRackImages && Object.keys(siteRackImages).length > 0) {
    content.push({ text: 'SECTION 03: RACK ELEVATION & PHYSICAL PLACEMENT', style: 'sectionHeading' });
    Object.entries(siteRackImages).forEach(([siteName, rackImgUrl]) => {
      content.push({
        text: `Rack Layout: ${siteName}`,
        style: 'checkItemBold',
        margin: [0, 8, 0, 4],
      });
      content.push({
        image: rackImgUrl,
        width: 320,
        alignment: 'center',
        margin: [0, 0, 0, 12],
      });
    });
  }

  // Technician sign-off box
  content.push({
    table: {
      widths: ['50%', '50%'],
      dontBreakRows: true,
      body: [
        [
          {
            border: [true, true, true, true],
            borderColor: ['#101010', '#101010', '#101010', '#101010'],
            margin: [8, 8, 8, 8],
            stack: [
              { text: 'INSTALLATION TECHNICIAN SIGN-OFF', style: 'docControlLabel' },
              { text: 'Name: _______________________________', style: 'body', margin: [0, 8, 0, 4] },
              { text: 'Signature: __________________________', style: 'body', margin: [0, 4, 0, 4] },
              { text: 'Date: _______________________________', style: 'body', margin: [0, 4, 0, 0] },
            ],
          },
          {
            border: [true, true, true, true],
            borderColor: ['#101010', '#101010', '#101010', '#101010'],
            margin: [8, 8, 8, 8],
            stack: [
              { text: 'COMMISSIONING / QA APPROVAL', style: 'docControlLabel' },
              { text: 'Name: _______________________________', style: 'body', margin: [0, 8, 0, 4] },
              { text: 'Signature: __________________________', style: 'body', margin: [0, 4, 0, 4] },
              { text: 'Date: _______________________________', style: 'body', margin: [0, 4, 0, 0] },
            ],
          },
        ],
      ],
    },
    margin: [0, 14, 0, 0],
  });

  return {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: REPORT_PAGE_MARGINS,
    background: () => ({
      canvas: [
        {
          type: 'rect',
          x: 0,
          y: 0,
          w: 595.28,
          h: 841.89,
          color: '#FFFFFF',
        },
      ],
    }),
    content,
    styles: patchSheetStyleDictionary,
    defaultStyle: {
      font: 'Courier',
      color: '#101010',
      fontSize: 8.5,
    },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: 'PATCH SHEET · FIELD INSTALLATION WORK ORDER', fontSize: 7, color: '#606060' },
        { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', fontSize: 7, color: '#606060' },
      ],
      margin: [40, 10, 40, 0],
    }),
  };
}
