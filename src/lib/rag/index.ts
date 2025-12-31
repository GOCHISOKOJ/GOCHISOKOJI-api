import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { embedText } from '@/lib/gemini/client';
import { createAdminClient } from '@/lib/supabase/admin';

type SourceType = 'corpus' | 'post';

export type EvidenceItem = {
  sourceType: SourceType;
  sourceId: string;
  chunkIndex: number;
  title: string | null;
  content: string;
  similarity: number;
  metadata: any;
};

const DEFAULT_MAX_CHARS = 1400;
const EXPECTED_EMBEDDING_DIM = 768;

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function toPgVector(vec: number[]): string {
  if (vec.length !== EXPECTED_EMBEDDING_DIM) {
    throw new Error(`Embedding dim mismatch: expected ${EXPECTED_EMBEDDING_DIM}, got ${vec.length}`);
  }
  // PostgREST pgvector accepts vector literal like: [0.1,0.2,...]
  return `[${vec.join(',')}]`;
}

function clip(text: string, maxLen: number): string {
  const s = String(text ?? '').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}…`;
}

function normalizeNewlines(text: string): string {
  return String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function chunkByMaxChars(text: string, maxChars: number): string[] {
  const t = normalizeNewlines(text).trim();
  if (!t) return [];

  const lines = t.split('\n');
  const chunks: string[] = [];
  let buf: string[] = [];
  let len = 0;

  const flush = () => {
    const s = buf.join('\n').trim();
    if (s) chunks.push(s);
    buf = [];
    len = 0;
  };

  for (const line of lines) {
    const next = (buf.length ? '\n' : '') + line;
    if (len + next.length > maxChars && buf.length > 0) {
      flush();
    }
    buf.push(line);
    len += next.length;
  }
  flush();
  return chunks;
}

type MdChunk = { title: string | null; content: string };

function chunkMarkdownByHeadings(md: string, maxChars: number): MdChunk[] {
  const text = normalizeNewlines(md);
  const lines = text.split('\n');

  const chunks: MdChunk[] = [];
  let currentTitle: string | null = null;
  let sectionLines: string[] = [];

  const pushSection = () => {
    const sectionText = sectionLines.join('\n').trim();
    if (!sectionText) return;
    const split = chunkByMaxChars(sectionText, maxChars);
    for (const part of split) {
      chunks.push({ title: currentTitle, content: part });
    }
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.+)\s*$/);
    if (heading) {
      // flush previous section
      pushSection();
      sectionLines = [line];
      currentTitle = heading[2]?.trim() || null;
      continue;
    }
    sectionLines.push(line);
  }
  pushSection();

  // If no headings were found, fallback to chunk by max chars
  if (chunks.length === 0) {
    return chunkByMaxChars(text, maxChars).map((c) => ({ title: null, content: c }));
  }
  return chunks;
}

async function getExistingHashes(sourceType: SourceType, sourceId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('recipe_embeddings')
    .select('chunk_index,content_hash')
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .order('chunk_index', { ascending: true });

  if (error) throw new Error(error.message);
  const map = new Map<number, string>();
  for (const row of (data || []) as any[]) {
    map.set(Number(row.chunk_index), String(row.content_hash));
  }
  return map;
}

async function deleteChunksNotInRange(sourceType: SourceType, sourceId: string, keepCount: number) {
  const admin = createAdminClient();
  // delete chunks with chunk_index >= keepCount
  const { error } = await admin
    .from('recipe_embeddings')
    .delete()
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .gte('chunk_index', keepCount);
  if (error) throw new Error(error.message);
}

async function upsertChunks(params: {
  sourceType: SourceType;
  sourceId: string;
  chunks: Array<{ title: string | null; content: string; metadata?: any }>;
}) {
  const { sourceType, sourceId, chunks } = params;
  const admin = createAdminClient();
  const existing = await getExistingHashes(sourceType, sourceId);

  let embedded = 0;
  let skipped = 0;

  const rowsToUpsert: any[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const content = c.content.trim();
    if (!content) continue;
    const contentHash = sha256(content);
    const prevHash = existing.get(i);

    if (prevHash === contentHash) {
      skipped++;
      continue;
    }

    const vec = await embedText(content, {
      taskType: 'RETRIEVAL_DOCUMENT',
      title: c.title ?? undefined,
    });
    embedded++;

    rowsToUpsert.push({
      source_type: sourceType,
      source_id: sourceId,
      chunk_index: i,
      title: c.title,
      content,
      content_hash: contentHash,
      metadata: c.metadata ?? {},
      embedding: toPgVector(vec),
    });
  }

  if (rowsToUpsert.length > 0) {
    const { error } = await admin
      .from('recipe_embeddings')
      .upsert(rowsToUpsert, { onConflict: 'source_type,source_id,chunk_index' });
    if (error) throw new Error(error.message);
  }

  // Remove trailing old chunks if the new chunk count is smaller
  await deleteChunksNotInRange(sourceType, sourceId, chunks.length);

  return { embedded, skipped, total: chunks.length };
}

export async function indexCorpus(options?: { maxChars?: number }) {
  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;
  const filePath = path.join(process.cwd(), 'docs', 'recipe_corpus.md');
  const md = await fs.readFile(filePath, 'utf8');
  const chunks = chunkMarkdownByHeadings(md, maxChars).map((c) => ({
    title: c.title,
    content: c.content,
    metadata: {
      kind: 'corpus',
      path: 'docs/recipe_corpus.md',
      title: c.title,
    },
  }));

  return await upsertChunks({
    sourceType: 'corpus',
    sourceId: 'docs/recipe_corpus.md',
    chunks,
  });
}

function normalizePostToText(post: any): { title: string; text: string; kojiType: string | null } {
  const title = String(post?.title || '').trim();
  const description = String(post?.description || '').trim();
  const kojiType = typeof post?.koji_type === 'string' ? post.koji_type : null;
  const ingredients = Array.isArray(post?.ingredients) ? post.ingredients : [];
  const steps = Array.isArray(post?.steps) ? post.steps : [];

  const ingLines = ingredients
    .map((i: any) => {
      const name = String(i?.name || '').trim();
      const amount = String(i?.amount || '').trim();
      if (!name) return '';
      return amount ? `- ${name}: ${amount}` : `- ${name}`;
    })
    .filter(Boolean)
    .join('\n');

  const stepLines = steps
    .map((s: any, idx: number) => {
      const d = String(s?.description || '').trim();
      if (!d) return '';
      return `${idx + 1}. ${d}`;
    })
    .filter(Boolean)
    .join('\n');

  const text = [
    title ? `タイトル: ${title}` : '',
    kojiType ? `麹: ${kojiType}` : '',
    description ? `説明: ${description}` : '',
    ingLines ? `材料:\n${ingLines}` : '',
    stepLines ? `手順:\n${stepLines}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .trim();

  return { title, text, kojiType };
}

export async function indexPostById(postId: string) {
  const admin = createAdminClient();
  const { data: post, error } = await admin
    .from('posts')
    .select('id,title,description,koji_type,ingredients,steps,is_public,updated_at')
    .eq('id', postId)
    .single();

  if (error) throw new Error(error.message);
  if (!post) throw new Error('post not found');

  const isPublic = !!(post as any).is_public;
  if (!isPublic) {
    // If the post is not public, remove its embeddings
    const { error: delErr } = await admin
      .from('recipe_embeddings')
      .delete()
      .eq('source_type', 'post')
      .eq('source_id', String(postId));
    if (delErr) throw new Error(delErr.message);
    return { embedded: 0, skipped: 0, total: 0, removed: true };
  }

  const norm = normalizePostToText(post);
  const parts = chunkByMaxChars(norm.text, DEFAULT_MAX_CHARS);
  const chunks = parts.map((c, idx) => ({
    title: norm.title,
    content: c,
    metadata: {
      kind: 'post',
      postId: String(postId),
      kojiType: norm.kojiType,
      chunk: idx,
      updatedAt: (post as any).updated_at,
    },
  }));

  const res = await upsertChunks({
    sourceType: 'post',
    sourceId: String(postId),
    chunks,
  });

  return { ...res, removed: false };
}

export async function searchEvidence(params: {
  query: string;
  topK?: number;
  sourceTypes?: SourceType[];
}) {
  const query = String(params.query ?? '').trim();
  if (!query) return [] as EvidenceItem[];

  const topK = typeof params.topK === 'number' && params.topK > 0 ? Math.min(params.topK, 12) : 6;
  const sourceTypes = Array.isArray(params.sourceTypes) && params.sourceTypes.length > 0 ? params.sourceTypes : (['corpus', 'post'] as SourceType[]);

  const admin = createAdminClient();
  const vec = await embedText(query, { taskType: 'RETRIEVAL_QUERY' });

  const { data, error } = await admin.rpc('match_recipe_embeddings', {
    query_embedding: toPgVector(vec),
    match_count: topK,
    source_types: sourceTypes,
  });

  if (error) throw new Error(error.message);

  const rows = (Array.isArray(data) ? data : []) as any[];
  return rows.map((r) => ({
    sourceType: r.source_type as SourceType,
    sourceId: String(r.source_id),
    chunkIndex: Number(r.chunk_index),
    title: r.title ?? null,
    content: clip(String(r.content ?? ''), 900),
    metadata: r.metadata ?? {},
    similarity: typeof r.similarity === 'number' ? r.similarity : Number(r.similarity),
  })) as EvidenceItem[];
}


