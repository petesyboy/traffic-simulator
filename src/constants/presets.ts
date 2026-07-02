/**
 * presets.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pre-configured visibility pipeline topologies for quick product demonstrations.
 */

import { NODE_TYPES, CONFIG_TYPES, ACTION_TYPES } from './nodeTypes';
import type { CustomNode } from '../store/store';
import type { Edge } from '@xyflow/react';

export interface PresetScenario {
  name: string;
  description: string;
  nodes: CustomNode[];
  edges: Edge[];
  trafficStreams: any[];
}

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    name: "1. Basic Traffic Filtering",
    description: "SPAN traffic mirrored and selectively routed to a Wireshark inspection tool via a basic Traffic Map.",
    nodes: [
      {
        id: "p1-span",
        type: NODE_TYPES.INPUT,
        position: { x: 50, y: 150 },
        data: { label: "Mirror SPAN Port 1", configType: CONFIG_TYPES.SPAN, linkSpeed: 10000, active: true }
      },
      {
        id: "p1-map",
        type: NODE_TYPES.MAP,
        position: { x: 280, y: 140 },
        data: { 
          label: "Core Traffic Map", 
          configType: CONFIG_TYPES.TRAFFIC_MAP,
          conditions: [{ logic: 'AND', field: 'vlan', value: '100, 200', action: 'pass' }]
        }
      },
      {
        id: "p1-tool",
        type: NODE_TYPES.TOOL,
        position: { x: 520, y: 150 },
        data: { label: "Wireshark Sensor", configType: CONFIG_TYPES.PACKET_TOOL, toolName: "Wireshark" }
      }
    ],
    edges: [
      { id: "p1-e1", source: "p1-span", sourceHandle: "out", target: "p1-map", targetHandle: "in" },
      { id: "p1-e2", source: "p1-map", sourceHandle: "out", target: "p1-tool", targetHandle: "in" }
    ],
    trafficStreams: [
      {
        id: "p1-t1",
        name: "Web Traffic (1.2 Gbps)",
        sourceNodeId: "p1-span",
        vlan: "100",
        ipSrc: "192.168.1.25",
        ipDst: "10.0.0.50",
        portSrc: "80",
        portDst: "54231",
        protocol: "tcp",
        bandwidth: 1200,
        active: true
      }
    ]
  },
  {
    name: "2. GigaSMART Optimisation",
    description: "Incoming TAP traffic optimised using Deduplication and Packet Slicing to reduce downstream tool licensing costs.",
    nodes: [
      {
        id: "p2-tap",
        type: NODE_TYPES.INPUT,
        position: { x: 50, y: 160 },
        data: { label: "TAP Link 1/1/x1", configType: CONFIG_TYPES.TAP, tappedLinksCount: 1, optics: "QSB-523T" }
      },
      {
        id: "p2-map",
        type: NODE_TYPES.MAP,
        position: { x: 280, y: 150 },
        data: { label: "Ingest Traffic Map", configType: CONFIG_TYPES.TRAFFIC_MAP, conditions: [] }
      },
      {
        id: "p2-dedup",
        type: NODE_TYPES.GIGASMART,
        position: { x: 500, y: 80 },
        data: { label: "Deduplication", configType: NODE_TYPES.GIGASMART, actionType: ACTION_TYPES.DEDUPLICATION, dedupRate: 35 }
      },
      {
        id: "p2-slice",
        type: NODE_TYPES.GIGASMART,
        position: { x: 720, y: 150 },
        data: { label: "Packet Slicing", configType: NODE_TYPES.GIGASMART, actionType: ACTION_TYPES.PACKET_SLICING, sliceSize: 64 }
      },
      {
        id: "p2-tool",
        type: NODE_TYPES.TOOL,
        position: { x: 950, y: 160 },
        data: { label: "Vectra NDR", configType: CONFIG_TYPES.PACKET_TOOL, toolName: "Vectra" }
      }
    ],
    edges: [
      { id: "p2-e1", source: "p2-tap", sourceHandle: "out", target: "p2-map", targetHandle: "in" },
      { id: "p2-e2", source: "p2-map", sourceHandle: "out", target: "p2-dedup", targetHandle: "in" },
      { id: "p2-e3", source: "p2-dedup", sourceHandle: "out", target: "p2-slice", targetHandle: "in" },
      { id: "p2-e4", source: "p2-slice", sourceHandle: "out", target: "p2-tool", targetHandle: "in" }
    ],
    trafficStreams: [
      {
        id: "p2-t1",
        name: "Backup Streams (8.5 Gbps)",
        sourceNodeId: "p2-tap",
        vlan: "200",
        ipSrc: "172.16.5.10",
        ipDst: "172.16.10.20",
        portSrc: "445",
        portDst: "61245",
        protocol: "tcp",
        bandwidth: 8500,
        active: true
      }
    ]
  },
  {
    name: "3. Federated Search Enclosure",
    description: "App Metadata generated and archived in S3 Object Storage, with Splunk querying it dynamically via Federated Search.",
    nodes: [
      {
        id: "p3-span",
        type: NODE_TYPES.INPUT,
        position: { x: 50, y: 180 },
        data: { label: "Core Switch SPAN", configType: CONFIG_TYPES.SPAN, linkSpeed: 40000, active: true }
      },
      {
        id: "p3-map",
        type: NODE_TYPES.MAP,
        position: { x: 280, y: 170 },
        data: { label: "Central Map", configType: CONFIG_TYPES.TRAFFIC_MAP, conditions: [] }
      },
      {
        id: "p3-ami",
        type: NODE_TYPES.GIGASMART,
        position: { x: 500, y: 170 },
        data: { label: "Metadata Gen", configType: NODE_TYPES.GIGASMART, actionType: ACTION_TYPES.APP_METADATA, metadataFormat: "CEF" }
      },
      {
        id: "p3-s3",
        type: NODE_TYPES.TOOL,
        position: { x: 740, y: 220 },
        data: { label: "S3 Cold Storage", configType: CONFIG_TYPES.STORAGE_TOOL, toolName: "S3 / Object Storage" }
      },
      {
        id: "p3-splunk",
        type: NODE_TYPES.TOOL,
        position: { x: 740, y: 80 },
        data: { label: "Splunk Indexer", configType: CONFIG_TYPES.METADATA_TOOL, toolName: "Splunk" }
      }
    ],
    edges: [
      { id: "p3-e1", source: "p3-span", sourceHandle: "out", target: "p3-map", targetHandle: "in" },
      { id: "p3-e2", source: "p3-map", sourceHandle: "out", target: "p3-ami", targetHandle: "in" },
      { id: "p3-e3", source: "p3-ami", sourceHandle: "out", target: "p3-s3", targetHandle: "in" },
      { id: "p3-e4", source: "p3-s3", sourceHandle: "out", target: "p3-splunk", targetHandle: "in" }
    ],
    trafficStreams: [
      {
        id: "p3-t1",
        name: "Enterprise Data (12.0 Gbps)",
        sourceNodeId: "p3-span",
        vlan: "300",
        ipSrc: "10.100.1.1",
        ipDst: "10.200.2.2",
        portSrc: "443",
        portDst: "59102",
        protocol: "tcp",
        bandwidth: 12000,
        active: true
      }
    ]
  }
];
