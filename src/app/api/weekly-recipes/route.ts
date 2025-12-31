import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/gemini/client';

// キャッシュ用の変数（サーバーサイドで保持）
let cachedWeeklyRecipes: WeeklyRecipeResult | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1時間
let aiRefreshPromise: Promise<void> | null = null;

interface WeeklyRecipeResult {
  recipes: Array<{
    id: string;
    day: string;
    title: string;
    image: string | null;
  }>;
  generatedAt: string;
}

interface AISelectionResponse {
  selectedIds: string[];
  reason: string;
}

const DAYS = ['月', '火', '水', '木', '金', '土', '日'];

type PostRow = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  koji_type: string | null;
  ingredients: any;
  created_at: string;
  view_count: number | null;
};

function jsonWithCache(body: any, cached: boolean) {
  // ブラウザは短め、CDN/プロキシは長めにキャッシュしつつ、古いレスポンスで即応答できるようにする
  return NextResponse.json(body, {
    headers: {
      'Cache-Control': cached
        ? 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'
        : 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

function buildFallback(posts: PostRow[]): WeeklyRecipeResult {
  // 体感速度優先: AI待ちをせず、人気(PV)を優先しつつ麹タイプの偏りを避けて7件選ぶ
  const sorted = [...posts].sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
  const picked: PostRow[] = [];
  const pickedIds = new Set<string>();
  const byKoji = new Map<string, number>();

  // まずは麹タイプごとに1つずつ拾う
  for (const p of sorted) {
    if (picked.length >= 7) break;
    if (pickedIds.has(p.id)) continue;
    const k = (p.koji_type || '不明').trim();
    if ((byKoji.get(k) || 0) >= 1) continue;
    picked.push(p);
    pickedIds.add(p.id);
    byKoji.set(k, (byKoji.get(k) || 0) + 1);
  }

  // 残りは人気順で補完
  for (const p of sorted) {
    if (picked.length >= 7) break;
    if (pickedIds.has(p.id)) continue;
    picked.push(p);
    pickedIds.add(p.id);
  }

  return {
    recipes: picked.slice(0, 7).map((post, index) => ({
      id: post.id,
      day: DAYS[index] || '他',
      title: post.title,
      image: post.image_url,
    })),
    generatedAt: new Date().toISOString(),
  };
}

async function computeAiAndCache(posts: PostRow[]) {
  try {
    const currentMonth = new Date().getMonth() + 1;
    const seasonText =
      currentMonth >= 3 && currentMonth <= 5 ? '春' :
      currentMonth >= 6 && currentMonth <= 8 ? '夏' :
      currentMonth >= 9 && currentMonth <= 11 ? '秋' : '冬';

    const recipeList = posts
      .map(
        (p, i) =>
          `${i + 1}. ID:${p.id} | ${p.title} | 麹:${p.koji_type || '不明'} | 材料:${(p.ingredients || []).slice?.(0, 3)?.join?.(',') ?? ''} | PV:${p.view_count || 0}`
      )
      .join('\n');

    const prompt = `あなたは麹レシピアプリの「今週のおすすめ」を選定するAIです。

以下のレシピリストから、今週のおすすめとして7品を選んでください。

【選定基準】
- ${seasonText}の旬を意識した料理
- 麹の種類（コンソメこうじ、中華こうじ、たまねぎこうじ）のバランス
- 和・洋・中など料理ジャンルの多様性
- 週末（土日）はちょっと特別な料理を
- 人気度（PV数）も参考に

【レシピリスト】
${recipeList}

【出力形式】
以下のJSON形式で出力してください。selectedIdsには選んだレシピのIDを月〜日の順で7つ指定してください。

\`\`\`json
{
  "selectedIds": ["id1", "id2", "id3", "id4", "id5", "id6", "id7"],
  "reason": "選定理由の簡潔な説明"
}
\`\`\``;

    const aiResponse = await generateJSON<AISelectionResponse>(prompt);
    const selected = aiResponse.selectedIds
      .filter((id) => typeof id === 'string')
      .map((id) => posts.find((p) => p.id === id))
      .filter(Boolean) as PostRow[];

    const pickedIds = new Set(selected.map((p) => p.id));
    const remaining = posts.filter((p) => !pickedIds.has(p.id));
    const finalPosts = [...selected, ...remaining].slice(0, 7);

    cachedWeeklyRecipes = {
      recipes: finalPosts.map((post, index) => ({
        id: post.id,
        day: DAYS[index],
        title: post.title,
        image: post.image_url,
      })),
      generatedAt: new Date().toISOString(),
    };
    cacheTimestamp = Date.now();
  } catch (e) {
    // AI失敗時はキャッシュを更新しない（フォールバック表示は既に返している）
    console.error('AI selection failed (background):', e);
  } finally {
    aiRefreshPromise = null;
  }
}

export async function GET() {
  try {
    // キャッシュが有効な場合はキャッシュを返す
    const now = Date.now();
    if (cachedWeeklyRecipes && (now - cacheTimestamp) < CACHE_DURATION_MS) {
      return jsonWithCache({
        ...cachedWeeklyRecipes,
        cached: true,
        source: 'ai',
      }, true);
    }

    const supabase = await createClient();

    // データベースから直近の公開レシピを取得（最大30件）
    const { data: postsRaw, error } = await supabase
      .from('posts')
      .select('id, title, description, image_url, koji_type, ingredients, created_at, view_count')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Error fetching posts for weekly recipes:', error);
      return NextResponse.json(
        { error: 'レシピの取得に失敗しました' },
        { status: 500 }
      );
    }

    const posts = (postsRaw || []) as PostRow[];
    // レシピが少ない場合は即返す（そのままキャッシュ）
    if (!posts || posts.length < 7) {
      const result = buildFallback(posts || []);
      cachedWeeklyRecipes = result;
      cacheTimestamp = now;
      return jsonWithCache({ ...result, cached: false, source: 'fallback' }, false);
    }

    // まずは高速フォールバックを即返す（AI待ちをしない）
    const fallback = buildFallback(posts);
    // フォールバックもキャッシュ（とりあえず即表示できる状態を作る）
    cachedWeeklyRecipes = fallback;
    cacheTimestamp = now;

    // 裏でAI選定を走らせてキャッシュを更新（次回以降はAIが即表示）
    if (!aiRefreshPromise) {
      aiRefreshPromise = computeAiAndCache(posts);
    }

    return jsonWithCache(
      {
        ...fallback,
        cached: false,
        source: 'fallback',
        refreshInBackground: true,
      },
      false
    );

  } catch (error) {
    console.error('Error in weekly-recipes API:', error);
    return NextResponse.json(
      { error: '週間レシピの取得に失敗しました' },
      { status: 500 }
    );
  }
}

// キャッシュを強制的にクリアするエンドポイント（管理用）
export async function POST() {
  cachedWeeklyRecipes = null;
  cacheTimestamp = 0;
  aiRefreshPromise = null;
  return NextResponse.json({ message: 'Cache cleared' });
}

