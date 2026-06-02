import React from 'react';

interface NavItem {
  id: string;
  icon: string;
  label: string;
}

interface LeftNavProps {
  activeTab: string;
  onTabChange: (id: string) => void;
}

export default function LeftNav({ activeTab, onTabChange }: LeftNavProps) {
  const navItems: NavItem[] = [
    { id: 'dashboard', icon: '⬡', label: 'Dashboard' },
    { id: 'analyst', icon: '◈', label: 'AI Analyst' },
    { id: 'chat', icon: '◎', label: 'AI Chat' },
    { id: 'settings', icon: '⊙', label: 'Settings' },
  ];

  return (
    <div style={{
      width: '64px',
      minWidth: '64px',
      height: '100%',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: '20px',
      gap: '8px',
      flexShrink: 0,
    }}>
      {/* Logo at top — pulsing cyan dot + "PD" text */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        marginBottom: '24px',
        position: 'relative',
      }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{
            position: 'absolute',
            display: 'inline-flex',
            height: '12px',
            width: '12px',
            borderRadius: '50%',
            background: 'var(--accent)',
            opacity: 0.6,
            animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
          }} />
          <span style={{
            position: 'relative',
            display: 'inline-flex',
            borderRadius: '50%',
            height: '8px',
            width: '8px',
            background: 'var(--accent)',
          }} />
        </div>
        <span className="font-mono" style={{
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          color: 'var(--text-primary)',
          marginTop: '6px',
        }}>
          PD
        </span>
      </div>

      {/* Nav items */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        gap: '4px',
      }}>
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              title={item.label}
              style={{
                width: '100%',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                background: isActive ? 'var(--accent-glow)' : 'transparent',
                cursor: 'pointer',
                borderTop: 'none',
                borderBottom: 'none',
                borderRight: 'none',
                padding: 0,
                outline: 'none',
                transition: 'all 0.15s ease-in-out',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span className="font-mono text-center" style={{
                fontSize: '18px',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                lineHeight: '1',
                transition: 'color 0.15s',
              }}>
                {item.icon}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
