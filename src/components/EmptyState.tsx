import React from 'react';
import { FileQuestion, Bookmark } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  type: 'posts' | 'likes';
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ type, onAction, className = '' }: EmptyStateProps) {
  const config = {
    posts: {
      icon: <FileQuestion className="h-16 w-16 text-muted-foreground" />,
      title: 'まだレシピを投稿していません',
      description: 'AI制作モードで簡単にレシピを作成できます',
      actionLabel: 'レシピを作成',
    },
    likes: {
      icon: <Bookmark className="h-16 w-16 text-muted-foreground" />,
      title: '保存したレシピはありません',
      description: '気になるレシピを見つけて保存しておきましょう',
      actionLabel: 'レシピを探す',
    },
  };

  const { icon, title, description, actionLabel } = config[type];

  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 ${className}`}>
      {/* イラスト代替アイコン */}
      <div className="mb-6 opacity-50">
        {icon}
      </div>
      
      {/* メッセージ */}
      <h4 className="text-center mb-2">
        {title}
      </h4>
      <p className="text-sm text-muted-foreground text-center mb-6 max-w-[280px]">
        {description}
      </p>
      
      {/* アクション */}
      {onAction && (
        <Button tone="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}


