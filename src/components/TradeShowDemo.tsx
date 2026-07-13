import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { useReactFlow } from '@xyflow/react';

export const TradeShowDemo: React.FC = () => {
  const isDemoActive = useStore((s) => s.isTradeShowDemoActive);
  const demoStatus = useStore((s) => s.tradeShowDemoStatus);
  const setDemoActive = useStore((s) => s.setTradeShowDemoActive);
  const setDemoStep = useStore((s) => s.setTradeShowDemoStep);
  const setDemoStatus = useStore((s) => s.setTradeShowDemoStatus);

  const clearCanvas = useStore((s) => s.clearCanvas);
  const addNode = useStore((s) => s.addNode);
  const setEdges = useStore((s) => s.setEdges);
  const addTrafficStream = useStore((s) => s.addTrafficStream);
  const toggleSimulation = useStore((s) => s.toggleSimulation);
  const setAdvancedMode = useStore((s) => s.setAdvancedMode);

  const { fitView } = useReactFlow();

  const timerRef = useRef<any>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const countdownIntervalRef = useRef<any>(null);

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
          setDemoStatus('Initializing Trade Show Demo... Cleaning canvas...');
          if (useStore.getState().isRunning) toggleSimulation();
          clearCanvas();
          setAdvancedMode(false); // Switch to standard view
          timerRef.current = setTimeout(() => runStep(1), 2000);
          break;

        case 1:
          setDemoStatus('Step 1: Deploying Network TAPs to capture network link traffic...');
          // Add TAPs
          addNode({
            id: 'demo-tap-1',
            type: 'inputNode',
            position: { x: 80, y: 100 },
            data: { 
              label: 'Network TAP 1 (SM - 6 Links)', 
              configType: 'Network Tap', 
              portSpeed: '10G',
              tapFiberMode: 'Singlemode',
              tappedLinksCount: 6,
              tappedLinkOptic: '10G-SFP-LR'
            }
          });
          addNode({
            id: 'demo-tap-2',
            type: 'inputNode',
            position: { x: 80, y: 340 },
            data: { 
              label: 'Network TAP 2 (MM - 6 Links)', 
              configType: 'Network Tap', 
              portSpeed: '10G',
              tapFiberMode: 'Multimode',
              tappedLinksCount: 6,
              tappedLinkOptic: '10G-SFP-SR'
            }
          });

          // Add traffic streams
          addTrafficStream({
            id: 'demo-ts-1',
            name: 'TAP 1 - Web SSL Traffic (6.0 Gbps)',
            sourceNodeId: 'demo-tap-1',
            vlan: '100',
            ipSrc: '192.168.1.50',
            ipDst: '10.0.0.10',
            portSrc: '49152',
            portDst: '443',
            protocol: 'tcp',
            bandwidth: 6000,
            active: true,
            drift: 1,
            lastDriftUpdate: 0
          });
          addTrafficStream({
            id: 'demo-ts-2',
            name: 'TAP 2 - DNS Query Volume (1.5 Gbps)',
            sourceNodeId: 'demo-tap-2',
            vlan: '200',
            ipSrc: '192.168.2.100',
            ipDst: '8.8.8.8',
            portSrc: '53000',
            portDst: '53',
            protocol: 'udp',
            bandwidth: 1500,
            active: true,
            drift: 1,
            lastDriftUpdate: 0
          });

          timerRef.current = setTimeout(() => runStep(2), 3000);
          break;

        case 2:
          setDemoStatus('Step 2: Placing a GigaVUE-TA25 Aggregation Node...');
          addNode({
            id: 'demo-ta',
            type: 'hardwareNode',
            position: { x: 440, y: 220 },
            data: { 
              label: 'GigaVUE-TA25', 
              model: 'TA25',
              configType: 'Chassis',
              installedBoards: { 'Slot 1': 'TA25 Base' },
              optics: [{ board: 'Base', optic: 'SFP-532', qty: 4 }]
            }
          });
          timerRef.current = setTimeout(() => runStep(3), 3000);
          break;

        case 3:
          setDemoStatus('Step 3: Connecting BOTH Network TAPs to GigaVUE-TA25 ports...');
          setEdges([
            { id: 'demo-e1', source: 'demo-tap-1', sourceHandle: 'out', target: 'demo-ta', targetHandle: 'in' },
            { id: 'demo-e2', source: 'demo-tap-2', sourceHandle: 'out', target: 'demo-ta', targetHandle: 'in' }
          ]);
          timerRef.current = setTimeout(() => runStep(4), 3000);
          break;

        case 4:
          setDemoStatus('Step 4: Placing a GigaVUE-HC1-Plus chassis for GigaSMART traffic optimization...');
          addNode({
            id: 'demo-hc',
            type: 'hardwareNode',
            position: { x: 800, y: 220 },
            data: { 
              label: 'GigaVUE-HC1-Plus', 
              model: 'HC1-Plus',
              configType: 'Chassis',
              installedBoards: { 'Slot 1': 'HC1-Plus Base' },
              optics: [{ board: 'Base', optic: 'SFP-532', qty: 4 }]
            }
          });
          timerRef.current = setTimeout(() => runStep(5), 3000);
          break;

        case 5:
          setDemoStatus('Step 5: Routing aggregated streams from TA25 into the HC1-Plus chassis...');
          setEdges([
            { id: 'demo-e1', source: 'demo-tap-1', sourceHandle: 'out', target: 'demo-ta', targetHandle: 'in' },
            { id: 'demo-e2', source: 'demo-tap-2', sourceHandle: 'out', target: 'demo-ta', targetHandle: 'in' },
            { id: 'demo-e3', source: 'demo-ta', sourceHandle: 'out', target: 'demo-hc', targetHandle: 'in' }
          ]);
          timerRef.current = setTimeout(() => runStep(6), 3000);
          break;

        case 6:
          setDemoStatus('Step 6: Deploying GigaSMART Deduplication and Application Metadata (AMI) engines...');
          addNode({
            id: 'demo-gs-dedup',
            type: 'gigaSmartNode',
            position: { x: 1160, y: 100 },
            data: { label: 'Packet Deduplication', configType: 'GigaSMART', actionType: 'Deduplication', dedupRate: 35 }
          });
          addNode({
            id: 'demo-gs-ami',
            type: 'gigaSmartNode',
            position: { x: 1160, y: 340 },
            data: { label: 'App Metadata (AMI)', configType: 'GigaSMART', actionType: 'Application Metadata', metadataFormat: 'CEF', metadataRate: 2.0 }
          });
          timerRef.current = setTimeout(() => runStep(7), 4000);
          break;

        case 7:
          setDemoStatus('Step 7: Routing the streams into GigaSMART engines for processing...');
          setEdges([
            { id: 'demo-e1', source: 'demo-tap-1', sourceHandle: 'out', target: 'demo-ta', targetHandle: 'in' },
            { id: 'demo-e2', source: 'demo-tap-2', sourceHandle: 'out', target: 'demo-ta', targetHandle: 'in' },
            { id: 'demo-e3', source: 'demo-ta', sourceHandle: 'out', target: 'demo-hc', targetHandle: 'in' },
            { id: 'demo-e4', source: 'demo-hc', sourceHandle: 'out', target: 'demo-gs-dedup', targetHandle: 'in' },
            { id: 'demo-e5', source: 'demo-hc', sourceHandle: 'out', target: 'demo-gs-ami', targetHandle: 'in' }
          ]);
          timerRef.current = setTimeout(() => runStep(8), 3000);
          break;

        case 8:
          setDemoStatus('Step 8: Deploying packet-consuming analysis tools (ExtraHop & Splunk)...');
          addNode({
            id: 'demo-tool-extrahop',
            type: 'toolNode',
            position: { x: 1520, y: 100 },
            data: { label: 'ExtraHop Tool', toolName: 'ExtraHop', configType: 'Packet Tool' }
          });
          addNode({
            id: 'demo-tool-splunk',
            type: 'toolNode',
            position: { x: 1520, y: 340 },
            data: { label: 'Splunk Tool', toolName: 'Splunk', configType: 'Metadata Tool', expectedFormat: 'CEF' }
          });
          timerRef.current = setTimeout(() => runStep(9), 3500);
          break;

        case 9:
          setDemoStatus('Step 9: Delivering optimized packet streams and metadata to tools...');
          setEdges([
            { id: 'demo-e1', source: 'demo-tap-1', sourceHandle: 'out', target: 'demo-ta', targetHandle: 'in' },
            { id: 'demo-e2', source: 'demo-tap-2', sourceHandle: 'out', target: 'demo-ta', targetHandle: 'in' },
            { id: 'demo-e3', source: 'demo-ta', sourceHandle: 'out', target: 'demo-hc', targetHandle: 'in' },
            { id: 'demo-e4', source: 'demo-hc', sourceHandle: 'out', target: 'demo-gs-dedup', targetHandle: 'in' },
            { id: 'demo-e5', source: 'demo-hc', sourceHandle: 'out', target: 'demo-gs-ami', targetHandle: 'in' },
            { id: 'demo-e6', source: 'demo-gs-dedup', sourceHandle: 'out', target: 'demo-tool-extrahop', targetHandle: 'in' },
            { id: 'demo-e7', source: 'demo-gs-ami', sourceHandle: 'out', target: 'demo-tool-splunk', targetHandle: 'in' }
          ]);
          timerRef.current = setTimeout(() => runStep(10), 3000);
          break;

        case 10:
          setDemoStatus('Step 10: Launching traffic flow simulation! Watch the live statistics...');
          if (!useStore.getState().isRunning) toggleSimulation();
          
          let secondsLeft = 25;
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
  }, [isDemoActive]);

  if (!isDemoActive) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '60px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(18, 18, 18, 0.95)',
        border: '2px solid #22c55e',
        borderRadius: '8px',
        padding: '12px 24px',
        zIndex: 1000,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6), 0 0 15px rgba(34, 197, 94, 0.4)',
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
            background: '#22c55e',
            boxShadow: '0 0 8px #22c55e'
          }} 
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#22c55e', fontWeight: 'bold', letterSpacing: '0.05em' }}>
            TRADE SHOW AUTO-DEMO ACTIVE
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
