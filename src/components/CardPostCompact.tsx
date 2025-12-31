import React from 'react';
import { Clock } from 'lucide-react';

interface CardPostCompactProps {
  image?: string | null;
  title: string;
  totalMinutes: number;
  onClick?: () => void;
  className?: string;
}

export function CardPostCompact({
  image,
  title,
  totalMinutes,
  onClick,
  className = '',
}: CardPostCompactProps) {
  return (
    <article 
      className={`bg-surface rounded-lg overflow-hidden shadow-card hover:shadow-medium transition-shadow cursor-pointer ${className}`}
      onClick={onClick}
    >
      {/* 画像 1:1 */}
      <div className="relative w-full aspect-square overflow-hidden bg-muted">
        {image ? (
          <img 
            src={image} 
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/10">
            <div className="text-xs text-foreground/70">写真なし</div>
          </div>
        )}
      </div>
      
      {/* コンテンツ */}
      <div className="p-3 flex flex-col gap-2">
        {/* タイトル */}
        <h4 className="text-sm line-clamp-2 leading-snug">
          {title}
        </h4>
        
        {/* 情報行 */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{totalMinutes}分</span>
          </div>
        </div>
      </div>
    </article>
  );
}


