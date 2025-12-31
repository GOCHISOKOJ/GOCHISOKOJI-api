import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import config from '@/config/ai-examples.json';

type Example = {
  id: string;
  kojiType: string;
  text: string;
};

function getIsoWeekKey(d: Date): string {
  // ISO week date algorithm (returns a stable weekly key like "2025-W51")
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const year = date.getUTCFullYear();
  return `${year}-W${String(weekNo).padStart(2, '0')}`;
}

function pickWeekly(examples: Example[], now: Date): Example | null {
  if (examples.length === 0) return null;
  const key = getIsoWeekKey(now);
  // simple deterministic hash
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return examples[h % examples.length] ?? null;
}

async function loadExamplesFromSupabase(kojiType: string): Promise<Example[] | null> {
  try {
    const supabase = await createClient();
    const query = supabase
      .from('ai_examples')
      .select('id,koji_type,text,is_active,created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    const { data, error } = kojiType ? await query.eq('koji_type', kojiType) : await query;
    if (error) {
      console.error('[ai-examples] supabase error:', error);
      return null;
    }

    return (data ?? []).map((r: any) => ({
      id: String(r.id),
      kojiType: String(r.koji_type),
      text: String(r.text),
    }));
  } catch (e) {
    console.error('[ai-examples] supabase unexpected error:', e);
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kojiType = (searchParams.get('kojiType') ?? '').trim();

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/35dd2980-78af-40fd-a649-80906759f95d', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'sql-copy',
      hypothesisId: 'E',
      location: 'src/app/api/ai-examples/route.ts',
      message: 'ai-examples GET',
      data: { kojiType: kojiType || null },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const rotation = 'weekly';
  const fromDb = await loadExamplesFromSupabase(kojiType);
  const dbExamples = fromDb ?? [];

  // フォールバック: Supabase未設定/未作成でも画面が壊れないようにする
  const fromConfig = ((config as any)?.examples as Example[] | undefined) ?? [];
  const configExamples = fromConfig
    .filter((e) => (kojiType ? (e as any).kojiType === kojiType : true))
    .map((e: any) => ({ id: e.id, kojiType: e.kojiType, text: e.text })) as Example[];

  const candidates = dbExamples.length > 0 ? dbExamples : configExamples;
  const now = new Date();

  const chosen = pickWeekly(candidates, now);
  const source = dbExamples.length > 0 ? 'supabase' : 'config';

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/35dd2980-78af-40fd-a649-80906759f95d', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'sql-copy',
      hypothesisId: 'E',
      location: 'src/app/api/ai-examples/route.ts',
      message: 'ai-examples response',
      data: {
        source,
        candidatesCount: candidates.length,
        chosenId: chosen?.id ?? null,
        chosenKojiType: chosen?.kojiType ?? null,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return NextResponse.json({
    rotation,
    kojiType: kojiType || null,
    example: chosen ? { id: chosen.id, kojiType: chosen.kojiType, text: chosen.text } : null,
    source,
  });
}


