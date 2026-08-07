/**
 * ChassisFaceplate.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Compact front-panel view of a chassis's real port complement, drawn on the
 * hardware node in Advanced Mode. Purely presentational - every port and its
 * state comes from `utils/ports`.
 */
import React from 'react';
import type { ChassisPort } from '../../store/types';
import type { PortOccupant } from '../../utils/ports';

interface ChassisFaceplateProps {
  ports: ChassisPort[];
  occupancy: Map<string, PortOccupant>;
  /** Ports to briefly pulse-highlight, e.g. right after an optic is installed. */
  flashPortIds?: Set<string>;
}

type PortState = 'linked' | 'fitted' | 'free' | 'unlicensed';

const STATE_STYLE: Record<PortState, React.CSSProperties> = {
  linked: { background: '#00e5ff', borderColor: '#00e5ff', boxShadow: '0 0 3px rgba(0,229,255,0.8)' },
  fitted: { background: '#ff9800', borderColor: '#ff9800' },
  free: { background: '#2a2a2a', borderColor: '#444' },
  // Physically present but outside the licence tier - dim red, visibly inert.
  unlicensed: { background: '#3a1c1c', borderColor: '#6d2b2b' },
};

const STATE_LABEL: Record<PortState, string> = {
  linked: 'linked',
  fitted: 'fitted but unused',
  free: 'empty cage',
  unlicensed: 'not licensed',
};

function getPortState(port: ChassisPort, occupant: PortOccupant | undefined): PortState {
  if (occupant?.peerNodeId) return 'linked';
  if (occupant?.optic) return 'fitted';
  return port.licensed ? 'free' : 'unlicensed';
}

/** SFP banks are physically two staggered rows; QSFP and RJ45 sit in one. */
function rowsFor(ports: ChassisPort[], cage: ChassisPort['cage']): ChassisPort[][] {
  if (cage !== 'SFP' || ports.length <= 12) return [ports];
  const half = Math.ceil(ports.length / 2);
  return [ports.slice(0, half), ports.slice(half)];
}

const CAGE_LABEL: Record<ChassisPort['cage'], string> = { QSFP: 'QSFP', SFP: 'SFP', RJ45: 'RJ45', MPO: 'MPO' };

export const ChassisFaceplate: React.FC<ChassisFaceplateProps> = ({ ports, occupancy, flashPortIds }) => {
  if (ports.length === 0) return null;

  // Group by board so a multi-slot HC3 reads as separate modules, then by cage
  // family within each board, mirroring the physical panel layout.
  const boards: { board: string; ports: ChassisPort[] }[] = [];
  for (const port of ports) {
    let group = boards.find(b => b.board === port.board);
    if (!group) {
      group = { board: port.board, ports: [] };
      boards.push(group);
    }
    group.ports.push(port);
  }

  let linked = 0, fitted = 0, free = 0, unlicensed = 0;
  for (const port of ports) {
    const state = getPortState(port, occupancy.get(port.id));
    if (state === 'linked') linked++;
    else if (state === 'fitted') fitted++;
    else if (state === 'free') free++;
    else unlicensed++;
  }

  return (
    <div style={{ marginTop: '6px', borderTop: '1px solid #2a2a2a', paddingTop: '5px' }}>
      {boards.map(({ board, ports: boardPorts }) => {
        const cages: ChassisPort['cage'][] = ['MPO', 'QSFP', 'SFP', 'RJ45'];
        return (
          <div key={board} style={{ marginBottom: '4px' }}>
            {boards.length > 1 && (
              <div style={{ fontSize: '7px', color: '#777', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {board}
              </div>
            )}
            {cages.map(cage => {
              const cagePorts = boardPorts.filter(p => p.cage === cage);
              if (cagePorts.length === 0) return null;
              return (
                <div key={cage} style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '7px', color: '#888', width: '26px', flexShrink: 0, lineHeight: '7px', paddingTop: '1px' }}>
                    {CAGE_LABEL[cage]}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    {rowsFor(cagePorts, cage).map((row, rowIdx) => (
                      <div key={rowIdx} style={{ display: 'flex', gap: '1px', flexWrap: 'wrap' }}>
                        {row.map(port => {
                          const occupant = occupancy.get(port.id);
                          const state = getPortState(port, occupant);
                          const isFlashing = flashPortIds?.has(port.id);
                          const detail = [
                            occupant?.optic,
                            occupant?.peerLabel
                              ? `→ ${occupant.peerLabel}`
                              // An optic is present but the port has no peer - name that
                              // explicitly rather than just showing the optic on its own,
                              // which read as "connected" at a glance.
                              : (state === 'fitted' ? `(${STATE_LABEL.fitted})` : undefined),
                          ].filter(Boolean).join(' ');
                          return (
                            <div
                              key={port.id}
                              title={`${port.id} — ${detail || STATE_LABEL[state]}`}
                              className={isFlashing ? 'chassis-port-flash' : undefined}
                              style={{
                                width: '6px', height: '6px', borderRadius: '1px',
                                // Canvas nodes are draggable, so the "grab" hand cursor
                                // otherwise bleeds through onto these tiny port squares,
                                // making it hard to tell you're precisely over one while
                                // hovering for its tooltip - force a plain arrow instead.
                                cursor: 'default',
                                border: '1px solid', flexShrink: 0, ...STATE_STYLE[state],
                              }}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      <div style={{ fontSize: '7px', color: '#888', marginTop: '2px' }}>
        <span style={{ color: '#00e5ff' }}>{linked} linked</span>
        {' · '}
        <span style={{ color: '#ff9800' }}>{fitted} fitted</span>
        {' · '}
        {free} free
        {unlicensed > 0 && <span style={{ color: '#a04545' }}>{` · ${unlicensed} unlicensed`}</span>}
      </div>
    </div>
  );
};
