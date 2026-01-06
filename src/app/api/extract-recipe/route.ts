// 会話からレシピを抽出するAPI
import { NextRequest, NextResponse } from 'next/server';
import { generateJSON } from '@/lib/gemini/client';

export const runtime = 'nodejs';

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
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ExtractRecipeRequest;

    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: '会話履歴が必要です' },
        { status: 400 }
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
1. ユーザーが提供したレシピ情報（料理名、材料、作り方など）を見つけてください
2. 以下のJSON形式で整形して出力してください
3. ユーザーが書いた内容をできるだけ忠実に抽出してください（勝手に変更しない）
4. 足りない情報は推測で補完してください

【麹タイプの判定】
- 「コンソメ麹」「コンソメこうじ」「コンソメ風」→ "コンソメこうじ"
- 「中華麹」「中華こうじ」「中華風」→ "中華こうじ"
- 「旨塩麹」「旨塩こうじ」「旨塩風」「玉ねぎ麹」「たまねぎこうじ」→ "たまねぎこうじ"
- 不明な場合 → "たまねぎこうじ"

【出力形式】
{
  "title": "料理名",
  "description": "料理の説明（1-2文）",
  "koji_type": "コンソメこうじ/中華こうじ/たまねぎこうじのいずれか",
  "difficulty": "かんたん/ふつう/むずかしいのいずれか",
  "ingredients": [
    { "name": "材料名", "amount": "分量" }
  ],
  "steps": [
    { "order": 1, "description": "手順の説明" }
  ],
  "tips": "コツやポイント（あれば）"
}

【重要】
- JSONのみを出力してください（説明文不要）
- 必ず有効なJSONを出力してください
`.trim();

    // Gemini APIでレシピを抽出
    const recipe = await generateJSON<ExtractedRecipe>(prompt);

    // レスポンスを返す
    return NextResponse.json({
      success: true,
      recipe,
    });

  } catch (error: any) {
    console.error('Error in /api/extract-recipe:', error);
    
    return NextResponse.json(
      { 
        error: 'レシピの抽出に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

