import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { useReactFlow } from '@xyflow/react';
import { CONFIG_TYPES } from '../constants/nodeTypes';

// Left column: routers, core/dist switches, and 8 access switches - the
// "infrastructure" side of the before/after story. Rendered as inputNode so
// each gets a single 'out' source handle, matching how they're always the
// origin of an edge in both the messy and clean topologies.
const INFRA_NODES = [
  { id: 'r1', label: 'Router R1', configType: 'Router' },
  { id: 'r2', label: 'Router R2', configType: 'Router' },
  { id: 'coresw1', label: 'Core SW1', configType: 'Switch' },
  { id: 'coresw2', label: 'Core SW2', configType: 'Switch' },
  { id: 'distsw1', label: 'Dist SW1', configType: 'Switch' },
  { id: 'distsw2', label: 'Dist SW2', configType: 'Switch' },
  { id: 'acc1', label: 'Access1', configType: 'Switch' },
  { id: 'acc2', label: 'Access2', configType: 'Switch' },
  { id: 'acc3', label: 'Access3', configType: 'Switch' },
  { id: 'acc4', label: 'Access4', configType: 'Switch' },
  { id: 'acc5', label: 'Access5', configType: 'Switch' },
  { id: 'acc6', label: 'Access6', configType: 'Switch' },
  { id: 'acc7', label: 'Access7', configType: 'Switch' },
  { id: 'acc8', label: 'Access8', configType: 'Switch' },
].map((n, i) => ({ ...n, y: 40 + i * 100 }));

// Right column: the 10 point security/monitoring tools every infra node is
// wired to directly in the "before" state.
const TOOL_NODES = [
  { id: 'fw', label: 'Firewall' },
  { id: 'dlp', label: 'DLP' },
  { id: 'waf', label: 'WAF' },
  { id: 'ndr', label: 'NDR' },
  { id: 'apm', label: 'APM' },
  { id: 'grc', label: 'GRC' },
  { id: 'apisec', label: 'API SEC' },
  { id: 'npm', label: 'NPM' },
  { id: 'ueba', label: 'UEBA' },
  { id: 'siem', label: 'SIEM' },
].map((n, i) => ({ ...n, y: 40 + i * 130 }));

// Deliberately non-sequential pairings so lines cross visually in the
// "before" state - every infra node and every tool appears at least once.
const MESSY_PAIRS: Array<[string, string]> = [
  ['r1', 'siem'], ['r1', 'fw'], ['r2', 'ndr'], ['r2', 'waf'],
  ['coresw1', 'dlp'], ['coresw1', 'apm'], ['coresw2', 'grc'], ['coresw2', 'siem'],
  ['distsw1', 'apisec'], ['distsw1', 'npm'], ['distsw2', 'ueba'], ['distsw2', 'fw'],
  ['acc1', 'waf'], ['acc1', 'siem'], ['acc2', 'dlp'], ['acc2', 'npm'],
  ['acc3', 'ndr'], ['acc3', 'ueba'], ['acc4', 'apm'], ['acc4', 'fw'],
  ['acc5', 'grc'], ['acc5', 'apisec'], ['acc6', 'waf'], ['acc6', 'dlp'],
  ['acc7', 'siem'], ['acc7', 'ndr'], ['acc8', 'apm'], ['acc8', 'grc'],
];

const INFRA_X = 80;
const TOOL_X = 1700;
const PIPELINE_X = 880;
const PIPELINE_Y = 690;

export const MissionDemo: React.FC = () => {
  const isDemoActive = useStore((s) => s.isMissionDemoActive);
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

  const { fitView } = useReactFlow();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopDemo = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    const wasRunning = useStore.getState().isRunning;
    if (wasRunning) toggleSimulation();
    setDemoActive(false);
    setDemoStep(0);
    setDemoStatus('');
  };

  useEffect(() => {
    if (!isDemoActive) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      return;
    }

    const runStep = (step: number) => {
      setDemoStep(step);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdown(0);

      switch (step) {
        case 0:
          setDemoStatus('Initializing Mission Demo... Cleaning canvas...');
          if (useStore.getState().isRunning) toggleSimulation();
          clearCanvas();
          setAdvancedMode(false);
          timerRef.current = setTimeout(() => runStep(1), 2000);
          break;

        case 1:
          setDemoStatus('The Challenge: Complexity...');
          INFRA_NODES.forEach((n) => {
            addNode({
              id: `mission-${n.id}`,
              type: 'inputNode',
              position: { x: INFRA_X, y: n.y },
              data: { label: n.label, configType: n.configType }
            });
          });
          timerRef.current = setTimeout(() => runStep(2), 2500);
          break;

        case 2:
          setDemoStatus('...connecting directly to a fragmented toolchain of point security tools...');
          TOOL_NODES.forEach((t) => {
            addNode({
              id: `mission-tool-${t.id}`,
              type: 'toolNode',
              position: { x: TOOL_X, y: t.y },
              data: { label: t.label, toolName: t.label, configType: CONFIG_TYPES.PACKET_TOOL }
            });
          });
          timerRef.current = setTimeout(() => runStep(3), 2500);
          break;

        case 3:
          setDemoStatus('Before: Direct connections create Blind Spots, rising Cost, and Inflexibility.');
          setEdges(
            MESSY_PAIRS.map(([from, to], i) => ({
              id: `mission-me${i + 1}`,
              source: `mission-${from}`,
              sourceHandle: 'out',
              target: `mission-tool-${to}`,
              targetHandle: 'in'
            }))
          );
          timerRef.current = setTimeout(() => runStep(4), 5000);
          break;

        case 4:
          setDemoStatus('Transforming: Introducing the Gigamon Deep Observability Pipeline...');
          setEdges([]);
          addNode({
            id: 'mission-pipeline',
            type: 'hardwareNode',
            position: { x: PIPELINE_X, y: PIPELINE_Y },
            data: {
              label: 'Deep Observability Pipeline',
              model: 'HC1-Plus',
              configType: 'Chassis',
              installedBoards: { 'Slot 1': 'HC1-Plus Base' },
              optics: [{ board: 'Base', optic: 'SFP-532', qty: 24 }]
            }
          });
          timerRef.current = setTimeout(() => runStep(5), 2500);
          break;

        case 5: {
          setDemoStatus('After: Visibility delivers Security, Efficiency, and Agility.');
          const converge = INFRA_NODES.map((n, i) => ({
            id: `mission-ce${i + 1}`,
            source: `mission-${n.id}`,
            sourceHandle: 'out',
            target: 'mission-pipeline',
            targetHandle: 'in'
          }));
          const diverge = TOOL_NODES.map((t, i) => ({
            id: `mission-ce${INFRA_NODES.length + i + 1}`,
            source: 'mission-pipeline',
            sourceHandle: 'out',
            target: `mission-tool-${t.id}`,
            targetHandle: 'in'
          }));
          setEdges([...converge, ...diverge]);
          timerRef.current = setTimeout(() => runStep(6), 3000);
          break;
        }

        case 6: {
          setDemoStatus('Launching traffic flow simulation across the unified pipeline...');
          addTrafficStream({
            id: 'mission-ts-1',
            name: 'R1 - Aggregated Uplink Traffic (18.0 Gbps)',
            sourceNodeId: 'mission-r1',
            vlan: '100',
            ipSrc: '10.10.1.1',
            ipDst: '10.10.9.1',
            portSrc: '49152',
            portDst: '443',
            protocol: 'tcp',
            bandwidth: 18000,
            active: true,
            drift: 1,
            lastDriftUpdate: 0
          });
          addTrafficStream({
            id: 'mission-ts-2',
            name: 'Access1 - Branch Traffic (9.0 Gbps)',
            sourceNodeId: 'mission-acc1',
            vlan: '200',
            ipSrc: '10.20.1.50',
            ipDst: '10.10.9.1',
            portSrc: '51000',
            portDst: '443',
            protocol: 'tcp',
            bandwidth: 9000,
            active: true,
            drift: 1,
            lastDriftUpdate: 0
          });
          if (!useStore.getState().isRunning) toggleSimulation();

          let secondsLeft = 20;
          setCountdown(secondsLeft);
          countdownIntervalRef.current = setInterval(() => {
            secondsLeft -= 1;
            setCountdown(secondsLeft);
            if (secondsLeft <= 0) {
              clearInterval(countdownIntervalRef.current!);
              runStep(0); // Loop back to start
            }
          }, 1000);
          break;
        }

        default:
          runStep(0);
      }

      // Smoothly pan & zoom to center the currently placed nodes
      setTimeout(() => {
        try {
          fitView({ duration: 800, padding: 0.15 });
        } catch (e) {
          console.warn('fitView failed', e);
        }
      }, 80);
    };

    runStep(0);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [isDemoActive, addNode, addTrafficStream, clearCanvas, fitView, setAdvancedMode, setDemoStatus, setDemoStep, setEdges, toggleSimulation]);

  if (!isDemoActive) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '110px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(18, 18, 18, 0.95)',
        border: '2px solid #3b82f6',
        borderRadius: '8px',
        padding: '12px 24px',
        zIndex: 1000,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6), 0 0 15px rgba(59, 130, 246, 0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        minWidth: '600px',
        maxWidth: '85vw',
        justifyContent: 'space-between'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: '#3b82f6',
            boxShadow: '0 0 8px #3b82f6'
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#3b82f6', fontWeight: 'bold', letterSpacing: '0.05em' }}>
            MISSION DEMO ACTIVE
          </span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#e0e0e0' }}>
            {demoStatus}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {countdown > 0 && (
          <div style={{ fontSize: '11px', color: '#a855f7', background: 'rgba(168, 85, 247, 0.1)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(168, 85, 247, 0.2)', fontWeight: 'bold' }}>
            Loop restarts in {countdown}s
          </div>
        )}
        <button
          onClick={stopDemo}
          style={{
            background: '#ef5350',
            color: '#fff',
            border: 'none',
            padding: '6px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            transition: 'background 0.2s',
            boxShadow: '0 2px 5px rgba(239, 83, 80, 0.3)'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#d32f2f')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#ef5350')}
        >
          ⏹ Stop Demo
        </button>
      </div>
    </div>
  );
};
