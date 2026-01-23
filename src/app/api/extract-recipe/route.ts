// 会話からレシピを抽出するAPI
import { NextRequest, NextResponse } from 'next/server';
import { generateJSON } from '@/lib/gemini/client';
import { calculateDetailedNutrition } from '@/lib/nutrition/calculator';

export const runtime = 'nodejs';

// CORSヘッダー
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// CORS プリフライト対応
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

interface ExtractRecipeRequest {
  messages: Array<{
    role: 'user' | 'ai';
    text: string;
  }>;
}

interface ExtractedRecipe {
  title: string;
  description: string;
  koji_type: string;
  difficulty: string;
  ingredients: Array<{ name: string; amount: string }>;
  steps: Array<{ order: number; description: string }>;
  tips?: string;
  // 栄養情報（AIが推定）
  calories?: number;
  salt_g?: number;
  cooking_time_min?: number;
  // タグ（材料から自動判定）
  tags?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ExtractRecipeRequest;

    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: '会話履歴が必要です' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 会話履歴をテキストに変換
    const conversationText = body.messages
      .map((m) => `${m.role === 'user' ? 'ユーザー' : 'AI'}: ${m.text}`)
      .join('\n\n');

    // プロンプト: 会話からレシピを抽出
    const prompt = `
あなたはレシピ抽出の専門家です。以下の会話履歴から、ユーザーが提供したレシピ情報を抽出してJSON形式で出力してください。

【会話履歴】
${conversationText}

【タスク】
1. 会話履歴からレシピ情報を見つけてください
2. 以下のJSON形式で整形して出力してください
3. **重要**: AIが生成した「📖説明」「💡コツ」がある場合は、一字一句変更せずにそのまま抽出してください
4. 足りない情報は推測で補完してください

【説明（description）の抽出ルール - 最重要】
1. AIの最終レシピに「📖説明:」または「📖説明」がある場合
   → その内容を参考に、50-80文字程度に要約（食べたくなる表現、誇張を抑える）
   → 要約のポイント:
     * 元の説明の良さを残しつつ、簡潔に
     * 「外はカリッと、中はほくほく」→「カリほく食感」のように自然に短縮
     * 過度な形容詞（「絶品」「究極」「止まらない美味しさ」など）は削除
     * 50-80文字を目安に
2. ない場合 → ユーザーのコメントから1-2文で作成

【コツ（tips）の抽出ルール - 最重要】
1. AIの最終レシピに「💡コツ:」または「💡コツ」がある場合
   → その内容を参考に、30-60文字程度に要約（具体的なテクニックを残す）
   → 要約のポイント:
     * 数値（「1cm厚さ」「弱火で3分」など）は必ず残す
     * 方法と効果（「〇〇することで△△に仕上がる」）は維持
     * 冗長な表現は短縮
2. ない場合 → ユーザーが書いたコツをそのまま使用
3. どちらもない場合のみ → 推測で作成

【絶対禁止】
- 「📖説明」「💡コツ」をそのまま全文コピーすること（長すぎる・誇張しすぎる）
- 重要な情報（食感、調理法、数値）を削除すること
→ 必ず要約しつつ、魅力的な表現を残すこと

【ユーザーのフォーマット例】
ユーザーは以下のような形式でレシピを送ってくることがあります：
- 【料理名】または（料理名）でタイトル
- (材料) または ■材料 で材料リスト開始
- (作り方) または ■作り方 で手順開始
- ①②③ または 1.2.3. で手順番号
- 「〇〇麹 大5」は「〇〇こうじ 大さじ5」と解釈

【麹タイプの判定】
- 「コンソメ麹」「コンソメこうじ」「コンソメ風」→ "コンソメ麹"
- 「中華麹」「中華こうじ」「中華風」→ "中華麹"
- 「旨塩麹」「旨塩こうじ」「旨塩風」「玉ねぎ麹」「たまねぎこうじ」→ "たまねぎ麹"
- 不明な場合 → "たまねぎ麹"

【難易度の判定】
- 炊飯器だけ、レンジだけ、混ぜるだけ → "かんたん"
- 3ステップ以下 → "かんたん"
- 4-6ステップ → "ふつう"
- 7ステップ以上、または複雑な調理 → "むずかしい"

【栄養情報の推定】
材料と調味料から以下を概算で推定してください：
- calories: 1人前のカロリー（kcal、100〜800程度）
- salt_g: 1人前の塩分（g、0.5〜3.0程度）
- cooking_time_min: 調理時間の目安（分、5〜60程度）

【タグの自動判定】
材料を見て、該当するタグをすべて選択してください（複数可）：
- 魚: 魚介類を使用
- 肉: 肉類を使用（鶏、豚、牛、ひき肉など）
- 卵: 卵を使用
- 野菜: 野菜がメインまたは多め
- 時短: 15分以内で作れる
- 作り置き: 保存がきく
- おつまみ: お酒に合う
- ダイエット: 低カロリー・ヘルシー
- 主菜: メインディッシュ
- 副菜: サブのおかず
- スープ: 汁物
- サラダ: サラダ系

【出力形式】
{
  "title": "料理名（【】は除去）",
  "description": "料理の説明（📖説明がある場合は50-80文字に要約、ない場合はユーザーのコメントから1-2文で作成）",
  "koji_type": "コンソメ麹/中華麹/たまねぎ麹のいずれか",
  "difficulty": "かんたん/ふつう/むずかしいのいずれか",
  "ingredients": [
    { "name": "材料名", "amount": "分量（大5→大さじ5に変換）" }
  ],
  "steps": [
    { "order": 1, "description": "手順の説明（①などの番号は除去）" }
  ],
  "tips": "コツやポイント（💡コツがある場合は30-60文字に要約、ない場合はユーザーが書いたものやレシピから推測）",
  "calories": 300,
  "salt_g": 1.5,
  "cooking_time_min": 15,
  "tags": ["肉", "主菜", "時短"]
}

【重要】
- JSONのみを出力してください（説明文不要）
- 必ず有効なJSONを出力してください
- 「📖説明」「💡コツ」がある場合は、その内容を要約して抽出すること（食べたくなる表現、誇張を抑える）
`.trim();

    // Gemini APIでレシピを抽出
    const recipe = await generateJSON<ExtractedRecipe>(prompt);

    // 統一された栄養計算ロジックで上書き（一貫性を担保）
    if (recipe && recipe.ingredients) {
      const nutrition = calculateDetailedNutrition(
        recipe.ingredients,
        recipe.koji_type,
        recipe.steps?.map(s => s.description)
      );
      
      // 計算結果で上書き（AIの推定より成分表ベースの計算を優先）
      recipe.calories = nutrition.caloriesKcal;
      recipe.salt_g = nutrition.saltG;
      recipe.cooking_time_min = nutrition.timeMinutes;
    }

    // レスポンスを返す
    return NextResponse.json({
      success: true,
      recipe,
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('Error in /api/extract-recipe:', error);
    
    return NextResponse.json(
      { 
        error: 'レシピの抽出に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}



