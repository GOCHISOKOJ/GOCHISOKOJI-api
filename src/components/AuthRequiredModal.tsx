'use client';

import React from 'react';
import { LogIn } from 'lucide-react';

interface AuthRequiredModalProps {
  message: string;
  redirectTo?: string;
  isOpen?: boolean;
}

export function AuthRequiredModal({
  message,
  redirectTo = '/login',
  isOpen = true,
}: AuthRequiredModalProps) {
  if (!isOpen) return null;

  const handleLogin = () => {
    // 現在のパスを next パラメータとして渡す
    const currentPath = window.location.pathname;
    window.location.href = `${redirectTo}?next=${encodeURIComponent(currentPath)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景オーバーレイ */}
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" />
      
      {/* モーダルダイアログ */}
      <div className="relative bg-card rounded-xl shadow-lg p-6 mx-4 max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
        {/* アイコン */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <LogIn className="w-7 h-7 text-primary" />
          </div>
        </div>
        
        {/* メッセージ */}
        <p className="text-center text-foreground text-base font-medium mb-6 leading-relaxed">
          {message}
        </p>
        
        {/* ログインボタン */}
        <button
          onClick={handleLogin}
          className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium text-base hover:bg-primary/90 transition-colors shadow-md"
        >
          ログインする
        </button>
        
        {/* 補足テキスト */}
        <p className="text-center text-muted-foreground text-xs mt-4">
          Googleアカウントで簡単にログインできます
        </p>
      </div>
    </div>
  );
}


