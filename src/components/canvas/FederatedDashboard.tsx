import React from 'react';
import dashboardImg from '../../assets/dashboard-mock.webp';

interface FederatedDashboardProps {
  onClose: () => void;
}

export const FederatedDashboard: React.FC<FederatedDashboardProps> = ({ onClose }) => {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        background: '#121212', border: '1px solid #333', borderRadius: '16px',
        width: '90%', height: '90%', maxWidth: '1200px', display: 'flex',
        flexDirection: 'column', overflow: 'hidden', boxShadow: '0 0 40px rgba(0,0,0,0.8)'
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 24px', borderBottom: '1px solid #333', background: 'rgba(255,255,255,0.03)'
        }}>
          <h2 style={{ margin: 0, fontSize: '16px', color: '#00e5ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📊 Federated Network Insights
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#aaa', cursor: 'pointer',
            fontSize: '24px', lineHeight: '1', padding: '4px'
          }}>&times;</button>
        </div>
        <div style={{ flex: 1, padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0a0a0a' }}>
          <img src={dashboardImg} alt="Network Insights Dashboard" style={{ 
            maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px',
            border: '1px solid #222', boxShadow: '0 4px 20px rgba(0, 229, 255, 0.1)'
          }} />
        </div>
      </div>
    </div>
  );
};
