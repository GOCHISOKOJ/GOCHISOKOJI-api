'use client';

import React from 'react';
import { Home, Sparkles, User } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { useRouter, usePathname } from 'next/navigation';
import { useKeyboard } from '@/lib/hooks/useKeyboard';

const navItemVariants = cva(
  'flex flex-col items-center justify-center gap-1 h-[56px] flex-1 transition-colors',
  {
    variants: {
      active: {
        true: 'text-primary',
        false: 'text-ink/60 hover:text-ink/80',
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

interface BottomNavProps {
  activeId?: string;
  onItemClick?: (id: string) => void;
  items?: NavItem[];
}

export function BottomNav({ 
  activeId = 'home',
  onItemClick,
  items 
}: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const keyboard = useKeyboard();

  const defaultItems: NavItem[] = [
    {
      id: 'home',
      label: 'ホーム',
      icon: <Home className="h-6 w-6" />,
      onClick: () => router.push('/'),
    },
    {
      id: 'ai',
      label: 'AI',
      icon: <Sparkles className="h-6 w-6" />,
      onClick: () => router.push('/compose'),
    },
    {
      id: 'profile',
      label: 'プロフィール',
      icon: <User className="h-6 w-6" />,
      onClick: () => router.push('/profile'),
    },
  ];

  const navItems = items || defaultItems;

  // パスからアクティブなIDを自動判定
  const getActiveId = () => {
    if (pathname === '/') return 'home';
    if (pathname === '/compose') return 'ai';
    if (pathname === '/profile') return 'profile';
    return activeId;
  };

  const currentActiveId = getActiveId();

  const shouldHideOnComposeWhileTyping = pathname === '/compose' && keyboard.isOpen;

  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/a2183a97-7691-4013-9b1b-c6f1b8ad2750',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'kbd',hypothesisId:'H_hide_nav',location:'src/components/BottomNav.tsx:render',message:'bottom nav visibility',data:{pathname,keyboardOpen:keyboard.isOpen,hide:shouldHideOnComposeWhileTyping},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (shouldHideOnComposeWhileTyping) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background shadow-strong pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around max-w-screen-lg mx-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              item.onClick?.();
              onItemClick?.(item.id);
            }}
            className={navItemVariants({ active: currentActiveId === item.id })}
            aria-label={item.label}
            aria-current={currentActiveId === item.id ? 'page' : undefined}
          >
            {item.icon}
            <span className="text-xs">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

