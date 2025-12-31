// レシピ生成API Route

import { NextRequest, NextResponse } from 'next/server';
import { generateJSON } from '@/lib/gemini/client';
import { createRecipePrompt, type RecipeGenerationInput, type GeneratedRecipe } from '@/lib/gemini/prompts';
import { searchEvidence, type EvidenceItem } from '@/lib/rag';

export const runtime = 'nodejs';

function formatEvidenceForPrompt(evidence: EvidenceItem[]): string {
  if (!Array.isArray(evidence) || evidence.length === 0) return '';
  const lines = evidence.map((e) => {
    const head = `[${e.sourceType}:${e.sourceId}#${e.chunkIndex}${e.title ? ` ${e.title}` : ''}]`;
    return `- ${head} ${e.content}`;
  });
  return [
    '## 参考（エビデンス）',
    '以下は過去のレシピ例/注意点の抜粋です。矛盾しないように参考にしてください（そのまま引用する必要はありません）。',
    ...lines,
  ].join('\n');
}

export async function POST(request: NextRequest) {
  try {
    // リクエストボディを取得
    const body = await request.json() as RecipeGenerationInput;

    // バリデーション
    if (!body.kojiType) {
      return NextResponse.json(
        { error: '麹の種類を指定してください' },
        { status: 400 }
      );
    }

    // プロンプトを生成（RAGで根拠を注入）
    let evidenceBlock = '';
    try {
      const q = [body.kojiType, body.additionalRequirements || body.difficulty || ''].filter(Boolean).join(' ');
      const evidence = await searchEvidence({ query: q, topK: 6, sourceTypes: ['corpus', 'post'] });
      evidenceBlock = formatEvidenceForPrompt(evidence);
    } catch (e) {
      // RAG未設定でも生成が壊れないようにする
      evidenceBlock = '';
    }

    const prompt = evidenceBlock ? `${evidenceBlock}\n\n${createRecipePrompt(body)}` : createRecipePrompt(body);

    // Gemini APIでレシピを生成
    const recipe = await generateJSON<GeneratedRecipe>(prompt);

    // レスポンスを返す
    return NextResponse.json({
      success: true,
      recipe,
    });

  } catch (error: any) {
    console.error('Error in /api/generate-recipe:', error);
    
    return NextResponse.json(
      { 
        error: 'レシピの生成に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error',
        errorType: error?.constructor?.name,
      },
      { status: 500 }
    );
  }
}

