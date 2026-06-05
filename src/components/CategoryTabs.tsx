import React from 'react';
import { CATEGORY_LABELS } from '../utils/polymarket';

interface CategoryTabsProps {
  activeCategory: string;
  onSelectCategory: (key: string) => void;
}

export default function CategoryTabs({ activeCategory, onSelectCategory }: CategoryTabsProps) {
  const categories = Object.keys(CATEGORY_LABELS);

  return (
    <div 
      className="w-full overflow-x-auto"
      style={{
        height: '48px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      <div className="flex h-full min-w-max items-center px-2">
        {categories.map((key) => {
          const isActive = activeCategory.toLowerCase() === key.toLowerCase();
          const label = CATEGORY_LABELS[key];

          return (
            <button
              key={key}
              onClick={() => onSelectCategory(key)}
              style={{
                height: '100%',
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                outline: 'none',
                transition: 'all 0.15s ease-in-out',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
