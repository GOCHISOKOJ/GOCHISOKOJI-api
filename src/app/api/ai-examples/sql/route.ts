import { NextResponse } from 'next/server';

const SETUP_SQL = `-- 例文（メニュー）管理テーブル
create table if not exists public.ai_examples (
  id uuid primary key default gen_random_uuid(),
  koji_type text not null,
  text text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at を自動更新
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_ai_examples_updated_at on public.ai_examples;
create trigger set_ai_examples_updated_at
before update on public.ai_examples
for each row execute procedure public.set_updated_at();

-- RLS
alter table public.ai_examples enable row level security;

-- 読み取りは全員OK（例文表示のため）
drop policy if exists "Anyone can read ai_examples" on public.ai_examples;
create policy "Anyone can read ai_examples"
on public.ai_examples
for select
to public
using (true);
`;

const SEED_CHUKA_SQL = `insert into public.ai_examples (koji_type, text) values
('中華麹', '中華麹で作る、鶏むねのよだれ鶏。鶏むねをしっとり茹でて裂き、きゅうりと一緒に盛る。タレは中華麹＋酢＋ごま油＋ラー油＋にんにく＋白ごま。辛さはラー油で調整したい。'),
('中華麹', '中華麹でもやしナムル。もやしをさっと茹でて水気を切り、中華麹＋ごま油＋白ごま＋こしょうで和える。にらや人参を少し入れてもいい。作り置きできるように日持ちの目安も知りたい。'),
('中華麹', '中華麹の麻婆なす。なすをごま油で焼いて、ひき肉と豆板醤を炒め、中華麹で旨みを足してとろみをつける。辛さ控えめにして子どもも食べられる味にしたい。');
`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = (searchParams.get('kind') ?? 'setup').trim();
  const sql = kind === 'seed_chuka' ? SEED_CHUKA_SQL : SETUP_SQL;

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/35dd2980-78af-40fd-a649-80906759f95d', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'sql-copy',
      hypothesisId: 'E',
      location: 'src/app/api/ai-examples/sql/route.ts',
      message: 'SQL endpoint accessed',
      data: { kind },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return new NextResponse(sql, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}



