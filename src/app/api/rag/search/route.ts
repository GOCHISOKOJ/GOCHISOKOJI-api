import { NextRequest, NextResponse } from 'next/server';
import { searchEvidence } from '@/lib/rag';

export const runtime = 'nodejs';

type Body = {
  query: string;
  topK?: number;
  sourceTypes?: Array<'corpus' | 'post'>;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;
    const query = String(body?.query ?? '').trim();
    if (!query) {
      return NextResponse.json({ error: 'query が必要です' }, { status: 400 });
    }

    const evidence = await searchEvidence({
      query,
      topK: typeof body?.topK === 'number' ? body!.topK : undefined,
      sourceTypes: Array.isArray(body?.sourceTypes) ? body!.sourceTypes : undefined,
    });

    return NextResponse.json({ ok: true, evidence });
  } catch (e) {
    console.error('RAG search error:', e);
    return NextResponse.json(
      { error: 'RAG検索に失敗しました', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


