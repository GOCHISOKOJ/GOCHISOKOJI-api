import React from 'react';
import { cn } from '@/lib/utils';

interface ChipTagProps {
  label: string;
  type?: 'koji' | 'time' | 'count' | 'difficulty';
  icon?: React.ReactNode;
  className?: string;
}

export function ChipTag({
  label,
  type = 'koji',
  icon,
  className = '',
}: ChipTagProps) {
  const baseClasses = 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium';
  
  const typeClasses = {
    koji: 'bg-primary/10 text-primary border border-primary/20',
    time: 'bg-muted text-muted-foreground',
    count: 'bg-muted text-muted-foreground',
    difficulty: 'bg-muted text-muted-foreground',
  };

  return (
    <span className={cn(baseClasses, typeClasses[type], className)}>
      {icon}
      {label}
    </span>
  );
}







