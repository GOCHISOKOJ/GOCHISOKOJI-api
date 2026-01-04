import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { indexPostById } from '@/lib/rag';

export const runtime = 'nodejs';

type Body = { postId: string };

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    const postId = String(body?.postId ?? '').trim();
    if (!postId) {
      return NextResponse.json({ error: 'postId が必要です' }, { status: 400 });
    }

    // 所有者チェック（RLSがある前提で、念のためuser_id一致も確認）
    const { data: post, error } = await supabase.from('posts').select('id,user_id,is_public').eq('id', postId).single();
    if (error || !post) {
      return NextResponse.json({ error: '投稿が見つかりません' }, { status: 404 });
    }
    if (post.user_id !== user.id) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    const result = await indexPostById(postId);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error('RAG index post error:', e);
    return NextResponse.json(
      { error: '投稿のインデックス更新に失敗しました', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


