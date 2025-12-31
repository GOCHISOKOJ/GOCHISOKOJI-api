import React from 'react';

interface AppBarProps {
  title?: string;
  leftActions?: React.ReactNode;
  rightActions?: React.ReactNode;
  // 既存画面との互換（Compose/Detail などが leftAction/rightAction を渡しているため）
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  className?: string;
}

export function AppBar({
  title,
  leftActions,
  rightActions,
  leftAction,
  rightAction,
  className = '',
}: AppBarProps) {
  return (
    <header className={`sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${className}`}>
      <div className="flex h-[56px] items-center justify-between px-4">
        {/* 左側のアクション */}
        <div className="flex items-center gap-2">
          {leftActions ?? leftAction}
        </div>
        
        {/* タイトル */}
        {title && (
          <h1 className="text-lg font-semibold truncate flex-1 text-center">
            {title}
          </h1>
        )}
        
        {/* 右側のアクション */}
        <div className="flex items-center gap-2">
          {rightActions ?? rightAction}
        </div>
      </div>
    </header>
  );
}


