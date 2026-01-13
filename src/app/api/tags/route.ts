/**
 * タグ一覧API
 * DBにタグテーブルがある場合はDBから取得、ない場合はフォールバック
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// CORSヘッダー
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// CORS プリフライト対応
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// フォールバック用のハードコードタグ
const FALLBACK_TAGS = [
  // 食材系
  { id: 'fish', name: '魚', category: 'ingredient', emoji: '🐟', display_order: 10 },
  { id: 'meat', name: '肉', category: 'ingredient', emoji: '🍖', display_order: 11 },
  { id: 'egg', name: '卵', category: 'ingredient', emoji: '🥚', display_order: 12 },
  { id: 'vegetable', name: '野菜', category: 'ingredient', emoji: '🥬', display_order: 13 },
  // スタイル系
  { id: 'quick', name: '時短', category: 'style', emoji: '⚡', display_order: 20 },
  { id: 'meal-prep', name: '作り置き', category: 'style', emoji: '📦', display_order: 21 },
  { id: 'snack', name: 'おつまみ', category: 'style', emoji: '🍺', display_order: 22 },
  // ダイエット系
  { id: 'diet', name: 'ダイエット', category: 'diet', emoji: '🏃', display_order: 30 },
  { id: 'low-carb', name: '低糖質', category: 'diet', emoji: '🥗', display_order: 31 },
  // 料理タイプ
  { id: 'main', name: '主菜', category: 'dish_type', emoji: '🍳', display_order: 40 },
  { id: 'side', name: '副菜', category: 'dish_type', emoji: '🥒', display_order: 41 },
  { id: 'soup', name: 'スープ', category: 'dish_type', emoji: '🍲', display_order: 42 },
  { id: 'salad', name: 'サラダ', category: 'dish_type', emoji: '🥗', display_order: 43 },
];

interface Tag {
  id: string;
  name: string;
  category: string;
  emoji: string;
  display_order: number;
}

interface TagsByCategory {
  ingredient: Tag[];
  style: Tag[];
  diet: Tag[];
  dish_type: Tag[];
}

export async function GET() {
  try {
    // Supabaseクライアント作成
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let tags: Tag[] = [];
    let fromDb = false;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // DBからタグを取得
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, category, emoji, display_order')
        .order('display_order', { ascending: true });

      if (!error && data && data.length > 0) {
        tags = data;
        fromDb = true;
      }
    }

    // DBから取得できなかった場合はフォールバック
    if (tags.length === 0) {
      tags = FALLBACK_TAGS;
    }

    // カテゴリごとにグループ化
    const byCategory: TagsByCategory = {
      ingredient: [],
      style: [],
      diet: [],
      dish_type: [],
    };

    for (const tag of tags) {
      const category = tag.category as keyof TagsByCategory;
      if (byCategory[category]) {
        byCategory[category].push(tag);
      }
    }

    return NextResponse.json({
      success: true,
      tags,
      byCategory,
      fromDb,
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error in /api/tags:', error);
    
    // エラー時もフォールバックを返す
    const byCategory: TagsByCategory = {
      ingredient: FALLBACK_TAGS.filter(t => t.category === 'ingredient'),
      style: FALLBACK_TAGS.filter(t => t.category === 'style'),
      diet: FALLBACK_TAGS.filter(t => t.category === 'diet'),
      dish_type: FALLBACK_TAGS.filter(t => t.category === 'dish_type'),
    };

    return NextResponse.json({
      success: true,
      tags: FALLBACK_TAGS,
      byCategory,
      fromDb: false,
    }, { headers: corsHeaders });
  }
}
