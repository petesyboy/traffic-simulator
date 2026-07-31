import React, { useState } from 'react';
import type { Edge } from '@xyflow/react';
import type { CustomNode } from '../../../store/store';
import { useStore } from '../../../store/store';
import type { BaseNodeData, HardwareNodeData, TappedLinkAllocation } from '../../../store/types';
import { SUPPORTED_TAP_OPTICS } from '../../../constants/nodeTypes';
import { describeTapOptic, getCompatibleTapOptics, getTapTerminationClass } from '../../../constants/tapOpticRules';
import { getOpticSpeed, getTapLinkCapacity, getRemainingCageCapacity } from '../../../utils/hardwareUtils';
import skusData from '../../../constants/skus.json';
import hardwareCatalogue from '../../../constants/hardwareCatalogue.json';

interface TapLinksPanelProps {
  selectedNode: CustomNode;
  updateNodeData: (nodeId: string, data: Partial<BaseNodeData>) => void;
  nodes: CustomNode[];
  edges: Edge[];
}

const isQsfpSpeed = (speed: string) => speed === '40G' || speed === '100G' || speed === '400G';

export const TapLinksPanel: React.FC<TapLinksPanelProps> = ({
  selectedNode,
  updateNodeData,
  nodes,
  edges
}) => {
  const addTrafficStream = useStore(state => state.addTrafficStream);

  const tapModel = String(selectedNode.data?.model || '');
  const tapSku = String(selectedNode.data?.sku || '');
  const tapDescription = String(
    selectedNode.data?.description || 
    (tapSku && (skusData as Record<string, string>)[tapSku]) || 
    ''
  );
  const hwData = selectedNode.data as HardwareNodeData;

  const isSMTap = tapSku.includes('253') || tapSku.includes('273') || tapSku.includes('453') ||
    tapModel.toLowerCase().includes('single-mode') || tapModel.toLowerCase().includes('sm') ||
    tapModel.includes('253T') || tapModel.includes('273T') || tapModel.includes('453T');

  const isM506T = tapModel.includes('M506T') || tapSku === 'PNL-M506T';
  const isATX = tapModel.includes('A-TX') || tapSku.startsWith('TAP-A-TX');
  const isATX2 = tapModel.includes('A-TX2') || tapSku.startsWith('TAP-A-TX2');

  const isPassiveOpticalTap = tapModel.startsWith('TAP-M') || tapSku.startsWith('TAP-M');
  const isBuiltInOptics = isATX || isATX2 || isPassiveOpticalTap;
  const builtInOpticLabel = isPassiveOpticalTap
    ? `Passive Optical Splitter (${isSMTap ? 'Singlemode' : 'Multimode'})`
    : 'Built-in 1G Copper';

  const catalogueItem = hardwareCatalogue.taps.find(t => t.sku === tapSku || t.model === tapModel);
  const maxLinks = catalogueItem?.max_links ?? getTapLinkCapacity(tapDescription);

  const isASF = tapModel.includes('A-SF') || tapSku.includes('ASF');
  let availableOptics = SUPPORTED_TAP_OPTICS;
  if (isASF) {
    availableOptics = SUPPORTED_TAP_OPTICS.filter(o => {
      const speed = getOpticSpeed(o.value);
      return speed === '1G' || speed === '10G';
    });
  } else if (isM506T) {
    availableOptics = SUPPORTED_TAP_OPTICS.filter(o => {
      const speed = getOpticSpeed(o.value);
      return speed === '40G' || speed === '100G';
    });
  }

  const allocations: TappedLinkAllocation[] = hwData.tappedLinkAllocations || [];
  const currentAllocatedCount = hwData.tappedLinkAllocations ? hwData.tappedLinkAllocations.reduce((sum, a) => sum + a.qty, 0) : 0;
  const remainingLinksByTapCapacity = maxLinks - currentAllocatedCount;

  // Local state
  const [addQty, setAddQty] = useState(1);
  const [addOptic, setAddOptic] = useState('');
  const [addToolOptic, setAddToolOptic] = useState('');

  const activeAddOptic = addOptic || (availableOptics.find(o => o.isSM === isSMTap)?.value) || availableOptics[0]?.value || (isSMTap ? '10G-SFP-LR' : '10G-SFP-SR');

  const networkSpeed = getOpticSpeed(activeAddOptic);
  const hasKnownSpeed = networkSpeed !== 'Unknown';
  const speedFilteredToolOptics = (hasKnownSpeed && !isPassiveOpticalTap)
    ? availableOptics.filter(o => getOpticSpeed(o.value) === networkSpeed)
    : availableOptics.filter(o => o.isSM === isSMTap && !o.isCopper);

  // Find the chassis (HC/TA) this TAP is physically connected to, so we can cap the
  // link selector by however many free SFP/QSFP cages it actually has left.
  const connectedChassis = edges
    .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
    .map(e => nodes.find(n => n.id === (e.source === selectedNode.id ? e.target : e.source)))
    .find(n => n?.type === 'hardwareNode' && (String(n.data?.model || '').includes('HC') || String(n.data?.model || '').includes('TA')));

  // Passive module TAPs terminate into a fixed, fibre-type-specific optic set -
  // a multimode M251T can't land on a singlemode LR, and neither LC tap takes
  // the MPO or Rx-only BiDi parts. Where the matrix governs this TAP it replaces
  // the generic speed-matched picker entirely.
  const terminationClass = getTapTerminationClass(tapModel, tapSku);
  const matrixOptics = getCompatibleTapOptics(tapModel, tapSku, String(connectedChassis?.data?.model || '') || undefined);

  const activeAddToolOptic = matrixOptics.length > 0
    ? (matrixOptics.some(o => o.sku === addToolOptic) ? addToolOptic : matrixOptics[0].sku)
    : ((addToolOptic && (isPassiveOpticalTap || getOpticSpeed(addToolOptic) === networkSpeed))
      ? addToolOptic
      : speedFilteredToolOptics[0]?.value || activeAddOptic);

  let remainingLinksByCageCapacity = Infinity;
  let cageLimitReason = '';
  if (connectedChassis && !isBuiltInOptics) {
    const chassisModel = String(connectedChassis.data?.model || '');
    const freeCages = getRemainingCageCapacity(chassisModel, connectedChassis.data as HardwareNodeData);

    const networkIsQsfp = isQsfpSpeed(networkSpeed);
    const toolIsQsfp = isQsfpSpeed(getOpticSpeed(activeAddToolOptic));
    const qsfpPerLink = (networkIsQsfp ? 1 : 0) + (toolIsQsfp ? 1 : 0);
    const sfpPerLink = 2 - qsfpPerLink;

    const maxByQsfp = qsfpPerLink > 0 ? Math.floor(freeCages.qsfp / qsfpPerLink) : Infinity;
    const maxBySfp = sfpPerLink > 0 ? Math.floor(freeCages.sfp / sfpPerLink) : Infinity;
    remainingLinksByCageCapacity = Math.max(0, Math.min(maxByQsfp, maxBySfp));

    if (remainingLinksByCageCapacity < remainingLinksByTapCapacity) {
      const limitingCageType = maxByQsfp <= maxBySfp ? 'QSFP' : 'SFP';
      cageLimitReason = `Limited by ${limitingCageType} cages free on ${connectedChassis.data?.label || chassisModel}.`;
    }
  }

  const remainingLinks = Math.max(0, Math.min(remainingLinksByTapCapacity, remainingLinksByCageCapacity));

  const mismatchedAllocations = allocations.filter(a => {
    if (isM506T) return false;
    const cleanOptic = a.optic ? a.optic.split(' ')[0] : '';
    const matched = availableOptics.find(o => o.value === cleanOptic);
    return matched ? matched.isSM !== isSMTap : false;
  });

  const handleAddAllocation = (qty: number, opticVal: string, toolOpticVal: string) => {
    if (qty <= 0 || qty > remainingLinks) return;
    const effectiveOptic = isBuiltInOptics ? builtInOpticLabel : opticVal;
    const effectiveToolOptic = toolOpticVal;
    const existingIndex = allocations.findIndex(a => a.optic === effectiveOptic && (a.toolOptic || a.optic) === effectiveToolOptic);
    const newAllocations = [...allocations];
    if (existingIndex > -1) {
      newAllocations[existingIndex] = {
        ...newAllocations[existingIndex],
        qty: newAllocations[existingIndex].qty + qty
      };
    } else {
      newAllocations.push({ qty, optic: effectiveOptic, toolOptic: effectiveToolOptic });
    }
    const totalLinks = newAllocations.reduce((sum, a) => sum + a.qty, 0);
    updateNodeData(selectedNode.id, {
      tappedLinkAllocations: newAllocations,
      tappedLinksCount: totalLinks
    });
    setAddQty(1);

    // Auto-create traffic streams
    const isActiveTapModel = tapModel.includes('A-TX') || tapModel.includes('A-SF');
    if (isActiveTapModel) {
      const opticSpeedMatch = effectiveOptic.match(/(100M|1G|10G)/i);
      let speedMbps = 10000;
      if (isBuiltInOptics) {
        speedMbps = 1000;
      } else if (opticSpeedMatch) {
        const sp = opticSpeedMatch[1].toUpperCase();
        if (sp === '1G') speedMbps = 1000;
        else if (sp === '100M') speedMbps = 100;
        else if (sp === '10G') speedMbps = 10000;
      }

      const profiles = [
        { name: 'Web Traffic', port: '443', proto: 'tcp' as const },
        { name: 'DB Sync Flow', port: '5432', proto: 'tcp' as const },
        { name: 'App Services API', port: '8080', proto: 'tcp' as const },
        { name: 'DNS Queries', port: '53', proto: 'udp' as const },
        { name: 'Video Streaming', port: '5004', proto: 'udp' as const },
        { name: 'VoIP Signalling', port: '5060', proto: 'udp' as const },
      ];

      const tapLabel = String(selectedNode.data?.label || tapModel);
      for (let i = 0; i < qty; i++) {
        const profile = profiles[Math.floor(Math.random() * profiles.length)];
        const utilisation = 0.55 + Math.random() * 0.30;
        const bandwidthMbps = Math.floor(speedMbps * utilisation);
        const randomSubnet = Math.floor(Math.random() * 254) + 1;
        const randomVlan = String(Math.floor(Math.random() * 900) + 100);
        const streamGbps = bandwidthMbps >= 1000
          ? `${(bandwidthMbps / 1000).toFixed(1).replace('.0', '')} Gbps`
          : `${bandwidthMbps} Mbps`;

        const linkIdx = currentAllocatedCount + i + 1;
        const streamName = `${tapLabel} - Link ${linkIdx} - ${profile.name} (${streamGbps})`;

        addTrafficStream({
          id: `t-${crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)}`,
          name: streamName,
          sourceNodeId: selectedNode.id,
          vlan: randomVlan,
          ipSrc: `192.168.${randomSubnet}.25`,
          ipDst: `10.10.${randomSubnet}.5`,
          portSrc: String(Math.floor(Math.random() * 50000) + 1024),
          portDst: profile.port,
          protocol: profile.proto,
          bandwidth: bandwidthMbps,
          active: true,
          drift: 1,
          lastDriftUpdate: 0
        });
      }
    }
  };

  const handleRemoveAllocation = (index: number) => {
    const newAllocations = allocations.filter((_, idx) => idx !== index);
    const totalLinks = newAllocations.reduce((sum, a) => sum + a.qty, 0);
    updateNodeData(selectedNode.id, {
      tappedLinkAllocations: newAllocations,
      tappedLinksCount: totalLinks
    });
  };

  return (
    <div className="panel-section border-t border-orange-500/20 pt-4 mt-4">
      <h4 className="section-header text-orange text-base font-semibold mb-2">TAP Settings</h4>
      
      {/* Existing Allocations List */}
      <div className="flex-col gap-2 mb-3">
        <span className="text-xs text-muted font-bold uppercase">
          Active link allocations ({currentAllocatedCount}/{maxLinks} links)
        </span>
        {allocations.map((alloc, idx) => {
          const cleanOptic = alloc.optic ? alloc.optic.split(' ')[0] : '';
          const matched = availableOptics.find(o => o.value === cleanOptic);
          const hasAllocMismatch = !isM506T && matched ? matched.isSM !== isSMTap : false;
          const cleanToolOptic = alloc.toolOptic ? alloc.toolOptic.split(' ')[0] : '';
          const toolMatched = availableOptics.find(o => o.value === cleanToolOptic);
          return (
            <div key={idx} className="flex-between bg-[#111] p-2 border border-subtle rounded-md">
              <div className="flex-col gap-1">
                <div className="text-md text-white font-bold">
                  {alloc.qty} link{alloc.qty > 1 ? 's' : ''}
                  {!isBuiltInOptics && (
                    <> &mdash; <span className="text-cyan">Net: {matched?.label || alloc.optic}</span>
                    {alloc.toolOptic && alloc.toolOptic !== alloc.optic && (
                      <span> | <span className="text-orange">Tool: {toolMatched?.label || alloc.toolOptic}</span></span>
                    )}</>
                  )}
                  {isBuiltInOptics && (
                    <span className="text-secondary"> &mdash; {builtInOpticLabel}
                      {alloc.toolOptic && alloc.toolOptic !== builtInOpticLabel && (
                        <span> | <span className="text-orange">Tool: {toolMatched?.label || alloc.toolOptic}</span></span>
                      )}
                    </span>
                  )}
                </div>
                {hasAllocMismatch && (
                  <div className="text-xs text-red">
                    ⚠️ Fibre mode mismatch (TAP is {isSMTap ? 'Single-mode' : 'Multi-mode'})
                  </div>
                )}
              </div>
              <button 
                onClick={() => handleRemoveAllocation(idx)}
                className="remove-btn px-2 py-1"
                title="Remove allocation"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Allocation Form */}
      {remainingLinks > 0 ? (
        <div className="bg-[#181818] p-3 rounded-lg border border-dashed border-strong flex-col gap-3 mb-3">
          <div className="text-sm text-orange font-bold">Add link allocation</div>
          
          <div className="flex-col gap-2">
            <div className="flex-row gap-2">
              <div className="flex-col gap-1" style={{ width: isBuiltInOptics ? '100%' : '70px' }}>
                <label className="text-xs text-muted">Links</label>
                <select
                  value={Math.min(addQty, remainingLinks)}
                  onChange={e => setAddQty(parseInt(e.target.value))}
                  className="form-select text-md p-1 bg-[#222]"
                >
                  {Array.from({ length: remainingLinks }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
                {cageLimitReason && (
                  <span className="text-xs text-orange mt-1">{cageLimitReason}</span>
                )}
              </div>

              {!isBuiltInOptics && (
                <div className="flex-col gap-1 flex-1">
                  <label className="text-xs text-muted">Network Optic</label>
                  <select 
                    value={activeAddOptic} 
                    onChange={e => {
                      setAddOptic(e.target.value);
                      setAddToolOptic('');
                    }} 
                    disabled={isM506T}
                    className="form-select text-md p-1 bg-[#222] w-full"
                  >
                    {availableOptics.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex-col gap-1">
              <label className="text-xs text-muted">Tool Optic</label>
              <select 
                value={activeAddToolOptic} 
                onChange={e => setAddToolOptic(e.target.value)} 
                disabled={isM506T}
                className="form-select text-md p-1 bg-[#222] w-full"
              >
                {!isPassiveOpticalTap && !matrixOptics.length && <option value={activeAddOptic}>Match Network Optic</option>}
                {matrixOptics.length > 0
                  ? matrixOptics.map(o => (
                      <option key={o.sku} value={o.sku}>{describeTapOptic(o)}</option>
                    ))
                  : speedFilteredToolOptics.filter(opt => isPassiveOpticalTap || opt.value !== activeAddOptic).map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
              </select>
              {matrixOptics.length > 0 ? (
                <span className="text-xs text-muted mt-1">
                  {tapModel} is a {terminationClass === 'singlemode-lc' ? 'singlemode LC' : terminationClass === 'bidi' ? 'BiDi' : 'multimode LC'} tap
                  {connectedChassis ? ` — showing only optics ${String(connectedChassis.data?.label || connectedChassis.data?.model)} can terminate` : ''}. Two optics are needed per tapped link (Rx side only).
                </span>
              ) : (networkSpeed && !isPassiveOpticalTap) && (
                <span className="text-xs text-muted mt-1">Filtered to {networkSpeed} optics (tool must match network speed)</span>
              )}
            </div>
          </div>

          <button 
            onClick={() => handleAddAllocation(addQty, activeAddOptic, activeAddToolOptic)}
            className="btn btn-primary btn-sm align-self-end mt-1"
          >
            + Add Links
          </button>
        </div>
      ) : remainingLinksByCageCapacity <= 0 && remainingLinksByTapCapacity > 0 ? (
        <div className="badge badge-orange p-2 rounded-md mb-3 flex-center text-md">
          ⚠️ No free SFP/QSFP cages remain on {connectedChassis?.data?.label || String(connectedChassis?.data?.model || 'the connected chassis')} to allocate more links.
        </div>
      ) : (
        <div className="badge badge-green p-2 rounded-md mb-3 flex-center text-md">
          ✓ All {maxLinks} available link slots allocated.
        </div>
      )}

      <div className="text-xs text-muted mt-1">
        {isM506T 
          ? 'Note: TAP-M506T requires termination with QSB-523T optics in the TA/HC unit.' 
          : `Specifies link allocations for this TAP (up to a maximum of ${maxLinks} links for this model).`}
      </div>
      
      {(tapModel.includes('G-TAP A-SF2') || tapModel.includes('ASF21')) && (
        <div className="mt-2 p-2 bg-[#2196f3]/10 border border-[#2196f3]/30 rounded-md text-cyan text-xs leading-normal">
          <div className="font-bold mb-1">G-TAP A-SF2 Deployment Rules:</div>
          <ul className="m-0 pl-4">
            <li>Network ports in a pair must use the same transceiver type.</li>
            <li>Tool ports must match the same speed as the network ports (medium can differ).</li>
            <li>For 1G optical tool ports, disable auto-negotiation on the connected tool.</li>
            <li>Copper SFPs run only at their native speeds.</li>
          </ul>
        </div>
      )}
      
      {mismatchedAllocations.length > 0 && (
        <div className="mt-2 p-2 bg-[#ef5350]/10 border border-[#ef5350]/30 rounded-md text-red text-xs">
          ⚠️ Mismatch detected! Tool/Network optic fiber type does not match the TAP's fiber type.
        </div>
      )}
    </div>
  );
};
