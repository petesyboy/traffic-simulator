import React, { useState, useEffect } from 'react';
import { useStore, type CustomNode } from '../../store/store';
import { getSupportedBoards, validateOptic } from '../../utils/opticValidation';
import { resolveNodeSkus } from '../../utils/skuResolver';
import hardwareCatalogue from '../../constants/hardwareCatalogue.json';
import skusData from '../../constants/skus.json';
import { SUPPORTED_TAP_OPTICS } from '../../constants/nodeTypes';
import { getAvailableEngines } from '../../constants/gigaSmartRules';

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
  const addTrafficStream = useStore(state => state.addTrafficStream);

  // Calculate TAP link requirements and total optics by fiber type
  const incomingTapEdges = edges.filter(e => e.target === node.id);
  const uniqueIncomingTapSources = Array.from(new Set(incomingTapEdges.map(e => e.source)));
  let tappedLinks = 0;
  let requiredMMOptics = 0;
  let requiredSMOptics = 0;
  let requiredCopperOptics = 0;

  uniqueIncomingTapSources.forEach(srcId => {
    const sourceNode = nodes.find(n => n.id === srcId);
    if (sourceNode?.data?.model?.includes('TAP')) {
      const tapSku = String(sourceNode.data?.sku || '');
      const tapModel = String(sourceNode.data?.model || '');
      const isSMTap = tapSku.includes('253') || tapSku.includes('273') || tapSku.includes('453') || tapModel.toLowerCase().includes('single-mode') || tapModel.toLowerCase().includes('sm') || tapModel.includes('253T') || tapModel.includes('273T') || tapModel.includes('453T');
      
      const allocations = (sourceNode.data?.tappedLinkAllocations as { qty: number, optic: string, toolOptic?: string }[]) || [
        { 
          qty: (sourceNode.data?.tappedLinksCount as number) ?? 1, 
          optic: (sourceNode.data?.tappedLinkOptic as string) || (isSMTap ? 'SFP-533 (10G SFP+ LR)' : 'SFP-532 (10G SFP+ SR)')
        }
      ];

      for (const alloc of allocations) {
        const opticToValidate = alloc.toolOptic || alloc.optic;
        const matched = SUPPORTED_TAP_OPTICS.find(o => o.value === opticToValidate);
        const isCopper = matched ? !!matched.isCopper : opticToValidate.includes('Copper');
        const isSM = matched ? matched.isSM : isSMTap;
        tappedLinks += alloc.qty;
        if (isCopper) {
          requiredCopperOptics += alloc.qty * 2;
        } else if (isSM) {
          requiredSMOptics += alloc.qty * 2;
        } else {
          requiredMMOptics += alloc.qty * 2;
        }
      }
    }
  });

  const outgoingToolLinks = edges.filter(e => e.source === node.id && nodes.find(n => n.id === e.target)?.type === 'toolNode').length;

  let installedMMOptics = 0;
  let installedSMOptics = 0;
  let installedCopperOptics = 0;
  installedOptics.forEach(opt => {
    const name = opt.optic.toUpperCase();
    const isOpticCopper = name.includes('COPPER') || name.includes('BASE-T') || name.includes('BASET') || name.includes('ACTIVE CABLE') || name.includes('DIRECT ATTACH') || name.includes('DAC');
    const isOpticMM = !isOpticCopper && (name.includes('SR') || name.includes('SX') || name.includes('SWDM') || name.includes('FX') || name.includes('LRM') || name.includes('BIDI'));
    const isOpticSM = !isOpticCopper && (name.includes('LR') || name.includes('LX') || name.includes('ER') || name.includes('PLR') || name.includes('DR1') || name.includes('CWDM') || name.includes('FR'));
    if (isOpticCopper) installedCopperOptics += opt.qty;
    else if (isOpticMM) installedMMOptics += opt.qty;
    else if (isOpticSM) installedSMOptics += opt.qty;
  });

  const missingMM = Math.max(0, requiredMMOptics - installedMMOptics);
  const missingSM = Math.max(0, requiredSMOptics - installedSMOptics);
  const missingCopper = Math.max(0, requiredCopperOptics - installedCopperOptics);

  const totalOptics = installedOptics.reduce((sum, opt) => sum + opt.qty, 0);
  const totalOpticsNeeded = (requiredMMOptics + requiredSMOptics + requiredCopperOptics) + outgoingToolLinks;
  const isOpticsInvalid = (totalOptics < totalOpticsNeeded) || (missingMM > 0) || (missingSM > 0) || (missingCopper > 0);

  const [selectedOpticBoard, setSelectedOpticBoard] = useState('');
  const [selectedOptic, setSelectedOptic] = useState('');
  const [qtyStr, setQtyStr] = useState('1');
  const [errorMsg, setErrorMsg] = useState('');
  const [termDurationStr, setTermDurationStr] = useState((node.data?.termDurationOverride as string) || '');
  const [activeTab, setActiveTab] = useState<'general'|'optics'|'apps'>('general');
  const [isSpecsExpanded, setIsSpecsExpanded] = useState(false);

  // Allocation local states
  const [addQty, setAddQty] = useState(1);
  const [addOptic, setAddOptic] = useState('');
  const [addToolOptic, setAddToolOptic] = useState('');
  
  const disableDcWarnings = useStore(state => state.disableDcWarnings);

  useEffect(() => {
    if (model?.includes('TAP')) {
      setActiveTab('general');
    }
  }, [node.id, model]);

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

  const supportedBoards = getSupportedBoards(model || '', node.data?.portCapacity as string, installedOptics);
  
  const availableOpticBoards: { board: string; supportedOptics: string[] }[] = [];
  
  // 1. Add Main / Base board if supported
  const mainBoardObj = supportedBoards.find(b => b.board.toLowerCase().includes('main') || b.board.toLowerCase().includes('base'));
  if (mainBoardObj) {
    availableOpticBoards.push({
      board: mainBoardObj.board,
      supportedOptics: mainBoardObj.supportedOptics
    });
  }

  // 2. Add each slot board instance
  Object.entries(installedBoards).forEach(([slotIdx, boardName]) => {
    if (!boardName) return;
    const boardTemplate = supportedBoards.find(b => b.board === boardName);
    if (boardTemplate) {
      availableOpticBoards.push({
        board: `${boardName} (Slot ${slotIdx})`,
        supportedOptics: boardTemplate.supportedOptics
      });
    }
  });

  const activeOpticBoardObj = availableOpticBoards.length === 1 
    ? availableOpticBoards[0] 
    : availableOpticBoards.find(b => b.board === selectedOpticBoard);

  const getOpticSpeed = (opticName: string): '1G' | '10G' | '25G' | '40G' | '100G' | '400G' | 'Unknown' => {
    const name = opticName.toUpperCase();
    if (name.includes('400G') || name.startsWith('QDD-')) return '400G';
    if (name.includes('100G') || name.startsWith('Q28-')) return '100G';
    if (name.includes('40G') || name.startsWith('QSF-')) return '40G';
    if (name.includes('25G') || name.startsWith('SFP-55')) return '25G';
    if (name.includes('10G') || name.startsWith('SFP-53')) return '10G';
    if (name.includes('1G') || name.startsWith('SFP-50')) return '1G';
    return 'Unknown';
  };

  const getOpticFiberType = (opticName: string): string => {
    const upper = opticName.toUpperCase();
    if (upper.includes('COPPER') || upper.includes('BASE-T') || upper.includes('BASET') || upper.includes('ACTIVE CABLE') || upper.includes('DIRECT ATTACH') || upper.includes('DAC')) {
      return 'Copper';
    }
    if (/\b(SX|SR\d*|LRM|SWDM\d*|BIDI)\b/i.test(upper) || upper.includes(' SX') || upper.includes(' SR') || upper.includes(' LRM') || upper.includes(' SWDM') || upper.includes('BIDI')) {
      return 'MM';
    }
    if (/\b(LX|LR\d*|ER\d*|ZR\d*|LH|DR\d*|FR\d*|CWDM\d*|PLR\d*|PSM\d*)\b/i.test(upper) || upper.includes(' LX') || upper.includes(' LR') || upper.includes(' ER') || upper.includes(' ZR') || upper.includes(' LH') || upper.includes(' DR') || upper.includes(' FR') || upper.includes(' CWDM') || upper.includes(' PLR') || upper.includes(' PSM')) {
      return 'SM';
    }
    return '';
  };

  const formatOpticLabel = (opticName: string): string => {
    const type = getOpticFiberType(opticName);
    // Check if the SKU part (before the parenthesised description) ends with T — indicates TAA compliance
    const skuMatch = opticName.match(/^([A-Z0-9]+-[A-Z0-9]+)/i);
    const isTAA = skuMatch ? /T$/i.test(skuMatch[1]) : false;
    let label = type ? `${opticName} [${type}]` : opticName;
    if (isTAA) label += ' (TAA)';
    return label;
  };

  const getBoardCages = (boardName: string, isPlus: boolean): { sfp: number; qsfp: number } => {
    const name = boardName.toLowerCase();
    const modelLower = String(model || '').toLowerCase();
    
    if (modelLower.includes('ta25')) {
      return { sfp: 48, qsfp: 8 };
    }
    if (modelLower.includes('ta200')) {
      return { sfp: 0, qsfp: 64 };
    }
    if (modelLower.includes('ta400e')) {
      return { sfp: 2, qsfp: 32 };
    }
    if (modelLower.includes('ta400')) {
      return { sfp: 0, qsfp: 32 };
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

  const numBreakouts = installedOptics.reduce((sum, opt) => {
    if (opt.optic.includes('PNL-M341') || opt.optic.includes('PNL-M343')) {
      return sum + opt.qty;
    }
    return sum;
  }, 0);
  total25G += numBreakouts * 4;
  total10G += numBreakouts * 4;

  const modelLowerStr = String(model || '').toLowerCase();
  if (modelLowerStr.includes('ta25e')) {
    total25G = Math.min(total25G, 80);
    total10G = Math.min(total10G, 80);
  } else if (modelLowerStr.includes('ta25')) {
    total25G = Math.min(total25G, 56);
    total10G = Math.min(total10G, 56);
  } else if (modelLowerStr.includes('ta200e') || modelLowerStr.includes('ta200')) {
    total25G = Math.min(total25G, 128);
    total10G = Math.min(total10G, 128);
    total1G = 0;
  } else if (modelLowerStr.includes('ta400e')) {
    total100G = Math.min(total100G, 128);
    total25G = Math.min(total25G, 130);
    total10G = Math.min(total10G, 130);
    total1G = 0;
  } else if (modelLowerStr.includes('ta400')) {
    total100G = Math.min(total100G, 128);
    total25G = Math.min(total25G, 128);
    total10G = Math.min(total10G, 128);
    total1G = 0;
  } else if (modelLowerStr.includes('hct')) {
    total100G = Math.min(total100G, 2);
    total40G = Math.min(total40G, 6);
    total25G = Math.min(total25G, 12);
    total10G = Math.min(total10G, 32);
    total1G = Math.min(total1G, 12);
  } else if (modelLowerStr.includes('hc1-plus') || modelLowerStr.includes('hc1 plus')) {
    total100G = Math.min(total100G, 12);
    total40G = Math.min(total40G, 12);
    total25G = Math.min(total25G, 72);
    total10G = Math.min(total10G, 72);
    total1G = Math.min(total1G, 32);
  } else if (modelLowerStr.includes('hc1')) {
    total40G = Math.min(total40G, 8);
    total25G = 0;
    total10G = Math.min(total10G, 60);
    total1G = Math.min(total1G, 40);
  } else if (modelLowerStr.includes('hc3')) {
    total100G = Math.min(total100G, 64);
    total40G = Math.min(total40G, 64);
    total25G = Math.min(total25G, 128);
    total10G = Math.min(total10G, 128);
  }

  let used100G = 0, used40G = 0, used25G = 0, used10G = 0, used1G = 0;
  installedOptics.forEach(opt => {
    if (opt.optic.includes('PNL-M34')) return;
    const speed = getOpticSpeed(opt.optic);
    if (speed === '100G') used100G += opt.qty;
    else if (speed === '40G') used40G += opt.qty;
    else if (speed === '25G') used25G += opt.qty;
    else if (speed === '10G') used10G += opt.qty;
    else if (speed === '1G') used1G += opt.qty;
  });

  // ─── Calculate physical cages and ports ─────────────────────────────────────
  let totalSfpCages = 0;
  let totalQsfpCages = 0;
  let hasBuiltInCopper = false;
  let usedBuiltInCopper = 0;

  availableOpticBoards.forEach(b => {
    const cages = getBoardCages(b.board, isPlus);
    totalSfpCages += cages.sfp;
    totalQsfpCages += cages.qsfp;
    
    const name = b.board.toLowerCase();
    const modelLower = String(model || '').toLowerCase();
    if ((name.includes('main') || name.includes('base') || name.includes('hc1-x12g4')) && !isPlus && !modelLower.includes('hct') && !modelLower.includes('tap')) {
      hasBuiltInCopper = true;
    }
  });

  let usedSfpOptics = 0;
  let usedQsfpOptics = 0;
  let usedBreakouts = 0;
  
  installedOptics.forEach(opt => {
    if (opt.optic.includes('PNL-M341') || opt.optic.includes('PNL-M343')) {
      usedBreakouts += opt.qty;
    } else {
      const speed = getOpticSpeed(opt.optic);
      const isQsfp = speed === '100G' || speed === '40G' || speed === '400G';
      const isCopper = getOpticFiberType(opt.optic) === 'Copper';
      
      if (isQsfp) {
        usedQsfpOptics += opt.qty;
      } else {
        if (hasBuiltInCopper && isCopper && opt.optic.includes('SFP-501')) {
          const countForBuiltIn = Math.min(opt.qty, 4 - usedBuiltInCopper);
          usedBuiltInCopper += countForBuiltIn;
          usedSfpOptics += (opt.qty - countForBuiltIn);
        } else {
          usedSfpOptics += opt.qty;
        }
      }
    }
  });

  const totalUsedQsfpCages = usedQsfpOptics + usedBreakouts;
  const remainingQsfpCages = Math.max(0, totalQsfpCages - totalUsedQsfpCages);
  const breakoutSfpExpansion = usedBreakouts * 4;
  const totalExpandedSfpPorts = totalSfpCages + breakoutSfpExpansion;
  const remainingSfpPorts = Math.max(0, totalExpandedSfpPorts - usedSfpOptics);

  // ─── Calculate GigaSMART Engines ───────────────────────────────────────────
  const activeEngines = getAvailableEngines(model || '', Object.values(installedBoards));
  
  const ENGINE_NAMES: Record<string, string> = {
    'HC1_GEN2_ONBOARD': 'On-board Gen2 Engine',
    'HC1_GEN3_SMT_HC1_S': 'Gen3 Engine (SMT-HC1-S Slot Module)',
    'HC3_GEN2_C05': 'Gen2 Engine (SMT-HC3-C05)',
    'HC3_GEN3_C08': 'Gen3 Engine (SMT-HC3-C08)',
    'HC1PLUS_REAR_GEN3_SMT_HC1A_R': 'On-board Rear Gen3 Engine',
    'HC1PLUS_FRONT_GEN3_SMT_HC1_S': 'Front Gen3 Engine (SMT-HC1-S Slot Module)',
    'HCT_GEN3_SMT_HC1_S': 'Gen3 Engine (SMT-HC1-S Slot Module)',
  };

  const handleBoardSelect = (slotIndex: number, boardName: string) => {
    const newBoards = { ...installedBoards };
    if (boardName) {
      newBoards[slotIndex] = boardName;
    } else {
      delete newBoards[slotIndex];
    }
    
    const slotSuffix = `(Slot ${slotIndex})`;
    const nextOptics = installedOptics.filter(opt => !opt.board.includes(slotSuffix));

    updateNodeData(node.id, { 
      installedBoards: newBoards,
      optics: nextOptics
    });
    
    if (selectedOpticBoard && selectedOpticBoard.includes(slotSuffix)) {
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
    const validation = validateOptic(model, targetBoard, selectedOptic, node.data?.portCapacity as string, installedOptics);
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
        if (opt.optic.includes('PNL-M34')) return;
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
      const numBreakoutPanels = installedOptics.reduce((sum, opt) => {
        if (opt.board === targetBoard && (opt.optic.includes('PNL-M341') || opt.optic.includes('PNL-M343'))) {
          return sum + opt.qty;
        }
        return sum;
      }, 0);
      const allowedSfp = cages.sfp + numBreakoutPanels * 4;
      if (currentSfp + qty > allowedSfp) {
        setErrorMsg(`Cannot add optic. Board/Module "${targetBoard}" only has ${allowedSfp} SFP cage(s) (currently using ${currentSfp}, attempting to add ${qty}).`);
        return;
      }
    }

    const existingOpticIdx = installedOptics.findIndex(opt => (opt.board || 'Base Ports') === targetBoard && opt.optic === selectedOptic);
    let newOptics = [...installedOptics];
    if (existingOpticIdx >= 0) {
      newOptics[existingOpticIdx] = {
        ...newOptics[existingOpticIdx],
        qty: newOptics[existingOpticIdx].qty + qty
      };
    } else {
      newOptics.push({ board: targetBoard, optic: selectedOptic, qty });
    }

    // Auto-add corresponding parent optic if a breakout panel is added
    if (selectedOptic.includes('PNL-M341') || selectedOptic.includes('PNL-M343')) {
      let parentOptic = '';
      if (selectedOptic.includes('PNL-M341')) {
        const activeBoardObj = availableOpticBoards.find(b => b.board === targetBoard);
        const supports100G = activeBoardObj?.supportedOptics.some(opt => opt.includes('Q28-502T'));
        parentOptic = supports100G ? 'Q28-502T (100G QSFP28 SR4)' : 'QSF-502T (40G QSFP+ SR4)';
      } else {
        const activeBoardObj = availableOpticBoards.find(b => b.board === targetBoard);
        const supports100G = activeBoardObj?.supportedOptics.some(opt => opt.includes('Q28-506'));
        parentOptic = supports100G ? 'Q28-506 (100G QSFP28 PLR4)' : 'QSF-506T (40G QSFP+ PSM4)';
      }
      
      if (parentOptic) {
        const parentIdx = newOptics.findIndex(opt => (opt.board || 'Base Ports') === targetBoard && opt.optic === parentOptic);
        if (parentIdx >= 0) {
          newOptics[parentIdx] = {
            ...newOptics[parentIdx],
            qty: newOptics[parentIdx].qty + qty
          };
        } else {
          newOptics.push({ board: targetBoard, optic: parentOptic, qty });
        }
      }
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

  // License Exceeded Validation
  const getTaLicenseLimits = (modelName: string, capacity: string): { sfp: number, qsfp: number } => {
    const isTA25 = modelName.includes('TA25');
    const isTA200 = modelName.includes('TA200');
    const isTA400 = modelName.includes('TA400');
    const cap = capacity || 'Full';
    if (isTA25) {
      if (cap === 'Quarter') return { sfp: 12, qsfp: 2 };
      if (cap === 'Half') return { sfp: 24, qsfp: 4 };
      return { sfp: 48, qsfp: 8 };
    } else if (isTA200) {
      if (cap === 'Half') return { sfp: 0, qsfp: 32 };
      return { sfp: 0, qsfp: 64 };
    } else if (isTA400) {
      return { sfp: 2, qsfp: 32 };
    } else {
      if (cap === 'Quarter' || cap === '100G') return { sfp: 2, qsfp: 32 };
      if (cap === 'Half') return { sfp: 0, qsfp: 16 };
      return { sfp: 2, qsfp: 32 };
    }
  };

  const capVal = (node.data?.portCapacity as string) || 'Full';
  const limits = getTaLicenseLimits(model || '', capVal);

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
      if (usedSfp > limits.sfp || usedQsfp > limits.qsfp) {
        isLicenseExceeded = true;
        exceedMessage = `Configured optics (${usedSfp} SFP, ${usedQsfp} QSFP) exceed the licensed port count (${limits.sfp} SFP / ${limits.qsfp} QSFP cages).`;
        if (capVal === 'Quarter') {
          nextLicenseVal = 'Half';
          nextLicenseLabel = '24 / 4 Ports License';
        } else if (capVal === 'Half') {
          nextLicenseVal = 'Full';
          nextLicenseLabel = '48 / 8 Ports License';
        }
      }
    } else if (model.includes('TA200')) {
      if (usedQsfp > limits.qsfp) {
        isLicenseExceeded = true;
        exceedMessage = `Configured optics (${usedQsfp} QSFP) exceed the licensed port count (${limits.qsfp} QSFP cages).`;
        if (capVal === 'Half') {
          nextLicenseVal = 'Full';
          nextLicenseLabel = '64 Ports (QSFP) License';
        }
      }
    } else if (model.includes('TA400')) {
      if (usedSfp > limits.sfp || usedQsfp > limits.qsfp) {
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

  const tabStyle = { padding: '6px 12px', fontSize: '11px', fontWeight: 'bold' as const, border: 'none', borderRadius: '4px', cursor: 'pointer' };

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
      {!model?.includes('TAP') && (
        <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', borderBottom: '1px solid #333', paddingBottom: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTab('general')} style={{ ...tabStyle, background: activeTab === 'general' ? '#333' : 'transparent', color: activeTab === 'general' ? '#fff' : '#888' }}>General</button>
          <button 
            onClick={() => setActiveTab('optics')} 
            style={{ 
              ...tabStyle, 
              background: activeTab === 'optics' ? '#333' : 'transparent', 
              color: activeTab === 'optics' ? '#fff' : '#888',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>Optics</span>
            {isOpticsInvalid && (
              <span 
                className="optics-alert-dot" 
                style={{ 
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#ffa726',
                  boxShadow: '0 0 6px #ffa726'
                }} 
                title="Optics configuration invalid. Click to rectify."
              />
            )}
          </button>
          {node.data.gigaSmartApps && Array.isArray(node.data.gigaSmartApps) && node.data.gigaSmartApps.length > 0 && (
            <button onClick={() => setActiveTab('apps')} style={{ ...tabStyle, background: activeTab === 'apps' ? '#333' : 'transparent', color: activeTab === 'apps' ? '#fff' : '#888' }}>GigaSMART Apps</button>
          )}
        </div>
      )}

      {isLicenseExceeded && (
        <div style={{
          background: 'rgba(239, 83, 80, 0.08)',
          border: '1px solid rgba(239, 83, 80, 0.25)',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '16px',
          fontSize: '12px',
          color: '#ff8a80',
          lineHeight: '1.4'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px', color: '#ff5252' }}>
            ⚠️ License Port Count Exceeded
          </div>
          <div>{exceedMessage}</div>
          {nextLicenseVal && (
            <button
              onClick={() => updateNodeData(node.id, { portCapacity: nextLicenseVal })}
              style={{
                marginTop: '8px',
                background: '#ef5350',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Upgrade License to {nextLicenseLabel}
            </button>
          )}
        </div>
      )}



      {/* ── GENERAL TAB ── */}
      <div style={{ display: activeTab === 'general' ? 'block' : 'none' }}>
        <div className="config-card" style={{ paddingBottom: isSpecsExpanded ? '16px' : '10px' }}>
          <div 
            onClick={() => setIsSpecsExpanded(!isSpecsExpanded)} 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <h3 style={{ margin: 0 }}>⚙️ Hardware Specifications</h3>
            <span style={{ fontSize: '10px', color: '#888' }}>{isSpecsExpanded ? '▲ Collapse' : '▼ Expand'}</span>
          </div>
          
          {details ? (
            <div style={{ marginTop: '8px' }}>
              {!isSpecsExpanded ? (
                <div style={{ fontSize: '11px', color: '#aaa', background: '#111', padding: '6px 8px', borderRadius: '4px', border: '1px solid #222' }}>
                  Model: <strong style={{ color: '#fff' }}>{details.model}</strong> | SKU: <strong style={{ color: '#fff' }}>{resolved.hwSku}</strong>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', borderTop: '1px solid #222', paddingTop: '8px', marginTop: '8px' }}>
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
              )}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: '#aaa', marginTop: '8px' }}>Specs not found for {sku}.</div>
          )}
        </div>

        <div className="config-card" style={{ marginTop: '16px' }}>
          <h3>🌍 Deployment Configuration</h3>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Site Assignment (Optional)</label>
            <datalist id="existing-sites-list">
              {Array.from(new Set(nodes.map(n => n.data?.site).filter(s => typeof s === 'string' && s.trim() !== ''))).map(site => (
                <option key={site as string} value={site as string} />
              ))}
            </datalist>
            <input 
              type="text" 
              list="existing-sites-list"
              placeholder="e.g. Datacenter London" 
              value={(node.data?.site as string) || ''} 
              onChange={(e) => updateNodeData(node.id, { site: e.target.value })} 
              style={{ width: '100%', boxSizing: 'border-box' }} 
            />
          </div>
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
                    {(() => {
                      const val = (node.data?.portCapacity as string) || 'Full';
                      if (model.includes('TA400')) {
                        return (
                          <select value={val} onChange={(e) => updateNodeData(node.id, { portCapacity: e.target.value })} style={{ width: '100%' }}>
                            <option value="Full">32 x 400Gb ports + 2 x 10Gb SFP Cages</option>
                            <option value="Upgrade">16 x 100Gb & 16 x 400Gb ports + 2 x 10Gb SFP Cages</option>
                            <option value="100G">32 x 100Gb ports + 2 x 10Gb SFP Cages</option>
                          </select>
                        );
                      } else if (model.includes('TA200')) {
                        return (
                          <select value={val === 'Quarter' ? 'Half' : val} onChange={(e) => updateNodeData(node.id, { portCapacity: e.target.value })} style={{ width: '100%' }}>
                            <option value="Full">64 Ports (QSFP) License</option>
                            <option value="Half">32 Ports (QSFP) License</option>
                          </select>
                        );
                      } else if (model.includes('TA25')) {
                        return (
                          <select value={val} onChange={(e) => updateNodeData(node.id, { portCapacity: e.target.value })} style={{ width: '100%' }}>
                            <option value="Full">48 / 8 Ports License</option>
                            <option value="Half">24 / 4 Ports License</option>
                            <option value="Quarter">12 / 2 Ports License</option>
                          </select>
                        );
                      } else {
                        return (
                          <select value={val} onChange={(e) => updateNodeData(node.id, { portCapacity: e.target.value })} style={{ width: '100%' }}>
                            <option value="Full">Full Capacity</option>
                            <option value="Half">Half Capacity</option>
                            <option value="Quarter">Quarter Capacity</option>
                          </select>
                        );
                      }
                    })()}
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
          const isM506T = tapModel.includes('TAP-M506T') || tapSku.includes('TAP-M506T');
          const isATX = tapModel.includes('A-TX') && !tapModel.includes('A-TX2');
          const isATX2 = tapModel.includes('A-TX2');
          const isPassiveOpticalTap = tapModel.startsWith('TAP-M') || tapSku.startsWith('TAP-M');  // All M-Series are passive optical — no selectable optics
          const isBuiltInOptics = isATX || isATX2 || isPassiveOpticalTap;  // Only A-SF and A-SF2 have selectable optics
          const builtInOpticLabel = isPassiveOpticalTap
            ? `Passive Optical Splitter (${isSMTap ? 'Singlemode' : 'Multimode'})`
            : 'Built-in 1G Copper';
          
          let availableOptics = SUPPORTED_TAP_OPTICS;

          const allocations = (node.data.tappedLinkAllocations as { qty: number, optic: string, toolOptic?: string }[]) || [
            { 
              qty: node.data.tappedLinksCount ?? 1, 
              optic: isBuiltInOptics ? builtInOpticLabel : (node.data.tappedLinkOptic ? node.data.tappedLinkOptic.split(' ')[0] : (availableOptics[0]?.value) || (isSMTap ? 'SFP-533' : 'SFP-532'))
            }
          ];

          const currentAllocatedCount = allocations.reduce((sum, a) => sum + a.qty, 0);
          const remainingLinks = maxLinks - currentAllocatedCount;

          // Set default addOptic value if empty
          const activeAddOptic = addOptic || (availableOptics[0]?.value) || (isSMTap ? 'SFP-533' : 'SFP-532');

          // Extract speed from an optic label or SKU
          const getOpticSpeed = (opticVal: string): string => {
            const m = opticVal.match(/(100M|1G|10G|25G|40G|100G|400G)/i);
            if (m) return m[1].toUpperCase();

            const upper = opticVal.toUpperCase();
            if (upper.startsWith('QDD-')) return '400G';
            if (upper.startsWith('Q28-') || upper.startsWith('QSB-51') || upper.startsWith('QSB-52') || upper.startsWith('QSB-53')) return '100G';
            if (upper.startsWith('QSF-') || upper.startsWith('QSB-50')) return '40G';
            if (upper.startsWith('SFP-55')) return '25G';
            if (upper.startsWith('SFP-53')) return '10G';
            if (upper.startsWith('SFP-50')) return '1G';
            return '';
          };

          // Filter tool optics to only those matching the selected network optic speed
          const networkSpeed = getOpticSpeed(activeAddOptic);
          const speedFilteredToolOptics = (networkSpeed && !isPassiveOpticalTap)
            ? availableOptics.filter(o => getOpticSpeed(o.value) === networkSpeed)
            : availableOptics.filter(o => o.isSM === isSMTap && !o.isCopper);

          const activeAddToolOptic = (addToolOptic && (isPassiveOpticalTap || getOpticSpeed(addToolOptic) === networkSpeed))
            ? addToolOptic
            : speedFilteredToolOptics[0]?.value || activeAddOptic;

          // Check if any allocation has a mismatch
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
            let newAllocations = [...allocations];
            if (existingIndex > -1) {
              newAllocations[existingIndex] = {
                ...newAllocations[existingIndex],
                qty: newAllocations[existingIndex].qty + qty
              };
            } else {
              newAllocations.push({ qty, optic: effectiveOptic, toolOptic: effectiveToolOptic });
            }
            const totalLinks = newAllocations.reduce((sum, a) => sum + a.qty, 0);
            updateNodeData(node.id, {
              tappedLinkAllocations: newAllocations,
              tappedLinksCount: totalLinks
            });
            setAddQty(1);

            // Auto-create traffic streams for active TAP link allocations
            const isActiveTapModel = tapModel.includes('A-TX') || tapModel.includes('A-SF');
            if (isActiveTapModel) {
              // Determine speed from the optic (active TAPs: 1G or 10G)
              const opticSpeedMatch = effectiveOptic.match(/(100M|1G|10G)/i);
              let speedMbps = 10000; // default 10G
              if (isBuiltInOptics) {
                speedMbps = 1000; // Built-in 1G copper
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

              const tapLabel = String(node.data?.label || tapModel);
              for (let i = 0; i < qty; i++) {
                const profile = profiles[Math.floor(Math.random() * profiles.length)];
                // ~70% utilisation with ±15% variance
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
                  sourceNodeId: node.id,
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
            let newAllocations = allocations.filter((_, idx) => idx !== index);
            const totalLinks = newAllocations.reduce((sum, a) => sum + a.qty, 0);
            updateNodeData(node.id, {
              tappedLinkAllocations: newAllocations,
              tappedLinksCount: totalLinks
            });
          };

          return (
            <div style={{ borderTop: '1px solid rgba(255, 152, 0, 0.2)', paddingTop: '10px', marginTop: '16px', marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>TAP Settings</h4>
              
              {/* Existing Allocations List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Active link allocations ({currentAllocatedCount}/{maxLinks} links)</span>
                {allocations.map((alloc, idx) => {
                  const cleanOptic = alloc.optic ? alloc.optic.split(' ')[0] : '';
                  const matched = availableOptics.find(o => o.value === cleanOptic);
                  const hasAllocMismatch = !isM506T && matched ? matched.isSM !== isSMTap : false;
                  const cleanToolOptic = alloc.toolOptic ? alloc.toolOptic.split(' ')[0] : '';
                  const toolMatched = availableOptics.find(o => o.value === cleanToolOptic);
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', background: '#111', padding: '6px 8px', borderRadius: '4px', border: '1px solid #333', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ fontSize: '11px', color: '#fff', fontWeight: 'bold' }}>
                          {alloc.qty} link{alloc.qty > 1 ? 's' : ''}{!isBuiltInOptics && (<> &mdash; <span style={{ color: '#00e5ff' }}>Net: {matched?.label || alloc.optic}</span>
                          {alloc.toolOptic && alloc.toolOptic !== alloc.optic && (
                            <span> | <span style={{ color: '#ffb74d' }}>Tool: {toolMatched?.label || alloc.toolOptic}</span></span>
                          )}</>)}
                          {isBuiltInOptics && (
                            <span style={{ color: '#888' }}> &mdash; {builtInOpticLabel}
                              {alloc.toolOptic && alloc.toolOptic !== builtInOpticLabel && (
                                <span> | <span style={{ color: '#ffb74d' }}>Tool: {toolMatched?.label || alloc.toolOptic}</span></span>
                              )}
                            </span>
                          )}
                        </div>
                        {hasAllocMismatch && (
                          <div style={{ fontSize: '9px', color: '#ef5350' }}>
                            ⚠️ Fiber mode mismatch (TAP is {isSMTap ? 'Single-mode' : 'Multi-mode'})
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => handleRemoveAllocation(idx)}
                        style={{ background: 'transparent', border: 'none', color: '#ef5350', cursor: 'pointer', fontSize: '11px', padding: '2px 6px' }}
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
                <div style={{ background: '#181818', padding: '8px 10px', borderRadius: '6px', border: '1px dashed #444', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#ffb74d', fontWeight: 'bold' }}>Add link allocation</div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: isBuiltInOptics ? '100%' : '70px' }}>
                        <label style={{ fontSize: '9px', color: '#888' }}>Links</label>
                        <select 
                          value={addQty} 
                          onChange={e => setAddQty(parseInt(e.target.value))} 
                          style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}
                        >
                          {Array.from({ length: remainingLinks }, (_, i) => i + 1).map(num => (
                            <option key={num} value={num}>{num}</option>
                          ))}
                        </select>
                      </div>

                      {!isBuiltInOptics && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                          <label style={{ fontSize: '9px', color: '#888' }}>Network Optic</label>
                          <select 
                            value={activeAddOptic} 
                            onChange={e => {
                              setAddOptic(e.target.value);
                              setAddToolOptic('');
                            }} 
                            disabled={isM506T}
                            style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}
                          >
                            {availableOptics.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <label style={{ fontSize: '9px', color: '#888' }}>Tool Optic</label>
                      <select 
                        value={activeAddToolOptic} 
                        onChange={e => setAddToolOptic(e.target.value)} 
                        disabled={isM506T}
                        style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}
                      >
                        {!isPassiveOpticalTap && <option value={activeAddOptic}>Match Network Optic</option>}
                        {speedFilteredToolOptics.filter(opt => isPassiveOpticalTap || opt.value !== activeAddOptic).map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {(networkSpeed && !isPassiveOpticalTap) && (
                        <span style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>Filtered to {networkSpeed} optics (tool must match network speed)</span>
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={() => handleAddAllocation(addQty, activeAddOptic, activeAddToolOptic)}
                    style={{ background: '#ff9800', color: '#000', border: 'none', borderRadius: '3px', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', alignSelf: 'flex-end' }}
                  >
                    + Add Links
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: '10px', color: '#81c784', background: 'rgba(76, 175, 80, 0.05)', padding: '6px', borderRadius: '4px', border: '1px solid rgba(76, 175, 80, 0.2)', marginBottom: '12px', textAlign: 'center' }}>
                  ✓ All {maxLinks} available link slots allocated.
                </div>
              )}

              <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
                {isM506T 
                  ? 'Note: TAP-M506T requires termination with QSB-523T optics in the TA/HC unit.' 
                  : `Specifies link allocations for this TAP (up to a maximum of ${maxLinks} links for this model).`}
              </div>
              
              {(tapModel.includes('G-TAP A-SF2') || tapModel.includes('ASF21')) && (
                <div style={{ marginTop: '8px', padding: '6px', background: 'rgba(33, 150, 243, 0.1)', border: '1px solid rgba(33, 150, 243, 0.3)', borderRadius: '4px', color: '#64b5f6', fontSize: '9px', lineHeight: '1.4' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>G-TAP A-SF2 Deployment Rules:</div>
                  <ul style={{ margin: 0, paddingLeft: '14px' }}>
                    <li>Network ports in a pair must use the same transceiver type.</li>
                    <li>Tool ports must match the same speed as the network ports (medium can differ).</li>
                    <li>For 1G optical tool ports, disable auto-negotiation on the connected tool.</li>
                    <li>Copper SFPs run only at their native speeds.</li>
                  </ul>
                </div>
              )}
              
              {mismatchedAllocations.length > 0 && (
                <div style={{ marginTop: '8px', padding: '6px', background: 'rgba(239, 83, 80, 0.1)', border: '1px solid rgba(239, 83, 80, 0.3)', borderRadius: '4px', color: '#ef5350', fontSize: '10px' }}>
                  ⚠️ Fiber mode mismatch: TAP is {isSMTap ? 'Single-mode' : 'Multi-mode'} but some allocations use conflicting fiber mode transceivers.
                </div>
              )}

              {/* Hardware & Power Options */}
              {(() => {
                const isSeries2 = tapModel.includes('SF2') || tapModel.includes('TX2');
                const isSeries1 = !isSeries2 && (tapModel.includes('A-SF') || tapModel.includes('A-TX'));
                
                if (!isSeries1 && !isSeries2) return null;

                const tapRackMount = (node.data.tapRackMount as string) || 'RMT-GTA03 (3-bay Rack Tray)';
                const tapPower = (node.data.tapPower as string) || 'Individual Power Brick';
                const tapDualPower = !!node.data.tapDualPower;
                const tapBattery = !!node.data.tapBattery;

                return (
                  <div style={{ marginTop: '16px', background: '#181818', padding: '10px', borderRadius: '6px', border: '1px solid #333' }}>
                    <div style={{ fontSize: '11px', color: '#ffb74d', fontWeight: 'bold', marginBottom: '8px' }}>Hardware & Power Options</div>
                    
                    {isSeries1 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <label style={{ fontSize: '10px', color: '#aaa' }}>Rack Mount</label>
                          <select 
                            value={tapRackMount} 
                            onChange={(e) => updateNodeData(node.id, { tapRackMount: e.target.value })}
                            style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}
                          >
                            <option value="RMT-GTA03 (3-bay Rack Tray)">RMT-GTA03 (3-bay Rack Tray)</option>
                            <option value="Standalone">Standalone (No Tray)</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <label style={{ fontSize: '10px', color: '#aaa' }}>Power Source</label>
                          <select 
                            value={tapPower} 
                            onChange={(e) => updateNodeData(node.id, { tapPower: e.target.value })}
                            style={{ fontSize: '11px', padding: '4px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '3px' }}
                          >
                            <option value="Individual Power Brick">Individual Power Brick</option>
                            <option value="PST-GTA01 (AC Power Tray)">PST-GTA01 (AC Power Tray)</option>
                            <option value="PST-GTA02 (DC Power Tray)">PST-GTA02 (DC Power Tray)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {isSeries2 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '9px', color: '#888' }}>
                          Note: Series 2 TAPs ship with a rack mount kit and 1 power brick.
                        </div>
                        
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#ddd', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={tapDualPower} 
                            onChange={(e) => updateNodeData(node.id, { tapDualPower: e.target.checked })} 
                          />
                          Add Dual Power (PBK-GTA21)
                        </label>
                        
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#ddd', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={tapBattery} 
                            onChange={(e) => updateNodeData(node.id, { tapBattery: e.target.checked })} 
                          />
                          Add Battery Backup (BAT-GTA20)
                        </label>
                      </div>
                    )}
                  </div>
                );
              })()}

              {(() => {
                const outgoingEdges = edges.filter(e => e.source === node.id || e.target === node.id);
                if (outgoingEdges.length === 0) return null;
                
                let totalSpeed = 0;
                const rows: React.ReactNode[] = [];
                allocations.forEach((alloc, idx) => {
                  const match = alloc.optic.match(/(1|10|25|40|100|400)G/i);
                  if (match) {
                    const speedVal = parseInt(match[1]);
                    totalSpeed += speedVal * alloc.qty;
                    rows.push(
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#ccc', marginTop: '2px' }}>
                        <span>&bull; {alloc.qty} link{alloc.qty > 1 ? 's' : ''} × {match[1]}G</span>
                        <span style={{ fontFamily: 'monospace' }}>{alloc.qty * speedVal}G</span>
                      </div>
                    );
                  }
                });

                return (
                  <div style={{ marginTop: '12px', padding: '8px', backgroundColor: 'rgba(37, 179, 75, 0.1)', border: '1px solid rgba(37, 179, 75, 0.3)', borderRadius: '4px' }}>
                    <div style={{ fontSize: '11px', color: '#4caf50', fontWeight: 'bold' }}>Derived Input Capacity</div>
                    <div style={{ marginTop: '4px' }}>{rows}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#fff', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px', marginTop: '4px', fontWeight: 'bold' }}>
                      <span>Total Capacity</span>
                      <span style={{ fontFamily: 'monospace' }}>{totalSpeed}G</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {renderModuleSlots()}

        {!model?.includes('TAP') && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', marginTop: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#ffb74d' }}>Traffic Map Filter Rules</h4>
            <MapNodePanel node={node} onConditionChange={onConditionChange} onAddCondition={onAddCondition} onRemoveCondition={onRemoveCondition} />
          </div>
        )}
      </div>

      {/* ── OPTICS TAB ── */}
      <div style={{ display: activeTab === 'optics' ? 'block' : 'none' }}>
        {/* Dynamic Link and Optic Verification Panel */}
        {!model?.includes('TAP') && (
          <div style={{
            background: isOpticsInvalid ? 'rgba(255, 152, 0, 0.05)' : 'rgba(76, 175, 80, 0.05)',
            border: isOpticsInvalid ? '1px dashed rgba(255, 152, 0, 0.3)' : '1px dashed rgba(76, 175, 80, 0.3)',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '11px',
            color: '#ccc',
            lineHeight: '1.4'
          }}>
            <div style={{
              fontWeight: 'bold',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: isOpticsInvalid ? '#ffa726' : '#66bb6a',
              fontSize: '12px'
            }}>
              {isOpticsInvalid ? '⚠️ Optics Sanity Alert' : '✅ Optics Configuration Valid'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
              <div>
                <span style={{ color: '#888' }}>Tapped Links (In):</span>
                <strong style={{ color: '#fff', marginLeft: '4px', fontFamily: 'monospace' }}>{tappedLinks}</strong>
                <span style={{ color: '#666', fontSize: '9px', marginLeft: '2px' }}>(needs {tappedLinks * 2} optics)</span>
              </div>
              <div>
                <span style={{ color: '#888' }}>Tool Links (Out):</span>
                <strong style={{ color: '#fff', marginLeft: '4px', fontFamily: 'monospace' }}>{outgoingToolLinks}</strong>
                <span style={{ color: '#666', fontSize: '9px', marginLeft: '2px' }}>(needs {outgoingToolLinks} optics)</span>
              </div>
              <div>
                <span style={{ color: '#888' }}>Optics Needed:</span>
                <strong style={{ color: '#fff', marginLeft: '4px', fontFamily: 'monospace' }}>{totalOpticsNeeded}</strong>
                <span style={{ color: '#666', fontSize: '9px', marginLeft: '2px' }}>(MM: {requiredMMOptics}, SM: {requiredSMOptics}, CU: {requiredCopperOptics}, Tool: {outgoingToolLinks})</span>
              </div>
              <div>
                <span style={{ color: '#888' }}>Optics Deployed:</span>
                <strong style={{ color: isOpticsInvalid ? '#ffb74d' : '#81c784', marginLeft: '4px', fontFamily: 'monospace' }}>{totalOptics}</strong>
              </div>
            </div>
            <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
              <span style={{ color: '#888' }}>Sanity Check Status:</span>
              <strong style={{ color: isOpticsInvalid ? '#ef5350' : '#81c784', marginLeft: '4px' }}>
                {totalOptics < totalOpticsNeeded 
                  ? `Insufficient transceivers: Missing ${totalOpticsNeeded - totalOptics} optics`
                  : (missingMM > 0 || missingSM > 0 || missingCopper > 0)
                    ? 'Fiber type or speed mismatch on TAP links'
                    : 'All links fully allocated and verified'}
              </strong>
            </div>
          </div>
        )}

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
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>Physical Cages &amp; Ports</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#111', padding: '10px', borderRadius: '4px', border: '1px solid #333', fontSize: '11px', color: '#ccc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#aaa' }}>QSFP Cages (40G/100G/400G):</span>
                <strong style={{ color: remainingQsfpCages === 0 ? '#ef5350' : '#4caf50', fontFamily: 'monospace' }}>
                  {totalUsedQsfpCages} / {totalQsfpCages} Used ({remainingQsfpCages} Free)
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#aaa' }}>SFP Cages (1G/10G/25G):</span>
                <strong style={{ color: remainingSfpPorts === 0 ? '#ef5350' : '#4caf50', fontFamily: 'monospace' }}>
                  {usedSfpOptics} / {totalExpandedSfpPorts} Used ({remainingSfpPorts} Free)
                </strong>
              </div>
              {usedBreakouts > 0 && (
                <div style={{ color: '#00e5ff', fontSize: '10px', borderTop: '1px solid #222', paddingTop: '4px', marginTop: '2px' }}>
                  ℹ️ SFP capacity expanded by +{breakoutSfpExpansion} ports from {usedBreakouts} breakout panel{usedBreakouts > 1 ? 's' : ''}.
                </div>
              )}
              {hasBuiltInCopper && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #222', paddingTop: '4px', marginTop: '2px' }}>
                  <span style={{ color: '#aaa' }}>Built-in 1G RJ45 Ports:</span>
                  <strong style={{ color: (4 - usedBuiltInCopper) === 0 ? '#ef5350' : '#4caf50', fontFamily: 'monospace' }}>
                    {usedBuiltInCopper} / 4 Used ({4 - usedBuiltInCopper} Free)
                  </strong>
                </div>
              )}
            </div>
          </div>
        )}

        {!model?.includes('TAP') && (model?.includes('HC') || model?.includes('HCT')) && (
          <div style={{ borderTop: '1px solid rgba(255, 152, 0, 0.2)', paddingTop: '10px', marginTop: '10px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#ffb74d' }}>GigaSMART Engine Inventory</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#111', padding: '10px', borderRadius: '4px', border: '1px solid #333', fontSize: '11px', color: '#ccc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#aaa' }}>Total Engines Available:</span>
                <strong style={{ color: activeEngines.length === 0 ? '#ef5350' : '#00e5ff', fontFamily: 'monospace' }}>
                  {activeEngines.length}
                </strong>
              </div>
              {activeEngines.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #222', paddingTop: '6px', marginTop: '4px' }}>
                  {activeEngines.map(engine => (
                    <div key={engine} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px' }}>
                      <span style={{ color: '#ffb74d' }}>⚡</span>
                      <span>{ENGINE_NAMES[engine] || engine}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '10px', color: '#888', fontStyle: 'italic', marginTop: '4px' }}>
                  No active GigaSMART engines. Install an SMT module to enable GigaSMART.
                </div>
              )}
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
                const terminatedCU = Math.min(Math.floor(requiredCopperOptics / 2), Math.floor(installedCopperOptics / 2));
                const totalTerminated = terminatedMM + terminatedSM + terminatedCU;
                
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #222', paddingTop: '6px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Tapped Links Terminated:</span>
                      <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{totalTerminated} / {tappedLinks}</strong>
                    </div>
                    {missingMM > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef5350', fontSize: '10px', fontWeight: 'bold', marginTop: '2px' }}>
                        <span>⚠️ Multi-mode links lack optics: need {missingMM} more Multi-mode optic(s).</span>
                      </div>
                    )}
                    {missingSM > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef5350', fontSize: '10px', fontWeight: 'bold', marginTop: '2px' }}>
                        <span>⚠️ Single-mode links lack optics: need {missingSM} more Single-mode optic(s).</span>
                      </div>
                    )}
                    {missingCopper > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef5350', fontSize: '10px', fontWeight: 'bold', marginTop: '2px' }}>
                        <span>⚠️ Copper links lack optics: need {missingCopper} more Copper optic(s).</span>
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
              const requiredTapOptics = requiredMMOptics + requiredSMOptics + requiredCopperOptics;
              const totalRequiredOptics = requiredTapOptics + numToolLinks;

              if (missingMM > 0 || missingSM > 0 || missingCopper > 0) {
                return (
                  <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(239, 83, 80, 0.1)', border: '1px solid rgba(239, 83, 80, 0.3)', borderRadius: '6px', color: '#ef5350', fontSize: '11px', lineHeight: '1.5' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '12px' }}>⚠️ Optic Type Mismatch</div>
                    {missingMM > 0 && <div>• You need <strong>{missingMM}</strong> more Multi-mode optic(s) (e.g. SR/SX).</div>}
                    {missingSM > 0 && <div>• You need <strong>{missingSM}</strong> more Single-mode optic(s) (e.g. LR/LX).</div>}
                    {missingCopper > 0 && <div>• You need <strong>{missingCopper}</strong> more Copper optic(s).</div>}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '13px', color: '#ffb74d' }}>GigaSMART Pipeline</h4>
            </div>
            
            {(() => {
              // Engine Load Calculation
              const getEngineLoad = (actionType: string) => {
                if (actionType.includes('Decapsulation')) return 40;
                if (actionType.includes('Slicing')) return 20;
                if (actionType.includes('Masking')) return 30;
                if (actionType.includes('Dedup')) return 50;
                if (actionType.includes('NetFlow')) return 60;
                if (actionType.includes('Metadata') || actionType.includes('AMI')) return 80;
                return 30; // Default generic load
              };
              
              const totalLoad = node.data.gigaSmartApps.reduce((acc: number, app: any) => acc + getEngineLoad(app.actionType || ''), 0);
              const maxSinglePassLoad = 100;
              const isMultiPass = totalLoad > maxSinglePassLoad;
              
              return (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '6px' }}>
                    Engine Load: {totalLoad} / {maxSinglePassLoad}
                  </div>
                  <div style={{ width: '100%', background: '#222', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (totalLoad / maxSinglePassLoad) * 100)}%`, background: isMultiPass ? '#f44336' : '#4caf50', height: '100%' }} />
                  </div>
                  {isMultiPass && (
                    <div style={{ marginTop: '6px', padding: '6px', background: '#300', border: '1px solid #600', borderRadius: '4px', fontSize: '10px', color: '#f88', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <span>⚠️</span>
                      <span><strong>Hardware limit exceeded.</strong> Engaging multi-pass loopback. Effective throughput will be halved.</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {node.data.gigaSmartApps.map((app: any, idx: number) => (
              <div key={app.id || idx} style={{ background: '#111', border: '1px solid #333', borderRadius: '4px', padding: '10px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ background: '#333', color: '#aaa', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                      {idx + 1}
                    </div>
                    <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>{app.label || app.actionType}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button 
                      onClick={() => {
                        if (idx > 0) {
                          const newApps = [...(node.data.gigaSmartApps as any[])];
                          [newApps[idx - 1], newApps[idx]] = [newApps[idx], newApps[idx - 1]];
                          updateNodeData(node.id, { gigaSmartApps: newApps });
                        }
                      }}
                      disabled={idx === 0}
                      style={{ background: '#222', color: idx === 0 ? '#444' : '#ccc', border: '1px solid #444', borderRadius: '3px', cursor: idx === 0 ? 'not-allowed' : 'pointer', padding: '2px 6px', fontSize: '10px' }}
                      title="Move Up"
                    >
                      ▲
                    </button>
                    <button 
                      onClick={() => {
                        const apps = node.data.gigaSmartApps as any[];
                        if (idx < apps.length - 1) {
                          const newApps = [...apps];
                          [newApps[idx + 1], newApps[idx]] = [newApps[idx], newApps[idx + 1]];
                          updateNodeData(node.id, { gigaSmartApps: newApps });
                        }
                      }}
                      disabled={idx === (node.data.gigaSmartApps as any[]).length - 1}
                      style={{ background: '#222', color: idx === (node.data.gigaSmartApps as any[]).length - 1 ? '#444' : '#ccc', border: '1px solid #444', borderRadius: '3px', cursor: idx === (node.data.gigaSmartApps as any[]).length - 1 ? 'not-allowed' : 'pointer', padding: '2px 6px', fontSize: '10px' }}
                      title="Move Down"
                    >
                      ▼
                    </button>
                    <button 
                      onClick={() => {
                        const newApps = [...(node.data.gigaSmartApps as any[])];
                        newApps.splice(idx, 1);
                        updateNodeData(node.id, { gigaSmartApps: newApps });
                      }}
                      style={{ background: '#300', color: '#f55', border: '1px solid #500', borderRadius: '3px', cursor: 'pointer', padding: '2px 6px', fontSize: '10px', marginLeft: '4px' }}
                      title="Remove Pipeline Stage"
                    >
                      ✕
                    </button>
                  </div>
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
