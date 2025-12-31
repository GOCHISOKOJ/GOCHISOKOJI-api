import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { PostEditClient } from '@/components/PostEditClient';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PostEditPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/posts/${id}/edit`);
  }

  const { data: post, error } = await supabase.from('posts').select('*').eq('id', id).single();

  if (error || !post) {
    notFound();
  }

  // 自分の投稿のみ編集可
  if (post.user_id !== user.id) {
    notFound();
  }

  return <PostEditClient post={post} />;
}


