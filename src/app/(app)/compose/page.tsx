'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppBar } from '@/components/AppBar';
import { PostForm, type PostFormData } from '@/components/PostForm';
import { AIGenerateForm } from '@/components/AIGenerateForm';
import { ArrowLeft, Sparkles, PenLine, X } from 'lucide-react';
import { createPostStrict, updatePostStrict } from '@/lib/api/posts';
import { createClient } from '@/lib/supabase/client';
import type { GeneratedRecipe } from '@/lib/gemini/prompts';
import type { Post } from '@/lib/types/database';
import { AIChatComposer, type ChatMessage } from '@/components/AIChatComposer';
import { generateSeasonalGreeting, getSeasonalExampleText, pickSeasonalIngredientsForNow } from '@/lib/utils/seasonal';
import { toKojiDisplayName } from '@/lib/utils/koji';
import { AuthRequiredModal } from '@/components/AuthRequiredModal';

type Mode = 'select' | 'ai' | 'manual' | 'chat';

// Suspense boundary でラップ（useSearchParams 用）
export default function ComposePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    }>
      <ComposePageContent />
    </Suspense>
  );
}

function ComposePageContent() {
  const LOG_URL = 'http://127.0.0.1:7244/ingest/a2183a97-7691-4013-9b1b-c6f1b8ad2750';
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get('prompt');
  const [mode, setMode] = React.useState<Mode>('chat');
  const [generatedRecipe, setGeneratedRecipe] = React.useState<GeneratedRecipe | null>(null);
  const [manualInitialData, setManualInitialData] = React.useState<
    Partial<PostFormData> | undefined
  >(undefined);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSavingDraft, setIsSavingDraft] = React.useState(false);
  const [draftPostId, setDraftPostId] = React.useState<string | null>(null);
  const supabase = React.useMemo(() => createClient(), []);

  // 認証状態
  const [authStatus, setAuthStatus] = React.useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  
  // 認証モーダル用 state（ゲストが保存・投稿しようとした時に表示）
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const [authModalMessage, setAuthModalMessage] = React.useState('');

  React.useEffect(() => {
    // #region agent log
    fetch('/api/debug-log', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'avatar-debug',
        hypothesisId: 'H1_src_flow',
        location: 'src/app/(app)/compose/page.tsx:render',
        message: 'compose render (chat avatar src)',
        data: {
          mode,
          aiAvatarSrc: '/ai/kochan.png',
          authStatus,
          href: typeof window !== 'undefined' ? window.location.href : null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [mode, authStatus]);

  // 認証チェック
  React.useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      setAuthStatus(user ? 'authenticated' : 'unauthenticated');
    }
    checkAuth();
  }, [supabase]);

  // 認証ガード: 保存・投稿時に未ログインならモーダルを表示
  const requireAuth = React.useCallback((message: string): boolean => {
    if (authStatus !== 'authenticated') {
      setAuthModalMessage(message);
      setShowAuthModal(true);
      return false;
    }
    return true;
  }, [authStatus]);

  // チャットUI用
  const KOJI_TYPES = ['たまねぎこうじ', '中華こうじ', 'コンソメこうじ'] as const;
  const [selectedKojiType, setSelectedKojiType] = React.useState<string>(KOJI_TYPES[1]);
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = React.useState('');
  const [chatTitle, setChatTitle] = React.useState('');
  const [chatNotes, setChatNotes] = React.useState('');
  const [exampleText, setExampleText] = React.useState<string | null>(null);
  const [introExamples, setIntroExamples] = React.useState<Record<string, { title: string; description: string }> | null>(null);
  const [introPickedIngredients, setIntroPickedIngredients] = React.useState<string[] | null>(null);
  const [introStatus, setIntroStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [introError, setIntroError] = React.useState<string | null>(null);
  const [isChatThinking, setIsChatThinking] = React.useState(false);
  const [chatSuggestions, setChatSuggestions] = React.useState<
    Array<{ label: string; text: string }> | undefined
  >(undefined);
  const [shouldShowChatCreateButton, setShouldShowChatCreateButton] = React.useState(false);
  const [chatPopular, setChatPopular] = React.useState<
    Array<{ id: string; title: string; imageUrl: string | null; kojiType: string; viewCount: number }>
  >([]);
  const [isGeneratingFromChat, setIsGeneratingFromChat] = React.useState(false);

  const handleSelectKojiType = React.useCallback(
    (v: string) => {
      setSelectedKojiType(v);
      // 例は選択と同時に更新（体感の遅延/ズレ防止）
      const displayKoji = toKojiDisplayName(v);
      const ex = introExamples?.[displayKoji];
      if (ex?.title && ex?.description) {
        setExampleText(`${ex.title}。${ex.description}`);
      } else {
        // 初回例は固定を出さず、AI生成が返るまでローディング表示にする
        setExampleText(null);
      }
    },
    [introExamples]
  );

  // 初回導入（greeting/例）の非同期更新中に、ユーザーが会話を開始したら上書きしないためのガード
  const hasUserMessageRef = React.useRef(false);
  const introRequestIdRef = React.useRef(0);
  const introPickedIngredientsRef = React.useRef<string[] | null>(null);
  React.useEffect(() => {
    hasUserMessageRef.current = chatMessages.some((m) => m.role === 'user');
  }, [chatMessages]);
  React.useEffect(() => {
    introPickedIngredientsRef.current = introPickedIngredients;
  }, [introPickedIngredients]);

  const selectedKojiTypeRef = React.useRef<string>(selectedKojiType);
  React.useEffect(() => {
    selectedKojiTypeRef.current = selectedKojiType;
  }, [selectedKojiType]);

  const loadIntro = React.useCallback(async () => {
    const requestId = ++introRequestIdRef.current;
    setIntroStatus('loading');
    setIntroError(null);
    setExampleText(null);

    // #region agent log
    fetch(LOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'intro-example',
        hypothesisId: 'H2_intro_request',
        location: 'src/app/(app)/compose/page.tsx:loadIntro',
        message: 'loadIntro start',
        data: { requestId, kojiTypes: KOJI_TYPES, selectedKojiType: selectedKojiTypeRef.current },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    try {
      // 直近リロードの被り回避（端末内のみ）。例: [["白菜","大根","里芋"],["カニ","ねぎ","ブリ"]]
      let avoidSets: string[][] = [];
      try {
        const raw = localStorage.getItem('koji_intro_avoid_sets');
        const parsed = raw ? (JSON.parse(raw) as any) : null;
        if (Array.isArray(parsed)) {
          avoidSets = parsed
            .filter((x) => Array.isArray(x) && x.every((v) => typeof v === 'string'))
            .slice(0, 3)
            .map((x) => (x as string[]).map((s) => s.trim()).filter(Boolean).slice(0, 3));
        }
      } catch {
        avoidSets = [];
      }

      const picked = introPickedIngredientsRef.current ?? pickSeasonalIngredientsForNow(3).pickedIngredients;

      const res = await fetch('/api/chat-intro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kojiTypes: KOJI_TYPES, avoidSets, pickedIngredients: picked }),
      });
      const json = await res.json().catch(() => null);

      // #region agent log
      fetch(LOG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'intro-example',
          hypothesisId: 'H2_intro_response',
          location: 'src/app/(app)/compose/page.tsx:loadIntro',
          message: 'loadIntro response',
          data: { requestId, ok: res.ok, status: res.status, hasSuccess: json?.success === true },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      // 古いリクエスト結果や、会話開始後の上書きを防止
      if (requestId !== introRequestIdRef.current) return;
      if (hasUserMessageRef.current) return;

      if (!res.ok || !json?.success) {
        setIntroStatus('error');
        setIntroError((json?.error as string | undefined) || `例の生成に失敗しました（HTTP ${res.status}）`);
        return;
      }

      const examples =
        json?.examples && typeof json.examples === 'object'
          ? (json.examples as Record<string, { title: string; description: string }>)
          : null;

      // 次回の被り回避用に保存（直近3件）
      try {
        if (picked.length >= 3) {
          const next = [picked.slice(0, 3).sort((a, b) => a.localeCompare(b))];
          for (const s of avoidSets) next.push(s);
          localStorage.setItem('koji_intro_avoid_sets', JSON.stringify(next.slice(0, 3)));
        }
      } catch {
        // ignore
      }

      if (!examples) {
        setIntroStatus('error');
        setIntroError('例の生成結果が不正です（examplesが取得できませんでした）');
        return;
      }

      setIntroExamples(examples);
      const displayKoji = toKojiDisplayName(selectedKojiTypeRef.current);
      const ex = examples[displayKoji];
      if (ex?.title && ex?.description) {
        setExampleText(`${ex.title}。${ex.description}`);
        setIntroStatus('ready');
        return;
      }

      setIntroStatus('error');
      setIntroError('例の生成結果が不正です（こうじ別の例が見つかりませんでした）');
    } catch (e) {
      if (requestId !== introRequestIdRef.current) return;
      if (hasUserMessageRef.current) return;
      setIntroStatus('error');
      setIntroError('例の生成に失敗しました（通信エラー）');
    }
  }, [KOJI_TYPES]);

  const [drafts, setDrafts] = React.useState<
    Array<Pick<Post, 'id' | 'title' | 'updated_at' | 'created_at'>>
  >([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = React.useState(false);
  const [isResumingDraft, setIsResumingDraft] = React.useState(false);

  React.useEffect(() => {
    if (mode !== 'chat') return;
    if (chatMessages.length > 0) return;

    // 初期チップは表示しない（会話が始まってからAIが提案する）
    setChatSuggestions([]);

    // 旬食材をこのセッションで1回だけ確定（以後は固定）
    // 直近回避（localStorage）を考慮して、被らないように数回トライする
    let avoidSets: string[][] = [];
    try {
      const raw = localStorage.getItem('koji_intro_avoid_sets');
      const parsed = raw ? (JSON.parse(raw) as any) : null;
      if (Array.isArray(parsed)) {
        avoidSets = parsed
          .filter((x) => Array.isArray(x) && x.every((v) => typeof v === 'string'))
          .slice(0, 3)
          .map((x) => (x as string[]).map((s) => s.trim()).filter(Boolean).slice(0, 3));
      }
    } catch {
      avoidSets = [];
    }

    let picked = pickSeasonalIngredientsForNow(3).pickedIngredients.slice(0, 3);
    for (let i = 0; i < 6; i++) {
      const p = pickSeasonalIngredientsForNow(3).pickedIngredients.slice(0, 3);
      const sp = [...p].sort((a, b) => a.localeCompare(b));
      const isDup = avoidSets.some((s) => {
        const ss = [...s].slice(0, 3).sort((a, b) => a.localeCompare(b));
        return ss.length === 3 && ss[0] === sp[0] && ss[1] === sp[1] && ss[2] === sp[2];
      });
      if (!isDup) {
        picked = p;
        break;
      }
    }

    setIntroPickedIngredients(picked);
    introPickedIngredientsRef.current = picked;

    // まずはローカルで即時に挨拶を表示（ロード直後に空表示になるのを防ぐ）
    const localGreeting = generateSeasonalGreeting({ pickedIngredients: picked });
    setChatMessages([{ id: 'ai-hello', role: 'ai', text: localGreeting }]);
    setIntroExamples(null);
    // 初回の「例」はAI生成が返るまで固定を出さない
    setExampleText(null);
    setIntroStatus('loading');
    setIntroError(null);

    void loadIntro();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // URLパラメータからの初期プロンプトを自動送信
  const initialPromptSentRef = React.useRef(false);
  React.useEffect(() => {
    // 既に送信済みならスキップ
    if (initialPromptSentRef.current) return;
    // 初期プロンプトがなければスキップ
    if (!initialPrompt) return;
    // AIの挨拶メッセージが表示されるまで待つ
    if (chatMessages.length === 0) return;
    // ユーザーメッセージが既にあればスキップ
    if (chatMessages.some((m) => m.role === 'user')) return;
    
    // 自動送信
    initialPromptSentRef.current = true;
    // 少し遅延させて自然な流れにする
    const timer = setTimeout(() => {
      void handleChatSend(initialPrompt);
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, chatMessages]);

  const canGenerateDraftFromChat = React.useMemo(() => {
    const hasUser = chatMessages.some((m) => m.role === 'user');
    return hasUser && !isChatThinking && !isGeneratingFromChat;
  }, [chatMessages, isChatThinking, isGeneratingFromChat]);

  const handleGenerateDraftFromChat = async () => {
    if (!canGenerateDraftFromChat) return;
    
    // 認証ガード: 未ログインならモーダルを表示して終了
    if (!requireAuth('レシピを作成するにはログインが必要です')) {
      return;
    }
    
    setIsGeneratingFromChat(true);
    try {
      const additionalRequirements = [
        `料理名候補: ${chatTitle || '（未設定）'}`,
        `メモ: ${chatNotes || '（なし）'}`,
        '家庭向けに簡単で美味しく。麹の使いどころ（下味/タレ/炒め合わせ等）を明確に。',
      ].join('\n');

      const res = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kojiType: selectedKojiType,
          difficulty: 'かんたん',
          additionalRequirements,
        }),
      });
      const json = await res.json().catch(() => null);
      const recipe = res.ok && json?.success ? (json.recipe as GeneratedRecipe | undefined) : undefined;
      if (!recipe) {
        alert(json?.error || '下書きの作成に失敗しました');
        return;
      }
      handleRecipeGenerated(recipe);
    } catch (e) {
      console.error(e);
      alert('下書きの作成に失敗しました');
    } finally {
      setIsGeneratingFromChat(false);
    }
  };

  // 麹タイプが変わるたびに「例」を更新（API不要、ローカルで生成）
  React.useEffect(() => {
    if (mode !== 'chat') return;
    const displayKoji = toKojiDisplayName(selectedKojiType);
    const ex = introExamples?.[displayKoji];
    if (ex?.title && ex?.description) {
      setExampleText(`${ex.title}。${ex.description}`);
      return;
    }
    // 初回例は固定を出さず、AI生成が揃うまでローディング表示
    setExampleText(null);
  }, [mode, selectedKojiType, introExamples]);

  // AI生成完了時の処理
  const handleRecipeGenerated = (recipe: GeneratedRecipe) => {
    setGeneratedRecipe(recipe);
    setManualInitialData(undefined);
    setDraftPostId(null);
    setMode('manual'); // 生成後は手動編集モードに移行
  };

  const POST_IMAGES_BUCKET = 'post-images';

  const uploadPostImage = async (
    supabaseClient: ReturnType<typeof createClient>,
    userId: string,
    file: File
  ): Promise<string> => {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `posts/${userId}/${Date.now()}.${ext}`;

    const { error } = await supabaseClient.storage
      .from(POST_IMAGES_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });

    if (error) {
      console.error('Image upload error:', error);
      const status = (error as any)?.statusCode ?? (error as any)?.status ?? null;
      const message = (error as any)?.message ?? 'Unknown error';

      // bucket未作成 / 権限不足（RLS）を分かりやすく案内
      if (status === 404 || /Bucket/i.test(message) || /not found/i.test(message)) {
        throw new Error(
          `画像アップロード用のStorageバケット「${POST_IMAGES_BUCKET}」が見つかりません。SupabaseのStorageでバケットを作成してください。`
        );
      }
      if (/row-level security/i.test(message) || /RLS/i.test(message) || status === 403) {
        throw new Error(
          `画像アップロードの権限がありません（StorageのRLSポリシーが必要です）。SupabaseのStorageポリシー設定を行ってください。`
        );
      }

      throw new Error(`画像のアップロードに失敗しました: ${message}`);
    }

    const { data } = supabaseClient.storage.from(POST_IMAGES_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const resolveImageUrl = async (
    supabaseClient: ReturnType<typeof createClient>,
    userId: string,
    data: PostFormData
  ): Promise<string | null> => {
    if (data.imageFile) {
      return await uploadPostImage(supabaseClient, userId, data.imageFile);
    }
    return data.image_url ?? null;
  };

  const handleSubmit = async (data: PostFormData) => {
    // 認証ガード: 未ログインならモーダルを表示して終了
    if (!requireAuth('投稿するにはログインが必要です')) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // requireAuth を通過しているので通常はここに来ないが、念のため
        return;
      }

      const image_url = await resolveImageUrl(supabase, user.id, data);

      const common = {
        title: data.title,
        description: data.description,
        koji_type: data.koji_type,
        difficulty: data.difficulty,
        ingredients: data.ingredients,
        steps: data.steps,
        image_url,
        is_public: true,
        is_ai_generated: generatedRecipe !== null,
      } as const;

      const post = draftPostId
        ? await updatePostStrict(supabase, draftPostId, common)
        : await createPostStrict(supabase, { user_id: user.id, ...common });

      if (post) {
        // RAG: 公開投稿をインデックス更新（失敗しても投稿フローは止めない）
        fetch('/api/rag/index-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId: post.id }),
        }).catch(() => {});

        alert('投稿しました！');
        router.push('/');
      } else {
        alert('投稿に失敗しました');
      }
    } catch (error) {
      console.error('Submit error:', error);
      alert(error instanceof Error ? error.message : '投稿に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveDraftCore = async (data: PostFormData, options?: { silent?: boolean }) => {
    // 認証ガード: 未ログインならモーダルを表示して終了
    if (!requireAuth('下書きを保存するにはログインが必要です')) {
      return { ok: false as const };
    }

    setIsSavingDraft(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // requireAuth を通過しているので通常はここに来ないが、念のため
        return { ok: false as const };
      }

      const image_url = await resolveImageUrl(supabase, user.id, data);

      const common = {
        title: data.title,
        description: data.description,
        koji_type: data.koji_type,
        difficulty: data.difficulty,
        ingredients: data.ingredients,
        steps: data.steps,
        image_url,
        is_public: false,
        is_ai_generated: generatedRecipe !== null,
      } as const;

      const post = draftPostId
        ? await updatePostStrict(supabase, draftPostId, common)
        : await createPostStrict(supabase, { user_id: user.id, ...common });

      if (post?.id) {
        setDraftPostId(post.id);
        if (!options?.silent) alert('下書きを保存しました');
        return { ok: true as const, postId: post.id };
      }

      alert('下書きの保存に失敗しました');
      return { ok: false as const };
    } catch (error) {
      console.error('Save draft error:', error);
      alert(error instanceof Error ? error.message : '下書きの保存に失敗しました');
      return { ok: false as const };
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSaveDraft = async (data: PostFormData) => {
    await saveDraftCore(data);
  };

  const buildChatDraftData = (): PostFormData => {
    return {
      title: chatTitle,
      description: chatNotes,
      koji_type: selectedKojiType,
      difficulty: 'かんたん',
      ingredients: [],
      steps: [],
      image_url: null,
      imageFile: null,
    };
  };

  const handleChatSend = async (overrideText?: string) => {
    const text = (overrideText ?? chatInput).trim();
    if (!text) return;
    if (isChatThinking) return;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/35dd2980-78af-40fd-a649-80906759f95d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'chat-client',
        hypothesisId: 'CHAT',
        location: 'src/app/(app)/compose/page.tsx',
        message: 'handleChatSend called',
        data: {
          source: overrideText ? 'chip' : 'input',
          textLen: text.length,
          selectedKojiType,
          chatMessagesCount: chatMessages.length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
    };
    const pendingAiId = `a-${Date.now() + 1}`;
    const pendingAiMsg: ChatMessage = {
      id: pendingAiId,
      role: 'ai',
      text: '考え中...',
    };
    setChatMessages((prev) => [...prev, userMsg, pendingAiMsg]);

    // タイトル未設定なら最初の入力をタイトル候補にする
    setChatTitle((prev) => (prev ? prev : text.slice(0, 50)));
    setChatNotes((prev) => (prev ? `${prev}\n${text}` : text));

    setChatInput('');
    setIsChatThinking(true);
    setChatSuggestions([]); // 送信したら一旦消す（邪魔にならないように）
    setChatPopular([]);

    try {
      const isFirstTurn = chatMessages.filter((m) => m.role === 'user').length === 0;
      const payload = {
        kojiType: selectedKojiType,
        messages: [...chatMessages, userMsg].map((m) => ({ role: m.role, text: m.text })),
        firstTurn: isFirstTurn,
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      const aiText =
        res.ok && json?.success && typeof json?.reply === 'string' ? (json.reply as string) : null;
      const suggestions = Array.isArray(json?.suggestions)
        ? (json.suggestions as Array<any>)
            .filter((s) => s?.label && s?.text)
            .slice(0, 8)
            .map((s) => ({ label: String(s.label), text: String(s.text) }))
        : [];
      const shouldShowCreateButton = json?.shouldShowCreateButton === true;
      const suggestedKoji = typeof json?.suggestedKoji === 'string' ? json.suggestedKoji.trim() : null;
      const popular = Array.isArray(json?.popular)
        ? (json.popular as Array<any>)
            .filter((p) => p?.id && p?.title)
            .slice(0, 6)
            .map((p) => ({
              id: String(p.id),
              title: String(p.title),
              imageUrl: (p.imageUrl ?? null) as string | null,
              kojiType: String(p.kojiType ?? selectedKojiType),
              viewCount: Number(p.viewCount ?? 0),
            }))
        : [];
      
      // AIが麹を提案した場合、自動選択（ユーザーがまだ選んでいない場合のみ）
      if (suggestedKoji && !selectedKojiType) {
        // KOJI_TYPES内の表記に正規化
        const normalizedKoji = KOJI_TYPES.find(k => 
          suggestedKoji.includes(k) || k.includes(suggestedKoji.replace('こうじ', ''))
        );
        if (normalizedKoji) {
          setSelectedKojiType(normalizedKoji);
        }
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/35dd2980-78af-40fd-a649-80906759f95d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'chat-client',
          hypothesisId: 'CHAT',
          location: 'src/app/(app)/compose/page.tsx',
          message: 'chat api response',
          data: {
            ok: res.ok,
            outLen: aiText?.length ?? null,
            suggestionsCount: suggestions.length,
            popularCount: popular.length,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      // 通常の会話
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === pendingAiId
            ? { ...m, text: aiText ?? 'ごめんね、うまく返答できなかったよ。もう一度送ってみて！' }
            : m
        )
      );
      setChatSuggestions(suggestions);
      setShouldShowChatCreateButton(shouldShowCreateButton);
      setChatPopular(popular);
    } catch (e) {
      console.error(e);
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === pendingAiId ? { ...m, text: '通信に失敗しました。もう一度送ってみて！' } : m
        )
      );
    } finally {
      setIsChatThinking(false);
    }
  };

  const handleChatSaveDraft = async (): Promise<boolean> => {
    if (!chatTitle.trim()) {
      alert('下書きを保存するには料理名やメモを入力してください');
      return false;
    }
    const res = await saveDraftCore(buildChatDraftData(), { silent: true });
    return res.ok;
  };

  const handleChatSkipToForm = () => {
    const derivedTitle = (chatTitle.trim() || chatNotes.trim()).slice(0, 50);
    if (derivedTitle) setChatTitle(derivedTitle);
    setGeneratedRecipe(null);
    setManualInitialData({ ...buildChatDraftData(), title: derivedTitle });
    setMode('manual');
  };

  const convertToFormData = (recipe: GeneratedRecipe): PostFormData => {
    return {
      title: recipe.title,
      description: recipe.description,
      koji_type: recipe.koji_type,
      difficulty: recipe.difficulty,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      image_url: null,
    };
  };

  const convertPostToFormData = (post: Post): PostFormData => {
    return {
      title: post.title,
      description: post.description ?? '',
      koji_type: post.koji_type,
      difficulty: post.difficulty ?? 'かんたん',
      ingredients: post.ingredients ?? [{ name: '', amount: '' }],
      steps: post.steps ?? [{ order: 1, description: '' }],
      image_url: post.image_url ?? null,
      imageFile: null,
    };
  };

  const loadDrafts = React.useCallback(async () => {
    setIsLoadingDrafts(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setDrafts([]);
        return;
      }

      const { data, error } = await supabase
        .from('posts')
        .select('id,title,updated_at,created_at')
        .eq('user_id', user.id)
        .eq('is_public', false)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error loading drafts:', error);
        setDrafts([]);
        return;
      }

      setDrafts((data ?? []) as any);
    } finally {
      setIsLoadingDrafts(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    if (mode !== 'select') return;
    void loadDrafts();
  }, [mode, loadDrafts]);

  const handleResumeDraft = async (postId: string) => {
    setIsResumingDraft(true);
    try {
      const { data, error } = await supabase.from('posts').select('*').eq('id', postId).single();

      if (error || !data) {
        alert('下書きの読み込みに失敗しました');
        return;
      }

      const post = data as Post;
      setDraftPostId(post.id);
      setGeneratedRecipe(null);
      setManualInitialData(convertPostToFormData(post));
      setMode('manual');
    } finally {
      setIsResumingDraft(false);
    }
  };

  const initialData =
    manualInitialData ?? (generatedRecipe ? convertToFormData(generatedRecipe) : undefined);

  // ゲストアクセス許可: ページレベルの認証ブロックは削除
  // 保存・投稿時のみ requireAuth() で認証チェックを行う

  return (
    <div className="min-h-screen bg-background">
      {/* 認証モーダル: ゲストが保存・投稿しようとした時に表示 */}
      {showAuthModal && (
        <AuthRequiredModal
          message={authModalMessage}
          isOpen={true}
        />
      )}
      
      {/* モバイル幅375pxに制限 */}
      <div className="max-w-[375px] mx-auto relative min-h-screen flex flex-col">
        {/* AppBar */}
        <AppBar
          title={
            mode === 'chat'
              ? 'レシピを考える'
              : mode === 'select'
                ? 'レシピ投稿'
                : mode === 'ai'
                  ? 'AI生成'
                  : 'レシピ編集'
          }
          leftAction={
            <button
              onClick={() => {
                if (mode === 'chat') {
                  router.back();
                  return;
                }
                if (mode === 'select') {
                  setMode('chat');
                  return;
                }

                setMode('chat');
                setGeneratedRecipe(null);
                setManualInitialData(undefined);
              }}
              className="h-[44px] w-[44px] flex items-center justify-center rounded-md hover:bg-muted transition-colors"
              aria-label={mode === 'chat' ? '閉じる' : '戻る'}
            >
              {mode === 'chat' ? <X className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
            </button>
          }
          rightActions={
            mode === 'chat' ? (
              <button
                type="button"
                onClick={handleChatSkipToForm}
                className="h-[44px] px-3 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-sm font-medium"
                aria-label="スキップ"
              >
                スキップ
              </button>
            ) : null
          }
        />

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto pb-20">
          {mode === 'chat' && (
            <AIChatComposer
              messages={chatMessages}
              input={chatInput}
              onInputChange={setChatInput}
              onSend={handleChatSend}
              isThinking={isChatThinking}
              suggestions={chatSuggestions}
              shouldShowCreateButton={shouldShowChatCreateButton}
              popular={chatPopular}
              canGenerateDraft={canGenerateDraftFromChat}
              onGenerateDraft={handleGenerateDraftFromChat}
              isGeneratingFromChat={isGeneratingFromChat}
              onSaveDraft={handleChatSaveDraft}
              isSavingDraft={isSavingDraft}
              kojiTypes={[...KOJI_TYPES]}
              selectedKojiType={selectedKojiType}
              onSelectKojiType={handleSelectKojiType}
              aiAvatarSrc="/ai/kochan.png"
              exampleText={exampleText}
              introStatus={introStatus}
              introError={introError}
              onRetryIntro={loadIntro}
              onTapExample={(text) => setChatInput(text)}
              onOpenDrafts={() => setMode('select')}
            />
          )}

          {mode === 'select' && (
            <div className="p-4 space-y-4">
              <div className="text-center space-y-2 py-8">
                <h2 className="text-2xl font-bold">レシピ投稿方法を選択</h2>
                <p className="text-muted-foreground">
                  AIに生成してもらうか、手動で入力するか選んでください
                </p>
              </div>

              {/* 下書きから再開 */}
              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold">下書きから再開</h3>
                  {isLoadingDrafts && (
                    <span className="text-xs text-muted-foreground">読み込み中...</span>
                  )}
                </div>
                {drafts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    下書きはありません（「下書き保存」で作成できます）
                  </p>
                ) : (
                  <div className="space-y-2">
                    {drafts.slice(0, 5).map((d) => (
                      <button
                        key={d.id}
                        onClick={() => handleResumeDraft(d.id)}
                        disabled={isResumingDraft}
                        className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{d.title || '（無題）'}</div>
                            <div className="text-xs text-muted-foreground">
                              更新: {new Date(d.updated_at || d.created_at).toLocaleString()}
                            </div>
                          </div>
                          <span className="text-sm text-primary font-medium shrink-0">
                            {isResumingDraft ? '復元中...' : '再開'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* AI生成ボタン */}
              <button
                onClick={() => setMode('ai')}
                className="w-full p-6 rounded-lg border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-all space-y-3"
              >
                <div className="flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-primary mb-1">AIで生成</h3>
                  <p className="text-sm text-muted-foreground">
                    条件を選ぶだけで、AIがレシピを自動生成
                  </p>
                </div>
              </button>

              {/* 手動入力ボタン */}
              <button
                onClick={() => {
                  setGeneratedRecipe(null);
                  setManualInitialData(undefined);
                  setDraftPostId(null);
                  setMode('manual');
                }}
                className="w-full p-6 rounded-lg border-2 border-border hover:border-muted-foreground transition-all space-y-3"
              >
                <div className="flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <PenLine className="w-8 h-8 text-foreground" />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold mb-1">手動で入力</h3>
                  <p className="text-sm text-muted-foreground">自分のレシピを詳しく記録</p>
                </div>
              </button>
            </div>
          )}

          {mode === 'ai' && <AIGenerateForm onRecipeGenerated={handleRecipeGenerated} />}

          {mode === 'manual' && (
            <PostForm
              onSubmit={handleSubmit}
              onSaveDraft={handleSaveDraft}
              isSubmitting={isSubmitting}
              isSavingDraft={isSavingDraft}
              initialData={initialData}
            />
          )}
        </main>
      </div>
    </div>
  );
}


