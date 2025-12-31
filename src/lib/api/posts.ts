// レシピ投稿API

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Post, PostInsert, PostUpdate, PostWithUser } from '../types/database';

/**
 * レシピ投稿を作成
 */
export async function createPost(
  supabase: SupabaseClient,
  post: PostInsert
): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .insert(post)
    .select()
    .single();

  if (error) {
    console.error('Error creating post:', error);
    return null;
  }

  return data;
}

/**
 * レシピ投稿を作成（失敗時は例外）
 * - Compose（下書き/投稿）で失敗理由をユーザーに表示するために使用
 */
export async function createPostStrict(
  supabase: SupabaseClient,
  post: PostInsert
): Promise<Post> {
  const { data, error } = await supabase
    .from('posts')
    .insert(post)
    .select()
    .single();

  if (error || !data) {
    console.error('Error creating post (strict):', error);
    throw new Error(error?.message || '投稿の作成に失敗しました');
  }

  return data;
}

/**
 * レシピ投稿一覧を取得（新着順）
 */
export async function getPosts(
  supabase: SupabaseClient,
  limit = 20,
  offset = 0
): Promise<PostWithUser[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      user:users(*)
    `)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching posts:', error);
    return [];
  }

  return data as PostWithUser[];
}

/**
 * レシピ投稿一覧を取得（人気順：閲覧数）
 */
export async function getPopularPosts(
  supabase: SupabaseClient,
  limit = 20,
  offset = 0
): Promise<PostWithUser[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      user:users(*)
    `)
    .eq('is_public', true)
    .order('view_count', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching popular posts:', error);
    return [];
  }

  return data as PostWithUser[];
}

/**
 * レシピ投稿詳細を取得
 */
export async function getPostById(
  supabase: SupabaseClient,
  postId: string
): Promise<PostWithUser | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      user:users(*)
    `)
    .eq('id', postId)
    .single();

  if (error) {
    console.error('Error fetching post:', error);
    return null;
  }

  return data as PostWithUser;
}

/**
 * ユーザーの投稿一覧を取得
 */
export async function getPostsByUserId(
  supabase: SupabaseClient,
  userId: string,
  includePrivate = false
): Promise<Post[]> {
  let query = supabase
    .from('posts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!includePrivate) {
    query = query.eq('is_public', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching user posts:', error);
    return [];
  }

  return data;
}

/**
 * レシピ投稿を更新
 */
export async function updatePost(
  supabase: SupabaseClient,
  postId: string,
  updates: PostUpdate
): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .update(updates)
    .eq('id', postId)
    .select()
    .single();

  if (error) {
    console.error('Error updating post:', error);
    return null;
  }

  return data;
}

/**
 * レシピ投稿を更新（失敗時は例外）
 */
export async function updatePostStrict(
  supabase: SupabaseClient,
  postId: string,
  updates: PostUpdate
): Promise<Post> {
  const { data, error } = await supabase
    .from('posts')
    .update(updates)
    .eq('id', postId)
    .select()
    .single();

  if (error || !data) {
    console.error('Error updating post (strict):', error);
    throw new Error(error?.message || '投稿の更新に失敗しました');
  }

  return data;
}

/**
 * レシピ投稿を削除
 */
export async function deletePost(
  supabase: SupabaseClient,
  postId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);

  if (error) {
    console.error('Error deleting post:', error);
    return false;
  }

  return true;
}

/**
 * 麹の種類でフィルタリング
 */
export async function getPostsByKojiType(
  supabase: SupabaseClient,
  kojiType: string,
  limit = 20
): Promise<PostWithUser[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      user:users(*)
    `)
    .eq('is_public', true)
    .eq('koji_type', kojiType)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching posts by koji type:', error);
    return [];
  }

  return data as PostWithUser[];
}

/**
 * レシピ検索（タイトル・説明文）
 */
export async function searchPosts(
  supabase: SupabaseClient,
  query: string,
  limit = 20
): Promise<PostWithUser[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      user:users(*)
    `)
    .eq('is_public', true)
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error searching posts:', error);
    return [];
  }

  return data as PostWithUser[];
}

