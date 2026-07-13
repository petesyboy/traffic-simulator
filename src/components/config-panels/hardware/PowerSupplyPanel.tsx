import React, { useState } from 'react';
import type { CustomNode } from '../../../store/store';
import { useStore } from '../../../store/store';
import type { BaseNodeData, HardwareNodeData } from '../../../store/types';

interface PowerSupplyPanelProps {
  selectedNode: CustomNode;
  updateNodeData: (nodeId: string, data: Partial<BaseNodeData>) => void;
}

export const PowerSupplyPanel: React.FC<PowerSupplyPanelProps> = ({
  selectedNode,
  updateNodeData
}) => {
  const disableDcWarnings = useStore(state => state.disableDcWarnings);

  const model = selectedNode.data?.model as string;
  const hwData = selectedNode.data as HardwareNodeData;

  const [termDurationStr, setTermDurationStr] = useState((hwData.termDurationOverride as string) || '');

  const handleTermBlur = () => {
    if (!termDurationStr) {
      updateNodeData(selectedNode.id, { termDurationOverride: undefined });
      return;
    }
    let parsed = parseInt(termDurationStr, 10);
    if (isNaN(parsed) || parsed < 1) parsed = 1;
    if (parsed > 120) parsed = 120;
    setTermDurationStr(parsed.toString());
    updateNodeData(selectedNode.id, { termDurationOverride: parsed.toString() });
  };

  const handlePowerChange = (power: string) => {
    if (power === 'DC' && !disableDcWarnings) {
      const confirm = window.confirm("You have selected a DC-powered appliance. Are you sure you need DC power?");
      if (!confirm) {
        updateNodeData(selectedNode.id, { powerSupply: 'AC' });
        return;
      }
    }
    updateNodeData(selectedNode.id, { powerSupply: power });
  };

  return (
    <div className="panel-section flex-col gap-4">
      <h4 className="section-header text-cyan text-base font-semibold mb-2">Chassis Configuration</h4>

      <div className="grid-2">
        <div className="flex-col gap-1">
          <label className="form-label">Power Supply</label>
          <select 
            value={hwData.powerSupply || 'AC'} 
            onChange={(e) => handlePowerChange(e.target.value)} 
            className="form-select w-full"
          >
            <option value="AC">AC Power</option>
            <option value="DC">DC Power</option>
          </select>
        </div>

        <div className="flex-col gap-1">
          <label className="form-label">Term Override (Months)</label>
          <input 
            type="number" 
            placeholder="Project Default" 
            value={termDurationStr} 
            onChange={(e) => setTermDurationStr(e.target.value)} 
            onBlur={handleTermBlur} 
            className="form-input w-full"
          />
        </div>
      </div>

      {model?.includes('TA') && (
        <div className="flex-col gap-1 mt-2">
          <label className="form-label">Software Port Capacity</label>
          {(() => {
            const val = (hwData.portCapacity as string) || 'Full';
            if (model.includes('TA400')) {
              return (
                <select 
                  value={val} 
                  onChange={(e) => updateNodeData(selectedNode.id, { portCapacity: e.target.value })} 
                  className="form-select w-full"
                >
                  <option value="Full">32 x 400Gb ports + 2 x 10Gb SFP Cages</option>
                  <option value="Upgrade">16 x 100Gb & 16 x 400Gb ports + 2 x 10Gb SFP Cages</option>
                  <option value="100G">32 x 100Gb ports + 2 x 10Gb SFP Cages</option>
                </select>
              );
            } else if (model.includes('TA200')) {
              return (
                <select 
                  value={val === 'Quarter' ? 'Half' : val} 
                  onChange={(e) => updateNodeData(selectedNode.id, { portCapacity: e.target.value })} 
                  className="form-select w-full"
                >
                  <option value="Full">64 Ports (QSFP) License</option>
                  <option value="Half">32 Ports (QSFP) License</option>
                </select>
              );
            } else if (model.includes('TA25')) {
              return (
                <select 
                  value={val} 
                  onChange={(e) => updateNodeData(selectedNode.id, { portCapacity: e.target.value })} 
                  className="form-select w-full"
                >
                  <option value="Full">48 / 8 Ports License</option>
                  <option value="Half">24 / 4 Ports License</option>
                  <option value="Quarter">12 / 2 Ports License</option>
                </select>
              );
            }
            return null;
          })()}
        </div>
      )}
    </div>
  );
};
