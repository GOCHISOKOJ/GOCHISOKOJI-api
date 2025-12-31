import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { HomeClient } from '@/components/HomeClient';

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 新着投稿を取得（created_at降順）: 未ログインでも閲覧OK
  const { data: recentPosts } = await supabase
    .from('posts')
    .select(
      `
      *,
      user:users(*)
    `
    )
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(20);

  // 人気投稿（ランキング）: ログイン必須
  const canViewPopular = !!user;
  const popularPosts = canViewPopular
    ? (
        await supabase
          .from('posts')
          .select(
            `
            *,
            user:users(*)
          `
          )
          .eq('is_public', true)
          .order('view_count', { ascending: false })
          .limit(20)
      ).data
    : [];

  return (
    <HomeClient
      recentPosts={recentPosts || []}
      popularPosts={popularPosts || []}
      canViewPopular={canViewPopular}
    />
  );
}


