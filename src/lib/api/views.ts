// PV（ページビュー）計測API

import { createClient } from '@/lib/supabase/client';
import type { ViewInsert } from '../types/database';

const supabase = createClient();

/**
 * PVを記録
 */
export async function trackView(postId: string): Promise<boolean> {
  // 現在のユーザーを取得（ログインしていない場合はnull）
  const { data: { user } } = await supabase.auth.getUser();

  // セッションIDを生成（匿名ユーザー用）
  const sessionId = getOrCreateSessionId();

  const view: ViewInsert = {
    post_id: postId,
    user_id: user?.id || null,
    session_id: user ? null : sessionId, // ログインユーザーの場合はsession_idは不要
  };

  const { error } = await supabase
    .from('views')
    .insert(view);

  if (error) {
    console.error('Error tracking view:', error);
    return false;
  }

  // postsテーブルのview_countを更新
  await incrementViewCount(postId);

  return true;
}

/**
 * postsテーブルのview_countをインクリメント
 */
async function incrementViewCount(postId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_view_count', {
    post_id: postId,
  });

  if (error) {
    // RPCが存在しない場合は、直接UPDATE
    const { data: post } = await supabase
      .from('posts')
      .select('view_count')
      .eq('id', postId)
      .single();

    if (post) {
      await supabase
        .from('posts')
        .update({ view_count: (post.view_count || 0) + 1 })
        .eq('id', postId);
    }
  }
}

/**
 * セッションIDを取得または生成（localStorage使用）
 */
function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') {
    return ''; // サーバーサイドでは空文字
  }

  const SESSION_KEY = 'koji_session_id';
  let sessionId = localStorage.getItem(SESSION_KEY);

  if (!sessionId) {
    // UUIDv4風のIDを生成
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  return sessionId;
}

/**
 * 投稿のPV数を取得
 */
export async function getPostViewCount(postId: string): Promise<number> {
  const { count, error } = await supabase
    .from('views')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);

  if (error) {
    console.error('Error fetching view count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * ユーザーの投稿別PV統計を取得
 */
export async function getUserPostViews(userId: string): Promise<{ postId: string; viewCount: number }[]> {
  const { data, error } = await supabase
    .from('views')
    .select(`
      post_id,
      posts!inner(user_id)
    `)
    .eq('posts.user_id', userId);

  if (error) {
    console.error('Error fetching user post views:', error);
    return [];
  }

  // 投稿IDごとにPV数を集計
  const viewCounts: { [key: string]: number } = {};
  data.forEach((item: any) => {
    const postId = item.post_id;
    viewCounts[postId] = (viewCounts[postId] || 0) + 1;
  });

  return Object.entries(viewCounts).map(([postId, viewCount]) => ({
    postId,
    viewCount,
  }));
}







