import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { indexCorpus } from '@/lib/rag';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
    }

    const result = await indexCorpus();
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error('RAG index corpus error:', e);
    return NextResponse.json(
      { error: 'コーパスの再インデックスに失敗しました', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


