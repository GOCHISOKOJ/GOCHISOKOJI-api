import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { PostDetailClient } from '@/components/PostDetailClient';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PostDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: post, error } = await supabase
    .from('posts')
    .select(
      `
      *,
      user:users(*)
    `
    )
    .eq('id', id)
    .single();

  if (error || !post) {
    notFound();
  }

  return <PostDetailClient post={post} />;
}


