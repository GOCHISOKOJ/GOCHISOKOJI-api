'use client';

import React from 'react';
import { createClient } from '@/lib/supabase/client';
import { ProfileClient } from '@/components/ProfileClient';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { AuthRequiredModal } from '@/components/AuthRequiredModal';

// 最近見たレシピをlocalStorageから取得
function getRecentViewedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem('recentViewedPosts');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 10); // 最大10件
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export default function ProfilePage() {
  const supabase = createClient();
  const [userProfile, setUserProfile] = React.useState<any>(null);
  const [userPosts, setUserPosts] = React.useState<any[]>([]);
  const [likedPosts, setLikedPosts] = React.useState<any[]>([]);
  const [draftPosts, setDraftPosts] = React.useState<any[]>([]);
  const [recentPosts, setRecentPosts] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showAuthModal, setShowAuthModal] = React.useState(false);

  React.useEffect(() => {
    async function loadUserData() {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser) {
          setShowAuthModal(true);
          setIsLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        setUserProfile(
          profile || {
            id: authUser.id,
            email: authUser.email!,
            display_name: authUser.email,
            avatar_url: null,
            bio: null,
            created_at: '',
            updated_at: '',
          }
        );

        // 公開済みの自分の投稿
        const { data: publicPosts } = await supabase
          .from('posts')
          .select(`
            *,
            user:users(*)
          `)
          .eq('user_id', authUser.id)
          .eq('is_public', true)
          .order('created_at', { ascending: false });

        setUserPosts(publicPosts || []);

        // 下書き（非公開）の投稿
        const { data: drafts } = await supabase
          .from('posts')
          .select(`
            *,
            user:users(*)
          `)
          .eq('user_id', authUser.id)
          .eq('is_public', false)
          .order('created_at', { ascending: false });

        setDraftPosts(drafts || []);

        // お気に入り（保存）した投稿
        const { data: likes } = await supabase
          .from('likes')
          .select(`
            post_id,
            posts (
              *,
              user:users(*)
            )
          `)
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false });

        const liked = likes?.map((like: any) => like.posts).filter(Boolean) || [];
        setLikedPosts(liked);

        // 最近見たレシピ
        const recentIds = getRecentViewedIds();
        if (recentIds.length > 0) {
          const { data: recentData } = await supabase
            .from('posts')
            .select(`
              *,
              user:users(*)
            `)
            .in('id', recentIds)
            .eq('is_public', true);

          // IDの順序を維持（最近見た順）
          if (recentData) {
            const orderedRecent = recentIds
              .map(id => recentData.find(p => p.id === id))
              .filter(Boolean);
            setRecentPosts(orderedRecent);
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadUserData();
  }, [supabase]);

  // 未ログイン時は認証モーダルを表示
  if (showAuthModal) {
    return (
      <AuthRequiredModal
        message="プロフィールを見るにはログインが必要です"
        isOpen={true}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!userProfile) {
    return null;
  }

  return (
    <ProfileClient 
      user={userProfile} 
      userPosts={userPosts} 
      likedPosts={likedPosts}
      draftPosts={draftPosts}
      recentPosts={recentPosts}
    />
  );
}
