/**
 * SimulationEngine.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Headless (renders null) component that drives the traffic simulation loop.
 * It runs on a setInterval whose period is controlled by `simulationSpeed`.
 */

import React, { useEffect, useRef } from 'react';
import { useStore, type TrafficStream } from '../store/store';
import { calculateSimulationStep } from '../utils/simulation';
import { NODE_TYPES, isDedupAction } from '../constants/nodeTypes';

const SimulationEngine: React.FC = () => {
  const isRunning          = useStore((state) => state.isRunning);
  const simulationSpeed    = useStore((state) => state.simulationSpeed);
  const updateSimulationTick = useStore((state) => state.updateSimulationTick);

  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }

    const runSimulationStep = () => {
      const state = useStore.getState();
      const { nodes, trafficStreams, edges } = state;
      const now = Date.now();

      // ── 1. Compute deduplication rate drift and traffic stream bandwidth drift ──
      const nodeDataPatches: Record<string, Record<string, unknown>> = {};
      const streamPatches: Record<string, Partial<TrafficStream>> = {};

      nodes.forEach((node) => {
        if (
          node.type === NODE_TYPES.GIGASMART &&
          isDedupAction(node.data?.actionType as string || '')
        ) {
          const lastUpdate  = (node.data?.lastDedupUpdate as number) || 0;
          const currentRate = node.data?.dedupRate as number;

          if (!currentRate) {
            nodeDataPatches[node.id] = {
              ...nodeDataPatches[node.id],
              dedupRate: Math.floor(Math.random() * 41) + 10,
              lastDedupUpdate: now,
            };
          } else if (now - lastUpdate >= 2000) {
            const delta   = Math.floor(Math.random() * 11) - 5;
            const newRate = Math.min(50, Math.max(10, currentRate + delta));
            nodeDataPatches[node.id] = {
              ...nodeDataPatches[node.id],
              dedupRate: newRate,
              lastDedupUpdate: now,
            };
          }
        }
      });

      trafficStreams.forEach((stream) => {
        if (!stream.active) return;

        const lastUpdate   = (stream.lastDriftUpdate as number) || 0;
        const currentDrift = stream.drift ?? 1.0;

        if (stream.drift === undefined) {
          streamPatches[stream.id] = { drift: 1.0, lastDriftUpdate: now };
        } else if (now - lastUpdate >= 2000) {
          const delta    = (Math.random() * 3 - 1.5) / 100;
          const newDrift = Math.min(1.05, Math.max(0.95, currentDrift + delta));
          streamPatches[stream.id] = { drift: newDrift, lastDriftUpdate: now };
        }
      });

      // ── 2. Run Core Simulation Logic ──
      // Pass the existing nodes/edges/streams. 
      // Note: calculateSimulationStep should ideally use the drifted values.
      // We'll update the streams with patches before passing them to the simulation.
      const driftedStreams = trafficStreams.map(s => {
        if (streamPatches[s.id]) {
          return { ...s, ...streamPatches[s.id] };
        }
        return s;
      });

      const result = calculateSimulationStep(nodes, edges, driftedStreams);

      // Merge node data patches from simulation (status updates) with our drift patches
      const finalNodeDataPatches = { ...nodeDataPatches };
      Object.keys(result.nodeDataPatches).forEach(id => {
        finalNodeDataPatches[id] = {
          ...finalNodeDataPatches[id],
          ...result.nodeDataPatches[id]
        };
      });

      // ── 3. Single batched store update ──
      updateSimulationTick(
        result.metrics,
        result.activeEdges,
        result.blockedEdges,
        result.deliveredStreamIds,
        finalNodeDataPatches,
        streamPatches
      );
    };

    runSimulationStep();

    const intervalTime = 800 / simulationSpeed;
    tickRef.current = window.setInterval(runSimulationStep, intervalTime);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [isRunning, simulationSpeed, updateSimulationTick]);

  return null;
};

export default SimulationEngine;
