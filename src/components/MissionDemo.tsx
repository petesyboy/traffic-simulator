/**
 * MissionDemo.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Interactive "Deep Observability Eliminates Blind Spots" presentation demo.
 * Recreates the Organization A (Chaos & Blind Spots) -> Organization B (Gigamon
 * Deep Observability Pipeline) architectural showcase with true hierarchical
 * topology, cloud workloads, chaotic multi-coloured spaghetti wiring, sleek
 * metallic pipeline cylinder, and interactive presenter HUD playback controls.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../store/store';
import { useReactFlow } from '@xyflow/react';
import { CONFIG_TYPES } from '../constants/nodeTypes';

// Network Hierarchy Topology (Staggered multi-tier structure for unblocked routing)
const INFRA_NODES = [
  { id: 'r1', label: 'Router R1', configType: 'Router', x: 180, y: 300 },
  { id: 'r2', label: 'Router R2', configType: 'Router', x: 580, y: 340 },
  { id: 'coresw1', label: 'Core SW1', configType: 'Switch', x: 180, y: 450 },
  { id: 'coresw2', label: 'Core SW2', configType: 'Switch', x: 580, y: 490 },
  { id: 'distsw1', label: 'Dist SW1', configType: 'Switch', x: 180, y: 600 },
  { id: 'distsw2', label: 'Dist SW2', configType: 'Switch', x: 580, y: 640 },
  { id: 'acc1', label: 'Access 1', configType: 'Switch', x: 40, y: 780 },
  { id: 'acc2', label: 'Access 2', configType: 'Switch', x: 240, y: 780 },
  { id: 'acc3', label: 'Access 3', configType: 'Switch', x: 440, y: 780 },
  { id: 'acc4', label: 'Access 4', configType: 'Switch', x: 640, y: 780 },
  { id: 'acc5', label: 'Access 5', configType: 'Switch', x: 40, y: 900 },
  { id: 'acc6', label: 'Access 6', configType: 'Switch', x: 240, y: 900 },
  { id: 'acc7', label: 'Access 7', configType: 'Switch', x: 440, y: 900 },
  { id: 'acc8', label: 'Access 8', configType: 'Switch', x: 640, y: 900 },
];

// Internal Network Backbone Interconnects (Cloud <-> Routers <-> Core <-> Dist <-> Access)
const NETWORK_BACKBONE_LINKS: Array<[string, string, string?, string?]> = [
  ['mission-cloud', 'mission-r1', 'out-down', 'in-top'],
  ['mission-cloud', 'mission-r2', 'out-down', 'in-top'],
  ['mission-r1', 'mission-coresw1', 'out-bottom', 'in-top'],
  ['mission-r1', 'mission-coresw2', 'out-bottom', 'in-top'],
  ['mission-r2', 'mission-coresw1', 'out-bottom', 'in-top'],
  ['mission-r2', 'mission-coresw2', 'out-bottom', 'in-top'],
  ['mission-coresw1', 'mission-distsw1', 'out-bottom', 'in-top'],
  ['mission-coresw1', 'mission-distsw2', 'out-bottom', 'in-top'],
  ['mission-coresw2', 'mission-distsw1', 'out-bottom', 'in-top'],
  ['mission-coresw2', 'mission-distsw2', 'out-bottom', 'in-top'],
  ['mission-distsw1', 'mission-acc1', 'out-bottom', 'in-top'],
  ['mission-distsw1', 'mission-acc2', 'out-bottom', 'in-top'],
  ['mission-distsw1', 'mission-acc3', 'out-bottom', 'in-top'],
  ['mission-distsw1', 'mission-acc4', 'out-bottom', 'in-top'],
  ['mission-distsw2', 'mission-acc5', 'out-bottom', 'in-top'],
  ['mission-distsw2', 'mission-acc6', 'out-bottom', 'in-top'],
  ['mission-distsw2', 'mission-acc7', 'out-bottom', 'in-top'],
  ['mission-distsw2', 'mission-acc8', 'out-bottom', 'in-top'],
];

// Right Column: Full 12-Tool Stack matching the presentation slide
const TOOL_NODES = [
  { id: 'fso', label: 'FSO', category: 'Cloud Observability', toolName: 'Dynatrace', y: 150 },
  { id: 'cdr', label: 'CDR', category: 'Cloud Detection', toolName: 'CrowdStrike', y: 215 },
  { id: 'fw', label: 'FIREWALL', category: 'Inline Security', toolName: 'Palo Alto Networks', y: 280 },
  { id: 'dlp', label: 'DLP', category: 'Data Protection', toolName: 'Symantec DLP', y: 345 },
  { id: 'waf', label: 'WAF', category: 'App Security', toolName: 'F5 WAF', y: 410 },
  { id: 'ndr', label: 'NDR', category: 'Network Detection', toolName: 'Darktrace', y: 475 },
  { id: 'apm', label: 'APM', category: 'Performance', toolName: 'AppDynamics', y: 540 },
  { id: 'grc', label: 'GRC', category: 'Compliance', toolName: 'ServiceNow GRC', y: 605 },
  { id: 'apisec', label: 'API SEC', category: 'API Protection', toolName: 'Noname Security', y: 670 },
  { id: 'npm', label: 'NPM', category: 'Network Performance', toolName: 'Riverbed NPM', y: 735 },
  { id: 'ueba', label: 'UEBA', category: 'User Analytics', toolName: 'Exabeam UEBA', y: 800 },
  { id: 'siem', label: 'SIEM', category: 'Security Information', toolName: 'Splunk', y: 865 },
];

const TOOL_X = 1750;
const PIPELINE_X = 1260;
const PIPELINE_Y = 170;

// Multi-coloured chaotic pairs for "Organization A (Chaos & Blind Spots)" - high-contrast in light & dark themes
const CHAOS_PAIRS: Array<{ from: string; to: string; color: string; showTap?: boolean; curvature?: number }> = [
  { from: 'mission-cloud', to: 'mission-tool-fso', color: '#0284c7', showTap: true, curvature: 0.2 },
  { from: 'mission-cloud', to: 'mission-tool-cdr', color: '#7c3aed', showTap: true, curvature: 0.35 },
  { from: 'mission-r1', to: 'mission-tool-fw', color: '#2563eb', showTap: true, curvature: -0.15 },
  { from: 'mission-r1', to: 'mission-tool-siem', color: '#d97706', curvature: 0.5 },
  { from: 'mission-r2', to: 'mission-tool-ndr', color: '#7c3aed', showTap: true, curvature: 0.25 },
  { from: 'mission-r2', to: 'mission-tool-waf', color: '#059669', curvature: -0.1 },
  { from: 'mission-coresw1', to: 'mission-tool-dlp', color: '#ea580c', showTap: true, curvature: -0.2 },
  { from: 'mission-coresw1', to: 'mission-tool-apm', color: '#0891b2', curvature: 0.3 },
  { from: 'mission-coresw2', to: 'mission-tool-grc', color: '#db2777', showTap: true, curvature: 0.2 },
  { from: 'mission-coresw2', to: 'mission-tool-siem', color: '#d97706', curvature: 0.45 },
  { from: 'mission-distsw1', to: 'mission-tool-apisec', color: '#7c3aed', showTap: true, curvature: -0.25 },
  { from: 'mission-distsw1', to: 'mission-tool-npm', color: '#0d9488', curvature: 0.15 },
  { from: 'mission-distsw2', to: 'mission-tool-ueba', color: '#65a30d', showTap: true, curvature: 0.25 },
  { from: 'mission-distsw2', to: 'mission-tool-fw', color: '#2563eb', curvature: -0.4 },
  { from: 'mission-acc1', to: 'mission-tool-waf', color: '#059669', showTap: true, curvature: -0.35 },
  { from: 'mission-acc1', to: 'mission-tool-siem', color: '#d97706', curvature: 0.2 },
  { from: 'mission-acc2', to: 'mission-tool-dlp', color: '#ea580c', curvature: -0.25 },
  { from: 'mission-acc3', to: 'mission-tool-ndr', color: '#7c3aed', showTap: true, curvature: -0.15 },
  { from: 'mission-acc4', to: 'mission-tool-apm', color: '#0891b2', curvature: -0.1 },
  { from: 'mission-acc5', to: 'mission-tool-grc', color: '#db2777', showTap: true, curvature: 0.1 },
  { from: 'mission-acc6', to: 'mission-tool-apisec', color: '#7c3aed', curvature: 0.2 },
  { from: 'mission-acc7', to: 'mission-tool-npm', color: '#0d9488', showTap: true, curvature: 0.25 },
  { from: 'mission-acc8', to: 'mission-tool-ueba', color: '#65a30d', curvature: 0.3 },
];

// Clean Organization B convergence trunk mapping
const CONVERGE_TRUNK_X = PIPELINE_X - 80;

// High-bandwidth traffic streams representing the hybrid enterprise estate
const MISSION_TRAFFIC_STREAMS = [
  { nodeId: 'cloud', label: 'Cloud VPC & Microservices', vlan: '100', ipSrc: '172.16.1.5', portSrc: '443', portDst: '443', protocol: 'tcp' as const, bandwidth: 18000 },
  { nodeId: 'r1', label: 'Router R1 - Core Uplink', vlan: '110', ipSrc: '10.10.1.1', portSrc: '49152', portDst: '443', protocol: 'tcp' as const, bandwidth: 14000 },
  { nodeId: 'r2', label: 'Router R2 - Redundant Uplink', vlan: '111', ipSrc: '10.10.2.1', portSrc: '49153', portDst: '443', protocol: 'tcp' as const, bandwidth: 12000 },
  { nodeId: 'coresw1', label: 'Core SW1 - Datacentre Fabric', vlan: '120', ipSrc: '10.11.1.1', portSrc: '50100', portDst: '443', protocol: 'tcp' as const, bandwidth: 9000 },
  { nodeId: 'coresw2', label: 'Core SW2 - Datacentre Fabric', vlan: '121', ipSrc: '10.11.2.1', portSrc: '50101', portDst: '443', protocol: 'tcp' as const, bandwidth: 8500 },
  { nodeId: 'distsw1', label: 'Dist SW1 - Campus Aggregate', vlan: '130', ipSrc: '10.12.1.1', portSrc: '50200', portDst: '443', protocol: 'tcp' as const, bandwidth: 5500 },
  { nodeId: 'distsw2', label: 'Dist SW2 - Campus Aggregate', vlan: '131', ipSrc: '10.12.2.1', portSrc: '50201', portDst: '443', protocol: 'tcp' as const, bandwidth: 5000 },
  { nodeId: 'acc1', label: 'Access 1 - Finance & ERP', vlan: '201', ipSrc: '10.20.1.50', portSrc: '51000', portDst: '443', protocol: 'tcp' as const, bandwidth: 4500 },
  { nodeId: 'acc2', label: 'Access 2 - Engineering Workstations', vlan: '202', ipSrc: '10.20.2.50', portSrc: '51001', portDst: '8080', protocol: 'tcp' as const, bandwidth: 3800 },
  { nodeId: 'acc3', label: 'Access 3 - Branch Office VPN', vlan: '203', ipSrc: '10.20.3.50', portSrc: '51002', portDst: '500', protocol: 'udp' as const, bandwidth: 3200 },
  { nodeId: 'acc4', label: 'Access 4 - Wireless AP Aggregate', vlan: '204', ipSrc: '10.20.4.50', portSrc: '51003', portDst: '443', protocol: 'tcp' as const, bandwidth: 4000 },
  { nodeId: 'acc5', label: 'Access 5 - IoT & Building Controls', vlan: '205', ipSrc: '10.20.5.50', portSrc: '51004', portDst: '1883', protocol: 'tcp' as const, bandwidth: 2100 },
  { nodeId: 'acc6', label: 'Access 6 - HR & Internal Portals', vlan: '206', ipSrc: '10.20.6.50', portSrc: '51005', portDst: '443', protocol: 'tcp' as const, bandwidth: 2500 },
  { nodeId: 'acc7', label: 'Access 7 - VoIP & Media Streams', vlan: '207', ipSrc: '10.20.7.50', portSrc: '51006', portDst: '5060', protocol: 'udp' as const, bandwidth: 3400 },
  { nodeId: 'acc8', label: 'Access 8 - Guest & DMZ', vlan: '208', ipSrc: '10.20.8.50', portSrc: '51007', portDst: '443', protocol: 'tcp' as const, bandwidth: 2800 },
];

const STEP_DEFINITIONS = [
  { step: 1, name: '1. Topology', label: 'Hybrid Network Topology', duration: 4 },
  { step: 2, name: '2. Org A (Chaos)', label: 'Organization A: Chaos & Blind Spots', duration: 6 },
  { step: 3, name: '3. Pipeline', label: 'Gigamon Deep Observability Pipeline', duration: 5 },
  { step: 4, name: '4. Org B (Solution)', label: 'Organization B: Unified Pipeline', duration: 5 },
  { step: 5, name: '5. Live ROI', label: 'Live Traffic Optimization & ROI', duration: 25 },
];

export const MissionDemo: React.FC = () => {
  const isDemoActive = useStore((s) => s.isMissionDemoActive);
  const currentStep = useStore((s) => s.missionDemoStep);
  const demoStatus = useStore((s) => s.missionDemoStatus);
  const setDemoActive = useStore((s) => s.setMissionDemoActive);
  const setDemoStep = useStore((s) => s.setMissionDemoStep);
  const setDemoStatus = useStore((s) => s.setMissionDemoStatus);

  const clearCanvas = useStore((s) => s.clearCanvas);
  const addNode = useStore((s) => s.addNode);
  const setEdges = useStore((s) => s.setEdges);
  const addTrafficStream = useStore((s) => s.addTrafficStream);
  const toggleSimulation = useStore((s) => s.toggleSimulation);
  const setAdvancedMode = useStore((s) => s.setAdvancedMode);
  const collapseTrafficGenerator = useStore((s) => s.collapseTrafficGenerator);

  const { fitView } = useReactFlow();

  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopDemo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (useStore.getState().isRunning) toggleSimulation();
    setDemoActive(false);
    setDemoStep(0);
    setDemoStatus('');
    setIsPaused(false);
  }, [setDemoActive, setDemoStatus, setDemoStep, toggleSimulation]);

  // Step runner logic
  const executeStep = useCallback((step: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    setDemoStep(step);
    const stepDef = STEP_DEFINITIONS.find((d) => d.step === step);
    const stepDuration = stepDef ? stepDef.duration : 5;
    setCountdown(stepDuration);

    let fitTargets: Array<{ id: string }> | undefined;

    switch (step) {
      case 0:
      case 1: {
        setDemoStatus('Enterprise Hybrid Infrastructure: Cloud VPCs, Core Datacentre, Distribution and Access switches.');
        if (useStore.getState().isRunning) toggleSimulation();
        clearCanvas();
        setAdvancedMode(false);
        collapseTrafficGenerator();

        // 1. Add Cloud Workloads Node
        addNode({
          id: 'mission-cloud',
          type: 'missionCloudNode',
          position: { x: 300, y: 150 },
          className: 'mission-demo-node',
          data: { label: 'Hybrid Cloud Estate (AWS / Azure / VPC)', configType: 'Cloud' }
        });

        // 2. Add Network Switches & Routers
        INFRA_NODES.forEach((n) => {
          addNode({
            id: `mission-${n.id}`,
            type: 'inputNode',
            position: { x: n.x, y: n.y },
            className: 'mission-demo-node',
            data: { label: n.label, configType: n.configType }
          });
        });

        // 3. Add Internal Backbone Mesh Links
        setEdges(
          NETWORK_BACKBONE_LINKS.map(([src, tgt, srcH, tgtH], idx) => ({
            id: `mission-bb-${idx + 1}`,
            source: src,
            target: tgt,
            sourceHandle: srcH || 'out-bottom',
            targetHandle: tgtH || 'in-top',
            type: 'missionBackboneEdge',
            className: 'mission-demo-edge',
          }))
        );

        fitTargets = undefined; // Fit full canvas
        break;
      }

      case 2: {
        setDemoStatus('Organization A (Chaos & Blind Spots): Unmanaged point-to-point SPAN/TAP connections create tool sprawl, blind spots, and high TCO.');
        // Add 12 Destination Tools
        TOOL_NODES.forEach((t) => {
          addNode({
            id: `mission-tool-${t.id}`,
            type: 'toolNode',
            position: { x: TOOL_X, y: t.y },
            className: 'mission-demo-node',
            data: { label: t.label, toolName: t.toolName, configType: CONFIG_TYPES.PACKET_TOOL, ingestLimitMbps: 100000 }
          });
        });

        // Build backbone links + chaotic multi-coloured edges
        const backboneEdges = NETWORK_BACKBONE_LINKS.map(([src, tgt, srcH, tgtH], idx) => ({
          id: `mission-bb-${idx + 1}`,
          source: src,
          target: tgt,
          sourceHandle: srcH || 'out-bottom',
          targetHandle: tgtH || 'in-top',
          type: 'missionBackboneEdge',
          className: 'mission-demo-edge',
        }));

        const chaosEdges = CHAOS_PAIRS.map((pair, idx) => ({
          id: `mission-chaos-${idx + 1}`,
          source: pair.from,
          sourceHandle: 'out',
          target: pair.to,
          targetHandle: 'in',
          type: 'missionChaosEdge',
          className: 'mission-demo-edge mission-chaos-active',
          data: { color: pair.color, showTapBox: pair.showTap, curvature: pair.curvature ?? 0.28 }
        }));

        setEdges([...backboneEdges, ...chaosEdges]);
        fitTargets = undefined;
        break;
      }

      case 3: {
        setDemoStatus('Transformation: The Gigamon Deep Observability Pipeline centralises traffic intelligence, filtering, and de-duplication.');
        // Remove chaos edges, retain backbone
        const backboneEdges = NETWORK_BACKBONE_LINKS.map(([src, tgt, srcH, tgtH], idx) => ({
          id: `mission-bb-${idx + 1}`,
          source: src,
          target: tgt,
          sourceHandle: srcH || 'out-bottom',
          targetHandle: tgtH || 'in-top',
          type: 'missionBackboneEdge',
          className: 'mission-demo-edge',
        }));
        setEdges(backboneEdges);

        // Add the iconic metallic Gigamon Pipeline Centerpiece
        addNode({
          id: 'mission-pipeline',
          type: 'missionPipelineNode',
          position: { x: PIPELINE_X, y: PIPELINE_Y },
          className: 'mission-demo-node',
          data: {
            label: 'Gigamon Deep Observability Pipeline',
            model: 'HC1-Plus',
            hideModelLabel: true,
            configType: 'Chassis',
            installedBoards: { 'Slot 1': 'HC1-Plus Base' },
            optics: [{ board: 'Base', optic: 'SFP-532T', qty: 24 }],
            conditions: [{ field: 'vlan', value: '999', action: 'drop' }],
            gigaSmartApps: [
              { id: 'mission-dedup', label: 'Packet De-duplication', actionType: 'Deduplication', dedupRate: 28 },
              { id: 'mission-appmeta', label: 'Application Metadata', actionType: 'Application Metadata' },
              { id: 'mission-ssl', label: 'SSL/TLS Decryption', actionType: 'SSL Decryption' }
            ]
          }
        });

        fitTargets = [{ id: 'mission-pipeline' }];
        break;
      }

      case 4: {
        setDemoStatus('Organization B (Unified Observability): Clean corporate orange bus taps converge from all tiers into the Gigamon Pipeline, feeding tools with zero noise.');
        const backboneEdges = NETWORK_BACKBONE_LINKS.map(([src, tgt, srcH, tgtH], idx) => ({
          id: `mission-bb-${idx + 1}`,
          source: src,
          target: tgt,
          sourceHandle: srcH || 'out-bottom',
          targetHandle: tgtH || 'in-top',
          type: 'missionBackboneEdge',
          className: 'mission-demo-edge',
        }));

        // Convergence bus edges (Cloud + Infra -> Pipeline)
        const cloudConverge = [{
          id: 'mission-bus-cloud',
          source: 'mission-cloud',
          sourceHandle: 'out-down',
          target: 'mission-pipeline',
          targetHandle: 'in-cloud',
          type: 'missionBusEdge',
          className: 'mission-demo-edge',
          data: { trunkX: CONVERGE_TRUNK_X, dotAtSource: true, color: '#ff9800' }
        }];

        const getTargetHandleForNode = (id: string) => {
          if (id === 'r1') return 'in-r1';
          if (id === 'r2') return 'in-r2';
          if (id === 'coresw1') return 'in-core1';
          if (id === 'coresw2') return 'in-core2';
          if (id.startsWith('dist')) return 'in-dist';
          return 'in-acc';
        };

        const infraConverge = INFRA_NODES.map((n, idx) => ({
          id: `mission-bus-infra-${idx + 1}`,
          source: `mission-${n.id}`,
          sourceHandle: 'out',
          target: 'mission-pipeline',
          targetHandle: getTargetHandleForNode(n.id),
          type: 'missionBusEdge',
          className: 'mission-demo-edge',
          data: { trunkX: CONVERGE_TRUNK_X, dotAtSource: true, color: '#ff9800' }
        }));

        // Divergence direct parallel feeds from each pipeline output handle to its tool
        const toolDiverge = TOOL_NODES.map((t, idx) => ({
          id: `mission-bus-tool-${idx + 1}`,
          source: 'mission-pipeline',
          sourceHandle: `out-${t.id}`,
          target: `mission-tool-${t.id}`,
          targetHandle: 'in',
          type: 'default',
          className: 'mission-demo-edge',
          style: { stroke: '#ff9800', strokeWidth: '2.5px' },
        }));

        setEdges([...backboneEdges, ...cloudConverge, ...infraConverge, ...toolDiverge]);
        fitTargets = undefined;
        break;
      }

      case 5: {
        setDemoStatus('Live Traffic Simulation: Full traffic flow active — GigaSMART drops VLAN 999 broadcast clutter and de-duplicates traffic by ~30%, saving massive tool licensing costs.');
        
        // Inject Traffic Streams across Hybrid Estate
        MISSION_TRAFFIC_STREAMS.forEach((s, idx) => {
          const gbps = (s.bandwidth / 1000).toFixed(1).replace(/\.0$/, '');
          addTrafficStream({
            id: `mission-ts-${idx + 1}`,
            name: `${s.label} (${gbps} Gbps)`,
            sourceNodeId: s.nodeId === 'cloud' ? 'mission-cloud' : `mission-${s.nodeId}`,
            vlan: s.vlan,
            ipSrc: s.ipSrc,
            ipDst: '10.10.99.1',
            portSrc: s.portSrc,
            portDst: s.portDst,
            protocol: s.protocol,
            bandwidth: s.bandwidth,
            active: true,
            drift: 1,
            lastDriftUpdate: 0
          });
        });

        // Add VLAN 999 legacy broadcast noise stream (filtered by Gigamon Pipeline)
        addTrafficStream({
          id: `mission-ts-${MISSION_TRAFFIC_STREAMS.length + 1}`,
          name: 'Dist SW1 - Legacy Broadcast Noise, VLAN 999 (6.0 Gbps)',
          sourceNodeId: 'mission-distsw1',
          vlan: '999',
          ipSrc: '10.30.1.1',
          ipDst: '255.255.255.255',
          portSrc: '17500',
          portDst: '17500',
          protocol: 'udp',
          bandwidth: 6000,
          active: true,
          drift: 1,
          lastDriftUpdate: 0
        });

        if (!useStore.getState().isRunning) toggleSimulation();
        fitTargets = undefined;
        break;
      }

      default:
        executeStep(1);
        return;
    }

    // Auto-advance countdown loop
    let remaining = stepDuration;
    countdownIntervalRef.current = setInterval(() => {
      if (!isPaused) {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          const nextStep = step >= 5 ? 1 : step + 1;
          executeStep(nextStep);
        }
      }
    }, 1000);

    // Smooth Pan & Zoom fitView
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        try {
          fitView(
            fitTargets
              ? { duration: 800, padding: 0.35, nodes: fitTargets, maxZoom: 1.1 }
              : { duration: 800, padding: 0.35, maxZoom: 0.85, minZoom: 0.2 }
          );
        } catch (e) {
          console.warn('fitView failed', e);
        }
      });
    });
  }, [addNode, addTrafficStream, clearCanvas, collapseTrafficGenerator, fitView, isPaused, setAdvancedMode, setDemoStatus, setDemoStep, setEdges, toggleSimulation]);

  // Initial trigger when demo starts
  useEffect(() => {
    if (isDemoActive) {
      executeStep(1);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isDemoActive, executeStep]);

  if (!isDemoActive) return null;

  return (
    <div
      className="mission-control-hud"
      style={{
        position: 'fixed',
        top: '55px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(12px)',
        border: '2px solid #ff9800',
        borderRadius: '14px',
        padding: '12px 20px',
        zIndex: 1000,
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(255, 152, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        color: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif',
        minWidth: '850px',
        maxWidth: '92vw',
      }}
    >
      {/* Top Header Row: Title, Step Pills, Playback Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
        {/* Title & Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#ff9800',
              boxShadow: '0 0 10px #ff9800',
              animation: 'pulse 2s infinite',
            }}
          />
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#ff9800', fontWeight: 800, letterSpacing: '0.1em' }}>
              MISSION DEMO • EXECUTIVE VALUE SHOWCASE
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>
              Deep Observability Eliminates Blind Spots
            </div>
          </div>
        </div>

        {/* Step Navigation Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.4)', padding: '4px 6px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
          {STEP_DEFINITIONS.map((def) => {
            const isCur = currentStep === def.step;
            return (
              <button
                key={def.step}
                onClick={() => executeStep(def.step)}
                style={{
                  background: isCur ? '#ea580c' : 'transparent',
                  color: isCur ? '#fff' : '#94a3b8',
                  border: 'none',
                  borderRadius: '5px',
                  padding: '5px 10px',
                  fontSize: '11px',
                  fontWeight: isCur ? 800 : 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isCur ? '0 2px 8px rgba(234, 88, 12, 0.4)' : 'none',
                }}
              >
                {def.name}
              </button>
            );
          })}
        </div>

        {/* Playback Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Previous Step */}
          <button
            onClick={() => executeStep(Math.max(1, currentStep - 1))}
            disabled={currentStep <= 1}
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: currentStep <= 1 ? '#475569' : '#e2e8f0',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
              cursor: currentStep <= 1 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
            }}
            title="Previous Step"
          >
            ⏪
          </button>

          {/* Pause / Play */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            style={{
              background: isPaused ? '#10b981' : 'rgba(255,255,255,0.08)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title={isPaused ? 'Resume Auto-Play' : 'Pause Auto-Play'}
          >
            {isPaused ? '▶ Play' : '⏸ Pause'}
          </button>

          {/* Next Step */}
          <button
            onClick={() => executeStep(currentStep >= 5 ? 1 : currentStep + 1)}
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: '#e2e8f0',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
            title="Next Step"
          >
            ⏩
          </button>

          {/* Restart */}
          <button
            onClick={() => executeStep(1)}
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
            title="Restart Presentation"
          >
            🔄
          </button>

          {/* Stop / Exit */}
          <button
            onClick={stopDemo}
            style={{
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#b91c1c')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#dc2626')}
          >
            ⏹ Exit Demo
          </button>
        </div>
      </div>

      {/* Middle Row: Live Step Narrative & Timer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.3)', padding: '8px 14px', borderRadius: '8px', borderLeft: '4px solid #ea580c' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', lineHeight: 1.4 }}>
          {demoStatus}
        </span>
        {!isPaused && countdown > 0 && (
          <span style={{ fontSize: '11px', color: '#ff9800', fontWeight: 'bold', whiteSpace: 'nowrap', marginLeft: '16px' }}>
            Next in {countdown}s
          </span>
        )}
        {isPaused && (
          <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold', whiteSpace: 'nowrap', marginLeft: '16px' }}>
            ⏸ Paused
          </span>
        )}
      </div>

      {/* Bottom Value Takeaways Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>🛡️</span>
          <div>
            <div style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#38bdf8' }}>0 Blind Spots</div>
            <div style={{ fontSize: '8.5px', color: '#94a3b8' }}>100% Pervasive Visibility</div>
          </div>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>📉</span>
          <div>
            <div style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#4ade80' }}>35%+ Ingest Savings</div>
            <div style={{ fontSize: '8.5px', color: '#94a3b8' }}>De-dup & Noise Filtering</div>
          </div>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>🔓</span>
          <div>
            <div style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#a78bfa' }}>SSL/TLS Decryption</div>
            <div style={{ fontSize: '8.5px', color: '#94a3b8' }}>Decrypt once, feed all tools</div>
          </div>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>☁️</span>
          <div>
            <div style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#f59e0b' }}>Hybrid Cloud Unified</div>
            <div style={{ fontSize: '8.5px', color: '#94a3b8' }}>AWS, Azure, Core & Edge</div>
          </div>
        </div>
      </div>
    </div>
  );
};
