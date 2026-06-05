import React from 'react';

interface NavItem {
  id: string;
  icon: string;
  label: string;
}

interface LeftNavProps {
  activeTab: string;
  onTabChange: (id: string) => void;
  watchlistCount: number;
}

export default function LeftNav({ activeTab, onTabChange, watchlistCount }: LeftNavProps) {
  const navItems: NavItem[] = [
    { id: 'dashboard', icon: '⬡', label: 'Dashboard' },
    { id: 'watchlist', icon: '★', label: 'Watchlist' },
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
      {/* Logo at top — Custom Logo + "PD" text */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        marginBottom: '24px',
        position: 'relative',
      }}>
        <div style={{
          position: 'relative',
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          overflow: 'hidden',
          border: '1px solid var(--accent-border)',
          boxShadow: '0 0 10px rgba(0, 209, 255, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000',
        }}>
          <img 
            src="/logo.jpg" 
            alt="PolyDict Logo" 
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }} 
          />
        </div>
        <span className="font-mono" style={{
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          color: 'var(--text-primary)',
          marginTop: '4px',
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
                position: 'relative',
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
              {item.id === 'watchlist' && watchlistCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '6px',
                  right: '12px',
                  background: 'var(--accent)',
                  color: 'var(--bg-primary)',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  borderRadius: '50%',
                  width: '14px',
                  height: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                  boxShadow: '0 0 6px var(--accent)',
                }}>
                  {watchlistCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
