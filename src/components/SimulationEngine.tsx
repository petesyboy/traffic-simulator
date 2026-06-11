import React, { useEffect, useRef } from 'react';
import { useStore, type TrafficStream, type NodeMetrics, type MapCondition } from '../store/store';

interface TrajectoryStream extends TrafficStream {
  trafficType?: 'packet' | 'metadata';
  metadataFormat?: 'CEF' | 'JSON';
}

// Match VLAN IDs: e.g. "100" in "100, 200, 300"
const matchesVlan = (streamVlan: string | undefined, filterVlan: string | undefined): boolean => {
  if (!filterVlan) return false;
  const allowed = filterVlan.split(',').map((s) => s.trim());
  return allowed.includes(String(streamVlan || '').trim());
};

// Match IP Subnet: simple prefix matching for demo purposes
const matchesIp = (streamIp: string | undefined, filterIp: string | undefined): boolean => {
  if (!filterIp) return false;
  const cleanFilter = filterIp.trim().toLowerCase();
  const cleanStream = String(streamIp || '').trim().toLowerCase();
  // Standard prefix matching
  if (cleanFilter.includes('/') && cleanFilter.split('/')[0]) {
    const prefix = cleanFilter.split('/')[0];
    return cleanStream.startsWith(prefix.substring(0, prefix.lastIndexOf('.')));
  }
  return cleanStream.includes(cleanFilter) || cleanFilter.includes(cleanStream);
};

// Match Ports: e.g. "80" in "80, 443"
const matchesPort = (streamPort: string | undefined, filterPort: string | undefined): boolean => {
  if (!filterPort) return false;
  const allowed = filterPort.split(',').map((s) => s.trim());
  return allowed.includes(String(streamPort || '').trim());
};

// Evaluate map conditions sequentially with logic rules (AND / OR)
const evaluateConditionGroup = (stream: TrafficStream, conditions: MapCondition[]): boolean => {
  let result = false;
  
  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];
    const val = String(cond.value || '').toLowerCase().trim();
    const field = cond.field;
    
    let streamVal = '';
    if (field === 'vlan') streamVal = stream.vlan;
    else if (field === 'ipsrc') streamVal = stream.ipSrc;
    else if (field === 'ipdst') streamVal = stream.ipDst;
    else if (field === 'portsrc') streamVal = stream.portSrc;
    else if (field === 'portdst') streamVal = stream.portDst;
    else if (field === 'protocol') streamVal = stream.protocol;
    
    const cleanStreamVal = String(streamVal || '').toLowerCase().trim();
    
    const isMatch = val === ''
      ? true
      : field === 'ipver'
      ? (val === 'ipv6' 
        ? (!!(stream.ipSrc && stream.ipSrc.includes(':')) || !!(stream.ipDst && stream.ipDst.includes(':'))) 
        : val === 'ipv4' 
        ? !(!!(stream.ipSrc && stream.ipSrc.includes(':')) || !!(stream.ipDst && stream.ipDst.includes(':'))) 
        : false)
      : field === 'vlan'
      ? matchesVlan(cleanStreamVal, val)
      : (field === 'ipsrc' || field === 'ipdst' || field === 'ip6src' || field === 'ip6dst')
      ? matchesIp(cleanStreamVal, val)
      : (field === 'portsrc' || field === 'portdst')
      ? matchesPort(cleanStreamVal, val)
      : cleanStreamVal === val;
    
    if (i === 0) {
      result = isMatch;
    } else {
      if (cond.logic === 'AND') {
        result = result && isMatch;
      } else {
        result = result || isMatch;
      }
    }
  }
  
  return result;
};

const evaluateMapConditions = (stream: TrafficStream, conditions: MapCondition[] | undefined): boolean => {
  if (!conditions || conditions.length === 0) return true; // Default: pass all
  
  const passConditions = conditions.filter(c => !c.action || c.action === 'pass');
  const dropConditions = conditions.filter(c => c.action === 'drop');
  
  // 1. Evaluate drop rules: if matched, drop immediately (return false)
  if (dropConditions.length > 0) {
    const matchesDrop = evaluateConditionGroup(stream, dropConditions);
    if (matchesDrop) {
      return false;
    }
  }
  
  // 2. Evaluate pass rules: if present, must match to pass
  if (passConditions.length > 0) {
    return evaluateConditionGroup(stream, passConditions);
  }
  
  return true; // No pass rules, didn't match drop rules -> pass
};

const SimulationEngine: React.FC = () => {
  const isRunning = useStore((state) => state.isRunning);
  const simulationSpeed = useStore((state) => state.simulationSpeed);
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
      // Read current state directly from store to prevent component re-triggering interval resets
      const currentNodes = useStore.getState().nodes;
      const currentEdges = useStore.getState().edges;
      const currentTraffic = useStore.getState().trafficStreams;

      // 1. Update GigaSMART Deduplication node rates (10%-50%, drift +/- 5% every 2 seconds)
      const now = Date.now();
      currentNodes.forEach((node) => {
        if (
          node.type === 'gigaSmartNode' && 
          (node.data?.actionType === 'Deduplication' || node.data?.actionType === 'Dedup')
        ) {
          const lastUpdate = (node.data?.lastDedupUpdate as number) || 0;
          const currentRate = (node.data?.dedupRate as number);
          
          if (!currentRate) {
            // Initial rate: random between 10 and 50
            const initialRate = Math.floor(Math.random() * 41) + 10;
            useStore.getState().updateNodeData(node.id, { dedupRate: initialRate, lastDedupUpdate: now });
          } else if (now - lastUpdate >= 2000) {
            // Drift: random change of -5 to +5
            const delta = Math.floor(Math.random() * 11) - 5;
            let newRate = currentRate + delta;
            if (newRate < 10) newRate = 10;
            if (newRate > 50) newRate = 50;
            useStore.getState().updateNodeData(node.id, { dedupRate: newRate, lastDedupUpdate: now });
          }
        }
      });

      // 1.5. Update Traffic Stream drift multipliers (+/- 5% from base, every 2 seconds)
      currentTraffic.forEach((stream) => {
        if (!stream.active) return;
        
        const lastUpdate = (stream.lastDriftUpdate as number) || 0;
        const currentDrift = (stream.drift as number) || 1.0;
        
        if (stream.drift === undefined) {
          useStore.getState().updateTrafficStream(stream.id, {
            drift: 1.0,
            lastDriftUpdate: now,
          });
        } else if (now - lastUpdate >= 2000) {
          const delta = (Math.random() * 3 - 1.5) / 100; // -1.5% to +1.5% drift
          let newDrift = currentDrift + delta;
          if (newDrift < 0.95) newDrift = 0.95;
          if (newDrift > 1.05) newDrift = 1.05;
          useStore.getState().updateTrafficStream(stream.id, {
            drift: newDrift,
            lastDriftUpdate: now,
          });
        }
      });

      // 2. Initialize metrics for all nodes
      const metrics: Record<string, NodeMetrics> = {};
      currentNodes.forEach((node) => {
        metrics[node.id] = {
          rxBps: 0,
          txBps: 0,
          rxPackets: 0,
          txPackets: 0,
          droppedPackets: 0,
        };
      });

      const activeEdgeSet = new Set<string>();
      const blockedEdgeSet = new Set<string>();

      // 3. Setup traversal queue
      interface QueueItem {
        nodeId: string;
        stream: TrajectoryStream;
        edgePath: string[];
      }

      const queue: QueueItem[] = [];
      const toolReceivedStreams: Record<string, TrajectoryStream[]> = {};
      const deliveredStreamIds = new Set<string>();

      // Find starting nodes for all active traffic streams
      currentTraffic.forEach((stream) => {
        if (!stream.active) return;
        
        const sourceNode = currentNodes.find((n) => n.id === stream.sourceNodeId);
        if (sourceNode) {
          const driftedBandwidth = stream.bandwidth * (stream.drift || 1.0);
          queue.push({
            nodeId: sourceNode.id,
            stream: { 
              ...stream, 
              bandwidth: driftedBandwidth, 
              trafficType: 'packet' 
            },
            edgePath: [],
          });
        }
      });

      let iterations = 0;
      const maxIterations = 200;

      while (queue.length > 0 && iterations < maxIterations) {
        iterations++;
        const item = queue.shift()!;
        const node = currentNodes.find((n) => n.id === item.nodeId);
        if (!node) continue;

        const nodeMetric = metrics[node.id];
        if (!nodeMetric) continue;

        const packetsPerSecond = item.stream.bandwidth * 250;

        if (node.id === item.stream.sourceNodeId && item.edgePath.length === 0) {
          nodeMetric.txBps += item.stream.bandwidth;
          nodeMetric.txPackets += packetsPerSecond;
        } else {
          nodeMetric.rxBps += item.stream.bandwidth;
          nodeMetric.rxPackets += packetsPerSecond;
        }

        let outboundEdges = currentEdges.filter((e) => e.source === node.id);
        if (outboundEdges.length === 0 && node.parentId) {
          outboundEdges = currentEdges.filter((e) => e.source === node.parentId);
        }

        if (node.type === 'toolNode') {
          if (!toolReceivedStreams[node.id]) {
            toolReceivedStreams[node.id] = [];
          }
          toolReceivedStreams[node.id].push(item.stream);
          deliveredStreamIds.add(item.stream.id);
          continue;
        }

        let forwardStream: TrajectoryStream | null = { ...item.stream };
        let dropBandwidth = 0;

        if (node.type === 'filterNode') {
          const configType = node.data?.configType as string;
          let isMatch = false;

          if (configType === 'VLAN Filter') {
            isMatch = matchesVlan(item.stream.vlan, node.data?.vlanIds as string);
          } else if (configType === 'IP Subnet Filter') {
            isMatch = matchesIp(item.stream.ipSrc, node.data?.ipSubnet as string) || 
                      matchesIp(item.stream.ipDst, node.data?.ipSubnet as string);
          } else if (configType === 'Port Filter') {
            isMatch = matchesPort(item.stream.portSrc, node.data?.ports as string) || 
                      matchesPort(item.stream.portDst, node.data?.ports as string);
          }

          if (isMatch) {
            nodeMetric.txBps += item.stream.bandwidth;
            nodeMetric.txPackets += packetsPerSecond;
          } else {
            dropBandwidth = item.stream.bandwidth;
            nodeMetric.droppedPackets += dropBandwidth;
            forwardStream = null;
          }
        } 
        else if (node.type === 'mapNode') {
          const isMatch = evaluateMapConditions(item.stream, node.data?.conditions as MapCondition[]);
          if (isMatch) {
            nodeMetric.txBps += item.stream.bandwidth;
            nodeMetric.txPackets += packetsPerSecond;
          } else {
            dropBandwidth = item.stream.bandwidth;
            nodeMetric.droppedPackets += dropBandwidth;
            forwardStream = null;
          }
        }
        else if (node.type === 'gigaSmartNode') {
          const actionType = node.data?.actionType as string || 'Deduplication';
          
          if (actionType === 'Deduplication' || actionType === 'Dedup') {
            // Dynamic Deduplication rate matching the icon's overlay percentage
            const dedupRate = (node.data?.dedupRate as number) || 20;
            const dropFraction = dedupRate / 100;

            dropBandwidth = item.stream.bandwidth * dropFraction;
            const validBandwidth = item.stream.bandwidth * (1 - dropFraction);

            nodeMetric.droppedPackets += dropBandwidth;
            nodeMetric.txBps += validBandwidth;
            nodeMetric.txPackets += validBandwidth * 250;
            forwardStream = { ...item.stream, bandwidth: validBandwidth };
          } 
          else if (actionType === 'Application Metadata' || actionType === 'AMX' || actionType === 'AMI') {
            const format = (node.data?.metadataFormat as string) || 'CEF';
            const scale = (actionType === 'AMX' || actionType === 'AMI') ? 0.015 : 0.1; // AMX/AMI uses 1.5%, App Metadata uses 10%
            const metadataBandwidth = item.stream.bandwidth * scale;

            dropBandwidth = item.stream.bandwidth * (1 - scale);
            nodeMetric.droppedPackets += dropBandwidth;
            nodeMetric.txBps += metadataBandwidth;
            nodeMetric.txPackets += metadataBandwidth * 250;
            forwardStream = { 
              ...item.stream, 
              bandwidth: metadataBandwidth, 
              trafficType: 'metadata', 
              metadataFormat: format as 'CEF' | 'JSON'
            };
          }
          else if (actionType === 'Packet Slicing') {
            const slicedBandwidth = item.stream.bandwidth * 0.6;
            nodeMetric.txBps += slicedBandwidth;
            nodeMetric.txPackets += packetsPerSecond;
            forwardStream = { ...item.stream, bandwidth: slicedBandwidth };
          } 
          else if (actionType === 'Header Stripping') {
            const strippedBandwidth = item.stream.bandwidth * 0.95;
            nodeMetric.txBps += strippedBandwidth;
            nodeMetric.txPackets += packetsPerSecond;
            forwardStream = { ...item.stream, bandwidth: strippedBandwidth };
          }
          else {
            // Custom GigaSMART App processing (e.g. SSL Decrypt, Masking, etc.)
            let scale = 1.0;
            if (actionType === 'SSL Decrypt' || actionType === 'Masking') {
              scale = 0.95;
            }
            const outputBandwidth = item.stream.bandwidth * scale;
            if (scale < 1.0) {
              dropBandwidth = item.stream.bandwidth * (1 - scale);
              nodeMetric.droppedPackets += dropBandwidth;
            }
            nodeMetric.txBps += outputBandwidth;
            nodeMetric.txPackets += packetsPerSecond;
            forwardStream = { ...item.stream, bandwidth: outputBandwidth };
          }
        }
        else if (node.type === 'gigaStreamNode') {
          if (outboundEdges.length > 0) {
            nodeMetric.txBps += item.stream.bandwidth;
            nodeMetric.txPackets += packetsPerSecond;
            
            const splitBandwidth = item.stream.bandwidth / outboundEdges.length;
            
            outboundEdges.forEach((edge) => {
              activeEdgeSet.add(edge.id);
              queue.push({
                nodeId: edge.target,
                stream: { ...item.stream, bandwidth: splitBandwidth },
                edgePath: [...item.edgePath, edge.id],
              });
            });
            continue;
          }
        }
        else {
          nodeMetric.txBps += item.stream.bandwidth;
          nodeMetric.txPackets += packetsPerSecond;
        }

        if (forwardStream && forwardStream.bandwidth > 0 && outboundEdges.length > 0) {
          outboundEdges.forEach((edge) => {
            activeEdgeSet.add(edge.id);
            queue.push({
              nodeId: edge.target,
              stream: { ...forwardStream! },
              edgePath: [...item.edgePath, edge.id],
            });
          });
        } else if (dropBandwidth > 0 && outboundEdges.length > 0) {
          outboundEdges.forEach((edge) => {
            blockedEdgeSet.add(edge.id);
          });
        }
      }

      currentEdges.forEach((edge) => {
        const sourceMetric = metrics[edge.source];
        if (sourceMetric && sourceMetric.txBps > 0 && !activeEdgeSet.has(edge.id)) {
          const targetMetric = metrics[edge.target];
          if (targetMetric && targetMetric.rxBps > 0) {
            activeEdgeSet.add(edge.id);
          }
        }
      });

      // 4. Validate tool traffic types and formats
      currentNodes.forEach((node) => {
        if (node.type === 'toolNode') {
          const configType = node.data?.configType as string || '';
          const expectedFormat = node.data?.expectedFormat as string || 'CEF';
          
          const isPacketTool = configType === 'Packet Tool';
          const isMetadataTool = configType === 'Metadata Tool';
          
          const received = toolReceivedStreams[node.id] || [];
          
          let nextStatus: 'warning' | 'optimal' | undefined = undefined;
          let nextStatusMessage = '';
          let receivedFormat = '';

          if (received.length > 0) {
            for (const rStream of received) {
              const rType = rStream.trafficType || 'packet';
              const rFormat = rStream.metadataFormat;

              if (isPacketTool) {
                if (rType !== 'packet') {
                  nextStatus = 'warning';
                  nextStatusMessage = 'Expected packets, got metadata';
                  break;
                }
              } else if (isMetadataTool) {
                if (rType !== 'metadata') {
                  nextStatus = 'warning';
                  nextStatusMessage = 'Expected metadata, got packets';
                  break;
                } else if (expectedFormat !== 'Any' && rFormat !== expectedFormat) {
                  nextStatus = 'warning';
                  nextStatusMessage = `Format mismatch: got ${rFormat}, expected ${expectedFormat}`;
                  break;
                }
                receivedFormat = rFormat || 'Metadata';
              }
            }
            
            if (!nextStatus) {
              nextStatus = 'optimal';
              nextStatusMessage = isPacketTool ? 'Receiving packet traffic' : `Receiving ${receivedFormat} metadata`;
            }
          } else {
            nextStatus = undefined;
            nextStatusMessage = 'No active traffic streams';
          }

          if (
            node.data?.status !== nextStatus || 
            node.data?.statusMessage !== nextStatusMessage ||
            node.data?.receivedFormat !== receivedFormat
          ) {
            useStore.getState().updateNodeData(node.id, { 
              status: nextStatus, 
              statusMessage: nextStatusMessage,
              receivedFormat: receivedFormat 
            });
          }
        }
      });

      updateSimulationTick(
        metrics, 
        Array.from(activeEdgeSet), 
        Array.from(blockedEdgeSet), 
        Array.from(deliveredStreamIds)
      );
    };

    runSimulationStep();

    const intervalTime = 800 / simulationSpeed;
    tickRef.current = window.setInterval(runSimulationStep, intervalTime);

    return () => {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
      }
    };
  }, [isRunning, simulationSpeed, updateSimulationTick]);

  return null;
};

export default SimulationEngine;
