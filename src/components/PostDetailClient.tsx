'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AppBar } from '@/components/AppBar';
import { ChipTag } from '@/components/ChipTag';
import { Clock, ArrowLeft, Bookmark } from 'lucide-react';
import type { PostWithUser, Ingredient, Step } from '@/lib/types/database';
import { createClient } from '@/lib/supabase/client';
import { isPostLiked, likePost, unlikePost } from '@/lib/api/likes';
import { toKojiDisplayName } from '@/lib/utils/koji';

interface PostDetailClientProps {
  post: PostWithUser;
}

export function PostDetailClient({ post }: PostDetailClientProps) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [isSaved, setIsSaved] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = React.useState(false);

  const ingredients = post.ingredients as Ingredient[] | null;
  const steps = post.steps as Step[] | null;

  React.useEffect(() => {
    async function loadSaved() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCurrentUserId(null);
        setIsSaved(false);
        return;
      }
      setCurrentUserId(user.id);
      const liked = await isPostLiked(supabase, user.id, post.id);
      setIsSaved(liked);
    }
    void loadSaved();

    // 最近見たレシピをlocalStorageに保存
    try {
      const key = 'recentViewedPosts';
      const stored = localStorage.getItem(key);
      let recentIds: string[] = stored ? JSON.parse(stored) : [];
      // 既に存在する場合は削除して先頭に追加
      recentIds = recentIds.filter(id => id !== post.id);
      recentIds.unshift(post.id);
      // 最大10件に制限
      recentIds = recentIds.slice(0, 10);
      localStorage.setItem(key, JSON.stringify(recentIds));
    } catch {
      // ignore localStorage errors
    }
  }, [supabase, post.id]);

  const isOwner = !!currentUserId && post.user_id === currentUserId;

  const handleToggleSave = async () => {
    if (!currentUserId) {
      alert('保存するにはログインしてください');
      router.push('/login');
      return;
    }
    if (isSaving) return;
    setIsSaving(true);

    const prev = isSaved;
    setIsSaved(!prev);
    try {
      if (prev) {
        const ok = await unlikePost(supabase, currentUserId, post.id);
        if (!ok) throw new Error('保存の解除に失敗しました');
      } else {
        const like = await likePost(supabase, currentUserId, post.id);
        if (!like) throw new Error('保存に失敗しました');
      }
    } catch (e) {
      console.error(e);
      setIsSaved(prev);
      alert(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[375px] mx-auto relative min-h-screen flex flex-col">
        {/* AppBar */}
        <AppBar
          title={post.title}
          leftAction={
            <button
              onClick={() => router.back()}
              className="h-[44px] w-[44px] flex items-center justify-center rounded-md hover:bg-muted transition-colors"
              aria-label="戻る"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          }
          rightActions={
            isOwner ? (
              <button
                type="button"
                onClick={() => router.push(`/posts/${post.id}/edit`)}
                className="h-[44px] px-3 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-sm font-medium"
                aria-label="編集"
              >
                編集
              </button>
            ) : null
          }
        />

        {/* コンテンツ */}
        <main className="flex-1 overflow-y-auto pb-20">
          {/* メイン画像 */}
          <div className="relative w-full aspect-[4/5] bg-muted">
            {post.image_url ? (
              <img
                src={post.image_url}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/10">
                <div className="text-center px-4">
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-primary/15 border border-primary/20 mb-2">
                    <span className="text-primary text-sm font-medium">麹</span>
                  </div>
                  <div className="text-xs text-foreground/70">写真なし</div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 space-y-6">
            {/* タイトルと情報 */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-2xl font-bold leading-snug flex-1">{post.title}</h1>
                <button
                  type="button"
                  onClick={handleToggleSave}
                  disabled={isSaving}
                  className="mt-2 h-11 w-11 shrink-0 rounded-full bg-surface/90 border border-border shadow-sm flex items-center justify-center hover:bg-surface transition-colors disabled:opacity-60"
                  aria-label={isSaved ? '保存を解除' : '保存する'}
                >
                  <Bookmark
                    className={isSaved ? 'h-5 w-5 text-primary' : 'h-5 w-5 text-foreground/70'}
                    fill={isSaved ? 'currentColor' : 'none'}
                  />
                </button>
              </div>

              {/* タグ */}
              <div className="flex flex-wrap items-center gap-2">
                <ChipTag type="koji" label={toKojiDisplayName(post.koji_type)} />
                {post.difficulty && (
                  <ChipTag type="difficulty" label={post.difficulty} />
                )}
              </div>

              {/* 投稿者情報 */}
              <div className="flex items-center gap-3 pt-2">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  {post.user.avatar_url ? (
                    <img src={post.user.avatar_url} alt={post.user.display_name || ''} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium">{post.user.display_name?.[0] || 'U'}</span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium">{post.user.display_name || 'ユーザー'}</div>
                </div>
              </div>
            </div>

            {/* 説明 */}
            {post.description && (
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">説明</h2>
                <button
                  type="button"
                  onClick={() => setIsDescriptionExpanded((v) => !v)}
                  className="w-full text-left rounded-lg border border-border bg-surface px-4 py-3"
                  aria-expanded={isDescriptionExpanded}
                  aria-label={isDescriptionExpanded ? '説明を折りたたむ' : '説明を展開する'}
                >
                  <div
                    className={`text-foreground/80 ${
                      isDescriptionExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'
                    }`}
                  >
                    {post.description}
                  </div>
                </button>
              </div>
            )}

            {/* 材料 */}
            {ingredients && ingredients.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">材料</h2>
                <ul className="space-y-2">
                  {ingredients.map((ingredient, index) => (
                    <li key={index} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                      <span>{ingredient.name}</span>
                      <span className="text-muted-foreground">{ingredient.amount}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 手順 */}
            {steps && steps.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">作り方</h2>
                <ol className="space-y-4">
                  {steps.map((step) => (
                    <li key={step.order} className="flex gap-3">
                      <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                        {step.order}
                      </span>
                      <div className="flex-1 pt-0.5">
                        <p className="text-foreground/80">{step.description}</p>
                        {step.image_url && (
                          <img src={step.image_url} alt={`手順${step.order}`} className="mt-2 rounded-lg w-full" />
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* 統計情報 */}
            <div className="flex gap-4 pt-4 text-sm text-muted-foreground">
              <span>{post.view_count} 回閲覧</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

