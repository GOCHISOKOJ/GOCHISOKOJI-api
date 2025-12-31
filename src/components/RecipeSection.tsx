'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { RecipeCardSmall } from './RecipeCardSmall';

interface Recipe {
  id: string;
  title: string;
  image_url?: string | null;
  is_public?: boolean;
  user?: {
    display_name?: string | null;
  } | null;
}

interface RecipeSectionProps {
  title: string;
  count?: number;
  recipes: Recipe[];
  onSeeAll?: () => void;
  onRecipeClick?: (id: string) => void;
  emptyMessage?: string;
  showAuthor?: boolean; // 投稿者名を表示するか
}

export function RecipeSection({
  title,
  count,
  recipes,
  onSeeAll,
  onRecipeClick,
  emptyMessage = 'まだレシピがありません',
  showAuthor = true, // デフォルトは表示
}: RecipeSectionProps) {
  if (recipes.length === 0) {
    return null;
  }

  return (
    <section className="pt-2">
      {/* セクションヘッダー */}
      <div className="px-3 flex items-center justify-between pb-0.5">
        <h3 className="text-sm font-semibold text-foreground leading-tight">
          {title}
          {count !== undefined && (
            <span className="text-muted-foreground font-normal ml-1 text-xs">
              （{count}品）
            </span>
          )}
        </h3>
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            className="flex items-center text-xs text-primary hover:text-primary/80 transition-colors min-h-0 p-0"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 横スクロールカルーセル */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 px-3">
          {recipes.map((recipe) => (
            <RecipeCardSmall
              key={recipe.id}
              id={recipe.id}
              imageUrl={recipe.image_url}
              title={recipe.title}
              authorName={showAuthor ? (recipe.user?.display_name || undefined) : undefined}
              isPrivate={recipe.is_public === false}
              onClick={() => onRecipeClick?.(recipe.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
