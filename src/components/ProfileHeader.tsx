'use client';

import React from 'react';
import { Bell, Settings, User } from 'lucide-react';
import Link from 'next/link';

interface ProfileHeaderProps {
  avatarUrl?: string;
  name: string;
  onNotificationClick?: () => void;
  className?: string;
}

export function ProfileHeader({ 
  avatarUrl, 
  name, 
  onNotificationClick,
  className = '' 
}: ProfileHeaderProps) {
  return (
    <header className={`sticky top-0 z-10 bg-background border-b border-border ${className}`}>
      <div className="flex items-center justify-between px-3 py-2">
        {/* 左側: アバター + タイトル */}
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="h-4 w-4 text-primary" />
            )}
          </div>
          <h1 className="text-base font-bold text-foreground">マイレシピ</h1>
        </div>
        
        {/* 右側: 設定 + 通知ベル */}
        <div className="flex items-center gap-1">
          <Link
            href="/profile/settings"
            className="p-1.5 rounded-full hover:bg-muted transition-colors min-h-0"
            aria-label="設定"
          >
            <Settings className="h-4 w-4 text-foreground" />
          </Link>
          <button
            onClick={onNotificationClick}
            className="p-1.5 rounded-full hover:bg-muted transition-colors min-h-0"
            aria-label="通知"
          >
            <Bell className="h-4 w-4 text-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
}
