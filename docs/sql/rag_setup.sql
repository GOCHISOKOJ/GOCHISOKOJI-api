-- RAG (recipe_corpus.md + posts) setup for Supabase/Postgres
-- Run this in Supabase Dashboard -> SQL Editor -> Run

-- 1) Extensions
create extension if not exists pgcrypto;
create extension if not exists vector;

-- 2) Embeddings table
-- - source_type: 'corpus' | 'post'
-- - source_id: corpus = 'docs/recipe_corpus.md', post = posts.id (uuid as text)
-- - chunk_index: chunk number within the source_id
create table if not exists public.recipe_embeddings (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('corpus', 'post')),
  source_id text not null,
  chunk_index int not null default 0,

  title text,
  content text not null,
  content_hash text not null,
  metadata jsonb not null default '{}'::jsonb,

  -- NOTE: vector dimension assumes Gemini text-embedding-004 (768 dims)
  embedding vector(768) not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (source_type, source_id, chunk_index)
);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_recipe_embeddings_set_updated_at on public.recipe_embeddings;
create trigger trg_recipe_embeddings_set_updated_at
before update on public.recipe_embeddings
for each row execute function public.set_updated_at();

-- 3) Index for fast similarity search
-- NOTE: ivfflat requires ANALYZE and works best after some data exists.
create index if not exists recipe_embeddings_embedding_ivfflat
on public.recipe_embeddings using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create index if not exists recipe_embeddings_source_idx
on public.recipe_embeddings (source_type, source_id, chunk_index);

-- 4) RLS: only service role should access by default (service role bypasses RLS)
alter table public.recipe_embeddings enable row level security;

-- 5) Search RPC (cosine similarity)
create or replace function public.match_recipe_embeddings(
  query_embedding vector(768),
  match_count int default 8,
  source_types text[] default null
)
returns table (
  id uuid,
  source_type text,
  source_id text,
  chunk_index int,
  title text,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    e.id,
    e.source_type,
    e.source_id,
    e.chunk_index,
    e.title,
    e.content,
    e.metadata,
    (1 - (e.embedding <=> query_embedding)) as similarity
  from public.recipe_embeddings e
  where (source_types is null or e.source_type = any(source_types))
  order by e.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

-- 6) Permissions: restrict to service_role only
revoke all on table public.recipe_embeddings from public;
revoke all on function public.match_recipe_embeddings(vector(768), int, text[]) from public;

grant all on table public.recipe_embeddings to service_role;
grant execute on function public.match_recipe_embeddings(vector(768), int, text[]) to service_role;


