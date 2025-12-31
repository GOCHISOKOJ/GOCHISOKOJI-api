import React from 'react';
import { Grid3x3, List } from 'lucide-react';

interface ViewToggleProps {
  view: 'grid' | 'list';
  onViewChange: (view: 'grid' | 'list') => void;
  className?: string;
}

export function ViewToggle({ view, onViewChange, className = '' }: ViewToggleProps) {
  return (
    <div className={`flex items-center gap-1 bg-muted rounded-md p-1 ${className}`}>
      <button
        onClick={() => onViewChange('grid')}
        className={`
          h-[36px] w-[36px] flex items-center justify-center rounded transition-colors
          ${view === 'grid' 
            ? 'bg-background text-primary shadow-soft' 
            : 'text-muted-foreground hover:text-foreground'
          }
        `}
        aria-label="グリッド表示"
        aria-pressed={view === 'grid'}
      >
        <Grid3x3 className="h-4 w-4" />
      </button>
      <button
        onClick={() => onViewChange('list')}
        className={`
          h-[36px] w-[36px] flex items-center justify-center rounded transition-colors
          ${view === 'list' 
            ? 'bg-background text-primary shadow-soft' 
            : 'text-muted-foreground hover:text-foreground'
          }
        `}
        aria-label="リスト表示"
        aria-pressed={view === 'list'}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}







