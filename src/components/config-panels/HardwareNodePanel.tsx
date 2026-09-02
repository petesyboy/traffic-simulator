import React, { useState } from 'react';
import { useStore, type CustomNode } from '../../store/store';
import { resolveNodeSkus } from '../../utils/skuResolver';
import { getOpticSpeed, getTaLicenseLimits, getOpticFiberType, isBreakoutPanelModel, findChassisInCatalogue } from '../../utils/hardwareUtils';
import { SUPPORTED_TAP_OPTICS } from '../../constants/nodeTypes';
import hardwareCatalogue from '../../constants/hardwareCatalogue.json';
import { getMergedSkus } from '../../utils/skuOverrides';
import {
  BoardSlotsPanel,
  CageSummaryPanel,
  PortMapPanel,
  OpticsPanel,
  GigaSmartAppsPanel,
  TapLinksPanel,
  PowerSupplyPanel,
  BreakoutPanelPanel
} from './hardware';
import { MapNodePanel } from './MapNodePanel';
import type { HardwareNodeData, InstalledOptic, GigaSmartNodeData, TappedLinkAllocation, MapCondition } from '../../store/types';

/**
 * Renders a catalogue `ports`/`base_ports` entry as a plain string. Modern
 * entries are an array of `{ type, count, speeds }` objects (crashed here
 * before as "Objects are not valid as a React child" when rendered raw);
 * a few legacy catalogue entries are still a bare port count number.
 */
function formatPortSummary(ports: unknown): string {
  if (!Array.isArray(ports)) return String(ports);
  return ports
    .map((p) => (p && typeof p === 'object' ? `${p.count}x ${p.type} (${(p.speeds || []).join('/')})` : String(p)))
    .join(', ');
}

interface HardwareNodePanelProps {
  node: CustomNode;
  onConditionChange: (index: number, key: string, value: string) => void;
  onAddCondition: () => void;
  onRemoveCondition: (index: number) => void;
}

export const HardwareNodePanel: React.FC<HardwareNodePanelProps> = ({
  node,
  onConditionChange,
  onAddCondition,
  onRemoveCondition
}) => {
  const model = node.data?.model as string;
  const sku = node.data?.sku as string;
  const hwData = node.data as HardwareNodeData;
  const installedOptics: InstalledOptic[] = hwData.optics || [];
  const gigaSmartApps: GigaSmartNodeData[] = hwData.gigaSmartApps || [];
  const conditions: MapCondition[] = hwData.conditions || [];
  
  const updateNodeData = useStore(state => state.updateNodeData);
  const edges = useStore(state => state.edges);
  const nodes = useStore(state => state.nodes);
  const projectLicenseMode = useStore(state => state.projectLicenseMode);
  const advancedMode = useStore(state => state.advancedMode);
  // Re-renders this panel when an uploaded price list changes SKU descriptions,
  // so getMergedSkus() below picks it up immediately rather than needing a reselect.
  useStore(state => state.skuCatalogueVersion);
  const skusData = getMergedSkus();

  const [activeTab, setActiveTab] = useState<'general' | 'optics' | 'apps'>('general');
  const [isSpecsExpanded, setIsSpecsExpanded] = useState(false);

  // Reset to the General tab when a TAP node becomes selected. Adjusted during
  // render (rather than in an effect) to avoid an extra commit-and-rerender pass.
  const [prevNodeId, setPrevNodeId] = useState(node.id);
  const [prevModel, setPrevModel] = useState(model);
  if (node.id !== prevNodeId || model !== prevModel) {
    setPrevNodeId(node.id);
    setPrevModel(model);
    if (model?.includes('TAP') || isBreakoutPanelModel(model)) {
      setActiveTab('general');
    }
  }

  // Determine catalogue details. The three catalogue arrays (taps/ta_series/hc_series) have
  // divergent, per-category shapes (e.g. `ports` is a plain count for taps but an array of
  // port-group objects for ta_series), so this stays untyped rather than modelling a union
  // that would need to match every JSON variant.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let details: any = null;
  if (model?.includes('TAP') || isBreakoutPanelModel(model)) details = hardwareCatalogue.taps.find(t => (sku && t.sku === sku) || t.model === model);
  else details = findChassisInCatalogue(model, sku);

  const resolved = resolveNodeSkus({ ...node.data, model, sku }, projectLicenseMode);

  // Optics check logic for warning badge
  const incomingTapEdges = edges.filter(e => e.target === node.id);
  let requiredMMOptics = 0;
  let requiredSMOptics = 0;
  let requiredCopperOptics = 0;
  const processedTapIds = new Set<string>();

  incomingTapEdges.forEach(e => {
    const sourceNode = nodes.find(n => n.id === e.source);
    if (!sourceNode) return;
    const isClusterTap = sourceNode.type === 'clusterNode' && sourceNode.data?.clusterType === 'tap';
    let taps: CustomNode[] = [];
    if (isClusterTap) {
      const origId = (e.data?.originalSource as string) || (e.data?.originalTarget as string);
      if (origId) {
        const m = nodes.find(n => n.id === origId);
        if (m && !processedTapIds.has(m.id)) {
          processedTapIds.add(m.id);
          taps = [m];
        }
      } else {
        const allMembers = nodes.filter(n => (sourceNode.data?.memberNodeIds as string[])?.includes(n.id));
        allMembers.forEach(m => {
          if (!processedTapIds.has(m.id)) {
            processedTapIds.add(m.id);
            taps.push(m);
          }
        });
      }
    } else if (sourceNode.data?.model?.includes('TAP') || sourceNode.type === 'inputNode') {
      if (!processedTapIds.has(sourceNode.id)) {
        processedTapIds.add(sourceNode.id);
        taps = [sourceNode];
      }
    }

    taps.forEach(tapN => {
      const tapSku = String(tapN.data?.sku || '');
      const tapModel = String(tapN.data?.model || '');
      const isSMTap = tapSku.includes('253') || tapSku.includes('273') || tapSku.includes('453') ||
        tapModel.toLowerCase().includes('single-mode') || tapModel.toLowerCase().includes('sm') ||
        tapModel.includes('253T') || tapModel.includes('273T') || tapModel.includes('453T');
      
      const allocations = (tapN.data?.tappedLinkAllocations as TappedLinkAllocation[]) || [];
      for (const alloc of allocations) {
        const opticToValidate = alloc.toolOptic || alloc.optic;
        const matched = SUPPORTED_TAP_OPTICS.find(o => o.value === opticToValidate);
        const isCopper = matched ? !!matched.isCopper : opticToValidate.includes('Copper');
        const isSM = matched ? matched.isSM : isSMTap;
        if (isCopper) requiredCopperOptics += alloc.qty * 2;
        else if (isSM) requiredSMOptics += alloc.qty * 2;
        else requiredMMOptics += alloc.qty * 2;
      }
    });
  });

  const outgoingToolLinks = edges.filter(e => {
    if (e.source !== node.id) return false;
    const target = nodes.find(n => n.id === e.target);
    if (!target) return false;
    return target.type === 'toolNode' || (target.type === 'clusterNode' && target.data?.clusterType === 'tool');
  }).length;

  let installedMMOptics = 0;
  let installedSMOptics = 0;
  let installedCopperOptics = 0;
  installedOptics.forEach(opt => {
    const type = getOpticFiberType(opt.optic);
    if (type === 'Copper') installedCopperOptics += opt.qty;
    else if (type === 'MM') installedMMOptics += opt.qty;
    else if (type === 'SM') installedSMOptics += opt.qty;
  });

  const missingMM = Math.max(0, requiredMMOptics - installedMMOptics);
  const missingSM = Math.max(0, requiredSMOptics - installedSMOptics);
  const missingCopper = Math.max(0, requiredCopperOptics - installedCopperOptics);
  const totalOptics = installedOptics.reduce((sum, opt) => sum + opt.qty, 0);
  const totalOpticsNeeded = (requiredMMOptics + requiredSMOptics + requiredCopperOptics) + outgoingToolLinks;
  const isOpticsInvalid = (totalOptics < totalOpticsNeeded) || (missingMM > 0) || (missingSM > 0) || (missingCopper > 0);

  // License Exceeded Validation

  const capVal = hwData.portCapacity || 'Full';
  const limits = getTaLicenseLimits(model || '', capVal);

  // getTaLicenseLimits keys its result by the catalogue's actual port type strings
  // (e.g. "SFP28", "QSFP28", "SFP+") rather than plain "sfp"/"qsfp", so match by
  // substring the same way getCageCapacityBreakdown does instead of assuming exact keys.
  let licensedSfp = 0;
  let licensedQsfp = 0;
  for (const portType in limits) {
    if (portType === 'qsfp_400g') continue;
    if (portType.toUpperCase().includes('QSFP')) licensedQsfp += limits[portType as keyof typeof limits] as number;
    else if (portType.toUpperCase().includes('SFP')) licensedSfp += limits[portType as keyof typeof limits] as number;
  }

  let usedSfp = 0;
  let usedQsfp = 0;
  let used400G = 0;

  installedOptics.forEach(opt => {
    const speed = getOpticSpeed(opt.optic);
    if (speed === '100G' || speed === '40G') {
      usedQsfp += opt.qty;
    } else if (speed === '400G') {
      usedQsfp += opt.qty;
      used400G += opt.qty;
    } else if (speed !== 'Unknown') {
      usedSfp += opt.qty;
    }
  });

  let isLicenseExceeded = false;
  let exceedMessage = '';
  let nextLicenseVal: string | null = null;
  let nextLicenseLabel = '';

  if (model?.includes('TA')) {
    if (model.includes('TA25')) {
      if (usedSfp > licensedSfp || usedQsfp > licensedQsfp) {
        isLicenseExceeded = true;
        exceedMessage = `Configured optics (${usedSfp} SFP, ${usedQsfp} QSFP) exceed the licensed port count (${licensedSfp} SFP / ${licensedQsfp} QSFP cages).`;
        if (capVal === 'Quarter') {
          nextLicenseVal = 'Half';
          nextLicenseLabel = '24 / 4 Ports License';
        } else if (capVal === 'Half') {
          nextLicenseVal = 'Full';
          nextLicenseLabel = '48 / 8 Ports License';
        }
      }
    } else if (model.includes('TA200')) {
      if (usedQsfp > licensedQsfp) {
        isLicenseExceeded = true;
        exceedMessage = `Configured optics (${usedQsfp} QSFP) exceed the licensed port count (${licensedQsfp} QSFP cages).`;
        if (capVal === 'Half') {
          nextLicenseVal = 'Full';
          nextLicenseLabel = '64 Ports (QSFP) License';
        }
      }
    } else if (model.includes('TA400E')) {
      // Plain GigaVUE-TA400 (non-E) is a fixed-capacity, unlicensed chassis - no
      // licensing.tiers in the catalogue and excluded from `isLicensed` elsewhere
      // (see getCageCapacityBreakdown) - so it has no license to exceed here either.
      if (usedSfp > licensedSfp || usedQsfp > licensedQsfp) {
        isLicenseExceeded = true;
        exceedMessage = `Configured optics (${usedSfp} SFP, ${usedQsfp} QSFP) exceed the physical chassis limits (2 SFP / 32 QSFP).`;
      } else if (capVal === '100G' && used400G > 0) {
        isLicenseExceeded = true;
        exceedMessage = `Configured 400G optics exceed the 100G Software Port License limit (0 x 400G ports enabled).`;
        nextLicenseVal = 'Upgrade';
        nextLicenseLabel = '16 x 100Gb & 16 x 400Gb ports + 2 x 10Gb SFP Cages';
      } else if (capVal === 'Upgrade' && used400G > 16) {
        isLicenseExceeded = true;
        exceedMessage = `Configured 400G optics (${used400G}) exceed the upgrade license limit (max 16 x 400G ports enabled).`;
        nextLicenseVal = 'Full';
        nextLicenseLabel = '32 x 400Gb ports + 2 x 10Gb SFP Cages';
      }
    }
  }

  return (
    <>
      <style>{`
        @keyframes pulse-orange {
          0% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0.4; transform: scale(0.9); }
        }
        .optics-alert-dot {
          animation: pulse-orange 1.5s infinite ease-in-out;
        }
      `}</style>
      {advancedMode && !model?.includes('TAP') && !isBreakoutPanelModel(model) && (
        <div className="node-panel-tabs mb-3 flex-wrap">
          <button
            onClick={() => setActiveTab('general')}
            className={`node-panel-tab${activeTab === 'general' ? ' node-panel-tab--active' : ''}`}
          >
            General{conditions.length > 0 ? ` (${conditions.length} rule${conditions.length > 1 ? 's' : ''})` : ''}
          </button>
          <button
            onClick={() => setActiveTab('optics')}
            className={`node-panel-tab${activeTab === 'optics' ? ' node-panel-tab--active' : ''}`}
          >
            <span>Optics</span>
            {isOpticsInvalid && (
              <span
                className="optics-alert-dot status-dot status-dot-orange"
                title="Optics configuration invalid. Click to rectify."
              />
            )}
          </button>
          {gigaSmartApps.length > 0 && (
            <button
              onClick={() => setActiveTab('apps')}
              className={`node-panel-tab${activeTab === 'apps' ? ' node-panel-tab--active' : ''}`}
            >
              GigaSMART Apps
            </button>
          )}
        </div>
      )}

      {!advancedMode && !model?.includes('TAP') && !isBreakoutPanelModel(model) && (
        <div
          className="panel-section"
          style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '10px' }}
        >
          Switch to Expert Designer (click the Gigamon logo 4×) for full hardware configuration — optics, board
          slots, licensing, and GigaSMART apps.
        </div>
      )}

      {isLicenseExceeded && (
        <div className="panel-section border border-red bg-red/10 text-red leading-normal mb-3">
          <div className="font-semibold text-red mb-1 flex-row gap-2">
            ⚠️ License Port Count Exceeded
          </div>
          <div>{exceedMessage}</div>
          {nextLicenseVal && (
            <button
              onClick={() => updateNodeData(node.id, { portCapacity: nextLicenseVal })}
              className="btn btn-primary btn-sm mt-2"
            >
              Upgrade License to {nextLicenseLabel}
            </button>
          )}
        </div>
      )}

      {/* ── GENERAL TAB ── */}
      <div style={{ display: !advancedMode || activeTab === 'general' ? 'block' : 'none' }}>
        <div className="panel-section">
          <div
            onClick={() => advancedMode && setIsSpecsExpanded(!isSpecsExpanded)}
            className={advancedMode ? 'flex-between cursor-pointer user-select-none' : 'flex-between user-select-none'}
          >
            <h3 className="text-base font-semibold m-0">⚙️ Hardware Specifications</h3>
            {advancedMode && <span className="text-xs text-muted">{isSpecsExpanded ? '▲ Collapse' : '▼ Expand'}</span>}
          </div>

          {details ? (
            <div className="mt-2">
              {!advancedMode || !isSpecsExpanded ? (
                <div className="text-md text-secondary bg-[#111] p-2 rounded-md border border-subtle">
                  Model: <strong className="text-white">{details.model}</strong> | SKU: <strong className="text-white">{resolved.hwSku}</strong>
                </div>
              ) : (
                <div className="flex-col gap-2 text-md border-t border-subtle pt-2 mt-2">
                  <div><strong>Model:</strong> {details.model}</div>
                  <div><strong>Hardware SKU:</strong> {resolved.hwSku}</div>
                  {skusData[resolved.hwSku] && (
                    <div className="bg-orange/10 p-2 rounded-md border border-orange/20 text-xs text-orange leading-normal">
                      <strong>Hardware Description:</strong> {skusData[resolved.hwSku]}
                    </div>
                  )}
                  {resolved.swSku && (
                    <>
                      <div><strong>Software SKU:</strong> {resolved.swSku}</div>
                      {skusData[resolved.swSku] && (
                        <div className="bg-cyan/10 p-2 rounded-md border border-cyan/20 text-xs text-cyan leading-normal">
                          <strong>Software Description:</strong> {skusData[resolved.swSku]}
                        </div>
                      )}
                    </>
                  )}
                  {details.ru && <div><strong>Form Factor:</strong> {details.ru} RU</div>}
                  {details.power && <div><strong>Power:</strong> {details.power}</div>}
                  {details.fans !== undefined && <div><strong>Fans:</strong> {details.fans}</div>}
                  {details.airflow && <div><strong>Airflow:</strong> {details.airflow}</div>}
                  {!model?.includes('TAP') && details.ports !== undefined && <div><strong>Base Ports:</strong> {formatPortSummary(details.ports)}</div>}
                  {!model?.includes('TAP') && details.base_ports !== undefined && <div><strong>Base Ports:</strong> {formatPortSummary(details.base_ports)}</div>}
                  {details.module_slots !== undefined && <div><strong>Module Slots:</strong> {details.module_slots}</div>}
                </div>
              )}
            </div>
          ) : (
            <div className="text-md text-secondary mt-2">Specs not found for {sku}.</div>
          )}
        </div>

        {advancedMode && !model?.includes('TAP') && !isBreakoutPanelModel(model) && (
          <BoardSlotsPanel selectedNode={node} updateNodeData={updateNodeData} />
        )}

        {advancedMode && (
          <div className="panel-section">
            <h3 className="text-base font-semibold mb-2">🌍 Deployment Configuration</h3>
            <div className="flex-col gap-1">
              <label className="form-label">Site Assignment (Optional)</label>
              <datalist id="existing-sites-list">
                {Array.from(new Set(nodes.map(n => n.data?.site).filter(s => typeof s === 'string' && s.trim() !== ''))).map(site => (
                  <option key={site as string} value={site as string} />
                ))}
              </datalist>
              <input
                type="text"
                list="existing-sites-list"
                placeholder="e.g. Datacentre London / VMware Private Cloud"
                value={(node.data?.site as string) || ''}
                onChange={(e) => updateNodeData(node.id, { site: e.target.value })}
                className="form-input w-full"
              />
            </div>
          </div>
        )}

        {(!model?.includes('TAP') || model?.includes('G-TAP A') || model?.includes('ASF') || model?.includes('ATX')) && !isBreakoutPanelModel(model) && (
          <PowerSupplyPanel selectedNode={node} updateNodeData={updateNodeData} />
        )}

        {model?.includes('TAP') && (
          <TapLinksPanel selectedNode={node} updateNodeData={updateNodeData} nodes={nodes} edges={edges} />
        )}

        {isBreakoutPanelModel(model) && (
          <BreakoutPanelPanel selectedNode={node} nodes={nodes} edges={edges} />
        )}

        {!model?.includes('TAP') && !isBreakoutPanelModel(model) && (
          <div className="panel-section">
            <h3 className="text-base font-semibold mb-2">🎯 Traffic Map Filter Rules</h3>
            <MapNodePanel
              node={node}
              onConditionChange={onConditionChange}
              onAddCondition={onAddCondition}
              onRemoveCondition={onRemoveCondition}
            />
          </div>
        )}
      </div>

      {/* ── OPTICS TAB ── */}
      <div style={{ display: activeTab === 'optics' ? 'block' : 'none' }}>
        {!model?.includes('TAP') && !isBreakoutPanelModel(model) && (
          <>
            <CageSummaryPanel selectedNode={node} />
            <PortMapPanel selectedNode={node} />
            <OpticsPanel selectedNode={node} updateNodeData={updateNodeData} nodes={nodes} edges={edges} />
          </>
        )}
      </div>

      {/* ── GIGASMART APPS TAB ── */}
      <div style={{ display: activeTab === 'apps' ? 'block' : 'none' }}>
        {!model?.includes('TAP') && !isBreakoutPanelModel(model) && (
          <GigaSmartAppsPanel selectedNode={node} updateNodeData={updateNodeData} />
        )}
      </div>
    </>
  );
};
