import React from 'react';
import { Skeleton } from './Skeleton';

export interface WeeklyRecipe {
  id: string;
  day: string;
  title: string;
  image: string | null;
}

interface WeeklyBannerProps {
  recipes: WeeklyRecipe[];
  onRecipeClick?: (id: string) => void;
  isLoading?: boolean;
}

function WeeklyBannerSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto -mx-4 px-4">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="flex-shrink-0 w-[140px]">
          <Skeleton className="aspect-video rounded-md mb-1" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function WeeklyBanner({ recipes, onRecipeClick, isLoading = false }: WeeklyBannerProps) {
  return (
    <div className="border-b border-border bg-background px-4 pt-1 pb-3">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold">今週のおすすめレシピ</h2>
        <button className="text-xs text-primary hover:underline">
          すべて見る
        </button>
      </div>
      
      {isLoading ? (
        <WeeklyBannerSkeleton />
      ) : recipes.length === 0 ? (
        <div className="py-4 text-center text-sm text-muted-foreground">
          おすすめレシピを準備中...
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto -mx-4 px-4">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="flex-shrink-0 w-[140px] cursor-pointer"
              onClick={() => onRecipeClick?.(recipe.id)}
            >
              <div className="relative aspect-video rounded-md overflow-hidden bg-muted mb-1">
                {recipe.image ? (
                  <img
                    src={recipe.image}
                    alt={recipe.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    No Image
                  </div>
                )}
                <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded">
                  {recipe.day}
                </div>
              </div>
              <p className="text-xs truncate">{recipe.title}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



