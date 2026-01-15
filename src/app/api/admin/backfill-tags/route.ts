import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateDetailedNutrition } from '@/lib/nutrition/calculator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// CORSヘッダー
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// タグ推定用のキーワードマッピング
const TAG_KEYWORDS: Record<string, string[]> = {
  // 食材タグ
  '肉': ['肉', '鶏', '豚', '牛', 'ひき肉', '鶏肉', '豚肉', '牛肉', 'ささみ', 'もも', 'むね', 'ロース', 'バラ', '手羽', '軟骨'],
  '魚': ['魚', '鮭', '鯖', 'さば', 'さけ', 'マグロ', 'まぐろ', 'ツナ', '鯛', 'たい', 'ブリ', 'ぶり', 'しらす', 'エビ', 'えび', 'イカ', 'いか', 'タコ', 'たこ', 'アジ', 'あじ', 'サンマ', 'さんま', 'ししゃも', 'あさり', 'しじみ', '貝'],
  '卵': ['卵', 'たまご', 'タマゴ'],
  '野菜': ['野菜', 'キャベツ', '白菜', 'ほうれん草', '小松菜', 'ニラ', 'もやし', 'なす', 'ナス', 'ピーマン', 'パプリカ', 'トマト', 'きゅうり', 'レタス', 'ブロッコリー', 'アスパラ', 'にんじん', '大根', 'ごぼう', 'れんこん', 'じゃがいも', 'さつまいも', '里芋', 'かぼちゃ', 'たまねぎ', '玉ねぎ', 'ねぎ', 'にんにく', '生姜', 'しょうが'],
  '豆腐': ['豆腐', 'とうふ', '厚揚げ', '油揚げ', '高野豆腐'],
  // スタイルタグ
  '時短': ['5分', '10分', '簡単', 'パパッと', 'すぐできる', 'レンジ', 'レンチン'],
  '作り置き': ['作り置き', '保存', '日持ち', '常備菜', 'ストック'],
  'おつまみ': ['おつまみ', 'ビール', '酒', 'つまみ'],
  // ダイエットタグ
  'ダイエット': ['ダイエット', 'ヘルシー', '低カロリー', '低糖質', '糖質オフ'],
  '低糖質': ['低糖質', '糖質オフ', '糖質制限'],
};

// 料理タイプ推定用
const DISH_TYPE_KEYWORDS: Record<string, string[]> = {
  '主菜': ['メイン', '主菜', 'おかず', '焼き', '炒め', 'ソテー', 'ステーキ'],
  '副菜': ['副菜', 'サブ', '付け合わせ', '小鉢'],
  'スープ': ['スープ', '汁', '味噌汁', 'みそ汁', 'ポタージュ'],
  'サラダ': ['サラダ', 'マリネ', 'カルパッチョ'],
};

/**
 * 投稿内容からタグを推定
 */
function inferTags(
  title: string,
  description: string | null,
  ingredients: any[] | null,
  steps: any[] | null,
  kojiType: string | null
): string[] {
  const tags: Set<string> = new Set();
  
  // 検索対象のテキストを結合
  const ingredientNames = (ingredients || []).map((i: any) => {
    if (typeof i === 'string') return i;
    return i?.name || '';
  }).join(' ');
  
  const stepsText = (steps || []).map((s: any) => {
    if (typeof s === 'string') return s;
    return s?.description || s?.text || '';
  }).join(' ');
  
  const searchText = `${title} ${description || ''} ${ingredientNames} ${stepsText}`.toLowerCase();
  
  // 食材タグとスタイルタグを推定
  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        tags.add(tag);
        break;
      }
    }
  }
  
  // 料理タイプを推定
  for (const [type, keywords] of Object.entries(DISH_TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        tags.add(type);
        break;
      }
    }
  }
  
  // 麹タイプから追加タグ
  if (kojiType) {
    if (kojiType.includes('旨塩') || kojiType.includes('たまねぎ')) {
      tags.add('旨塩');
    } else if (kojiType.includes('コンソメ')) {
      tags.add('コンソメ');
    } else if (kojiType.includes('中華')) {
      tags.add('中華');
    }
  }
  
  return Array.from(tags);
}

// OPTIONS (preflight)
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// 管理者用：過去投稿のタグ・栄養情報を一括更新
export async function POST(request: NextRequest) {
  try {
    console.log('[backfill-tags] API called');
    
    // 管理者認証（簡易的にシークレットキーで認証）
    const authHeader = request.headers.get('Authorization');
    const adminSecret = process.env.ADMIN_SECRET_KEY;
    
    if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }
    
    // リクエストパラメータ
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // デフォルトはドライラン
    const limit = body.limit || 100; // 一度に処理する件数
    const offset = body.offset || 0;
    
    // Service Role Keyを使用した管理者クライアントを作成
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    
    // 更新対象のフィールドを指定（デフォルトはタグと栄養情報のみ）
    const updateDescription = body.updateDescription === true;
    
    // 投稿を取得（updateDescriptionの場合は全投稿、それ以外はタグ・栄養情報が空の投稿）
    let query = adminSupabase
      .from('posts')
      .select('id, title, description, ingredients, steps, koji_type, tags, calories, salt_g, cooking_time_min')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (!updateDescription) {
      query = query.or('tags.is.null,calories.is.null,salt_g.is.null,cooking_time_min.is.null');
    }
    
    const { data: posts, error: fetchError } = await query;
    
    if (fetchError) {
      console.error('[backfill-tags] Fetch error:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch posts: ' + fetchError.message },
        { status: 500, headers: corsHeaders }
      );
    }
    
    console.log(`[backfill-tags] Found ${posts?.length || 0} posts to process`);
    
    const results: Array<{
      id: string;
      title: string;
      tags: string[];
      calories: number;
      salt_g: number;
      cooking_time_min: number;
      description?: string;
      updated: boolean;
    }> = [];
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const post of posts || []) {
      try {
        // タグを推定
        const inferredTags = inferTags(
          post.title,
          post.description,
          post.ingredients,
          post.steps,
          post.koji_type
        );
        
        // 栄養情報を計算
        const ingredientList = (post.ingredients || []).map((i: any) => {
          if (typeof i === 'string') return { name: i };
          return { name: i?.name || '', amount: i?.amount };
        });
        
        const nutrition = calculateDetailedNutrition(
          ingredientList,
          post.koji_type,
          (post.steps || []).map((s: any) => {
            if (typeof s === 'string') return s;
            return s?.description || s?.text || '';
          })
        );
        
        // 更新データを構築
        const updateData: Record<string, any> = {};
        
        // タグが空なら推定タグを設定
        if (!post.tags || post.tags.length === 0) {
          updateData.tags = inferredTags;
        }
        
        // 栄養情報が空なら計算値を設定
        if (post.calories === null) {
          updateData.calories = nutrition.caloriesKcal;
        }
        if (post.salt_g === null) {
          updateData.salt_g = nutrition.saltG;
        }
        if (post.cooking_time_min === null) {
          updateData.cooking_time_min = nutrition.timeMinutes;
        }
        
        // descriptionを材料名から生成（updateDescriptionオプションが有効な場合）
        if (updateDescription) {
          const ingredientNames = (post.ingredients || [])
            .map((i: any) => {
              if (typeof i === 'string') return i.trim();
              return (i?.name || '').trim();
            })
            .filter(Boolean);
          
          if (ingredientNames.length > 0) {
            updateData.description = ingredientNames.join('、');
          }
        }
        
        results.push({
          id: post.id,
          title: post.title,
          tags: updateData.tags || post.tags || [],
          calories: updateData.calories ?? post.calories,
          salt_g: updateData.salt_g ?? post.salt_g,
          cooking_time_min: updateData.cooking_time_min ?? post.cooking_time_min,
          description: updateData.description || post.description,
          updated: Object.keys(updateData).length > 0,
        });
        
        // 実際に更新（ドライランでなければ）
        if (!dryRun && Object.keys(updateData).length > 0) {
          const { error: updateError } = await adminSupabase
            .from('posts')
            .update(updateData)
            .eq('id', post.id);
          
          if (updateError) {
            console.error(`[backfill-tags] Update error for ${post.id}:`, updateError);
            errorCount++;
          } else {
            updatedCount++;
          }
        }
      } catch (e: any) {
        console.error(`[backfill-tags] Error processing ${post.id}:`, e);
        errorCount++;
      }
    }
    
    return NextResponse.json({
      success: true,
      dryRun,
      totalProcessed: posts?.length || 0,
      updatedCount: dryRun ? 0 : updatedCount,
      errorCount,
      results,
    }, { headers: corsHeaders });
    
  } catch (e: any) {
    console.error('[backfill-tags] Error:', e);
    return NextResponse.json(
      { success: false, error: 'Server error: ' + e.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
