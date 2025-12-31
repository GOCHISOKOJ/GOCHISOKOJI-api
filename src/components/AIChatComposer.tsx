'use client';

import React from 'react';
import { Plus, ArrowUp, Sparkles } from 'lucide-react';
import { ChatMessageBubble } from '@/components/ChatMessageBubble';
import quickRepliesConfig from '@/config/ai-quick-replies.json';
import { toKojiDisplayName } from '@/lib/utils/koji';

export interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  text: string;
}

type QuickReply = { id: string; label: string; text: string };

// AIチャット起動用クイックプロンプト
const QUICK_PROMPTS = [
  { id: '5分で簡単レシピ', label: '5分で簡単レシピ' },
  { id: '材料1つでできる', label: '材料1つでできる' },
  { id: '主菜（メイン）', label: '主菜（メイン）' },
  { id: '副菜（サブ）', label: '副菜（サブ）' },
  { id: '汁物', label: '汁物' },
];

interface AIChatComposerProps {
  messages: ChatMessage[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: (text?: string) => void | Promise<void>;
  isThinking?: boolean;
  suggestions?: Array<{ label: string; text: string }> | null;
  shouldShowCreateButton?: boolean;
  popular?: Array<{ id: string; title: string; imageUrl: string | null; kojiType: string; viewCount: number }> | null;
  canGenerateDraft?: boolean;
  onGenerateDraft?: () => void;
  isGeneratingFromChat?: boolean;
  onSaveDraft: () => Promise<boolean>;
  isSavingDraft: boolean;
  kojiTypes: string[];
  selectedKojiType: string;
  onSelectKojiType: (v: string) => void;
  aiAvatarSrc?: string | null;
  exampleText?: string | null;
  introStatus?: 'idle' | 'loading' | 'ready' | 'error';
  introError?: string | null;
  onRetryIntro?: () => void;
  onTapExample: (text: string) => void;
  onOpenDrafts: () => void;
  selectedQuickPrompt?: string | null;
  onSelectQuickPrompt?: (promptId: string) => void;
}

export function AIChatComposer({
  messages,
  input,
  onInputChange,
  onSend,
  isThinking = false,
  suggestions,
  shouldShowCreateButton = false,
  popular,
  canGenerateDraft = false,
  onGenerateDraft,
  isGeneratingFromChat = false,
  onSaveDraft,
  isSavingDraft,
  kojiTypes,
  selectedKojiType,
  onSelectKojiType,
  aiAvatarSrc,
  exampleText,
  introStatus = 'idle',
  introError = null,
  onRetryIntro,
  onTapExample,
  onOpenDrafts,
  selectedQuickPrompt,
  onSelectQuickPrompt,
}: AIChatComposerProps) {
  const LOG_URL = 'http://127.0.0.1:7244/ingest/a2183a97-7691-4013-9b1b-c6f1b8ad2750';
  const isBlocked = isThinking || isGeneratingFromChat;
  const canSend = input.trim().length > 0 && !isBlocked;
  const endRef = React.useRef<HTMLDivElement | null>(null);

  const lastMsg = messages[messages.length - 1];
  const hasStarted = React.useMemo(() => messages.some((m) => m.role === 'user'), [messages]);

  React.useEffect(() => {
    if (hasStarted) return;
    if (exampleText !== null) return;
    // #region agent log
    fetch(LOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'intro-example',
        hypothesisId: 'H1_nested_button_state',
        location: 'src/components/AIChatComposer.tsx:example-placeholder',
        message: 'example placeholder rendered',
        data: {
          introStatus,
          hasIntroError: !!introError,
          hasOnRetryIntro: typeof onRetryIntro === 'function',
          isBlocked,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [LOG_URL, hasStarted, exampleText, introStatus, introError, onRetryIntro, isBlocked]);

  // チップ複数選択（トグル）: 入力欄の先頭に「、」区切りで反映する
  const [selectedQuickReplyIds, setSelectedQuickReplyIds] = React.useState<string[]>([]);
  const autoInsertedPrefixRef = React.useRef<string>(''); // 直近で自動挿入したプレフィックス

  const quickReplies = React.useMemo<QuickReply[]>(() => {
    // suggestions が渡されている場合は「それだけ」を使う（AIチャット時に固定チップが残って邪魔にならないように）
    if (suggestions !== undefined) {
      return (Array.isArray(suggestions) ? suggestions : [])
        .filter((s) => s?.label && s?.text)
        .slice(0, 8)
        .map((s, idx) => ({ id: `ai-${idx}`, label: String(s.label), text: String(s.text) }));
    }
    const rules = (quickRepliesConfig as any)?.rules as Array<any>;
    if (!Array.isArray(rules)) return [];
    const picked: QuickReply[] = [];
    for (const rule of rules) {
      const when = rule?.when ?? {};
      const matchesAny = when?.any === true;
      const matchesKoji = typeof when?.kojiType === 'string' ? when.kojiType === selectedKojiType : false;
      if (!matchesAny && !matchesKoji) continue;
      const replies = Array.isArray(rule?.replies) ? rule.replies : [];
      for (const r of replies) {
        if (!r?.id || !r?.label || !r?.text) continue;
        picked.push({ id: String(r.id), label: String(r.label), text: String(r.text) });
      }
    }
    // id重複を排除しつつ順序維持
    const seen = new Set<string>();
    return picked.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  }, [selectedKojiType, suggestions]);

  const shouldShowQuickReplies = lastMsg?.role === 'ai' && !isThinking && quickReplies.length > 0;

  const applySelectedRepliesToInput = React.useCallback(
    (nextSelectedIds: string[], currentInput: string) => {
      const selectedTexts = nextSelectedIds
        .map((id) => quickReplies.find((r) => r.id === id)?.text?.trim())
        .filter((t): t is string => !!t);

      const nextPrefix = selectedTexts.join('、');
      const prevPrefix = autoInsertedPrefixRef.current;

      // prevPrefix が先頭にある場合は一旦剥がして残り（ユーザー入力）を保持する
      let remainder = currentInput;
      if (prevPrefix && remainder.startsWith(prevPrefix)) {
        remainder = remainder.slice(prevPrefix.length);
      }
      remainder = remainder.replace(/^、\s*/g, '').trimStart();

      const nextInput = nextPrefix ? (remainder ? `${nextPrefix}、${remainder}` : nextPrefix) : remainder;
      autoInsertedPrefixRef.current = nextPrefix;
      onInputChange(nextInput);
    },
    [onInputChange, quickReplies]
  );

  // AIの返答が変わってチップ一覧が更新されたら、選択状態をクリア（前の質問の選択が残らないように）
  React.useEffect(() => {
    // 選択中がなければ何もしない
    if (selectedQuickReplyIds.length === 0 && !autoInsertedPrefixRef.current) return;
    setSelectedQuickReplyIds([]);
    // 自動挿入分だけ入力欄から除去（先頭一致する場合のみ）
    const prevPrefix = autoInsertedPrefixRef.current;
    if (prevPrefix && input.startsWith(prevPrefix)) {
      const remainder = input.slice(prevPrefix.length).replace(/^、\s*/g, '').trimStart();
      autoInsertedPrefixRef.current = '';
      onInputChange(remainder);
    } else {
      autoInsertedPrefixRef.current = '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickReplies.map((r) => r.id).join('|')]);

  const handleSend = React.useCallback(
    async (text?: string) => {
      // 送信したら選択をクリア
      setSelectedQuickReplyIds([]);
      autoInsertedPrefixRef.current = '';
      await onSend(text);
    },
    [onSend]
  );

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="p-4 space-y-4">
      {/* 全画面ローディング（レシピ生成中） */}
      {isGeneratingFromChat && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center"
          aria-label="レシピを作成中"
          aria-live="polite"
        >
          <div className="w-[88%] max-w-[340px] rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border-2 border-border border-t-primary animate-spin" />
              <div className="space-y-1">
                <div className="text-base font-bold text-foreground">レシピを作成中…</div>
                <div className="text-sm text-muted-foreground">少し待ってね</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1) まずチャット（AIの話しかけ） */}
      <div className="pt-2 space-y-3">
        {messages.map((m) => (
          <ChatMessageBubble
            key={m.id}
            role={m.role}
            text={m.text}
            aiAvatarSrc={aiAvatarSrc}
          />
        ))}

        {Array.isArray(popular) && popular.length > 0 && lastMsg?.role === 'ai' && !isThinking && (
          <div className="pl-11">
            <div className="text-xs text-muted-foreground">人気の提案</div>
            <div className="pt-2 flex gap-3 overflow-x-auto pb-1">
              {popular.slice(0, 6).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void onSend(`この「${p.title}」を${p.kojiType}で作ってみたい。材料と手順を簡単に教えて！`)}
                  disabled={isBlocked}
                  className="w-56 shrink-0 rounded-xl border border-border bg-surface text-left overflow-hidden hover:bg-muted transition-colors"
                  aria-label={`人気: ${p.title}`}
                >
                  {p.imageUrl ? (
                    // next/image を使うと外部画像設定が必要になるため、imgで表示
                    <img src={p.imageUrl} alt={p.title} className="h-28 w-full object-cover" />
                  ) : (
                    <div className="h-28 w-full bg-muted" />
                  )}
                  <div className="p-3">
                    <div className="text-sm font-medium text-foreground line-clamp-2">{p.title}</div>
                    <div className="pt-1 text-xs text-muted-foreground">
                      {toKojiDisplayName(p.kojiType)} / 閲覧 {p.viewCount}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {shouldShowQuickReplies && quickReplies.length > 0 && (
          <div className="pl-11">
            <div className="flex flex-wrap gap-2">
              {quickReplies.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    if (isBlocked) return;
                    // チップをタップしたら即座に送信
                    void handleSend(r.text);
                  }}
                  disabled={isBlocked}
                  className="h-9 px-3 rounded-full border border-border bg-background hover:bg-muted text-foreground text-sm transition-colors"
                  aria-label={`提案: ${r.label}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* レシピ作成ボタン（3回目以降） */}
        {shouldShowCreateButton && canGenerateDraft && onGenerateDraft && !isThinking && (
          <div className="pl-11">
            <button
              type="button"
              onClick={onGenerateDraft}
              disabled={isBlocked}
              className="h-12 px-6 rounded-full bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-60"
              aria-label="レシピを作成する"
            >
              <Sparkles className="w-5 h-5" />
              <span>レシピを作成する</span>
            </button>
            <div className="pt-2 text-xs text-muted-foreground">
              これまでの会話から、AIがレシピを作成します
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* 2) 麹選択・例（会話開始前のみ表示） */}
      {!hasStarted && (
        <div className="space-y-4">
          {/* AIに聞いてみる（クイックプロンプト） */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
              <span>💡</span>
              <span>AIに聞いてみる</span>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              {QUICK_PROMPTS.map((item) => {
                const isSelected = selectedQuickPrompt === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (isBlocked) return;
                      onSelectQuickPrompt?.(item.id);
                    }}
                    disabled={isBlocked}
                    className={`h-9 px-3 rounded-full border text-sm transition-colors disabled:opacity-50 ${
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 「例」をタップすると入力欄に転送（クイックプロンプト選択時のみ表示） */}
          {selectedQuickPrompt && (
            exampleText ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onTapExample(exampleText)}
                  disabled={isBlocked}
                  className="max-w-[80%] rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-left hover:bg-primary/10 transition-colors"
                  aria-label="例を入れる"
                >
                  <div className="text-xs text-primary font-medium mb-1">💡 タップして送信</div>
                  <div className="text-sm text-foreground/90 leading-relaxed">{exampleText}</div>
                </button>
              </div>
            ) : (
              <div className="flex justify-end">
                <div
                  className="max-w-[80%] rounded-2xl border border-border bg-surface px-4 py-3 text-left"
                  aria-label="メニューを考え中"
                  role="group"
                >
                  <div className="text-xs text-muted-foreground mb-1">AIがメニューを考え中…</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-pulse" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:150ms]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )
          )}

          {/* 下書きから再開 */}
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={onOpenDrafts}
              className="text-sm text-primary/80 hover:text-primary hover:underline transition-colors"
              aria-label="下書きから再開"
            >
              下書きから再開
            </button>
          </div>
        </div>
      )}

      <div className="pt-2">
        <div className="flex items-center gap-3 rounded-full border border-border bg-background px-3 h-12">
          <button
            type="button"
              disabled={isBlocked}
            className="h-9 w-9 rounded-full border border-border bg-surface flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="メニュー"
          >
            <Plus className="h-5 w-5" />
          </button>
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="料理名やメモ（例：肉まん、生地は15分こねる）"
            className="flex-1 bg-transparent outline-none text-sm"
              disabled={isBlocked}
            onKeyDown={(e) => {
              // Enterで勝手に送信しない（IME確定/改行誤送信対策）
              // 送信はボタン or Cmd/Ctrl+Enter のみ
              if (e.key === 'Enter') {
                if (e.metaKey || e.ctrlKey) {
                  e.preventDefault();
                  if (canSend) void handleSend();
                } else {
                  // IME確定などは通常動作（送信しない）
                }
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              void handleSend();
            }}
            disabled={!canSend}
            className="h-10 w-10 rounded-full bg-foreground text-background flex items-center justify-center disabled:opacity-40"
            aria-label="送信"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}


