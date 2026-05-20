import React from 'react';
import { CATEGORY_LABELS } from '../utils/polymarket';

interface CategoryTabsProps {
  activeCategory: string;
  onSelectCategory: (key: string) => void;
}

export default function CategoryTabs({ activeCategory, onSelectCategory }: CategoryTabsProps) {
  const categories = Object.keys(CATEGORY_LABELS);

  return (
    <div className="w-full overflow-x-auto no-scrollbar border-b border-[#1e2a38] bg-[#0d1219] py-2 px-3 shrink-0">
      <div className="flex gap-2 min-w-max">
        {categories.map((key) => {
          const isActive = activeCategory.toLowerCase() === key.toLowerCase();
          const label = CATEGORY_LABELS[key];

          return (
            <button
              key={key}
              onClick={() => onSelectCategory(key)}
              className={`px-3 py-1.5 rounded-sm text-xs font-semibold font-mono tracking-tight transition-all duration-150 cursor-pointer select-none border ${
                isActive
                  ? 'border-[#00d4ff] bg-[#00d4ff]/10 text-[#00d4ff]'
                  : 'border-[#1e2a38] bg-[#111820] text-slate-400 hover:text-slate-200 hover:bg-[#1e2a38]/60'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
