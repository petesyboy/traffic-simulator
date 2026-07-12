import { type TrafficStream, type MapCondition } from '../../store/types';
import { matchesIp, matchesVlan, matchesPort } from './matching';

export const evaluateConditionGroup = (stream: TrafficStream, conditions: MapCondition[]): boolean => {
  if (conditions.length === 0) return false;
  
  const orGroups: MapCondition[][] = [[]];
  for (const cond of conditions) {
    if (cond.logic === 'OR') {
      orGroups.push([cond]);
    } else {
      orGroups[orGroups.length - 1].push(cond);
    }
  }

  const evaluateSingle = (cond: MapCondition): boolean => {
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
    
    if (val === '') return true;
    if (field === 'ipver') {
      const isIPv6 = !!(stream.ipSrc?.includes(':') || stream.ipDst?.includes(':'));
      return (val === 'ipv6') ? isIPv6 : (val === 'ipv4') ? !isIPv6 : false;
    }
    if (field === 'vlan') return matchesVlan(cleanStreamVal, val);
    if (['ipsrc', 'ipdst', 'ip6src', 'ip6dst'].includes(field)) return matchesIp(cleanStreamVal, val);
    if (['portsrc', 'portdst'].includes(field)) return matchesPort(cleanStreamVal, val);
    return cleanStreamVal === val;
  };

  return orGroups.some(andGroup => andGroup.every(cond => evaluateSingle(cond)));
};

export const evaluateMapConditions = (stream: TrafficStream, conditions: MapCondition[] | undefined): boolean => {
  if (!conditions || conditions.length === 0) return true;
  
  const passConditions = conditions.filter(c => !c.action || c.action === 'pass');
  const dropConditions = conditions.filter(c => c.action === 'drop');
  
  if (dropConditions.length > 0 && evaluateConditionGroup(stream, dropConditions)) {
    return false;
  }
  
  if (passConditions.length > 0) {
    return evaluateConditionGroup(stream, passConditions);
  }
  
  return true;
};
