/**
 * gleanPromptGenerator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates an executive-level prompt artifact tailored for Gigamon's internal
 * enterprise AI assistant (Glean).
 *
 * The prompt embeds the Bill of Materials (BOM), topology architecture,
 * GigaSMART packet transformations, physical data centre footprint (RU/power/heat),
 * and signal flow representations. It instructs Glean AI to author a consultative,
 * persuasive, sales-oriented Executive Summary in Markdown for the engineering report.
 *
 * Strictly intended for internal Gigamon SE use (guarded by isInternalEdition).
 */

import type { CustomNode, TrafficStream, ToolNodeData } from '../store/types';
import type { Edge } from '@xyflow/react';
import { generateBom, getSkus } from './bomEngine';
import { buildProjectWideOpticBom } from './bom/opticPacks';
import { consolidateSimpleDeviceRows } from './bom/consolidateSimpleDevices';
import { buildPhysicalItems, parseAndConvertDimensions } from './bom/physicalItems';
import { buildTopologyStats, type TopologyStats } from './report/describeTopology';
import { describeGigaSmartFunction } from './report/gigaSmartDescriptions';
import { describeToolPurpose } from './report/toolDescriptions';
import { sanitizeSolutionName } from './exportNaming';
import { NODE_TYPES } from '../constants/nodeTypes';

export interface GleanPromptOptions {
  nodes: CustomNode[];
  edges: Edge[];
  trafficStreams?: TrafficStream[];
  scenarioName?: string | null;
  projectRegion?: string;
  projectLicenseMode?: string;
  defaultTermDuration?: string;
  peakNodeRxMbps?: Record<string, number>;
  advancedMode?: boolean;
}

/** Utility to yield to browser event loop to prevent main-thread freezing on large graphs */
const yieldEventLoop = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof setTimeout !== 'undefined') {
      setTimeout(resolve, 0);
    } else {
      resolve();
    }
  });

/**
 * Generates the complete Markdown prompt for Glean AI.
 */
export async function generateGleanExecutiveSummaryPrompt(
  options: GleanPromptOptions,
): Promise<string> {
  const {
    nodes,
    edges,
    trafficStreams = [],
    scenarioName,
    projectRegion = 'US',
    projectLicenseMode = 'Perpetual',
    defaultTermDuration = '36',
    peakNodeRxMbps = {},
  } = options;

  const cleanName = sanitizeSolutionName(scenarioName, 'Gigamon_Solution');
  const displayName = scenarioName?.trim() || 'Gigamon Visibility Solution';
  const currentDate = new Date().toISOString().split('T')[0];

  // 1. Gather topology statistics
  const stats: TopologyStats = buildTopologyStats(nodes, edges, trafficStreams);
  await yieldEventLoop();

  // 2. Gather Bill of Materials (BOM)
  const licenseMode = projectLicenseMode === 'HTL' ? 'HTL' : 'Perpetual';
  const termDuration = defaultTermDuration || '36';
  const region = projectRegion === 'EU' || projectRegion === 'UK' ? projectRegion : 'US';
  const rawBom = generateBom(nodes, edges, licenseMode, termDuration, region, false, peakNodeRxMbps);
  const skus = getSkus();
  const opticBom = buildProjectWideOpticBom(rawBom, skus);
  const finalBom = consolidateSimpleDeviceRows(opticBom);
  await yieldEventLoop();

  // 3. Gather Physical Deployment Specifications
  const physicalItems = buildPhysicalItems(nodes, finalBom);
  const totalRU = physicalItems.reduce((acc, p) => acc + p.qty * p.ruNum, 0);
  const totalWeight = physicalItems.reduce((acc, p) => acc + p.qty * p.weightNum, 0);
  const totalPower = physicalItems.reduce((acc, p) => acc + p.qty * p.powerNum, 0);
  const totalHeat = physicalItems.reduce((acc, p) => acc + p.qty * p.heatNum, 0);
  await yieldEventLoop();

  // 4. Summarise Sites
  const sitesList = Array.from(
    new Set(
      nodes
        .map((n) => (n.data?.site as string || '').trim())
        .filter(Boolean),
    ),
  );
  if (sitesList.length === 0) sitesList.push('Global / Primary Datacentre');

  // 5. Gather GigaSMART capabilities
  const gigaSmartFunctions = Object.keys(stats.gigaSmartActionCounts).map((action) => {
    return `- **${action}** (${stats.gigaSmartActionCounts[action]} instance${stats.gigaSmartActionCounts[action] > 1 ? 's' : ''}): ${describeGigaSmartFunction(action)}`;
  });

  // 6. Gather Downstream Tools
  const toolNodes = nodes.filter((n) => n.type === NODE_TYPES.TOOL);
  const toolDescriptions = toolNodes.map((n) => {
    const data = n.data as ToolNodeData;
    const toolName = data.name || (data as unknown as { label?: string }).label || 'Security/Monitoring Tool';
    const purpose = describeToolPurpose(toolName);
    return `- **${toolName}**: ${purpose}`;
  });

  // 7. Chassis Inventory
  const chassisLines = Object.entries(stats.chassisCounts).map(
    ([model, count]) => `- **${model}**: ${count} unit${count > 1 ? 's' : ''}`,
  );

  // 8. Token Budgeting: Format BOM table (with consolidation if rows > 80)
  let bomTableContent = '';
  if (finalBom.length === 0) {
    bomTableContent = '_No hardware or software components provisioned in BOM._\n';
  } else if (finalBom.length <= 80) {
    bomTableContent = [
      '| Site / Location | Category | SKU | Description | Term | Qty |',
      '| :--- | :--- | :--- | :--- | :--- | :--- |',
      ...finalBom.map(
        (item) =>
          `| ${item.site || 'Global / Primary'} | ${item.type} | \`${item.sku}\` | ${item.description.replace(/\|/g, '-')} | ${item.term || '-'} | ${item.qty} |`,
      ),
    ].join('\n');
  } else {
    // Consolidated summary table for large enterprise topologies
    const aggregated: Record<string, { site: string; type: string; desc: string; term?: string; qty: number }> = {};
    for (const item of finalBom) {
      const key = `${item.site || 'Global'}|${item.sku}`;
      if (!aggregated[key]) {
        aggregated[key] = {
          site: item.site || 'Global',
          type: item.type,
          desc: item.description,
          term: item.term,
          qty: 0,
        };
      }
      aggregated[key].qty += item.qty;
    }
    bomTableContent = [
      `_Note: Large BOM with ${finalBom.length} line items has been consolidated by SKU._\n`,
      '| Site / Location | Category | SKU | Description | Term | Total Qty |',
      '| :--- | :--- | :--- | :--- | :--- | :--- |',
      ...Object.entries(aggregated).map(
        ([key, data]) => {
          const sku = key.split('|')[1];
          return `| ${data.site} | ${data.type} | \`${sku}\` | ${data.desc.replace(/\|/g, '-')} | ${data.term || '-'} | ${data.qty} |`;
        },
      ),
    ].join('\n');
  }
  await yieldEventLoop();

  // 9. Physical items breakdown table
  const physicalTable =
    physicalItems.length > 0
      ? [
          '| Chassis / Equipment | Qty | Rack Space | Power (W) | Heat (BTU/hr) | Weight (lbs) | Dimensions (Inches) |',
          '| :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
          ...physicalItems.map((p) => {
            const { inches } = parseAndConvertDimensions(p.dimensions);
            return `| ${p.name} | ${p.qty} | ${p.ru} | ${p.power} | ${p.heat} | ${p.weightNum.toFixed(1)} | ${inches} |`;
          }),
          `| **Total Footprint** | **${physicalItems.reduce((acc, p) => acc + p.qty, 0)}** | **${totalRU} RU** | **${totalPower} W** | **${totalHeat} BTU/hr** | **${totalWeight.toFixed(1)} lbs** | - |`,
        ].join('\n')
      : '_No rack-mountable equipment required._\n';

  // 10. Traffic Streams & Profiling Specification
  const trafficSummaryText =
    'Traffic profiles, stream volumes, and specific protocol distributions will be established during customer technical scoping and site onboarding. The Gigamon architecture provides non-blocking, line-rate capture across all monitored segments regardless of protocol or packet distribution.';

  // 11. Signal Flow Text / Mermaid Representation
  let signalFlowDiagram = '';
  if (edges.length <= 100) {
    const edgeConnections = edges
      .map((e) => {
        const srcNode = nodes.find((n) => n.id === e.source);
        const tgtNode = nodes.find((n) => n.id === e.target);
        const srcName = srcNode?.data?.label || srcNode?.data?.name || srcNode?.id || 'Source';
        const tgtName = tgtNode?.data?.label || tgtNode?.data?.name || tgtNode?.id || 'Target';
        return `    "${String(srcName).replace(/"/g, "'")}" --> "${String(tgtName).replace(/"/g, "'")}"`;
      })
      .slice(0, 80);

    signalFlowDiagram = [
      '```mermaid',
      'flowchart LR',
      ...edgeConnections,
      '```',
    ].join('\n');
  } else {
    // Tiered summary representation for dense graphs
    signalFlowDiagram = [
      '```mermaid',
      'flowchart LR',
      `    TAP_SPAN["Network Ingress (${stats.monitoredLinkCount} Links / ${stats.totalFeedCount} Feeds)"] --> FABRIC["Gigamon Visibility Fabric (${Object.keys(stats.chassisCounts).join(', ') || 'Appliances'})"]`,
      '    FABRIC --> GS["GigaSMART Optimisation & Inspection Engines"]',
      `    GS --> TOOLS["Security & Monitoring Tools (${toolNodes.length} Tools)"]`,
      '```',
    ].join('\n');
  }

  // 12. Assemble Full Prompt Markdown
  return `# GIGAMON GLEAN AI PROMPT: SOLUTION EXECUTIVE SUMMARY GENERATION

> **Instructions for the Gigamon Solutions Engineer:**
> 1. Copy or export this complete prompt.
> 2. Open Gigamon **Glean AI** (internal assistant).
> 3. Paste this entire prompt into the chat window.
> 4. *(Recommended)* Attach the exported architecture diagram file: \`Gigamon_Architecture_Diagram_${cleanName}.png\`.
> 5. Submit to Glean.
> 6. Copy the resulting Markdown output and paste it directly into the **Executive Summary / Notes** box in the Simulator Report Modal.

---

## ROLE & OBJECTIVE FOR GLEAN AI

Act as an elite **Gigamon Principal Solutions Engineer & Enterprise Architecture Consultant**.

You are writing the opening **Executive Summary** for a formal customer-facing **Gigamon Engineering Architecture & Solution Report**.

Your goal is to author a compelling, persuasive, sales-oriented, and technically sound Executive Summary in **clean Markdown format**. 
It must articulate:
1. **The Core Business Problem & Strategic Value**: Why the customer needs this visibility fabric (e.g. eliminating monitoring blind spots, defending against security evasion, optimising tool costs).
2. **What the Solution Does & How it Does It**: The end-to-end architecture from passive optical tapping and aggregation to intelligent GigaSMART packet processing and precision tool distribution.
3. **Key Strategic & Financial Benefits**: Highlighting traffic reduction (ROI), tool capacity preservation, operational resilience, and rapid incident response (MTTR).
4. **Physical & Environmental Footprint**: Summary of data centre space (RU), thermal efficiency, and power budgets.
5. **Scope Considerations & Key Assumptions**: Specific implementation assumptions regarding cabling, optical splitters, power feeds, and tool capacity.

---

## STRICT OUTPUT REQUIREMENTS & CONSTRAINTS

- **Format & Deliverable**: Produce the response as a **single, directly copy-and-pasteable Markdown file (\`.md\`)**. 
  - Do NOT wrap the entire response in a top-level code fence (no \` \`\`markdown \` or \` \`\` \` wrapping around the whole output).
  - Do NOT include any conversational preamble, intro, or sign-off (e.g. absolutely no "Here is the executive summary", "Sure, here is your markdown", or "Let me know if you need anything else").
  - Start immediately with the first Markdown heading (\`### Executive Solution Overview & Strategic Value\`).
  - The output must be 100% valid Markdown ready to be copied with a single click and pasted directly into the simulator's **Executive Summary / Notes** field or saved directly as a \`.md\` file.
- **Language & Spelling**: Use **British English spelling** conventions throughout (e.g., *analyse*, *optimise*, *centre*, *colour*, *prioritisation*).
- **Tone**: Consultative, authoritative, customer-focused, persuasive, and technically precise.
- **Section Structure**: You MUST structure your response into the following four distinct sections:
  - \`### Executive Solution Overview & Strategic Value\`
  - \`### Architecture & Operational Mechanics (What it does & How it does it)\`
  - \`### Key Business & Technical Benefits\`
  - \`### Scope Considerations & Key Assumptions\`
- **CRITICAL PDF RENDERING HOOK**: Under the heading \`### Scope Considerations & Key Assumptions\`, format all items as a clean Markdown bullet list (\`- ...\`). The simulator's PDF generation engine automatically parses this exact heading and bullet format into an official highlighted callout box in the customer's PDF report.
- **Hardware Architecture Rules**: Remember that in Gigamon architectures, every optical TAP produces two distinct output feeds (Northbound and Southbound duplex split), requiring two dedicated transceivers/ports on the fabric for 100% full-duplex coverage without packet loss.

---

## SOLUTION ARCHITECTURE & TECHNICAL SPECIFICATION

### 1. Project Metadata
- **Customer / Project Name**: ${displayName}
- **Date**: ${currentDate}
- **Region**: ${projectRegion}
- **Licensing Model**: ${projectLicenseMode} (${termDuration}-month term)
- **Deployment Sites**: ${sitesList.join(', ')}

### 2. Network Ingress & Visibility Telemetry
- **Monitored Network Links**: ${stats.monitoredLinkCount} link${stats.monitoredLinkCount !== 1 ? 's' : ''}
- **Total Ingress Traffic Feeds**: ${stats.totalFeedCount} optical feeds (${stats.inputCounts.tap} TAP modules, ${stats.inputCounts.span + stats.inputCounts.erspan + stats.inputCounts.other} SPAN/virtual feeds)
- **Ingress Fabric Delivery**: Non-blocking, multi-terabit line-rate ready architecture
- **Tapping Infrastructure**: Passive optical TAPs deployed in high-density M100T / M200T rack trays, delivering zero packet loss and zero latency overhead.

### 3. Visibility Fabric Appliances & Chassis
${chassisLines.length > 0 ? chassisLines.join('\n') : '- Virtual / Cloud Visibility Nodes'}

### 4. GigaSMART Packet Intelligence & Transformations
${gigaSmartFunctions.length > 0 ? gigaSmartFunctions.join('\n') : '- Core flow mapping, filtering, and aggregation without advanced GigaSMART packet modifications.'}

### 5. Downstream Security & Observability Tools
${toolDescriptions.length > 0 ? toolDescriptions.join('\n') : '- Centralised Network Operations & Security Operations Tool Farm'}

### 6. Traffic Streams & Profiling
${trafficSummaryText}

### 7. Physical Data Centre Footprint
${physicalTable}

### 8. Bill of Materials (BOM) Manifest
${bomTableContent}

### 9. End-to-End Signal Path Diagram
${signalFlowDiagram}

---

## PROMPT EXECUTION TASK

Using the technical and commercial architecture data above, output the formal **Executive Summary** as a single copy-and-pasteable Markdown file following the exact 4-section structure and strict formatting constraints outlined above (no intro greetings, no conversational commentary, no enclosing outer code blocks; start immediately with \`### Executive Solution Overview & Strategic Value\`).
`;
}
