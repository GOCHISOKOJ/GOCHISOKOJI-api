// お気に入りAPI

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Like, LikeInsert, Post } from '../types/database';

/**
 * お気に入り登録
 */
export async function likePost(
  supabase: SupabaseClient,
  userId: string,
  postId: string
): Promise<Like | null> {
  const like: LikeInsert = {
    user_id: userId,
    post_id: postId,
  };

  const { data, error } = await supabase
    .from('likes')
    .insert(like)
    .select()
    .single();

  if (error) {
    console.error('Error liking post:', error);
    return null;
  }

  return data;
}

/**
 * お気に入り解除
 */
export async function unlikePost(
  supabase: SupabaseClient,
  userId: string,
  postId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId);

  if (error) {
    console.error('Error unliking post:', error);
    return false;
  }

  return true;
}

/**
 * お気に入り状態を確認
 */
export async function isPostLiked(
  supabase: SupabaseClient,
  userId: string,
  postId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .maybeSingle();

  if (error) {
    console.error('Error checking like status:', error);
    return false;
  }

  return data !== null;
}

/**
 * ユーザーのお気に入り一覧を取得
 */
export async function getUserLikes(
  supabase: SupabaseClient,
  userId: string
): Promise<Post[]> {
  const { data, error } = await supabase
    .from('likes')
    .select(`
      post_id,
      posts (*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user likes:', error);
    return [];
  }

  // データ構造を整形
  return data
    .map((item: any) => item.posts)
    .filter((post: Post | null) => post !== null) as Post[];
}

/**
 * 投稿のお気に入り数を取得
 */
export async function getPostLikeCount(
  supabase: SupabaseClient,
  postId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);

  if (error) {
    console.error('Error fetching like count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * お気に入りの切り替え（トグル）
 */
export async function toggleLike(
  supabase: SupabaseClient,
  userId: string,
  postId: string
): Promise<boolean> {
  const isLiked = await isPostLiked(supabase, userId, postId);

  if (isLiked) {
    return await unlikePost(supabase, userId, postId);
  } else {
    const result = await likePost(supabase, userId, postId);
    return result !== null;
  }
}


