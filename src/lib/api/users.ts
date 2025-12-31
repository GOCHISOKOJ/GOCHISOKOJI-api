// ユーザーAPI

import { createClient } from '@/lib/supabase/client';
import type { User, UserInsert, UserUpdate } from '../types/database';

const supabase = createClient();

/**
 * 現在ログイン中のユーザー情報を取得
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  
  if (!authUser) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }

  return data;
}

/**
 * ユーザープロフィールを作成（初回ログイン時）
 */
export async function createUserProfile(user: UserInsert): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .insert(user)
    .select()
    .single();

  if (error) {
    console.error('Error creating user profile:', error);
    return null;
  }

  return data;
}

/**
 * ユーザープロフィールを更新
 */
export async function updateUserProfile(
  userId: string,
  updates: UserUpdate
): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating user profile:', error);
    return null;
  }

  return data;
}

/**
 * ユーザー情報をIDで取得
 */
export async function getUserById(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user by ID:', error);
    return null;
  }

  return data;
}

/**
 * Auth.usersとpublic.usersを同期（初回ログイン時に使用）
 */
export async function syncAuthUser(): Promise<User | null> {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  
  if (!authUser) return null;

  // 既にプロフィールが存在するか確認
  const existingUser = await getUserById(authUser.id);
  if (existingUser) return existingUser;

  // 存在しない場合は作成
  return await createUserProfile({
    id: authUser.id,
    email: authUser.email!,
    display_name: authUser.user_metadata.full_name || authUser.email?.split('@')[0] || null,
    avatar_url: authUser.user_metadata.avatar_url || null,
  });
}







