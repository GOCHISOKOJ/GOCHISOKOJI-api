'use client';

import React from 'react';
import { Search, Bookmark, ChefHat, FileEdit } from 'lucide-react';
import { ProfileHeader } from '@/components/ProfileHeader';
import { RecipeSection } from '@/components/RecipeSection';
import type { User, PostWithUser } from '@/lib/types/database';

interface ProfileClientProps {
  user: User;
  userPosts: PostWithUser[];
  likedPosts: PostWithUser[];
  draftPosts?: PostWithUser[];
  recentPosts?: PostWithUser[];
}

type FilterTab = 'all' | 'saved' | 'mine' | 'draft';

const filterTabs: { id: FilterTab; label: string; icon: React.ElementType }[] = [
  { id: 'saved', label: '保存', icon: Bookmark },
  { id: 'mine', label: '自分の', icon: ChefHat },
  { id: 'draft', label: '下書き', icon: FileEdit },
];

export function ProfileClient({ 
  user, 
  userPosts, 
  likedPosts, 
  draftPosts = [],
  recentPosts = [],
}: ProfileClientProps) {
  const [activeFilter, setActiveFilter] = React.useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  // 公開済みの自分のレシピ
  const publicPosts = userPosts.filter(p => p.is_public !== false);
  
  // 下書き（非公開）の自分のレシピ
  const drafts = draftPosts.length > 0 ? draftPosts : userPosts.filter(p => p.is_public === false);

  // 検索フィルタリング
  const filterBySearch = (posts: PostWithUser[]) => {
    if (!searchQuery.trim()) return posts;
    const query = searchQuery.toLowerCase();
    return posts.filter(p => 
      p.title.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query)
    );
  };

  // フィルタータブに応じたコンテンツ表示
  const renderFilteredContent = () => {
    switch (activeFilter) {
      case 'saved':
        return (
          <RecipeSection
            title="保存したレシピ"
            count={likedPosts.length}
            recipes={filterBySearch(likedPosts)}
            onRecipeClick={(id) => window.location.href = `/posts/${id}`}
          />
        );
      case 'mine':
        return (
          <RecipeSection
            title="自分のレシピ"
            count={publicPosts.length}
            recipes={filterBySearch(publicPosts)}
            onRecipeClick={(id) => window.location.href = `/posts/${id}`}
            showAuthor={false}
          />
        );
      case 'draft':
        return (
          <RecipeSection
            title="下書き中のレシピ"
            count={drafts.length}
            recipes={filterBySearch(drafts)}
            onRecipeClick={(id) => window.location.href = `/posts/${id}`}
            showAuthor={false}
          />
        );
      default:
        return null;
    }
  };

  const handleRecipeClick = (id: string) => {
    window.location.href = `/posts/${id}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[375px] mx-auto relative min-h-screen flex flex-col">
        {/* ヘッダー */}
        <ProfileHeader
          name={user.display_name || user.email || 'ユーザー'}
          avatarUrl={user.avatar_url || undefined}
          onNotificationClick={() => alert('通知機能は実装予定です')}
        />

        {/* 検索バー */}
        <div className="px-3 py-1.5 bg-background">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="レシピを検索"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-full border border-border bg-muted/30 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-colors"
            />
          </div>
        </div>

        {/* フィルタータブ */}
        <div className="px-3 pb-1.5 flex gap-1.5 overflow-x-auto scrollbar-hide">
          {filterTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(isActive ? 'all' : tab.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors min-h-0 ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto pb-14">
          {activeFilter !== 'all' ? (
            // フィルター選択時: そのカテゴリのみ表示
            renderFilteredContent()
          ) : (
            // 全体表示: セクション分け
            <>
              {/* 最近見たレシピ */}
              {recentPosts.length > 0 && (
                <RecipeSection
                  title="最近見たレシピ"
                  recipes={filterBySearch(recentPosts)}
                  onRecipeClick={handleRecipeClick}
                />
              )}

              {/* 保存したレシピ */}
              {likedPosts.length > 0 && (
                <RecipeSection
                  title="保存したレシピ"
                  count={likedPosts.length}
                  recipes={filterBySearch(likedPosts)}
                  onSeeAll={() => setActiveFilter('saved')}
                  onRecipeClick={handleRecipeClick}
                />
              )}

              {/* 自分のレシピ */}
              {publicPosts.length > 0 && (
                <RecipeSection
                  title="自分のレシピ"
                  count={publicPosts.length}
                  recipes={filterBySearch(publicPosts)}
                  onSeeAll={() => setActiveFilter('mine')}
                  onRecipeClick={handleRecipeClick}
                  showAuthor={false}
                />
              )}

              {/* 下書き中のレシピ */}
              {drafts.length > 0 && (
                <RecipeSection
                  title="下書き中のレシピ"
                  count={drafts.length}
                  recipes={filterBySearch(drafts)}
                  onSeeAll={() => setActiveFilter('draft')}
                  onRecipeClick={handleRecipeClick}
                  showAuthor={false}
                />
              )}

              {/* 空の状態 */}
              {likedPosts.length === 0 && publicPosts.length === 0 && drafts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <ChefHat className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">
                    まだレシピがありません
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    レシピを作成したり、お気に入りを保存してみましょう
                  </p>
                  <button
                    onClick={() => window.location.href = '/compose'}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-xs font-medium hover:bg-primary/90 transition-colors min-h-0"
                  >
                    レシピを作成する
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
