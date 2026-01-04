'use client';

import React from 'react';
import { Button } from '@/components/Button';
import { Plus, X, Camera } from 'lucide-react';
import type { Ingredient, Step } from '@/lib/types/database';

interface PostFormProps {
  onSubmit: (data: PostFormData) => Promise<void>;
  onSaveDraft?: (data: PostFormData) => Promise<void>;
  initialData?: Partial<PostFormData>;
  isSubmitting?: boolean;
  isSavingDraft?: boolean;
  submitLabel?: string;
  submittingLabel?: string;
}

export interface PostFormData {
  title: string;
  description: string;
  koji_type: string;
  difficulty: string;
  ingredients: Ingredient[];
  steps: Step[];
  image_url?: string | null;
  imageFile?: File | null;
}

export function PostForm({
  onSubmit,
  onSaveDraft,
  initialData,
  isSubmitting = false,
  isSavingDraft = false,
  submitLabel = '投稿する',
  submittingLabel = '投稿中...',
}: PostFormProps) {
  const [formData, setFormData] = React.useState<PostFormData>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    koji_type: initialData?.koji_type || '中華麹',
    difficulty: initialData?.difficulty || 'かんたん',
    ingredients: initialData?.ingredients || [{ name: '', amount: '' }],
    steps: initialData?.steps || [{ order: 1, description: '' }],
    image_url: initialData?.image_url ?? null,
    imageFile: null,
  });

  const [imagePreviewUrl, setImagePreviewUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const buildCleanData = (): PostFormData => {
    const validIngredients = formData.ingredients.filter((i) => i.name.trim() && i.amount.trim());
    const validSteps = formData.steps
      .filter((s) => s.description.trim())
      .map((s, index) => ({ ...s, order: index + 1 }));

    return {
      ...formData,
      ingredients: validIngredients,
      steps: validSteps,
      imageFile: formData.imageFile ?? null,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('タイトルを入力してください');
      return;
    }

    await onSubmit(buildCleanData());
  };

  const handleSaveDraft = async () => {
    if (!onSaveDraft) return;
    if (!formData.title.trim()) {
      alert('下書きを保存するにはタイトルを入力してください');
      return;
    }
    await onSaveDraft(buildCleanData());
  };

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (file: File | null) => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);

    if (!file) {
      setImagePreviewUrl(null);
      setFormData((prev) => ({ ...prev, imageFile: null }));
      return;
    }

    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
    setFormData((prev) => ({ ...prev, imageFile: file }));
  };

  const handleRemoveImage = () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    setFormData((prev) => ({ ...prev, imageFile: null, image_url: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addIngredient = () => {
    setFormData(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: '', amount: '' }],
    }));
  };

  const removeIngredient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  };

  const updateIngredient = (index: number, field: 'name' | 'amount', value: string) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) =>
        i === index ? { ...ing, [field]: value } : ing
      ),
    }));
  };

  const addStep = () => {
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, { order: prev.steps.length + 1, description: '' }],
    }));
  };

  const removeStep = (index: number) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 })),
    }));
  };

  const updateStep = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.map((step, i) =>
        i === index ? { ...step, description: value } : step
      ),
    }));
  };

  // 共通の入力フィールドスタイル
  const inputStyle = "w-full px-4 py-3 rounded-xl bg-surface border border-border/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 text-base placeholder:text-muted-foreground/50 transition-all shadow-sm";
  const textareaStyle = "w-full px-4 py-3 rounded-xl bg-surface border border-border/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 text-base leading-relaxed placeholder:text-muted-foreground/50 transition-all resize-none shadow-sm";

  return (
    <form onSubmit={handleSubmit} className="pb-8">
      {/* 写真セクション */}
      <div className="relative">
        <div className="aspect-[16/9] bg-muted/30 flex items-center justify-center overflow-hidden">
          {imagePreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagePreviewUrl} alt="プレビュー" className="h-full w-full object-cover" />
          ) : formData.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={formData.image_url} alt="写真" className="h-full w-full object-cover" />
          ) : (
            <div className="text-center">
              <Camera className="h-12 w-12 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground/60">写真を追加</p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
        />
        <div className="absolute bottom-4 right-4 flex gap-2">
          <button
            type="button"
            onClick={handlePickImage}
            className="h-10 px-4 rounded-full bg-surface/90 backdrop-blur-sm text-foreground text-sm font-medium shadow-md hover:bg-surface transition-colors"
          >
            写真を選択
          </button>
          {(imagePreviewUrl || formData.image_url) && (
            <button
              type="button"
              onClick={handleRemoveImage}
              className="h-10 w-10 rounded-full bg-surface/90 backdrop-blur-sm text-muted-foreground shadow-md hover:bg-surface hover:text-destructive transition-colors flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-6 space-y-8">
        {/* タイトル */}
        <div>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="レシピ名を入力"
            className="w-full text-xl font-bold bg-transparent border-0 border-b-2 border-border/50 focus:border-primary focus:outline-none pb-2 placeholder:text-muted-foreground/40 transition-colors"
            required
          />
        </div>

        {/* 説明 */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            説明
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="このレシピについて説明してください"
            rows={4}
            className={textareaStyle}
          />
        </div>

        {/* 麹の種類と難易度 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              麹の種類
            </label>
            <select
              value={formData.koji_type}
              onChange={(e) => setFormData(prev => ({ ...prev, koji_type: e.target.value }))}
              className={inputStyle}
            >
              <option value="中華麹">中華風こうじ</option>
              <option value="コンソメ麹">コンソメ風こうじ</option>
              <option value="たまねぎ麹">旨塩風こうじ</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              難易度
            </label>
            <select
              value={formData.difficulty}
              onChange={(e) => setFormData(prev => ({ ...prev, difficulty: e.target.value }))}
              className={inputStyle}
            >
              <option value="かんたん">かんたん</option>
              <option value="ふつう">ふつう</option>
              <option value="むずかしい">むずかしい</option>
            </select>
          </div>
        </div>

        {/* 材料 */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            材料
          </label>
          <div className="space-y-3">
            {formData.ingredients.map((ingredient, index) => (
              <div key={index} className="flex gap-2 items-center group">
                <div className="flex-1 flex gap-2 p-1 rounded-xl bg-surface border border-border/60 shadow-sm">
                  <input
                    type="text"
                    value={ingredient.name}
                    onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                    placeholder="材料名"
                    className="flex-1 px-3 py-2 bg-transparent border-0 focus:outline-none text-base placeholder:text-muted-foreground/50"
                  />
                  <div className="w-px bg-border my-1" />
                  <input
                    type="text"
                    value={ingredient.amount}
                    onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                    placeholder="分量"
                    className="w-24 px-3 py-2 bg-transparent border-0 focus:outline-none text-base text-right placeholder:text-muted-foreground/50"
                  />
                </div>
                {formData.ingredients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className="p-2 rounded-full hover:bg-muted transition-all text-muted-foreground hover:text-destructive"
                    aria-label="削除"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addIngredient}
              className="flex items-center gap-2 text-sm text-primary font-medium hover:text-primary/80 transition-colors pt-1"
            >
              <Plus className="h-4 w-4" />
              材料を追加
            </button>
          </div>
        </div>

        {/* 手順 */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            作り方
          </label>
          <div className="space-y-4">
            {formData.steps.map((step, index) => (
              <div key={index} className="flex gap-3 group">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mt-3 shadow-sm">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <textarea
                    value={step.description}
                    onChange={(e) => updateStep(index, e.target.value)}
                    placeholder={`手順${index + 1}を入力してください`}
                    rows={3}
                    className={textareaStyle}
                  />
                </div>
                {formData.steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    className="p-2 rounded-full hover:bg-muted transition-all text-muted-foreground hover:text-destructive self-start mt-3"
                    aria-label="削除"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addStep}
              className="flex items-center gap-2 text-sm text-primary font-medium hover:text-primary/80 transition-colors pt-1"
            >
              <Plus className="h-4 w-4" />
              手順を追加
            </button>
          </div>
        </div>

        {/* アクション */}
        <div className="pt-6 pb-4">
          {onSaveDraft ? (
            <div className="flex gap-3">
              <Button
                type="button"
                size="lg"
                tone="secondary"
                disabled={isSubmitting || isSavingDraft}
                className="flex-1 rounded-full"
                onClick={handleSaveDraft}
              >
                {isSavingDraft ? '保存中...' : '下書き保存'}
              </Button>
              <Button
                type="submit"
                size="lg"
                tone="primary"
                disabled={isSubmitting || isSavingDraft}
                className="flex-1 rounded-full"
              >
                {isSubmitting ? submittingLabel : submitLabel}
              </Button>
            </div>
          ) : (
            <Button
              type="submit"
              size="lg"
              tone="primary"
              disabled={isSubmitting}
              className="w-full rounded-full"
            >
              {isSubmitting ? submittingLabel : submitLabel}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
