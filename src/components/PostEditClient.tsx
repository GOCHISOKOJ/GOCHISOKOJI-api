'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AppBar } from '@/components/AppBar';
import { PostForm, type PostFormData } from '@/components/PostForm';
import { ArrowLeft } from 'lucide-react';
import { updatePostStrict } from '@/lib/api/posts';
import { createClient } from '@/lib/supabase/client';
import type { Post } from '@/lib/types/database';

interface PostEditClientProps {
  post: Post;
}

export function PostEditClient({ post }: PostEditClientProps) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const POST_IMAGES_BUCKET = 'post-images';

  const getSupabaseErrorMeta = (err: unknown): { status: number | null; message: string } => {
    if (err && typeof err === 'object') {
      const statusRaw = (err as Record<string, unknown>).statusCode ?? (err as Record<string, unknown>).status;
      const status = typeof statusRaw === 'number' ? statusRaw : null;
      const msgRaw = (err as Record<string, unknown>).message;
      const message = typeof msgRaw === 'string' ? msgRaw : 'Unknown error';
      return { status, message };
    }
    return { status: null, message: 'Unknown error' };
  };

  const uploadPostImage = async (
    supabaseClient: ReturnType<typeof createClient>,
    userId: string,
    file: File
  ): Promise<string> => {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `posts/${userId}/${Date.now()}.${ext}`;

    const { error } = await supabaseClient.storage
      .from(POST_IMAGES_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });

    if (error) {
      console.error('Image upload error:', error);
      const { status, message } = getSupabaseErrorMeta(error);

      if (status === 404 || /Bucket/i.test(message) || /not found/i.test(message)) {
        throw new Error(
          `画像アップロード用のStorageバケット「${POST_IMAGES_BUCKET}」が見つかりません。SupabaseのStorageでバケットを作成してください。`
        );
      }
      if (/row-level security/i.test(message) || /RLS/i.test(message) || status === 403) {
        throw new Error(
          '画像アップロードの権限がありません（StorageのRLSポリシーが必要です）。SupabaseのStorageポリシー設定を行ってください。'
        );
      }

      throw new Error(`画像のアップロードに失敗しました: ${message}`);
    }

    const { data } = supabaseClient.storage.from(POST_IMAGES_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const resolveImageUrl = async (
    supabaseClient: ReturnType<typeof createClient>,
    userId: string,
    data: PostFormData
  ): Promise<string | null> => {
    if (data.imageFile) {
      return await uploadPostImage(supabaseClient, userId, data.imageFile);
    }
    return data.image_url ?? null;
  };

  const initialData = React.useMemo<Partial<PostFormData>>(() => {
    return {
      title: post.title,
      description: post.description ?? '',
      koji_type: post.koji_type,
      difficulty: post.difficulty ?? 'かんたん',
      ingredients: post.ingredients ?? [{ name: '', amount: '' }],
      steps: post.steps ?? [{ order: 1, description: '' }],
      image_url: post.image_url ?? null,
    };
  }, [post]);

  const handleSubmit = async (data: PostFormData) => {
    setIsSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert('編集するにはログインしてください');
        router.push(`/login?next=/posts/${post.id}/edit`);
        return;
      }

      const image_url = await resolveImageUrl(supabase, user.id, data);

      const updates = {
        title: data.title,
        description: data.description,
        koji_type: data.koji_type,
        difficulty: data.difficulty,
        ingredients: data.ingredients,
        steps: data.steps,
        image_url,
        is_public: true,
        is_ai_generated: post.is_ai_generated,
      } as const;

      await updatePostStrict(supabase, post.id, updates);

      // RAG: 公開更新をインデックス更新（失敗しても編集フローは止めない）
      fetch('/api/rag/index-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id }),
      }).catch(() => {});

      alert('更新しました！');
      router.push(`/posts/${post.id}`);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : '更新に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[375px] mx-auto relative min-h-screen flex flex-col">
        <AppBar
          title="レシピ編集"
          leftAction={
            <button
              onClick={() => router.back()}
              className="h-[44px] w-[44px] flex items-center justify-center rounded-md hover:bg-muted transition-colors"
              aria-label="戻る"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          }
        />

        <main className="flex-1 overflow-y-auto pb-20">
          <PostForm
            initialData={initialData}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitLabel="更新する"
            submittingLabel="更新中..."
          />
        </main>
      </div>
    </div>
  );
}


