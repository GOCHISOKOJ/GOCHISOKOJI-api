'use client';

import React from 'react';
import { AppBar } from '@/components/AppBar';
import { TabBar } from '@/components/TabBar';
import { CardPost } from '@/components/CardPost';
import { WeeklyBanner, type WeeklyRecipe } from '@/components/WeeklyBanner';
import { Search, Check } from 'lucide-react';
import type { PostWithUser } from '@/lib/types/database';
import { createClient } from '@/lib/supabase/client';
import { likePost, unlikePost } from '@/lib/api/likes';

interface HomeClientProps {
  recentPosts: PostWithUser[];
  popularPosts: PostWithUser[];
  canViewPopular?: boolean;
}

const tabs = [
  { id: 'recent', label: '新着' },
  { id: 'popular', label: '人気' },
];

// 麹タイプフィルター（アイコン付き）
const KOJI_FILTERS = [
  { id: 'たまねぎこうじ', label: '旨塩風', icon: '🧂' },
  { id: '中華こうじ', label: '中華風', icon: '🥢' },
  { id: 'コンソメこうじ', label: 'コンソメ風', icon: '🫕' },
];

// 相対時間を計算する関数
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins}分前`;
  } else if (diffHours < 24) {
    return `${diffHours}時間前`;
  } else if (diffDays === 1) {
    return '1日前';
  } else if (diffDays < 7) {
    return `${diffDays}日前`;
  } else {
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  }
}

export function HomeClient({ recentPosts, popularPosts, canViewPopular = true }: HomeClientProps) {
  const [activeTab, setActiveTab] = React.useState<'recent' | 'popular'>('recent');
  const [query, setQuery] = React.useState('');
  const [selectedKojis, setSelectedKojis] = React.useState<Set<string>>(new Set());
  const supabase = React.useMemo(() => createClient(), []);
  
  // 麹フィルターのトグル選択
  const toggleKoji = React.useCallback((id: string) => {
    setSelectedKojis(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [savedIds, setSavedIds] = React.useState<Set<string>>(new Set());
  const [savingId, setSavingId] = React.useState<string | null>(null);

  // 週間おすすめレシピ（APIから取得）
  const [weeklyRecipes, setWeeklyRecipes] = React.useState<WeeklyRecipe[]>([]);
  const [isLoadingWeekly, setIsLoadingWeekly] = React.useState(true);

  const WEEKLY_CACHE_KEY = 'weekly_recipes_cache_v1';
  const WEEKLY_CACHE_TTL_MS = 60 * 60 * 1000; // 1時間

  const posts = activeTab === 'popular' ? popularPosts : recentPosts;

  const filteredPosts = React.useMemo(() => {
    return posts.filter((p) => {
      // 麹タイプフィルター（OR検索: 何も選択していなければ全表示）
      if (selectedKojis.size > 0 && !selectedKojis.has(p.koji_type)) return false;
      // テキスト検索
      const q = query.trim().toLowerCase();
      if (q) {
        const hay = `${p.title ?? ''} ${p.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [posts, query, selectedKojis]);

  // 週間おすすめレシピをAPIから取得
  React.useEffect(() => {
    // 1) まずは localStorage キャッシュで即表示（体感速度改善）
    try {
      const raw = localStorage.getItem(WEEKLY_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as any;
        const ts = Number(parsed?.ts ?? 0);
        const recipes = Array.isArray(parsed?.recipes) ? (parsed.recipes as WeeklyRecipe[]) : [];
        if (ts && Date.now() - ts < WEEKLY_CACHE_TTL_MS && recipes.length > 0) {
          setWeeklyRecipes(recipes);
          setIsLoadingWeekly(false);
        }
      }
    } catch {
      // ignore
    }

    async function loadWeeklyRecipes() {
      try {
        const res = await fetch('/api/weekly-recipes');
        if (res.ok) {
          const data = await res.json();
          const next = (data.recipes || []) as WeeklyRecipe[];
          setWeeklyRecipes(next);
          // 2) 取得できたら localStorage に保存（次回は即表示）
          try {
            localStorage.setItem(WEEKLY_CACHE_KEY, JSON.stringify({ ts: Date.now(), recipes: next }));
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.error('Error loading weekly recipes:', err);
      } finally {
        setIsLoadingWeekly(false);
      }
    }
    void loadWeeklyRecipes();
  }, []);

  React.useEffect(() => {
    async function loadSaved() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCurrentUserId(null);
        setSavedIds(new Set());
        return;
      }
      setCurrentUserId(user.id);
      const { data, error } = await supabase
        .from('likes')
        .select('post_id')
        .eq('user_id', user.id);
      if (error) {
        console.error('Error loading saved posts:', error);
        return;
      }
      setSavedIds(new Set((data ?? []).map((r: any) => r.post_id)));
    }
    void loadSaved();
  }, [supabase]);

  const handleToggleSave = async (postId: string) => {
    if (!currentUserId) {
      alert('保存するにはログインしてください');
      window.location.href = '/login';
      return;
    }
    if (savingId) return;
    setSavingId(postId);

    const wasSaved = savedIds.has(postId);
    // optimistic update
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(postId);
      else next.add(postId);
      return next;
    });

    try {
      if (wasSaved) {
        const ok = await unlikePost(supabase as any, currentUserId, postId);
        if (!ok) throw new Error('保存の解除に失敗しました');
      } else {
        const like = await likePost(supabase as any, currentUserId, postId);
        if (!like) throw new Error('保存に失敗しました');
      }
    } catch (e) {
      console.error(e);
      // revert
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(postId);
        else next.delete(postId);
        return next;
      });
      alert(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* モバイル幅375pxに制限 */}
      <div className="max-w-[375px] mx-auto relative min-h-screen flex flex-col">
        {/* AppBar */}
        <AppBar
          title="麹レシピ"
        />

        {/* 新着 / 人気（タブ） */}
        <TabBar
          tabs={tabs}
          activeId={activeTab}
          onTabChange={(id) => {
            if (id === 'popular' && !canViewPopular) {
              alert('人気ランキングを見るにはログインしてください');
              window.location.href = '/login?next=/';
              return;
            }
            setActiveTab(id as any);
          }}
        />

        {/* 検索 & 麹フィルター */}
        <div className="px-4 pt-2">
          <div className="bg-surface rounded-xl px-4 py-3 border border-border">
            {/* 検索窓 */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground group-focus-within:text-primary" />
              </div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="食材やレシピ名で検索..."
                className="w-full h-10 pl-9 pr-3 bg-background rounded-lg 
                           text-sm placeholder:text-muted-foreground
                           border border-border
                           focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20
                           transition-all duration-200"
              />
              {query.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <span className="text-xs text-primary hover:text-primary/80 font-medium">クリア</span>
                </button>
              )}
            </div>
            
            {/* 麹フィルター */}
            <div className="mt-3">
              <div className="flex items-center justify-center gap-2">
                {KOJI_FILTERS.map((koji) => {
                  const isSelected = selectedKojis.has(koji.id);
                  return (
                    <button
                      key={koji.id}
                      type="button"
                      onClick={() => toggleKoji(koji.id)}
                      className={`
                        flex items-center gap-1.5 px-4 py-1.5 rounded-lg transition-all duration-150
                        text-xs font-medium whitespace-nowrap
                        ${isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 text-foreground/80 hover:bg-muted'
                        }
                      `}
                    >
                      <span className="text-sm">{koji.icon}</span>
                      <span>{koji.label}</span>
                    </button>
                  );
                })}
              </div>
              {selectedKojis.size > 0 && (
                <div className="flex justify-center mt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedKojis(new Set())}
                    className="text-xs text-muted-foreground hover:text-primary"
                  >
                    クリア
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 今週のおすすめレシピ（AIが選定） */}
        <WeeklyBanner
          recipes={weeklyRecipes}
          isLoading={isLoadingWeekly}
          onRecipeClick={(id) => {
            // 週間レシピをクリックしたらレシピ詳細へ遷移
            window.location.href = `/posts/${id}`;
          }}
        />

        {/* コンテンツエリア */}
        <main className="flex-1 overflow-y-auto pb-20">
          <div className="p-4 space-y-4">
            {/* 投稿リスト */}
            {filteredPosts.length > 0 ? (
              filteredPosts.map((post) => (
                <CardPost
                  key={post.id}
                  postId={post.id}
                  image={post.image_url}
                  title={post.title}
                  description={post.description}
                  authorName={post.user?.display_name || post.user?.email || null}
                  authorAvatarUrl={post.user?.avatar_url || null}
                  kojiType={post.koji_type}
                  ingredients={post.ingredients}
                  totalMinutes={0} // TODO: 調理時間は将来的に追加
                  postedDate={getRelativeTime(post.created_at)}
                  isSaved={savedIds.has(post.id)}
                  isSaving={savingId === post.id}
                  onToggleSave={handleToggleSave}
                  onClick={() => window.location.href = `/posts/${post.id}`}
                />
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                {query.trim() || selectedKojis.size > 0 ? '該当するレシピがありません' : 'まだ投稿がありません'}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

