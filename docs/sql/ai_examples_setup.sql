-- 例文（メニュー）管理テーブル
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





