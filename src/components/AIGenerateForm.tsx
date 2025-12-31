'use client';

import React, { useState } from 'react';
import { Button } from './Button';
import { Sparkles, Loader2 } from 'lucide-react';
import type { GeneratedRecipe } from '@/lib/gemini/prompts';

interface AIGenerateFormProps {
  onRecipeGenerated: (recipe: GeneratedRecipe) => void;
}

export function AIGenerateForm({ onRecipeGenerated }: AIGenerateFormProps) {
  const [kojiType, setKojiType] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [additionalRequirements, setAdditionalRequirements] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const kojiTypes = ['中華風こうじ調味料', 'コンソメ風こうじ調味料', '旨塩風こうじ調味料'];
  const difficulties = ['かんたん', 'ふつう', 'むずかしい'];

  const handleGenerate = async () => {
    if (!kojiType) {
      setError('麹の種類を選択してください');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const response = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kojiType,
          difficulty: difficulty || undefined,
          additionalRequirements: additionalRequirements || undefined,
        }),
      });

      if (!response.ok) {
        let message = 'レシピ生成に失敗しました';
        try {
          const errorData = await response.json();
          message = errorData?.error || errorData?.details || message;
        } catch {
          // ignore non-json
        }
        throw new Error(message);
      }

      const data = await response.json();
      onRecipeGenerated(data.recipe);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'レシピ生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">AIレシピ生成</h2>
        <p className="text-muted-foreground">
          条件を選択して、AIに麹レシピを生成してもらいましょう
        </p>
      </div>

      {/* 麹の種類 */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          麹の種類 <span className="text-destructive">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {kojiTypes.map((type) => (
            <button
              key={type}
              onClick={() => setKojiType(type)}
              className={`p-3 rounded-lg border-2 transition-all ${
                kojiType === type
                  ? 'border-primary bg-primary/5 text-primary font-medium'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* 難易度 */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          難易度（任意）
        </label>
        <div className="grid grid-cols-3 gap-2">
          {difficulties.map((level) => (
            <button
              key={level}
              onClick={() => setDifficulty(difficulty === level ? '' : level)}
              className={`p-3 rounded-lg border-2 transition-all ${
                difficulty === level
                  ? 'border-primary bg-primary/5 text-primary font-medium'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* その他の要望 */}
      <div className="space-y-2">
        <label htmlFor="requirements" className="block text-sm font-medium">
          その他の要望（任意）
        </label>
        <textarea
          id="requirements"
          value={additionalRequirements}
          onChange={(e) => setAdditionalRequirements(e.target.value)}
          placeholder="例: 子供でも食べやすい味付けにしてほしい、保存期間を長くしたい、など"
          className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
          rows={3}
        />
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* 生成ボタン */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || !kojiType}
        size="lg"
        className="w-full"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            レシピを生成中...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 mr-2" />
            レシピを生成する
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        生成には10〜30秒程度かかります
      </p>
    </div>
  );
}

