import React, { useState } from 'react';
import { useStore, type CustomNode } from '../../store/store';
import { getSupportedBoards, validateOptic } from '../../utils/opticValidation';
import { resolveNodeSkus } from '../../utils/skuResolver';
import hardwareCatalogue from '../../constants/hardwareCatalogue.json';
import skusData from '../../constants/skus.json';
import { SUPPORTED_TAP_OPTICS } from '../../constants/nodeTypes';

interface HardwareNodePanelProps {
  node: CustomNode;
  onConditionChange: (index: number, key: string, value: string) => void;
  onAddCondition: () => void;
  onRemoveCondition: (index: number) => void;
}

// Re-import MapNodePanel to render inside the General tab
import { MapNodePanel } from './MapNodePanel';

export const HardwareNodePanel: React.FC<HardwareNodePanelProps> = ({ 
  node, 
  onConditionChange, 
  onAddCondition, 
  onRemoveCondition 
}) => {
  const model = node.data?.model as string;
  const sku = node.data?.sku as string;
  const installedOptics = (node.data?.optics as { board: string, optic: string, qty: number }[]) || [];
  const installedBoards = (node.data?.installedBoards as Record<string, string>) || {};
  const updateNodeData = useStore(state => state.updateNodeData);
  const edges = useStore(state => state.edges);
  const nodes = useStore(state => state.nodes);
  const projectLicenseMode = useStore(state => state.projectLicenseMode);

  // Calculate TAP link requirements and total optics by fiber type
  const incomingTapEdges = edges.filter(e => e.target === node.id);
  let tappedLinks = 0;
  let requiredMMOptics = 0;
  let requiredSMOptics = 0;

  incomingTapEdges.forEach(e => {
    const sourceNode = nodes.find(n => n.id === e.source);
    if (sourceNode?.data?.model?.includes('TAP')) {
      const tapSku = String(sourceNode.data?.sku || '');
      const tapModel = String(sourceNode.data?.model || '');
      const isSMTap = tapSku.includes('253') || tapSku.includes('273') || tapSku.includes('453') || tapModel.toLowerCase().includes('single-mode') || tapModel.toLowerCase().includes('sm') || tapModel.includes('253T') || tapModel.includes('273T') || tapModel.includes('453T');
      
      const numLinks = (sourceNode.data.tappedLinksCount as number) ?? 1;
      tappedLinks += numLinks;
      if (isSMTap) {
        requiredSMOptics += numLinks * 2;
      } else {
        requiredMMOptics += numLinks * 2;
      }
    }
  });

  let installedMMOptics = 0;
  let installedSMOptics = 0;
  installedOptics.forEach(opt => {
    const name = opt.optic.toUpperCase();
    const isOpticMM = name.includes('SR') || name.includes('SX') || name.includes('SWDM') || name.includes('FX');
    const isOpticSM = name.includes('LR') || name.includes('LX') || name.includes('ER') || name.includes('PLR') || name.includes('DR1') || name.includes('CWDM') || name.includes('FR');
    if (isOpticMM) installedMMOptics += opt.qty;
    else if (isOpticSM) installedSMOptics += opt.qty;
  });

  const missingMM = Math.max(0, requiredMMOptics - installedMMOptics);
  const missingSM = Math.max(0, requiredSMOptics - installedSMOptics);

  const totalOptics = installedOptics.reduce((sum, opt) => sum + opt.qty, 0);

  const [selectedOpticBoard, setSelectedOpticBoard] = useState('');
  const [selectedOptic, setSelectedOptic] = useState('');
  const [qtyStr, setQtyStr] = useState('1');
  const [errorMsg, setErrorMsg] = useState('');
  const [termDurationStr, setTermDurationStr] = useState((node.data?.termDurationOverride as string) || '');
  const [activeTab, setActiveTab] = useState<'general'|'optics'|'apps'>('general');
  
  const disableDcWarnings = useStore(state => state.disableDcWarnings);

  const handleTermBlur = () => {
    if (!termDurationStr) {
      updateNodeData(node.id, { termDurationOverride: undefined });
      return;
    }
    let parsed = parseInt(termDurationStr, 10);
    if (isNaN(parsed) || parsed < 1) parsed = 1;
    if (parsed > 120) parsed = 120;
    setTermDurationStr(parsed.toString());
    updateNodeData(node.id, { termDurationOverride: parsed.toString() });
  };

  const handlePowerChange = (power: string) => {
    if (power === 'DC' && !disableDcWarnings) {
      const confirm = window.confirm("You have selected a DC-powered appliance. Are you sure you need DC power?");
      if (!confirm) {
        updateNodeData(node.id, { powerSupply: 'AC' });
        return;
      }
    }
    updateNodeData(node.id, { powerSupply: power });
  };

  let details: any = null;

  if (model?.includes('TAP')) details = hardwareCatalogue.taps.find(t => t.sku === sku);
  else if (model?.includes('TA')) details = hardwareCatalogue.ta_series.find(t => t.sku === sku);
  else if (model?.includes('HC')) details = hardwareCatalogue.hc_series.find(t => t.sku === sku);

  const supportedBoards = getSupportedBoards(model || '', node.data?.portCapacity as string);
  
  const availableOpticBoards = supportedBoards.filter(b => 
    b.board.toLowerCase().includes('main') || 
    b.board.toLowerCase().includes('base') || 
    Object.values(installedBoards).includes(b.board)
  );

  const activeOpticBoardObj = availableOpticBoards.length === 1 
    ? availableOpticBoards[0] 
    : availableOpticBoards.find(b => b.board === selectedOpticBoard);

  const getOpticSpeed = (opticName: string): '1G' | '10G' | '25G' | '40G' | '100G' | 'Unknown' => {
    const name = opticName.toUpperCase();
    if (name.includes('100G') || name.startsWith('Q28-')) return '100G';
    if (name.includes('40G') || name.startsWith('QSF-')) return '40G';
    if (name.includes('25G') || name.startsWith('SFP-55')) return '25G';
    if (name.includes('10G') || name.startsWith('SFP-53')) return '10G';
    if (name.includes('1G') || name.startsWith('SFP-50')) return '1G';
    return 'Unknown';
  };

  const getOpticFiberType = (opticName: string): string => {
    const upper = opticName.toUpperCase();
    if (upper.includes('COPPER') || upper.includes('BASE-T') || upper.includes('BASET') || upper.endsWith('T') || upper.includes('ACTIVE CABLE') || upper.includes('DIRECT ATTACH') || upper.includes('DAC')) {
      return 'Copper';
    }
    if (/\b(SX|SR\d*|LRM|SWDM\d*)\b/i.test(upper) || upper.includes(' SX') || upper.includes(' SR') || upper.includes(' LRM') || upper.includes(' SWDM')) {
      return 'MM';
    }
    if (/\b(LX|LR\d*|ER\d*|ZR\d*|LH|DR\d*|FR\d*|CWDM\d*|PLR\d*|PSM\d*)\b/i.test(upper) || upper.includes(' LX') || upper.includes(' LR') || upper.includes(' ER') || upper.includes(' ZR') || upper.includes(' LH') || upper.includes(' DR') || upper.includes(' FR') || upper.includes(' CWDM') || upper.includes(' PLR') || upper.includes(' PSM')) {
      return 'SM';
    }
    return '';
  };

  const formatOpticLabel = (opticName: string): string => {
    const type = getOpticFiberType(opticName);
    return type ? `${opticName} [${type}]` : opticName;
  };

  const getBoardCages = (boardName: string, isPlus: boolean): { sfp: number; qsfp: number } => {
    const name = boardName.toLowerCase();
    const modelLower = String(model || '').toLowerCase();
    
    if (modelLower.includes('ta25')) {
      return { sfp: 48, qsfp: 8 };
    }
    
    if (name.includes('main') || name.includes('base') || name.includes('hc1-x12g4') || name.includes('hc1p-c04x08') || name.includes('hc1p-base') || name.includes('hct-c02')) {
      if (isPlus) {
        return { sfp: 8, qsfp: 4 };
      } else if (modelLower.includes('hct')) {
        return { sfp: 4, qsfp: 2 };
      } else { // HC1
        return { sfp: 12, qsfp: 0 };
      }
    }
    
    if (name.includes('q04x08')) {
      return { sfp: 8, qsfp: 4 };
    }
    if (name.includes('d25a24') || name.includes('bps-hc1-d25a24')) {
      return { sfp: 24, qsfp: 0 };
    }
    if (name.includes('x12') || name.includes('g12')) {
      return { sfp: 12, qsfp: 0 };
    }
    if (name.includes('x24')) {
      return { sfp: 24, qsfp: 0 };
    }
    if (name.includes('c08q08')) {
      return { sfp: 0, qsfp: 16 };
    }
    if (name.includes('c16')) {
      return { sfp: 0, qsfp: 16 };
    }
    if (name.includes('c08')) {
      return { sfp: 0, qsfp: 8 };
    }
    if (name.includes('c05')) {
      return { sfp: 0, qsfp: 5 };
    }
    if (name.includes('bps-hc3')) {
      return { sfp: 16, qsfp: 4 };
    }
    return { sfp: 0, qsfp: 0 };
  };

  const getBoardCageCapacities = (boardName: string, isPlus: boolean): {
    ports1G: number;
    ports10G: number;
    ports25G: number;
    ports40G: number;
    ports100G: number;
  } => {
    const caps = { ports1G: 0, ports10G: 0, ports25G: 0, ports40G: 0, ports100G: 0 };
    const name = boardName.toLowerCase();
    const modelLower = String(model || '').toLowerCase();
    const cages = getBoardCages(boardName, isPlus);
    
    caps.ports100G = cages.qsfp;
    caps.ports40G = cages.qsfp;
    caps.ports25G = cages.sfp;
    caps.ports10G = cages.sfp;
    caps.ports1G = cages.sfp;
    
    // For GigaVUE-HC1 main board SFP cages + copper ports
    if ((name.includes('main') || name.includes('base') || name.includes('hc1-x12g4')) && !isPlus && !modelLower.includes('hct')) {
      caps.ports1G = 12 + 4; // 12 SFP + 4 RJ45 copper ports
    }
    
    return caps;
  };

  let total100G = 0, total40G = 0, total25G = 0, total10G = 0, total1G = 0;
  const isPlus = String(model || '').includes('Plus');

  availableOpticBoards.forEach(b => {
    const caps = getBoardCageCapacities(b.board, isPlus);
    total100G += caps.ports100G;
    total40G += caps.ports40G;
    total25G += caps.ports25G;
    total10G += caps.ports10G;
    total1G += caps.ports1G;
  });

  let used100G = 0, used40G = 0, used25G = 0, used10G = 0, used1G = 0;
  installedOptics.forEach(opt => {
    const speed = getOpticSpeed(opt.optic);
    if (speed === '100G') used100G += opt.qty;
    else if (speed === '40G') used40G += opt.qty;
    else if (speed === '25G') used25G += opt.qty;
    else if (speed === '10G') used10G += opt.qty;
    else if (speed === '1G') used1G += opt.qty;
  });

  const handleBoardSelect = (slotIndex: number, boardName: string) => {
    const newBoards = { ...installedBoards };
    if (boardName) {
      newBoards[slotIndex] = boardName;
    } else {
      delete newBoards[slotIndex];
    }
    updateNodeData(node.id, { installedBoards: newBoards });
    
    if (selectedOpticBoard && !Object.values(newBoards).includes(selectedOpticBoard) && !selectedOpticBoard.toLowerCase().includes('main') && !selectedOpticBoard.toLowerCase().includes('base')) {
      setSelectedOpticBoard('');
      setSelectedOptic('');
      setErrorMsg('');
    }
  };

  const handleAddOptic = () => {
    setErrorMsg('');
    const targetBoard = availableOpticBoards.length === 1 ? availableOpticBoards[0].board : selectedOpticBoard;
    if (!targetBoard || !selectedOptic) {
      setErrorMsg('Please select a board and an optic.');
      return;
    }
    const validation = validateOptic(model, targetBoard, selectedOptic, node.data?.portCapacity as string);
    if (!validation.valid) {
      setErrorMsg(validation.message || 'Invalid optic combination.');
      return;
    }

    let qty = parseInt(qtyStr);
    if (isNaN(qty) || qty < 1) qty = 1;

    // Enforce target board physical cage limit
    const cages = getBoardCages(targetBoard, isPlus);
    let currentSfp = 0;
    let currentQsfp = 0;
    installedOptics.forEach(opt => {
      if (opt.board === targetBoard) {
        const speed = getOpticSpeed(opt.optic);
        if (speed === '100G' || speed === '40G') {
          currentQsfp += opt.qty;
        } else {
          currentSfp += opt.qty;
        }
      }
    });

    const newSpeed = getOpticSpeed(selectedOptic);
    const isNewQsfp = newSpeed === '100G' || newSpeed === '40G';
    
    if (isNewQsfp) {
      if (currentQsfp + qty > cages.qsfp) {
        setErrorMsg(`Cannot add optic. Board/Module "${targetBoard}" only has ${cages.qsfp} QSFP cage(s) (currently using ${currentQsfp}, attempting to add ${qty}).`);
        return;
      }
    } else {
      if (currentSfp + qty > cages.sfp) {
        setErrorMsg(`Cannot add optic. Board/Module "${targetBoard}" only has ${cages.sfp} SFP cage(s) (currently using ${currentSfp}, attempting to add ${qty}).`);
        return;
      }
    }

    const existingOpticIdx = installedOptics.findIndex(opt => (opt.board || 'Base Ports') === targetBoard && opt.optic === selectedOptic);
    let newOptics;
    if (existingOpticIdx >= 0) {
      newOptics = [...installedOptics];
      newOptics[existingOpticIdx] = {
        ...newOptics[existingOpticIdx],
        qty: newOptics[existingOpticIdx].qty + qty
      };
    } else {
      newOptics = [...installedOptics, { board: targetBoard, optic: selectedOptic, qty }];
    }
    updateNodeData(node.id, { optics: newOptics });
    setSelectedOptic('');
    setQtyStr('1');
  };

  const handleRemoveOptic = (index: number) => {
    const newOptics = [...installedOptics];
    newOptics.splice(index, 1);
    updateNodeData(node.id, { optics: newOptics });
  };

  const getBoardDescription = (boardName: string): string => {
    const name = boardName.toUpperCase();
    const isPlus = String(model || '').includes('Plus');
    
    let desc = '';
    if (name.includes('Q04X08')) {
      desc = isPlus ? '4x 100G QSFP28 & 8x 25G SFP28' : '4x 40G QSFP+ & 8x 10G SFP+';
    } else if (name.includes('D25A24')) {
      desc = 'Bypass: 2x 10G SR Pairs & 20x 10G SFP+';
    } else if (name.includes('X12') || name.includes('G12')) {
      desc = '12x 10G/1G SFP+';
    } else if (name.includes('X24')) {
      desc = '24x 25G/10G SFP28/SFP+';
    } else if (name.includes('C08Q08')) {
      desc = '8x 100G QSFP28 & 8x 40G QSFP+';
    } else if (name.includes('C16')) {
      desc = '16x 100G QSFP28';
    } else if (name.includes('C08')) {
      desc = '8x 100G QSFP28';
    } else if (name.includes('C05')) {
      desc = '5x 100G/40G QSFP28';
    } else if (name.includes('C25F2G')) {
      desc = 'Bypass: 2x 100G SR4 Pairs & 16x 10G SFP+';
    } else if (name.includes('C35C2G')) {
      desc = 'Bypass: 2x 100G LR Pairs & 16x 10G SFP+';
    } else if (name.includes('Q35C2G')) {
      desc = 'Bypass: 2x 40G LR Pairs & 16x 10G SFP+';
    }
    
    const hasGigaSmart = name.startsWith('SMT-');
    
    if (desc) {
      return `${boardName} (${hasGigaSmart ? 'GigaSMART Engine + ' : ''}${desc})`;
    }
    return boardName + (hasGigaSmart ? ' (GigaSMART Engine)' : '');
  };

  const renderModuleSlots = () => {
    if (!details?.module_slots) return null;
    
    const slots = [];
    const installableBoards = supportedBoards.filter(b => !b.board.toLowerCase().includes('main') && !b.board.toLowerCase().includes('base'));
    
    for (let i = 1; i <= details.module_slots; i++) {
      slots.push(
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
          <label style={{ fontSize: '11px', color: '#ccc' }}>Slot {i}</label>
          <select 
            value={installedBoards[i] || ''} 
            onChange={e => handleBoardSelect(i, e.target.value)}
            style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}
          >
            <option value="">-- Empty Slot --</option>
            {installableBoards.map(b => (
              <option key={b.board} value={b.board}>{getBoardDescription(b.board)}</option>
            ))}
          </select>
        </div>
      );
    }
    return (
      <div style={{ borderTop: '1px solid rgba(255, 152, 0, 0.2)', paddingTop: '10px', marginTop: '10px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>Module Slots</h4>
        {slots}
      </div>
    );
  };

  const resolved = resolveNodeSkus({ ...node.data, model, sku }, projectLicenseMode);

  const tabStyle = { padding: '6px 12px', fontSize: '11px', fontWeight: 'bold' as const, border: 'none', borderRadius: '4px', cursor: 'pointer' };

  return (
    <>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', borderBottom: '1px solid #333', paddingBottom: '8px', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('general')} style={{ ...tabStyle, background: activeTab === 'general' ? '#333' : 'transparent', color: activeTab === 'general' ? '#fff' : '#888' }}>General</button>
        <button onClick={() => setActiveTab('optics')} style={{ ...tabStyle, background: activeTab === 'optics' ? '#333' : 'transparent', color: activeTab === 'optics' ? '#fff' : '#888' }}>Optics</button>
        {node.data.gigaSmartApps && Array.isArray(node.data.gigaSmartApps) && node.data.gigaSmartApps.length > 0 && (
          <button onClick={() => setActiveTab('apps')} style={{ ...tabStyle, background: activeTab === 'apps' ? '#333' : 'transparent', color: activeTab === 'apps' ? '#fff' : '#888' }}>GigaSMART Apps</button>
        )}
      </div>

      {/* ── GENERAL TAB ── */}
      <div style={{ display: activeTab === 'general' ? 'block' : 'none' }}>
        <div className="config-card">
          <h3>⚙️ Hardware Specifications</h3>
          {details ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
              <div><strong>Model:</strong> {details.model}</div>
              <div><strong>Hardware SKU:</strong> {resolved.hwSku}</div>
              {skusData[resolved.hwSku as keyof typeof skusData] && (
                <div style={{ background: 'rgba(255, 152, 0, 0.08)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255, 152, 0, 0.2)', marginTop: '4px', marginBottom: '6px', fontSize: '11px', color: '#ffe0b2', lineHeight: '1.4' }}>
                  <strong>Hardware Description:</strong> {skusData[resolved.hwSku as keyof typeof skusData]}
                </div>
              )}
              {resolved.swSku && (
                <>
                  <div style={{ marginTop: '4px' }}><strong>Software SKU:</strong> {resolved.swSku}</div>
                  {skusData[resolved.swSku as keyof typeof skusData] && (
                    <div style={{ background: 'rgba(0, 229, 255, 0.08)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(0, 229, 255, 0.2)', marginTop: '4px', marginBottom: '6px', fontSize: '11px', color: '#e0f7fa', lineHeight: '1.4' }}>
                      <strong>Software Description:</strong> {skusData[resolved.swSku as keyof typeof skusData]}
                    </div>
                  )}
                </>
              )}
              {details.ru && <div><strong>Form Factor:</strong> {details.ru} RU</div>}
              {details.power && <div><strong>Power:</strong> {details.power}</div>}
              {details.fans !== undefined && <div><strong>Fans:</strong> {details.fans}</div>}
              {details.airflow && <div><strong>Airflow:</strong> {details.airflow}</div>}
              {!model?.includes('TAP') && details.ports !== undefined && <div><strong>Base Ports:</strong> {details.ports}</div>}
              {!model?.includes('TAP') && details.base_ports !== undefined && <div><strong>Base Ports:</strong> {details.base_ports}</div>}
              {details.module_slots !== undefined && <div><strong>Module Slots:</strong> {details.module_slots}</div>}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: '#aaa' }}>Specs not found for {sku}.</div>
          )}
        </div>

        {!model?.includes('TAP') && (
          <div className="config-card" style={{ marginTop: '16px' }}>
            <h3>🔧 Appliance Configuration</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>License Mode Override</label>
                <select value={(node.data?.licenseModeOverride as string) || 'default'} onChange={(e) => updateNodeData(node.id, { licenseModeOverride: e.target.value })} style={{ width: '100%' }}>
                  <option value="default">Project Default</option>
                  <option value="HTL">Hybrid Term Licensing (HTL)</option>
                  <option value="Perpetual">Perpetual</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Term Duration (Months)</label>
                <input type="number" placeholder="Project Default" value={termDurationStr} onChange={(e) => setTermDurationStr(e.target.value)} onBlur={handleTermBlur} style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Power Supply</label>
                <select value={(node.data?.powerSupply as string) || 'AC'} onChange={(e) => handlePowerChange(e.target.value)} style={{ width: '100%' }}>
                  <option value="AC">AC Power</option>
                  <option value="DC">DC Power</option>
                </select>
              </div>
              {model?.includes('TA') && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Software Port Capacity</label>
                    {model.includes('TA400') ? (
                      <select value={(node.data?.portCapacity as string) || 'Full'} onChange={(e) => updateNodeData(node.id, { portCapacity: e.target.value })} style={{ width: '100%' }}>
                        <option value="Full">32 x 400Gb ports</option>
                        <option value="100G">32 x 100Gb ports</option>
                      </select>
                    ) : (
                      <select value={(node.data?.portCapacity as string) || 'Full'} onChange={(e) => updateNodeData(node.id, { portCapacity: e.target.value })} style={{ width: '100%' }}>
                        <option value="Full">Full Capacity</option>
                        <option value="Half">Half Capacity</option>
                        <option value="Quarter">Quarter Capacity</option>
                      </select>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(node.data?.advancedFeatures)}
                      onChange={(e) => updateNodeData(node.id, { advancedFeatures: e.target.checked })}
                      id="checkboxAdvancedFeatures"
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor="checkboxAdvancedFeatures" style={{ fontSize: '11px', color: '#ccc', cursor: 'pointer' }}>
                      Include Advanced Features License
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {model?.includes('TAP') && (() => {
          const maxLinks = details?.max_links || 6;
          const tapSku = String(node.data?.sku || '');
          const tapModel = String(node.data?.model || '');
          const isSMTap = tapSku.includes('253') || tapSku.includes('273') || tapSku.includes('453') || tapModel.toLowerCase().includes('single-mode') || tapModel.toLowerCase().includes('sm') || tapModel.includes('253T') || tapModel.includes('273T') || tapModel.includes('453T');
          
          const selectedOpticVal = node.data.tappedLinkOptic || (isSMTap ? 'SFP-533 (10G SFP+ LR)' : 'SFP-532 (10G SFP+ SR)');
          const matchedOptic = SUPPORTED_TAP_OPTICS.find(o => o.value === selectedOpticVal);
          const hasMismatch = matchedOptic ? (matchedOptic.isSM !== isSMTap) : false;

          return (
            <div style={{ borderTop: '1px solid rgba(255, 152, 0, 0.2)', paddingTop: '10px', marginTop: '16px', marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>TAP Settings</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '11px', color: '#ccc', width: '90px' }}>Tapped Links:</label>
                  <select value={node.data.tappedLinksCount ?? 1} onChange={e => updateNodeData(node.id, { tappedLinksCount: parseInt(e.target.value) })} style={{ width: '80px', fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}>
                    {Array.from({ length: maxLinks }, (_, i) => i + 1).map(num => <option key={num} value={num}>{num}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '11px', color: '#ccc', width: '90px' }}>Target Optic:</label>
                  <select value={selectedOpticVal} onChange={e => updateNodeData(node.id, { tappedLinkOptic: e.target.value })} style={{ flex: 1, fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}>
                    {SUPPORTED_TAP_OPTICS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>Specifies the number of links this TAP is monitoring (1-{maxLinks}) and target optic speed/fiber type.</div>
              
              {hasMismatch && (
                <div style={{ marginTop: '8px', padding: '6px', background: 'rgba(239, 83, 80, 0.1)', border: '1px solid rgba(239, 83, 80, 0.3)', borderRadius: '4px', color: '#ef5350', fontSize: '10px' }}>
                  ⚠️ Fiber mode mismatch: TAP is {isSMTap ? 'Single-mode' : 'Multi-mode'} but target optic is {matchedOptic?.isSM ? 'Single-mode' : 'Multi-mode'}.
                </div>
              )}

              {(() => {
                const outgoingEdges = edges.filter(e => e.source === node.id || e.target === node.id);
                if (outgoingEdges.length === 0) return null;
                const otherId = outgoingEdges[0].source === node.id ? outgoingEdges[0].target : outgoingEdges[0].source;
                const targetNode = nodes.find(n => n.id === otherId);
                if (!targetNode) return null;
                
                const match = selectedOpticVal.match(/(1|10|25|40|100|400)G/i);
                if (!match) return null;

                const speedVal = parseInt(match[1]);
                const speedStr = match[1] + 'G';
                const numLinks = (node.data.tappedLinksCount as number) ?? 1;
                const totalSpeed = numLinks * speedVal;
                return (
                  <div style={{ marginTop: '12px', padding: '8px', backgroundColor: 'rgba(37, 179, 75, 0.1)', border: '1px solid rgba(37, 179, 75, 0.3)', borderRadius: '4px' }}>
                    <div style={{ fontSize: '11px', color: '#4caf50', fontWeight: 'bold' }}>Derived Input Capacity</div>
                    <div style={{ fontSize: '11px', color: '#fff', marginTop: '4px' }}>{numLinks} link(s) × {speedStr} = <strong>{totalSpeed}G Total</strong></div>
                    <div style={{ fontSize: '9px', color: '#aaa', marginTop: '2px' }}>(Based on target optic: {selectedOpticVal})</div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {!model?.includes('TAP') && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', marginTop: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#ffb74d' }}>Traffic Map Filter Rules</h4>
            <MapNodePanel node={node} onConditionChange={onConditionChange} onAddCondition={onAddCondition} onRemoveCondition={onRemoveCondition} />
          </div>
        )}
      </div>

      {/* ── OPTICS TAB ── */}
      <div style={{ display: activeTab === 'optics' ? 'block' : 'none' }}>
        {renderModuleSlots()}

        {!model?.includes('TAP') && (total100G > 0 || total40G > 0 || total25G > 0 || total10G > 0 || total1G > 0) && (
          <div style={{ borderTop: '1px solid rgba(255, 152, 0, 0.2)', paddingTop: '10px', marginTop: '10px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>Chassis Cage Capacity</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', textAlign: 'center', background: '#111', padding: '8px', borderRadius: '4px', border: '1px solid #333' }}>
              {total100G > 0 && <div><div style={{ color: '#888', fontWeight: 'bold', fontSize: '10px' }}>100G</div><div style={{ color: used100G > total100G ? '#ef5350' : '#fff', fontSize: '11px', marginTop: '2px', fontFamily: 'monospace' }}>{used100G}/{total100G}</div></div>}
              {total40G > 0 && <div><div style={{ color: '#888', fontWeight: 'bold', fontSize: '10px' }}>40G</div><div style={{ color: used40G > total40G ? '#ef5350' : '#fff', fontSize: '11px', marginTop: '2px', fontFamily: 'monospace' }}>{used40G}/{total40G}</div></div>}
              {total25G > 0 && <div><div style={{ color: '#888', fontWeight: 'bold', fontSize: '10px' }}>25G</div><div style={{ color: used25G > total25G ? '#ef5350' : '#fff', fontSize: '11px', marginTop: '2px', fontFamily: 'monospace' }}>{used25G}/{total25G}</div></div>}
              {total10G > 0 && <div><div style={{ color: '#888', fontWeight: 'bold', fontSize: '10px' }}>10G</div><div style={{ color: used10G > total10G ? '#ef5350' : '#fff', fontSize: '11px', marginTop: '2px', fontFamily: 'monospace' }}>{used10G}/{total10G}</div></div>}
              {total1G > 0 && <div><div style={{ color: '#888', fontWeight: 'bold', fontSize: '10px' }}>1G</div><div style={{ color: used1G > total1G ? '#ef5350' : '#fff', fontSize: '11px', marginTop: '2px', fontFamily: 'monospace' }}>{used1G}/{total1G}</div></div>}
            </div>
          </div>
        )}

        {!model?.includes('TAP') && (
          <div style={{ borderTop: '1px solid rgba(255, 152, 0, 0.2)', paddingTop: '10px', marginTop: '10px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>Optics Deployment Status</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#111', padding: '10px', borderRadius: '4px', border: '1px solid #333', fontSize: '11px', color: '#ccc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Deployed Optics:</span>
                <strong style={{ color: '#00e5ff', fontFamily: 'monospace' }}>{totalOptics}</strong>
              </div>
              {tappedLinks > 0 && (() => {
                const terminatedMM = Math.min(Math.floor(requiredMMOptics / 2), Math.floor(installedMMOptics / 2));
                const terminatedSM = Math.min(Math.floor(requiredSMOptics / 2), Math.floor(installedSMOptics / 2));
                const totalTerminated = terminatedMM + terminatedSM;
                
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #222', paddingTop: '6px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Tapped Links Terminated:</span>
                      <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{totalTerminated} / {tappedLinks}</strong>
                    </div>
                    {missingMM > 0 && (
                      <div style={{ color: '#ef5350', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <span>⚠️ Multi-mode links lack optics: need {missingMM} more Multi-mode optic(s).</span>
                      </div>
                    )}
                    {missingSM > 0 && (
                      <div style={{ color: '#ef5350', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <span>⚠️ Single-mode links lack optics: need {missingSM} more Single-mode optic(s).</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {availableOpticBoards.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(255, 152, 0, 0.2)', paddingTop: '10px', marginTop: '10px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>Install Optics</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {availableOpticBoards.length > 1 ? (
                <select value={selectedOpticBoard} onChange={e => { setSelectedOpticBoard(e.target.value); setSelectedOptic(''); setErrorMsg(''); }} style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}>
                  <option value="">-- Select Target Cage --</option>
                  {availableOpticBoards.map(b => <option key={b.board} value={b.board}>{b.board}</option>)}
                </select>
              ) : (
                <div style={{ fontSize: '11px', color: '#aaa', padding: '4px 0' }}>Target Cage: <strong style={{ color: '#fff' }}>{availableOpticBoards[0]?.board || 'Base Ports'}</strong></div>
              )}
              <select value={selectedOptic} onChange={e => { setSelectedOptic(e.target.value); setErrorMsg(''); }} style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }} disabled={availableOpticBoards.length === 0 || (availableOpticBoards.length > 1 && !selectedOpticBoard)}>
                <option value="">-- Select Optic --</option>
                {activeOpticBoardObj?.supportedOptics.map(opt => <option key={opt} value={opt}>{formatOpticLabel(opt)}</option>)}
              </select>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label style={{ fontSize: '11px', color: '#ccc' }}>Qty:</label>
                <input type="number" min={1} value={qtyStr} onChange={e => setQtyStr(e.target.value)} style={{ width: '40px', fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }} />
                <button onClick={handleAddOptic} style={{ flex: 1, padding: '4px 8px', background: 'rgba(255, 152, 0, 0.2)', border: '1px solid rgba(255, 152, 0, 0.4)', borderRadius: '3px', color: '#ffb74d', fontSize: '11px', cursor: 'pointer' }}>Add Optic</button>
              </div>
              {errorMsg && <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(239, 83, 80, 0.1)', border: '1px solid rgba(239, 83, 80, 0.3)', borderRadius: '4px', color: '#ef5350', fontSize: '11px', whiteSpace: 'pre-wrap' }}>⚠️ {errorMsg}</div>}
            </div>

            {installedOptics.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <h5 style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#ccc' }}>Installed Optics:</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {installedOptics.map((opt, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', border: '1px solid #333' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: '#fff' }}>{opt.qty}x {formatOpticLabel(opt.optic)}</span>
                        <span style={{ color: '#888' }}>{opt.board}</span>
                      </div>
                      <button onClick={() => handleRemoveOptic(i)} style={{ background: 'none', border: 'none', color: '#ef5350', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }} title="Remove Optic">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(() => {
              const toolsReached = new Set<string>();
              const visited = new Set<string>();
              const queue = [node.id];
              visited.add(node.id);
              while (queue.length > 0) {
                const currentId = queue.shift()!;
                const outbound = edges.filter(e => e.source === currentId);
                outbound.forEach(e => {
                  if (!visited.has(e.target)) {
                    visited.add(e.target);
                    const targetNode = nodes.find(n => n.id === e.target);
                    if (targetNode) {
                      if (targetNode.type === 'toolNode') toolsReached.add(targetNode.id);
                      else if (targetNode.type !== 'hardwareNode') queue.push(e.target);
                    }
                  }
                });
              }
              const numToolLinks = toolsReached.size;
              const requiredTapOptics = requiredMMOptics + requiredSMOptics;
              const totalRequiredOptics = requiredTapOptics + numToolLinks;

              if (missingMM > 0 || missingSM > 0) {
                return (
                  <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(255, 152, 0, 0.1)', border: '1px solid rgba(255, 152, 0, 0.3)', borderRadius: '4px', color: '#ffb74d', fontSize: '11px' }}>
                    <strong>⚠️ Attention:</strong> Every tapped link produces two outputs.
                    {missingMM > 0 && <div>• You need <strong>{missingMM}</strong> more Multi-mode optic(s) (e.g. SR/SX).</div>}
                    {missingSM > 0 && <div>• You need <strong>{missingSM}</strong> more Single-mode optic(s) (e.g. LR/LX).</div>}
                  </div>
                );
              } else if (numToolLinks > 0 && totalOptics < totalRequiredOptics) {
                const diff = totalRequiredOptics - totalOptics;
                return <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(0, 150, 136, 0.1)', border: '1px solid rgba(0, 150, 136, 0.3)', borderRadius: '4px', color: '#80cbc4', fontSize: '11px' }}><strong>💡 Suggestion:</strong> You have <strong>{numToolLinks}</strong> tool output(s). You need to install at least <strong>{diff}</strong> more optic(s) to support the tools.</div>;
              }
              return null;
            })()}
          </div>
        )}
      </div>

      {/* ── GIGASMART APPS TAB ── */}
      <div style={{ display: activeTab === 'apps' ? 'block' : 'none' }}>
        {node.data.gigaSmartApps && Array.isArray(node.data.gigaSmartApps) && node.data.gigaSmartApps.length > 0 ? (
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#ffb74d' }}>GigaSMART Applications</h4>
            {node.data.gigaSmartApps.map((app: any, idx: number) => (
              <div key={app.id || idx} style={{ background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '10px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>{app.label || app.actionType}</span>
                </div>
                
                {(app.actionType === 'Deduplication' || app.actionType === 'Dedup') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '11px', color: '#ccc' }}>Estimated Deduplication Rate (%)</label>
                    <input type="range" min={0} max={100} value={app.dedupRate ?? 20} onChange={e => {
                        const newApps = [...(node.data.gigaSmartApps as any[])];
                        newApps[idx] = { ...newApps[idx], dedupRate: Number(e.target.value) };
                        updateNodeData(node.id, { gigaSmartApps: newApps });
                      }} style={{ width: '100%' }} />
                    <div style={{ fontSize: '11px', color: '#00e5ff', textAlign: 'right' }}>{app.dedupRate ?? 20}% Duplicate Drops</div>
                    
                    <label style={{ fontSize: '11px', color: '#ccc', marginTop: '4px' }}>Drift Profile</label>
                    <select 
                      value={app.dedupDriftProfile || 'volatile'} 
                      onChange={e => {
                        const newApps = [...(node.data.gigaSmartApps as any[])];
                        newApps[idx] = { ...newApps[idx], dedupDriftProfile: e.target.value };
                        updateNodeData(node.id, { gigaSmartApps: newApps });
                      }} 
                      style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}
                    >
                      <option value="volatile">Volatile (Swings +/-5%)</option>
                      <option value="stable">Stable (Swings +/-2%)</option>
                      <option value="static">Static (No Drift)</option>
                    </select>
                  </div>
                )}
                
                {(app.actionType === 'Application Metadata' || app.actionType === 'AMX' || app.actionType === 'AMI') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', color: '#ccc' }}>Metadata Output Format</label>
                    <select value={app.metadataFormat || 'CEF'} onChange={e => {
                        const newApps = [...(node.data.gigaSmartApps as any[])];
                        newApps[idx] = { ...newApps[idx], metadataFormat: e.target.value };
                        updateNodeData(node.id, { gigaSmartApps: newApps });
                      }} style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}>
                      <option value="CEF">CEF (Common Event Format)</option>
                      <option value="JSON">JSON</option>
                    </select>

                    <label style={{ fontSize: '11px', color: '#ccc', marginTop: '4px' }}>Metadata Generation Rate (%)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="range"
                        min={1}
                        max={6}
                        step={0.5}
                        value={app.metadataRate !== undefined ? app.metadataRate : (app.actionType === 'Application Metadata' ? 3 : 1.5)}
                        onChange={e => {
                          const newApps = [...(node.data.gigaSmartApps as any[])];
                          newApps[idx] = { ...newApps[idx], metadataRate: Number(e.target.value) };
                          updateNodeData(node.id, { gigaSmartApps: newApps });
                        }}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', minWidth: '35px', textAlign: 'right', color: '#00e5ff', fontWeight: 'bold' }}>
                        {app.metadataRate !== undefined ? app.metadataRate : (app.actionType === 'Application Metadata' ? 3 : 1.5)}%
                      </span>
                    </div>
                  </div>
                )}
                
                {app.actionType === 'Packet Slicing' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '11px', color: '#ccc' }}>Packet Slice Size (Bytes)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="range" 
                        min={64} 
                        max={1518} 
                        value={app.sliceSize ?? 128} 
                        onChange={e => {
                          const newApps = [...(node.data.gigaSmartApps as any[])];
                          newApps[idx] = { ...newApps[idx], sliceSize: Number(e.target.value) };
                          updateNodeData(node.id, { gigaSmartApps: newApps });
                        }} 
                        style={{ flex: 1 }} 
                      />
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#00e5ff', minWidth: '40px', textAlign: 'right', fontWeight: 'bold' }}>
                        {app.sliceSize ?? 128}B
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#80cbc4', lineHeight: '1.3' }}>
                      Retains headers, truncating payload. Downstream bandwidth reduced by: <strong style={{ color: '#00e5ff' }}>{Math.round((1 - ((app.sliceSize ?? 128) / 1518)) * 100)}%</strong>
                    </div>
                  </div>
                )}

                {app.actionType !== 'Deduplication' && app.actionType !== 'Dedup' && app.actionType !== 'Application Metadata' && app.actionType !== 'AMX' && app.actionType !== 'AMI' && app.actionType !== 'Packet Slicing' && (
                  <div style={{ fontSize: '11px', color: '#aaa' }}>
                    No additional configuration required for {app.actionType}.
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: '#aaa', padding: '16px 0', textAlign: 'center' }}>
            No GigaSMART applications dropped on this hardware.
          </div>
        )}
      </div>
    </>
  );
};
