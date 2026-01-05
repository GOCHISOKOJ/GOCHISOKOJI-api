'use client';

import React from 'react';
import { AIAvatar } from '@/components/AIAvatar';
import type { ChatAttachment } from '@/components/AIChatComposer';

type ChatRole = 'ai' | 'user';

interface ChatMessageBubbleProps {
  role: ChatRole;
  text: string;
  aiAvatarSrc?: string | null;
  attachments?: ChatAttachment[];
}

export function ChatMessageBubble({ role, text, aiAvatarSrc, attachments }: ChatMessageBubbleProps) {
  if (role === 'ai') {
    // #region agent log
    fetch('/api/debug-log', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'avatar-debug',
        hypothesisId: 'H1_src_flow',
        location: 'src/components/ChatMessageBubble.tsx:ai',
        message: 'render ai bubble',
        data: {
          aiAvatarSrc: aiAvatarSrc ?? null,
          textLen: text?.length ?? 0,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    return (
      <div className="flex items-start gap-2">
        <AIAvatar src={aiAvatarSrc} alt="こうじのコウちゃん" />
        <div className="relative max-w-[80%]">
          {/* 吹き出しの三角（しっぽ） */}
          <div
            className="absolute left-0 top-3 -translate-x-full"
            style={{
              width: 0,
              height: 0,
              borderTop: '6px solid transparent',
              borderBottom: '6px solid transparent',
              borderRight: '8px solid var(--surface)',
            }}
          />
          {/* 吹き出し本体 */}
          <div className="rounded-2xl rounded-tl-md bg-surface shadow-sm px-4 py-3">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {text || '...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ユーザーメッセージ
  const image = (attachments || []).find((a) => a.kind === 'image');
  return (
    <div className="flex justify-end">
      <div className="relative max-w-[80%]">
        {/* 吹き出しの三角（しっぽ） */}
        <div
          className="absolute right-0 top-3 translate-x-full"
          style={{
            width: 0,
            height: 0,
            borderTop: '6px solid transparent',
            borderBottom: '6px solid transparent',
            borderLeft: '8px solid var(--primary)',
          }}
        />
        {/* 吹き出し本体 */}
        <div className="rounded-2xl rounded-tr-md bg-primary shadow-sm px-4 py-3">
          {image && (
            <div className="pb-2">
              <img
                src={image.dataUrl}
                alt="添付画像"
                className="w-full max-h-64 object-cover rounded-xl border border-primary/30"
              />
            </div>
          )}
          <p className="text-sm text-primary-foreground leading-relaxed whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    </div>
  );
}


