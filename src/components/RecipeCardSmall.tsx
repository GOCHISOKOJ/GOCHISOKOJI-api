'use client';

import React from 'react';

interface RecipeCardSmallProps {
  id: string;
  imageUrl?: string | null;
  title: string;
  authorName?: string;
  isPrivate?: boolean;
  onClick?: () => void;
}

export function RecipeCardSmall({
  id,
  imageUrl,
  title,
  authorName,
  isPrivate,
  onClick,
}: RecipeCardSmallProps) {
  return (
    <div
      className="flex-shrink-0 w-[100px] cursor-pointer group"
      onClick={onClick}
    >
      {/* 画像 */}
      <div className="relative aspect-square rounded-md overflow-hidden bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/10">
            <svg
              className="w-6 h-6 text-primary/40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
        
        {/* 非公開バッジ */}
        {isPrivate && (
          <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[8px] px-1 py-0.5 rounded flex items-center gap-0.5">
            <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            非公開
          </div>
        )}
      </div>
      
      {/* タイトル */}
      <h4 className="mt-1 text-xs font-medium text-foreground line-clamp-2 leading-tight">
        {title}
      </h4>
      
      {/* 作者名 */}
      {authorName && (
        <p className="text-[10px] text-muted-foreground truncate">
          {authorName}
        </p>
      )}
    </div>
  );
}
